/**
 * 四个体检 gate（每个可独立测试）与报告聚合。
 *
 * 统一输出形状：`{ id, level, evidence, attribution, detail }`；
 * 聚合结果 `SessionHealthReport` 供「体检 → 处方 → 出院」三步流程使用。
 *
 * 只读：gate 不改任何会话数据；写操作只会出现在 repair（可逆、先备份）。
 */
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { decodeSessionLogFile, type SessionLogRead } from './decode.ts'
import { firstLosslessViolation, type LosslessViolation } from './lossless.ts'

/**
 * gate 严重级。
 *
 * 判定标准（新增 gate 必须遵守）：
 * - `ok`：判定通过；
 * - `warn`：**观测到了**异常现象，但尚不致命（必须有可复现的观测依据）；
 * - `fail`：观测到硬损坏，判定不通过；
 * - `skipped`：**无从观测/无从判定**（冷态会话没有热态投影、缓存记录尚未生成、
 *   日志里没有 turn/end 可判）——中性档，不抬升会话总判。
 *
 * 关键区分：把「无法判定」记成 `warn` 是错的。那会让所有无从观测的会话恒为
 * 「注意」，真信号被淹没（实测事故：30 条会话全标「注意」）。
 * 无从观测 ⇒ `skipped`，有观测依据 ⇒ `warn`。
 */
export type GateLevel = 'ok' | 'warn' | 'fail' | 'skipped'

/** 归属信息：把失败字段指回具体插件包与字段路径。 */
export interface GateAttribution {
  /** 投影 key（例如 liveTokenStats）。 */
  projection?: string
  /** 所属包名；无法判定时为 'unknown'。 */
  package?: string
  /** 违规字段路径。 */
  field?: string
}

/** 一个 gate 的结果。 */
export interface GateResult {
  id: 'log-integrity' | 'projection-cache' | 'lossless-json' | 'cold-read'
  level: GateLevel
  evidence: string
  attribution?: GateAttribution
  detail?: Record<string, unknown>
}

/** 单会话体检报告。 */
export interface SessionHealthReport {
  sessionId: string
  level: GateLevel
  gates: GateResult[]
  generatedAt: number
}

/** gate 输入。 */
export interface GateContext {
  sessionId: string
  /** DSH home（缺省 ~/.dsh）。 */
  dshHome?: string
  /** 会话日志路径；缺省由调用方解析后传入。 */
  logPath?: string
  /** 已解码的日志（复用，避免重复解码）。 */
  log?: SessionLogRead
  /** 热态：宿主 `sessionProjections.checkpoint(session)` 的逐行状态。 */
  projectionState?: Record<string, unknown>
  /** 归属查询函数（投影 key → 包名）。 */
  attribute?: (projection: string) => GateAttribution | undefined
  /** 时间源（测试可控）。 */
  now?: () => number
}

/** 由日志读取结果推导的尾部事实。 */
export interface TailFacts {
  lastSeq: number
  lastEventType: string
  lastTurnEnd?: { turn: number; reason: string }
  openStep?: { turn: number; step: number }
  assistantAfterLastUser: boolean
}

/** 从解码事件推导尾部事实。 */
export function readTailFacts(log: SessionLogRead): TailFacts {
  const events = log.events
  let lastTurnEnd: { turn: number; reason: string } | undefined
  let lastUserIndex = -1
  let assistantAfterLastUser = false
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]
    if (event === undefined) continue
    if (event.type === 'user/message') {
      lastUserIndex = index
      assistantAfterLastUser = false
      continue
    }
    if (event.type === 'assistant/message' && index > lastUserIndex) assistantAfterLastUser = true
    if (event.type === 'turn/end') {
      const data = event.data as { turn?: unknown; reason?: { kind?: unknown } } | undefined
      lastTurnEnd = {
        turn: typeof data?.turn === 'number' ? data.turn : -1,
        reason: typeof data?.reason?.kind === 'string' ? data.reason.kind : 'unknown',
      }
    }
  }
  const last = events.at(-1)
  return {
    lastSeq: last?.seq ?? -1,
    lastEventType: last?.type ?? '',
    ...(lastTurnEnd === undefined ? {} : { lastTurnEnd }),
    ...(log.openStep === undefined ? {} : { openStep: log.openStep }),
    assistantAfterLastUser,
  }
}

