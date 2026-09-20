/**
 * 处方与处置定性。
 *
 * 两组回归的由来（用户实测）：
 *   1. 处方用 `level !== 'ok'` 判断投影缓存，把 `skipped`（无从判定）也算成异常，
 *      于是对着「本门无从判定」的证据输出「投影缓存未对齐」，还建议隔离一条不存在的记录。
 *   2. 处置只隔离投影缓存记录，而异常可能来自会话日志（open step）——两者都是「异常」，
 *      旧 UI 只摆 before/after 两个档位，用户无法判断是处置失败还是处置与病灶无关。
 */
import { describe, expect, it } from 'vitest'
import { assessRepair, prescribe, type RepairOutcome } from '../src/host/health/repair.ts'
import type { GateLevel, SessionHealthReport } from '../src/host/health/gates.ts'

type GateId = SessionHealthReport['gates'][number]['id']

/** 造一份五门报告：未指定的门默认 ok。 */
function makeReport(
  level: GateLevel,
  gates: Partial<Record<GateId, GateLevel>>,
  evidence: Partial<Record<GateId, string>> = {},
  priority: SessionHealthReport['priority'] = 'normal',
): SessionHealthReport {
  const ids: GateId[] = ['generation', 'log-integrity', 'projection-cache', 'lossless-json', 'cold-read']
  return {
    sessionId: 'session-test',
    level,
    priority,
    generatedAt: 1,
    gates: ids.map(id => ({
      id,
      level: gates[id] ?? 'ok',
      evidence: evidence[id] ?? `${id} ok`,
    })),
  }
}

/** 造一个处置执行结果。 */
function makeOutcome(ok: boolean, error?: string): RepairOutcome {
  return {
    ok,
    action: 'quarantine-projection-cache',
    sessionId: 'session-test',
    from: '/tmp/x.json',
    ...(ok ? { to: '/tmp/x.json.quarantine-1' } : {}),
    ...(error === undefined ? {} : { error }),
  }
}

describe('处方：只对「有观测依据」的档位开方', () => {
  it('投影缓存 skipped → 不出现「未对齐」（回归：曾把无从判定当异常）', () => {
    const lines = prescribe(makeReport('ok', { 'projection-cache': 'skipped' }))
    expect(lines.join('\n')).not.toContain('未对齐')
    expect(lines.join('\n')).not.toContain('投影缓存异常')
  })

  it('投影缓存 warn → 开方', () => {
    const lines = prescribe(makeReport('warn', { 'projection-cache': 'warn' }, { 'projection-cache': '缓存滞后 3 个事件' }))
    expect(lines.join('\n')).toContain('投影缓存异常')
    expect(lines.join('\n')).toContain('缓存滞后 3 个事件')
    expect(lines.join('\n')).toContain('session-health-repair')
  })

  it('投影缓存 fail → 开方', () => {
    const lines = prescribe(makeReport('fail', { 'projection-cache': 'fail' }))
    expect(lines.join('\n')).toContain('投影缓存异常')
  })

  it('全部检查通过 → 提示全绿', () => {
    expect(prescribe(makeReport('ok', {}))).toEqual(['# 全部检查通过：无需处置'])
  })

  it('有 skipped 但无异常 → 说「无可处置项」，不说「全绿」', () => {
    // 「无从判定」不等于「已检查且通过」，混为一谈会让用户以为该门检查过了。
    const lines = prescribe(makeReport('ok', { 'lossless-json': 'skipped', 'projection-cache': 'skipped' }))
    const text = lines.join('\n')
    expect(text).toContain('无可处置项')
    expect(text).not.toContain('全部检查通过')
    expect(text).toContain('lossless-json')
  })

  it('cold-read fail → 提示等待宿主结算并声明不改日志', () => {
    const text = prescribe(makeReport('fail', { 'cold-read': 'fail' })).join('\n')
    expect(text).toContain('open step')
    expect(text).toContain('不要硬改日志')
  })
})

