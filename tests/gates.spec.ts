import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  buildSessionReport,
  gateColdRead,
  gateLogIntegrity,
  gateLosslessJson,
  gateProjectionCache,
  readProjectionCache,
  readTailFacts,
} from '../src/host/health/gates.ts'
import type { DecodedEvent, SessionLogRead } from '../src/host/health/decode.ts'

/** 造一份「看起来正常」的解码结果。 */
function healthyLog(): SessionLogRead {
  const events: DecodedEvent[] = [
    { type: 'permission/preset', seq: 0, time: 1, data: {} },
    { type: 'turn/start', seq: 1, time: 2, data: { turn: 1 } },
    { type: 'step/start', seq: 2, time: 3, data: { turn: 1, step: 1 } },
    { type: 'user/message', seq: 3, time: 4, data: {} },
    { type: 'assistant/message', seq: 4, time: 5, data: {} },
    { type: 'step/end', seq: 5, time: 6, data: { turn: 1, step: 1 } },
    { type: 'turn/end', seq: 6, time: 7, data: { turn: 1, reason: { kind: 'completed' } } },
    { type: 'session/end-seed', seq: 7, time: 8, data: {} },
  ]
  return { events, frames: 2, recoveredFromTorn: 0, issues: [], decoder: 'local' }
}

describe('gate 1：日志完整性', () => {
  it('解码正常 → ok', () => {
    const gate = gateLogIntegrity(healthyLog())
    expect(gate.level).toBe('ok')
  })

  it('seq 缺口 → fail 且带首条问题', () => {
    const log = healthyLog()
    log.issues.push({ line: 9, why: 'seq gap (expected 8, got 12)' })
    const gate = gateLogIntegrity(log)
    expect(gate.level).toBe('fail')
    expect(gate.evidence).toContain('seq gap')
  })

  it('撕裂尾帧但可抢救 → warn', () => {
    const log = healthyLog()
    const torn: SessionLogRead = { ...log, tornStart: 4096, recoveredFromTorn: 128 }
    expect(gateLogIntegrity(torn).level).toBe('warn')
  })
})

describe('gate 2：投影缓存水位与结算形态', () => {
  let home = ''
  const withCache = (sessionId: string, body: unknown): void => {
    const dir = join(home, 'storages', 'session_projcache', 'sessions')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, `${sessionId}.json`), JSON.stringify(body), 'utf8')
  }
  beforeAll(() => { home = mkdtempSync(join(tmpdir(), 'steward-cache-')) })
  afterAll(() => { rmSync(home, { recursive: true, force: true }) })

  it('记录缺失 → warn（提示可能被拒写）', () => {
    const facts = readProjectionCache('session-missing', 10, home)
    expect(facts.present).toBe(false)
    expect(gateProjectionCache(facts).level).toBe('warn')
  })

  it('水位对齐且无未结算字段 → ok', () => {
    withCache('session-ok', { record: { rows: { title: { seq: 7, val: 'x' }, sessionStats: { seq: 7, val: { turns: 1 } } } } })
    const facts = readProjectionCache('session-ok', 7, home)
    expect(facts.lag).toBe(0)
    expect(facts.unsettled).toEqual([])
    expect(gateProjectionCache(facts).level).toBe('ok')
  })

  it('滞后 + 未结算字段 → fail（本次事故形态）', () => {
    withCache('session-bad', {
      record: {
        rows: {
          title: { seq: 100, val: 'x' },
          sessionStats: { seq: 100, val: { openStep: { turn: 2, step: 3 } } },
          liveTokenStats: { seq: 100, val: { activeStep: { active: { turn: 2, step: 3 } } } },
          subagentTiming: { seq: 100, val: { pendingTurnStart: 123 } },
          turnBoundary: { seq: 100, val: { lastStepBoundary: { kind: 'start', seq: 9 } } },
        },
      },
    })
    const facts = readProjectionCache('session-bad', 229, home)
    expect(facts.lag).toBe(129)
    expect(facts.unsettled.length).toBe(4)
    const gate = gateProjectionCache(facts)
    expect(gate.level).toBe('fail')
    expect(gate.evidence).toContain('缓存落后日志 129 个事件')
  })

  it('记录不可解析 → warn（不抛错）', () => {
    const dir = join(home, 'storages', 'session_projcache', 'sessions')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'session-broken.json'), '{not json', 'utf8')
    const facts = readProjectionCache('session-broken', 5, home)
    expect(facts.error).toContain('不可解析')
    expect(gateProjectionCache(facts).level).toBe('warn')
  })
})

