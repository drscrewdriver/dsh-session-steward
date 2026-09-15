/**
 * 会话历史文件（归档）域的服务端处理。
 *
 * 与 dsh-session-search-toggle 的差异（**刻意且必须记入交付说明**）：
 * toggle 的 `list-archived` 从它自己的独立索引里列出归档行（`engine.listArchived()`），
 * 而索引已随搜索索引包离开本包。因此本包改为从**官方归档集合**列出来源真值
 * （`readArchiveSet`：registry 优先、存储文件回退），标题等元数据为尽力而为：
 * 依次尝试 `sessionQuery.readTitleSnapshots` → 投影缓存记录里的 title。
 * 清理（prune）路径与迁移前**逐字等价**（备份 + 原子替换 + 需重启提示）。
 */
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pruneArchiveFile, readArchiveSet, type StewardRegistryFace } from './archive-source.ts'

/** 一行历史文件条目（尽力而为的元数据）。 */
export interface StewardHistoryRow {
  sessionId: string
  title: string
  cwd: string
  updatedAt: number
}

/** 列表结果。 */
export interface StewardHistoryListResult {
  ok: boolean
  items?: StewardHistoryRow[]
  /** 归档集合来源；`none` 表示两处都没读到。 */
  source?: 'registry' | 'storage-file' | 'none'
  /** 元数据降级原因（标题/cwd 缺失时给出）。 */
  degraded?: string
  error?: string
}

/** 标题快照读取面（结构化镜像，零 value import）。 */
export interface StewardTitleQueryFace {
  readTitleSnapshots?(ids: readonly string[]): Promise<readonly {
    status: 'fulfilled' | 'rejected'
    value?: { title?: { title: string } }
  }[]>
}

/** 投影缓存记录里可能存在的标题（同目录第二来源）。 */
function titleFromProjectionCache(sessionId: string): string {
  const path = join(homedir(), '.dsh', 'storages', 'session_projcache', 'sessions', `${sessionId}.json`)
  if (!existsSync(path)) return ''
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
      record?: { rows?: { title?: { val?: unknown } } }
    }
    const value = parsed.record?.rows?.title?.val
    return typeof value === 'string' ? value : ''
  } catch {
    return ''
  }
}

/**
 * `session-history-list`：列出官方归档集合（尽力附带标题等元数据）。
 * @param getRegistry - 惰性 workspaceRegistry 面。
 * @param query - 可选标题快照面。
 * @param searchPaths - 可选存储文件候选路径（DSH_HOME 非默认值/测试注入）。
 * @returns 归档行清单。
 */
export async function listHistory(
  getRegistry: () => StewardRegistryFace | undefined,
  query?: StewardTitleQueryFace,
  searchPaths?: readonly string[],
): Promise<StewardHistoryListResult> {
  const read = readArchiveSet(getRegistry(), searchPaths)
  if (read.source === 'none') {
    return { ok: false, error: 'workspace 存储文件与 workspaceRegistry 均不可用，无法读取归档集合' }
  }
  const ids = [...read.ids]
  const titles = new Map<string, string>()
  let degraded: string | undefined
  if (query?.readTitleSnapshots !== undefined && ids.length > 0) {
    try {
      const observations = await query.readTitleSnapshots(ids)
      ids.forEach((id, index) => {
        const title = observations[index]?.value?.title?.title
        if (typeof title === 'string' && title !== '') titles.set(id, title)
      })
    } catch {
      degraded = 'sessionQuery 标题快照不可用，标题回退到投影缓存/空'
    }
  } else if (ids.length > 0) {
    degraded = 'sessionQuery 不可用，标题回退到投影缓存/空'
  }
  const items: StewardHistoryRow[] = ids.map((sessionId) => {
    const title = titles.get(sessionId) ?? titleFromProjectionCache(sessionId)
    return { sessionId, title, cwd: '', updatedAt: 0 }
  })
  return { ok: true, items, source: read.source, ...(degraded === undefined ? {} : { degraded }) }
}

/** 按 DSH_HOME 解析存储文件候选（与 archive-source 的默认候选保持同一形状）。 */
export function storagePathsFor(dshHome: string): string[] {
  return [join(dshHome, 'storages', 'workspace.json')]
}

/** 清理结果。 */
export interface StewardHistoryPruneResult {
  ok: boolean
  removed?: number
  remaining?: number
  requiresRestart?: boolean
  error?: string
}

/** 单次清理的最大 id 数（与迁移前一致）。 */
export const MAX_PRUNE_IDS = 5000

/**
 * `session-history-prune`：从官方归档数组中批量移除会话 id。
 * 行为与迁移前等价：校验入参 → 备份并原子替换存储文件 → 返回 removed/remaining，
 * 并明确要求重启 DSH（宿主内存中的集合只在启动时重载）。
 * @param payload - `{ sessionIds: string[] }`。
 * @param log - 可选日志出口。
 * @param searchPaths - 可选候选路径覆盖（测试注入用）。
 */
export function pruneHistory(
  payload: unknown,
  log?: (msg: string) => void,
  searchPaths?: readonly string[],
): StewardHistoryPruneResult {
  const record = payload as { sessionIds?: unknown } | null
  if (!Array.isArray(record?.sessionIds) || record.sessionIds.length === 0) {
    return { ok: false, error: '缺少 sessionIds 数组' }
  }
  const ids = [...new Set(record.sessionIds.filter((id): id is string => typeof id === 'string' && id !== ''))]
  if (ids.length === 0) return { ok: false, error: 'sessionIds 无有效值' }
  if (ids.length > MAX_PRUNE_IDS) return { ok: false, error: `单次最多清理 ${MAX_PRUNE_IDS} 个` }
  let result: { removed: number; remaining: number; file?: string }
  try {
    result = pruneArchiveFile(ids, log, searchPaths)
  } catch (err) {
    return { ok: false, error: String(err instanceof Error ? err.message : err) }
  }
  log?.(`archive prune requested ${ids.length}, removed ${result.removed}, remaining ${result.remaining}`)
  return { ok: true, removed: result.removed, remaining: result.remaining, requiresRestart: true }
}