describe('处置定性', () => {
  const beforeFail = makeReport('fail', { 'cold-read': 'fail' })

  it('四门全绿 → nothing-to-do', () => {
    const ok = makeReport('ok', {})
    const result = assessRepair({ before: ok, after: ok, repair: makeOutcome(false, '记录不存在') })
    expect(result.verdict).toBe('nothing-to-do')
    expect(result.residual).toEqual([])
  })

  it('处置生效且异常消除 → repaired', () => {
    const result = assessRepair({
      before: makeReport('fail', { 'projection-cache': 'fail' }),
      after: makeReport('ok', { 'projection-cache': 'skipped' }),
      repair: makeOutcome(true),
    })
    expect(result.verdict).toBe('repaired')
    expect(result.explanation).toContain('处置生效')
  })

  it('处置生效但仍有无关异常 → repaired-with-residual，并点名残留门', () => {
    // 投影缓存被隔离了，但 cold-read 的 open step 依旧——必须讲清楚为什么还是异常。
    const result = assessRepair({
      before: makeReport('fail', { 'projection-cache': 'fail', 'cold-read': 'fail' }),
      after: beforeFail,
      repair: makeOutcome(true),
    })
    expect(result.verdict).toBe('repaired-with-residual')
    expect(result.explanation).toContain('cold-read')
    expect(result.explanation).toContain('不改会话日志')
    expect(result.residual).toEqual([{ id: 'cold-read', level: 'fail' }])
  })

  it('无可处置项（异常与投影缓存无关）→ not-applicable，不说「处置失败」', () => {
    // 本用例复现用户的截图场景：投影缓存 skipped，唯一 fail 是 cold-read。
    const result = assessRepair({
      before: beforeFail,
      after: beforeFail,
      repair: makeOutcome(false, '投影缓存记录不存在，无需隔离'),
    })
    expect(result.verdict).toBe('not-applicable')
    expect(result.explanation).toContain('无可逆处置项')
    expect(result.explanation).toContain('cold-read')
    expect(result.explanation).not.toContain('处置失败')
  })

  it('投影缓存本可处置但执行失败 → failed，带上原因', () => {
    const result = assessRepair({
      before: makeReport('fail', { 'projection-cache': 'fail' }),
      after: makeReport('fail', { 'projection-cache': 'fail' }),
      repair: makeOutcome(false, 'EPERM: permission denied'),
    })
    expect(result.verdict).toBe('failed')
    expect(result.explanation).toContain('EPERM')
  })

  it('skipped 不算残留（无从判定不是异常）', () => {
    const result = assessRepair({
      before: makeReport('warn', { 'projection-cache': 'warn' }),
      after: makeReport('ok', { 'projection-cache': 'skipped', 'lossless-json': 'skipped' }),
      repair: makeOutcome(true),
    })
    expect(result.verdict).toBe('repaired')
    expect(result.residual).toEqual([])
  })

  it('残留含 generation → 归因指向代次工具，而不是「等宿主结算」', () => {
    const result = assessRepair({
      before: makeReport('warn', { 'projection-cache': 'warn', generation: 'warn' }),
      after: makeReport('warn', { generation: 'warn' }),
      repair: makeOutcome(true),
    })
    expect(result.verdict).toBe('repaired-with-residual')
    expect(result.explanation).toContain('generation')
    expect(result.explanation).toContain('代次')
  })
})

describe('处方：代次异常', () => {
  /** 造一份带代次门 detail 的报告。 */
  function withGeneration(
    level: GateLevel,
    priority: SessionHealthReport['priority'],
    detail: Record<string, unknown>,
  ): SessionHealthReport {
    const report = makeReport(level, { generation: level }, {}, priority)
    report.gates = report.gates.map(gate => (gate.id === 'generation' ? { ...gate, detail } : gate))
    return report
  }

  it('当前代由暂存发布 → 按 detail 里的代次开方，不写死 v3', () => {
    // 回归：宿主把当前代升到 v4 后，写死 v3 的处方文本会说错。
    const text = prescribe(withGeneration('warn', 'high', { currentVersion: 4 })).join('\n')
    expect(text).toContain('代次异常')
    expect(text).toContain('当前代 v4')
    expect(text).toContain('high')
    expect(text).not.toContain('v3')
  })

  it('只有迁移暂存、当前代尚未发布 → 指向「先发布」而不是「等宿主结算」', () => {
    const text = prescribe(withGeneration('fail', 'high', {})).join('\n')
    expect(text).toContain('代次异常')
    expect(text).toContain('发布当前代')
  })

  it('代次门 fail 不会被当成「全部检查通过」', () => {
    expect(prescribe(withGeneration('fail', 'high', {})).join('\n')).not.toContain('全部检查通过')
  })

  it('代次门 ok 时不开方', () => {
    expect(prescribe(makeReport('ok', { generation: 'ok' }))).toEqual(['# 全部检查通过：无需处置'])
  })
})