/** gate 1：日志完整性（可解码、seq 连续、无撕裂尾帧）。 */
export function gateLogIntegrity(log: SessionLogRead): GateResult {
  if (log.issues.length > 0) {
    const first = log.issues[0]
    return {
      id: 'log-integrity',
      level: 'fail',
      evidence: `日志读取失败：line ${first?.line ?? '?'} ${first?.why ?? ''}（共 ${log.issues.length} 条问题）`,
      detail: { issues: log.issues.slice(0, 5), frames: log.frames, decoder: log.decoder },
    }
  }
  if (log.tornStart !== undefined) {
    return {
      id: 'log-integrity',
      level: 'warn',
      evidence: `存在撕裂尾帧（offset ${log.tornStart}，抢救 ${log.recoveredFromTorn} 字节）；提交前缀已保留`,
      detail: { frames: log.frames, decodedEvents: log.events.length, decoder: log.decoder },
    }
  }
  return {
    id: 'log-integrity',
    level: 'ok',
    evidence: `解码正常：${log.frames} 帧 / ${log.events.length} 事件，seq 连续，无撕裂尾帧（decoder=${log.decoder}）`,
    detail: { frames: log.frames, decodedEvents: log.events.length, decoder: log.decoder },
  }
}

/** 投影缓存行的体检事实。 */
export interface ProjectionCacheFacts {
  present: boolean
  path: string
  cacheSeq?: number
  rows?: number
  lag?: number
  unsettled: string[]
  error?: string
}

/** 读取投影缓存记录并计算滞后与未结算字段。 */
export function readProjectionCache(sessionId: string, logLastSeq: number, dshHome?: string): ProjectionCacheFacts {
  const path = join(
    dshHome ?? join(homedir(), '.dsh'),
    'storages',
    'session_projcache',
    'sessions',
    `${sessionId}.json`,
  )
  if (!existsSync(path)) return { present: false, path, unsettled: [] }
  let record: { rows?: Record<string, { seq?: number; val?: unknown }> }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { record?: typeof record }
    record = parsed.record ?? {}
  } catch (err) {
    return { present: true, path, unsettled: [], error: `缓存记录不可解析：${String(err instanceof Error ? err.message : err)}` }
  }
  const rows = record.rows ?? {}
  const seqs = Object.values(rows).map(row => row.seq).filter((seq): seq is number => typeof seq === 'number')
  const cacheSeq = seqs.length > 0 ? Math.min(...seqs) : undefined
  const unsettled: string[] = []
  const sessionStats = rows['sessionStats']?.val as { openStep?: unknown } | undefined
  if (sessionStats?.openStep !== undefined && sessionStats.openStep !== null) {
    unsettled.push(`sessionStats.openStep=${JSON.stringify(sessionStats.openStep)}`)
  }
  const live = rows['liveTokenStats']?.val as { activeStep?: { active?: unknown } } | undefined
  if (live?.activeStep?.active !== undefined && live.activeStep.active !== null) {
    unsettled.push(`liveTokenStats.activeStep.active=${JSON.stringify(live.activeStep.active)}`)
  }
  const subagent = rows['subagentTiming']?.val as { pendingTurnStart?: unknown } | undefined
  if (subagent?.pendingTurnStart !== undefined) unsettled.push(`subagentTiming.pendingTurnStart=${String(subagent.pendingTurnStart)}`)
  const boundary = rows['turnBoundary']?.val as { lastStepBoundary?: { kind?: unknown } } | undefined
  if (boundary?.lastStepBoundary?.kind === 'start') unsettled.push('turnBoundary.lastStepBoundary.kind=start')
  return {
    present: true,
    path,
    ...(cacheSeq === undefined ? {} : { cacheSeq }),
    rows: Object.keys(rows).length,
    ...(cacheSeq === undefined ? {} : { lag: logLastSeq - cacheSeq }),
    unsettled,
  }
}

/** gate 2：投影缓存水位与结算形态。 */
export function gateProjectionCache(facts: ProjectionCacheFacts): GateResult {
  if (facts.error !== undefined) {
    return { id: 'projection-cache', level: 'warn', evidence: facts.error, detail: { path: facts.path } }
  }
  if (!facts.present) {
    // 「记录不存在」是**无从判定**而非「观测到异常」：宿主会在下次检查点重建，
    // 短时缺失属正常。记为 warn 会让所有尚无缓存的会话恒为「注意」（同 lossless 门缺陷）。
    return {
      id: 'projection-cache',
      level: 'skipped',
      evidence: '投影缓存记录不存在，本门无从判定（宿主会在下次检查点重建；若长期不出现说明检查点写入被拒）',
      detail: { path: facts.path },
    }
  }
  const lag = facts.lag ?? 0
  const unsettled = facts.unsettled
  const detail = { path: facts.path, cacheSeq: facts.cacheSeq, rows: facts.rows, lag, unsettled }
  if (lag > 0 && unsettled.length > 0) {
    return {
      id: 'projection-cache',
      level: 'fail',
      evidence: `缓存落后日志 ${lag} 个事件且仍残留未结算字段：${unsettled.join('; ')}`,
      detail,
    }
  }
  if (lag > 0 || unsettled.length > 0) {
    return {
      id: 'projection-cache',
      level: 'warn',
      evidence: `缓存滞后 ${lag} 个事件${unsettled.length > 0 ? `；未结算字段：${unsettled.join('; ')}` : ''}`,
      detail,
    }
  }
  return { id: 'projection-cache', level: 'ok', evidence: `缓存与日志对齐（seq ${facts.cacheSeq ?? '?'}），无未结算残留`, detail }
}

