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

/** 定位一个会话的日志路径（跨工程目录查找）。 */
export function findSessionLog(sessionId: string, dshHome?: string): string | undefined {
  return discoverSessions(dshHome, 100_000).find(session => session.sessionId === sessionId)?.logPath
}

/** 扫描结果。 */
export interface HealthScanResult {
  ok: boolean
  scanned: number
  findings: SessionHealthReport[]
  /** 仅保留非 ok 的报告时使用。 */
  filtered?: boolean
  error?: string
}

/**
 * 批量体检。
 * @param options - dshHome / 扫描上限 / 是否只返回非 ok / 归属查询 / 热态状态提供者。
 */
export function scanSessions(options: {
  dshHome?: string
  limit?: number
  onlyProblems?: boolean
  attribute?: GateContext['attribute']
  projectionStateFor?: (sessionId: string) => Record<string, unknown> | undefined
  now?: () => number
}): HealthScanResult {
  const discovered = discoverSessions(options.dshHome, options.limit ?? 50)
  if (discovered.length === 0) {
    return { ok: false, scanned: 0, findings: [], error: '未发现任何会话日志（检查 DSH home 与 sessions 目录）' }
  }
  const findings: SessionHealthReport[] = []
  for (const session of discovered) {
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
    scanned: discovered.length,
    findings,
    ...(options.onlyProblems === true ? { filtered: true } : {}),
  }
}
