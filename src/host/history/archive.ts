/**
 * 会话历史文件（归档）域的服务端处理。
 *
 * 与 dsh-session-search-toggle 的差异（**刻意且必须记入交付说明**）：
 * toggle 的 `list-archived` 从它自己的独立索引里列出归档行（`engine.listArchived()`），
 * 而索引已随搜索索引包离开本包。因此本包改为从**官方归档集合**列出来源真值
 * （`readArchiveSet`：存储文件优先、registry 兜底），标题等元数据为尽力而为：
 * 依次尝试 `sessionQuery.readTitleSnapshots` → 投影缓存记录里的 title。
 * 列表与 prune **同源**（都认存储文件），否则清理成功后面板不会刷新；
 * registry 与文件的差集作为 `pendingRestart` 返回，面板据此提示重启。
 * 清理（prune）路径与迁移前**逐字等价**（备份 + 原子替换 + 需重启提示），
 * 另加一道写后校验：读回文件确认目标 id 确实消失。
 */
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pruneArchiveFile, readArchiveSet, type StewardRegistryFace } from './archive-source.ts'
import { locateSessionUsage } from './purge.ts'

/** 一行历史文件条目（尽力而为的元数据 + 磁盘占用）。 */
export interface StewardHistoryRow {
  sessionId: string
  title: string
  cwd: string
  updatedAt: number
  /** 转录目录占用字节数（未知/未解析时为 0）。 */
  bytes: number
  /** 投影缓存占用字节数。 */
  cacheBytes: number
}

/** 列表结果。 */
export interface StewardHistoryListResult {
  ok: boolean
  items?: StewardHistoryRow[]
  /** 归档集合来源；`none` 表示两处都没读到。 */
  source?: 'registry' | 'storage-file' | 'none'
  /** 元数据降级原因（标题/cwd 缺失时给出）。 */
  degraded?: string
  /**
   * 已从存储文件移除、但宿主内存 registry 里仍生效的 id 数。
   *
   * 大于 0 时列表展示的是**存储文件真值**（已不含这些 id），但它们在本进程内
   * 仍然隐藏着对应会话 —— 面板据此提示「需重启 DSH 才彻底消失」。
   */
  pendingRestart?: number
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
  dshHome?: string,
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
    return { sessionId, title, cwd: '', updatedAt: 0, bytes: 0, cacheBytes: 0 }
  })
  // 按行的磁盘占用：**以单元为单位**算，不给一个总量糊弄（实测单条可从 0 到 23 MB）。
  // 未提供 dshHome 时保持 0 —— 调方拿不到主目录就不猜路径。
  if (dshHome !== undefined && dshHome !== '' && items.length > 0) {
    try {
      const usage = locateSessionUsage(ids, dshHome)
      for (const item of items) {
        const entry = usage.get(item.sessionId)
        if (entry === undefined) continue
        item.bytes = entry.bytes
        item.cacheBytes = entry.cacheBytes
      }
    } catch { /* 体积是尽力而为，读不到不影响列表本身 */ }
  }
  // 悬挂项：宿主内存里还留着、文件里已经没有了 —— 这些是「清理已落盘但尚未生效」的 id。
  const fileIds = new Set(ids)
  const pendingRestart = (read.registryIds ?? []).filter((id) => !fileIds.has(id)).length
  return {
    ok: true,
    items,
    source: read.source,
    ...(degraded === undefined ? {} : { degraded }),
    ...(pendingRestart === 0 ? {} : { pendingRestart }),
  }
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
  // 写后校验：读回文件确认目标 id 确实不在了。
  // 没有这一步，「面板说清理成功、文件其实没变」只能靠用户肉眼发现。
  const after = readArchiveSet(undefined, searchPaths)
  if (after.source !== 'storage-file') {
    return { ok: false, error: '写入后无法读回存储文件，无法确认清理结果' }
  }
  const stillThere = new Set(after.ids)
  const leftover = ids.filter((id) => stillThere.has(id))
  if (leftover.length > 0) {
    return { ok: false, error: `存储文件在写入后仍包含 ${leftover.length} 个目标 id，清理未生效` }
  }
  log?.(`archive prune requested ${ids.length}, removed ${result.removed}, remaining ${result.remaining}`)
  return { ok: true, removed: result.removed, remaining: result.remaining, requiresRestart: true }
}