/** gate 3：投影状态的无损 JSON 判定（本次事故核心）。 */
export function gateLosslessJson(
  projectionState: Record<string, unknown> | undefined,
  attribute?: (projection: string) => GateAttribution | undefined,
): GateResult {
  if (projectionState === undefined) {
    return {
      id: 'lossless-json',
      level: 'skipped',
      evidence: '拿不到热态投影状态（宿主未暴露 sessionProjections）；冷态记录经 JSON 往返必然无损，本门无从判定',
    }
  }
  const keys = Object.keys(projectionState)
  if (keys.length === 0) {
    return { id: 'lossless-json', level: 'skipped', evidence: '热态投影状态为空，本门无从判定' }
  }
  for (const key of keys) {
    const row = projectionState[key] as { val?: unknown } | undefined
    const value = row !== undefined && typeof row === 'object' && 'val' in row ? row.val : row
    const violation: LosslessViolation | undefined = firstLosslessViolation(value)
    if (violation === undefined) continue
    const owned = attribute?.(key)
    return {
      id: 'lossless-json',
      level: 'fail',
      evidence: `投影 ${key} 状态不是无损 JSON：${violation.path} 为 ${violation.actual}（${violation.reason}）`,
      attribution: {
        projection: key,
        package: owned?.package ?? 'unknown',
        field: violation.path,
      },
      detail: { projection: key, violation, rows: keys.length },
    }
  }
  return { id: 'lossless-json', level: 'ok', evidence: `全部 ${keys.length} 行投影状态均为无损 JSON`, detail: { rows: keys.length } }
}

/** gate 4：冷读成本与可接续性。 */
export function gateColdRead(facts: TailFacts): GateResult {
  const detail = {
    lastSeq: facts.lastSeq,
    lastEventType: facts.lastEventType,
    lastTurnEnd: facts.lastTurnEnd,
    openStep: facts.openStep,
    assistantAfterLastUser: facts.assistantAfterLastUser,
  }
  if (facts.openStep !== undefined) {
    return {
      id: 'cold-read',
      level: 'fail',
      evidence: `存在未收尾的 open step（turn ${facts.openStep.turn}/step ${facts.openStep.step}），无法原地接续`,
      detail,
    }
  }
  if (facts.lastTurnEnd === undefined) {
    // 日志里没有 turn/end：可能是尚未完成首轮的空会话（无害），也可能是日志被截断。
    // 本门区分不了 → 无从判定。日志损坏由 gate 1（撕裂帧/解码）负责，不在本门断言。
    return { id: 'cold-read', level: 'skipped', evidence: '日志中没有 turn/end，本门无从确认是否存在可接续的已完成轮次', detail }
  }
  if (facts.lastTurnEnd.reason !== 'completed') {
    return {
      id: 'cold-read',
      level: 'warn',
      evidence: `最后一轮以 ${facts.lastTurnEnd.reason} 结束（非 completed）；可 fork 到该轮结束处`,
      detail,
    }
  }
  return { id: 'cold-read', level: 'ok', evidence: `最后一轮 completed 结束，会话可原地接续（末 seq ${facts.lastSeq}）`, detail }
}

/** 聚合四门结果为一份报告。 */
export function buildSessionReport(context: GateContext): SessionHealthReport {
  const log = context.log ?? (context.logPath === undefined
    ? undefined
    : decodeSessionLogFile(context.logPath))
  const gates: GateResult[] = []
  if (log === undefined) {
    gates.push({ id: 'log-integrity', level: 'fail', evidence: '未提供日志读取结果或日志路径' })
  } else {
    gates.push(gateLogIntegrity(log))
    const tail = readTailFacts(log)
    gates.push(gateProjectionCache(readProjectionCache(context.sessionId, tail.lastSeq, context.dshHome)))
    gates.push(gateLosslessJson(context.projectionState, context.attribute))
    gates.push(gateColdRead(tail))
  }
  // 总判聚合：fail > warn > ok。`skipped` 有意不参与——它是「本门无从判定」的
  // 中性档，既非通过也非异常，抬升总判会把冷态会话全变成「注意」（实测噪声源）。
  const level: GateLevel = gates.some(gate => gate.level === 'fail')
    ? 'fail'
    : gates.some(gate => gate.level === 'warn') ? 'warn' : 'ok'
  return {
    sessionId: context.sessionId,
    level,
    gates,
    generatedAt: (context.now ?? Date.now)(),
  }
}
