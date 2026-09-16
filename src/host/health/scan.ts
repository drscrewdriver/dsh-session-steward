/**
 * 批量体检：枚举会话日志、跑四门、给出汇总（供 `session-health-scan` 使用）。
 *
 * 只读；不激活任何 Agent，也不写任何会话数据。为控制成本，默认限制单次扫描的
 * 会话数与并发度，并支持 `limit` / `since` 过滤。
 */
import { existsSync, readdirSync, statSync, type Dirent } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { buildSessionReport, type GateContext, type SessionHealthReport } from './gates.ts'

/** 一个已发现的会话日志。 */
export interface DiscoveredSession {
  sessionId: string
  logPath: string
  updatedAt: number
  bytes: number
}

/** 会话根目录（`<dshHome>/sessions/<project>/<sessionId>/session.jsonl.zstd`）。 */
export function sessionsRoot(dshHome?: string): string {
  return join(dshHome ?? join(homedir(), '.dsh'), 'sessions')
}

/** 枚举全部会话日志（按 mtime 倒序），带可选上限。 */
export function discoverSessions(dshHome?: string, limit = 200): DiscoveredSession[] {
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
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        const candidate = join(path, 'session.jsonl.zstd')
        if (existsSync(candidate)) {
          let stats: { mtimeMs: number; size: number }
          try {
            const stat = statSync(candidate)
            stats = { mtimeMs: stat.mtimeMs, size: stat.size }
          } catch {
            continue
          }
          out.push({ sessionId: entry.name, logPath: candidate, updatedAt: stats.mtimeMs, bytes: stats.size })
          continue
        }
        stack.push(path)
      }
    }
  }
  out.sort((left, right) => right.updatedAt - left.updatedAt)
  return out.slice(0, Math.max(1, limit))
}

/**
 * 语料总数：只做目录枚举，**不跑体检**。
 *
 * 用于判断缓存是否已过期——枚举很便宜，而重扫要解 zstd、跑四门。
 * 正因为两者代价差着量级，「对账」才不构成缓存失效策略本身。
 * @param dshHome - DSH home（缺省 ~/.dsh）。
 */
export function countCorpus(dshHome?: string): number {
  return discoverSessions(dshHome, DISCOVERY_LIMIT).length
}

/** 定位一个会话的日志路径（跨工程目录查找）。 */
export function findSessionLog(sessionId: string, dshHome?: string): string | undefined {
  return discoverSessions(dshHome, 100_000).find(session => session.sessionId === sessionId)?.logPath
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

/** 语料枚举上限（进度分母的来源；与 route 侧 MAX_SCAN_LIMIT 同量级）。 */
const DISCOVERY_LIMIT = 200

/** 未显式传 limit 时的单批会话数。 */
const DEFAULT_BATCH_LIMIT = 50

/**
 * 批量体检（支持分批）。
 *
 * 语料先整体列出（按 mtime 倒序，≤ DISCOVERY_LIMIT），再按 `[offset, offset+limit)`
 * 切片扫描。这样客户端可以用小批次连续调用、自己累计真实进度，而宿主保持无状态
 * ——不必把同步循环改成异步，也不必新增进度轮询端点。
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
      logPath: session.logPath,
      ...(projectionState === undefined ? {} : { projectionState }),
      ...(options.attribute === undefined ? {} : { attribute: options.attribute }),
      ...(options.now === undefined ? {} : { now: options.now }),
    })
    if (options.onlyProblems === true && report.level === 'ok') continue
    findings.push(report)
  }
  return {
    ok: true,
    scanned: batch.length,
    total: discovered.length,
    offset,
    findings,
    ...(options.onlyProblems === true ? { filtered: true } : {}),
  }
}
