/**
 * 批量体检：枚举会话日志、跑门、给出汇总（供 `session-health-scan` 使用）。
 *
 * 只读；不激活任何 Agent，也不写任何会话数据。为控制成本，默认限制单次扫描的
 * 会话数与并发度，并支持 `limit` / `since` 过滤。
 *
 * **发现按代次而不是按固定文件名。** 一个会话目录的当前日志名由目录实测的最高
 * 代次决定（见 `generation.ts`）：历史代是 `session.jsonl.zstd`，已发布的当前代
 * 是 `session.v<N>.jsonl.zstd`。早期版本在这里写死 `session.jsonl.zstd`，于是
 * 61 个只留当前代的会话**一条都发现不了** —— 既扫不到，`findSessionLog` 也返回
 * undefined，连 `session-health-repair` 都会先报「未找到会话日志」。
 */
import { existsSync, readdirSync, type Dirent } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  latestArtifactMtime,
  readSessionGenerations,
  sessionPriority,
  type SessionGenerations,
  type SessionPriority,
} from './generation.ts'
import { buildSessionReport, type GateContext, type SessionHealthReport } from './gates.ts'

/** 一个已发现的会话。 */
export interface DiscoveredSession {
  sessionId: string
  /** 承载日志的代次目录。 */
  dir: string
  /**
   * 当前代日志路径。
   *
   * 目录内只有迁移暂存（尚未发布当前代）时为 undefined —— 该会话确实存在，
   * 但没有可读的规范产物，由 `generation` / `log-integrity` 两门如实报出，
   * 而不是当作「没有这个会话」。
   */
  logPath?: string
  /** 代次事实（当前代 / 历史代 / 暂存残留）。 */
  generations: SessionGenerations
  /** 处置优先级：`high` = 当前代是从暂存（TMP）发布出来的。 */
  priority: SessionPriority
  updatedAt: number
  bytes: number
}

/** 会话根目录（`<dshHome>/sessions/<project>/<sessionId>/`）。 */
export function sessionsRoot(dshHome?: string): string {
  return join(dshHome ?? join(homedir(), '.dsh'), 'sessions')
}

/**
 * 语料枚举上限。
 *
 * 这是防御无界遍历的**边界**，不是策略：早期版本写 200，实测语料 449 个会话时
 * 它静默截掉了一半（体检进度分母恒为 200，末 249 个会话永远扫不到）。
 */
const DISCOVERY_LIMIT = 100_000

/**
 * 枚举全部会话（按 mtime 倒序），带可选上限。
 *
 * 「是会话目录」的判据是**目录里有规范代次产物或迁移暂存**，不要求任何具体文件名。
 * @param dshHome - DSH home（缺省 ~/.dsh）。
 * @param limit - 返回上限（缺省 `DISCOVERY_LIMIT`）。
 */
export function discoverSessions(dshHome?: string, limit = DISCOVERY_LIMIT): DiscoveredSession[] {
  const root = sessionsRoot(dshHome)
  const out: DiscoveredSession[] = []
  if (!existsSync(root)) return out
  const stack: string[] = [root]
  while (stack.length > 0) {
    const dir = stack.pop()
    if (dir === undefined) continue
    let entries: Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const path = join(dir, entry.name)
      const generations = readSessionGenerations(path)
      if (generations.canonical.length === 0 && generations.staging.length === 0) {
        stack.push(path)
        continue
      }
      const current = generations.current
      out.push({
        sessionId: entry.name,
        dir: path,
        ...(current === undefined ? {} : { logPath: current.path }),
        generations,
        priority: sessionPriority(generations),
        updatedAt: latestArtifactMtime(generations) ?? 0,
        bytes: current?.bytes ?? 0,
      })
    }
  }
  out.sort((left, right) => right.updatedAt - left.updatedAt)
  return out.slice(0, Math.max(1, limit))
}

/**
 * 语料总数：只做目录枚举，**不跑体检**。
 *
 * 用于判断缓存是否已过期——枚举很便宜，而重扫要解 zstd、跑门。
 * 正因为两者代价差着量级，「对账」才不构成缓存失效策略本身。
 * @param dshHome - DSH home（缺省 ~/.dsh）。
 */
export function countCorpus(dshHome?: string): number {
  return discoverSessions(dshHome, DISCOVERY_LIMIT).length
}