describe('gate 3：无损 JSON（核心）', () => {
  it('全部行无损 → ok', () => {
    const gate = gateLosslessJson({ title: { val: 'x' }, sessionStats: { val: { turns: 2 } } })
    expect(gate.level).toBe('ok')
  })

  it('命中 undefined 值键 → fail，并带投影/包/字段归属', () => {
    const state = {
      title: { val: 'x' },
      liveTokenStats: { val: { activeStep: { lastSettled: { actualTokens: undefined as unknown as number } } } },
    }
    const gate = gateLosslessJson(state, (projection) =>
      projection === 'liveTokenStats' ? { projection, package: 'dsh-live-token-stats' } : { projection, package: 'unknown' })
    expect(gate.level).toBe('fail')
    expect(gate.attribution?.projection).toBe('liveTokenStats')
    expect(gate.attribution?.package).toBe('dsh-live-token-stats')
    expect(gate.attribution?.field).toBe('.activeStep.lastSettled.actualTokens')
  })

  it('无归属信息时如实标 unknown', () => {
    const gate = gateLosslessJson({ mystery: { val: { x: undefined } } })
    expect(gate.attribution?.package).toBe('unknown')
  })

  it('拿不到热态状态 → warn（冷态无法判定无损性）', () => {
    const gate = gateLosslessJson(undefined)
    expect(gate.level).toBe('warn')
    expect(gate.evidence).toContain('冷态')
  })
})

describe('gate 4：可接续性', () => {
  it('最后一轮 completed → ok', () => {
    expect(gateColdRead(readTailFacts(healthyLog())).level).toBe('ok')
  })

  it('存在未收尾 open step → fail', () => {
    const log = healthyLog()
    const withOpen: SessionLogRead = {
      ...log,
      events: [...log.events, { type: 'step/start', seq: 8, time: 9, data: { turn: 2, step: 1 } }],
      openStep: { turn: 2, step: 1 },
    }
    const gate = gateColdRead(readTailFacts(withOpen))
    expect(gate.level).toBe('fail')
    expect(gate.evidence).toContain('open step')
  })

  it('最后一轮 interrupted → warn', () => {
    const events = healthyLog().events.map(event =>
      event.type === 'turn/end' ? { ...event, data: { turn: 1, reason: { kind: 'interrupted' } } } : event)
    const gate = gateColdRead(readTailFacts({ ...healthyLog(), events }))
    expect(gate.level).toBe('warn')
    expect(gate.evidence).toContain('interrupted')
  })

  it('没有 turn/end → warn', () => {
    const events = healthyLog().events.filter(event => event.type !== 'turn/end')
    expect(gateColdRead(readTailFacts({ ...healthyLog(), events })).level).toBe('warn')
  })
})

describe('报告聚合', () => {
  it('任一 fail 即 fail；否则有 warn 即 warn', () => {
    const report = buildSessionReport({ sessionId: 's1', log: healthyLog(), now: () => 42 })
    expect(report.gates).toHaveLength(4)
    expect(report.level).toBe('warn') // 无热态投影状态 → lossless gate 为 warn
    expect(report.generatedAt).toBe(42)
  })

  it('缺日志路径且缺解码结果 → fail', () => {
    const report = buildSessionReport({ sessionId: 's2', now: () => 1 })
    expect(report.level).toBe('fail')
    expect(report.gates[0]?.id).toBe('log-integrity')
  })
})
