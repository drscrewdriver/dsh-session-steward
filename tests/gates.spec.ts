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

  it('记录缺失 → skipped（无从判定，不是「注意」）', () => {
    // 曾经断言 warn：所有尚无缓存的会话都会恒为「注意」（宿主会在下次检查点重建，
    // 短时缺失属正常）。无从观测 ⇒ skipped，不是 warn。
    const facts = readProjectionCache('session-missing', 10, home)
    expect(facts.present).toBe(false)
    expect(gateProjectionCache(facts).level).toBe('skipped')
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

  it('拿不到热态状态 → skipped（冷态无从判定，不是「注意」）', () => {
    // 曾经断言 warn：冷态会话没有热态投影可查，「无法判定」被记成「注意」后
    // 全部未加载会话恒为 warn，信号淹没在噪声里（实测事故）。中性档才是如实表达。
    const gate = gateLosslessJson(undefined)
    expect(gate.level).toBe('skipped')
    expect(gate.evidence).toContain('冷态')
  })

  it('热态投影为空 → skipped（无可判定行，同样不是「注意」）', () => {
    expect(gateLosslessJson({}).level).toBe('skipped')
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

  it('没有 turn/end → skipped（无从确认，不是「注意」）', () => {
    // 空会话（尚未完成首轮）无害，截断日志由 gate 1 负责；本门区分不了 ⇒ skipped。
    const events = healthyLog().events.filter(event => event.type !== 'turn/end')
    expect(gateColdRead(readTailFacts({ ...healthyLog(), events })).level).toBe('skipped')
  })
})

describe('报告聚合', () => {
  it('冷态会话 → ok：skipped 不抬升总判（回归：曾全量误报「注意」）', () => {
    // 未加载的会话既无热态投影、也无投影缓存记录 → 两门 skipped。
    // 修复前这两门记 warn，导致**所有**未加载会话恒为「注意」，信号淹没。
    const report = buildSessionReport({ sessionId: 's1', log: healthyLog(), now: () => 42 })
    expect(report.gates).toHaveLength(5)
    expect(report.gates.filter(gate => gate.level === 'skipped').length).toBeGreaterThan(0)
    expect(report.gates.some(gate => gate.level === 'warn')).toBe(false)
    expect(report.level).toBe('ok')
    expect(report.generatedAt).toBe(42)
  })

  it('有观测依据的异常仍抬升为 warn（撕裂帧）', () => {
    const torn: SessionLogRead = { ...healthyLog(), tornStart: 4096, recoveredFromTorn: 128 }
    const report = buildSessionReport({ sessionId: 's-torn', log: torn })
    expect(report.gates.find(gate => gate.id === 'log-integrity')?.level).toBe('warn')
    expect(report.level).toBe('warn')
  })

  it('缺日志路径且缺解码结果 → fail', () => {
    const report = buildSessionReport({ sessionId: 's2', now: () => 1 })
    expect(report.level).toBe('fail')
    // 代次门恒在首位：它断言的是「读的是哪一份产物」，是后面所有门的前提。
    expect(report.gates[0]?.id).toBe('generation')
    expect(report.gates[1]?.id).toBe('log-integrity')
  })

  it('未提供代次事实 → 代次门 skipped、优先级 normal（无据不主张）', () => {
    const report = buildSessionReport({ sessionId: 's3', log: healthyLog() })
    expect(report.gates.find(gate => gate.id === 'generation')?.level).toBe('skipped')
    expect(report.priority).toBe('normal')
  })
})