/** 按 id 定位一个会话（跨工程目录查找）。 */
export function findSession(sessionId: string, dshHome?: string): DiscoveredSession | undefined {
  return discoverSessions(dshHome, DISCOVERY_LIMIT).find(session => session.sessionId === sessionId)
}

/**
 * 定位一个会话的**当前代**日志路径（跨工程目录查找）。
 *
 * 返回 undefined 有两种含义，调用方必须区分：会话不存在，或会话存在但尚未发布
 * 当前代（只有迁移暂存）。需要区分时用 `findSession`。
 * @param sessionId - 会话 id。
 * @param dshHome - DSH home（缺省 ~/.dsh）。
 */
export function findSessionLog(sessionId: string, dshHome?: string): string | undefined {
  return findSession(sessionId, dshHome)?.logPath
}

/** 扫描结果。 */
export interface HealthScanResult {
  ok: boolean
  /** 本批实际体检的会话数（已访问数，不受 onlyProblems 过滤影响）。 */
  scanned: number
  /**
   * 语料总数（进度分母）。分批调用时每批都拿到同一个值，客户端据此算
   * `已访问 = offset + scanned` / `total`，宿主无需持有跨请求状态。
   */
  total: number
  /** 本批在语料中的起点（原样回显，便于客户端对账）。 */
  offset: number
  findings: SessionHealthReport[]
  /** 仅保留非 ok 的报告时使用。 */
  filtered?: boolean
  error?: string
}

/** 未显式传 limit 时的单批会话数。 */
const DEFAULT_BATCH_LIMIT = 50

/**
 * 批量体检（支持分批）。
 *
 * 语料先整体列出（按 mtime 倒序，≤ DISCOVERY_LIMIT），再按 `[offset, offset+limit)`
 * 切片扫描。这样客户端可以用小批次连续调用、自己累计真实进度，而宿主保持无状态
 * ——不必把同步循环改成异步，也不必新增进度轮询端点。
 *
 * 批内**命中顺序**按处置优先级排（`high` 在前，稳定排序）。分批切片仍按 mtime，
 * 所以 offset/total 的算术不受影响：只有同一批里的呈现顺序变了。
 * @param options - dshHome / 批大小 / 批起点 / 是否只返回非 ok / 归属查询 / 热态状态提供者。
 */
export function scanSessions(options: {
  dshHome?: string
  limit?: number
  offset?: number
  onlyProblems?: boolean
  attribute?: GateContext['attribute']
  projectionStateFor?: (sessionId: string) => Record<string, unknown> | undefined
  now?: () => number
}): HealthScanResult {
  const discovered = discoverSessions(options.dshHome, DISCOVERY_LIMIT)
  if (discovered.length === 0) {
    return {
      ok: false,
      scanned: 0,
      total: 0,
      offset: 0,
      findings: [],
      error: '未发现任何会话日志（检查 DSH home 与 sessions 目录）',
    }
  }
  const offset = Math.max(0, Math.floor(options.offset ?? 0))
  const limit = Math.max(1, Math.floor(options.limit ?? DEFAULT_BATCH_LIMIT))
  const batch = discovered.slice(offset, offset + limit)
  const findings: SessionHealthReport[] = []
  for (const session of batch) {
    const projectionState = options.projectionStateFor?.(session.sessionId)
    const report = buildSessionReport({
      sessionId: session.sessionId,
      ...(options.dshHome === undefined ? {} : { dshHome: options.dshHome }),
      ...(session.logPath === undefined ? {} : { logPath: session.logPath }),
      generations: session.generations,
      ...(projectionState === undefined ? {} : { projectionState }),
      ...(options.attribute === undefined ? {} : { attribute: options.attribute }),
      ...(options.now === undefined ? {} : { now: options.now }),
    })
    if (options.onlyProblems === true && report.level === 'ok') continue
    findings.push(report)
  }
  // 「从 TMP 移出来」的会话排在最前：它们是本插件此前读错产物（历史代）或
  // 完全发现不了的会话，先看到才能先处置。
  findings.sort((left, right) => (left.priority === right.priority ? 0 : left.priority === 'high' ? -1 : 1))
  return {
    ok: true,
    scanned: batch.length,
    total: discovered.length,
    offset,
    findings,
    ...(options.onlyProblems === true ? { filtered: true } : {}),
  }
}
