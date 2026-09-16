/**
 * 归档文件清理（**真删除**）—— 会话管家唯一的破坏性操作。
 *
 * 与「取消归档状态」（`pruneArchiveFile`）是**两件事**，刻意分开：
 *
 * | | 取消归档状态 | 清理归档文件 |
 * |---|---|---|
 * | 改什么 | 只改 `global.archivedSessionIds` | 删磁盘实体 **+** 改两处 id |
 * | 会话 | 回到侧边栏 | 从世界上消失 |
 * | 可逆 | 重启即生效 | 不可逆 |
 *
 * 「清理归档文件」必须**连带**执行「取消归档状态」：文件删了、id 还留在数组里，
 * 就是一条僵尸归档 —— 侧边栏看不见它，一旦被取消归档又会冒出一个打不开的空会话。
 *
 * 一次清理动 4 处：
 * 1. `~/.dsh/sessions/<工作区>/<会话id>/` —— 整个目录（可能含 `session.jsonl.zstd`
 *    与旧格式 `session.v3.jsonl.zstd` 两份，所以必须整目录删，不能只删当前格式）
 * 2. `~/.dsh/storages/session_projcache/sessions/<会话id>.json` —— 逐条投影缓存
 * 3. `workspace.json` → `global.archivedSessionIds`
 * 4. `workspace.json` → `tables.workspaces.*.sessionIds`
 *
 * 执行顺序是**先改文件、后删实体**：改文件是原子的且可整体中止（失败则一个字节都没删）；
 * 反过来先删实体再改文件，中途失败会留下僵尸 id。
 */
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { basename, join, relative, resolve, sep } from 'node:path'
import { editWorkspaceDocument } from './archive-source.ts'

/** 一个归档会话在磁盘上的实体与占用。 */
export interface StewardSessionUsage {
  sessionId: string
  /** 转录目录绝对路径（不存在时缺省）。 */
  dir?: string
  /** 转录目录占用字节数。 */
  bytes: number
  /** 投影缓存文件绝对路径（不存在时缺省）。 */
  cacheFile?: string
  /** 投影缓存占用字节数。 */
  cacheBytes: number
}

/** 转录根目录（`<dshHome>/sessions`）。 */
export function sessionsRootFor(dshHome: string): string {
  return join(dshHome, 'sessions')
}

/**
 * 投影缓存（**逐条布局**）根目录。
 *
 * 注意另有一个 `<dshHome>/storages/session_projcache.json`（整份布局）——
 * 那是布局迁移留下的**化石**，宿主早已不再写它，本插件也不碰它。
 */
export function projCacheRootFor(dshHome: string): string {
  return join(dshHome, 'storages', 'session_projcache', 'sessions')
}

/**
 * 会话 id 的目录名归一化。
 *
 * 归档集合里一律是 `session-<uuid>`，但子会话的目录名是不带前缀的 `<uuid>`，
 * 两者必须视为同一个会话，否则清理会「找不到文件」而静默什么都没删。
 */
export function dirKey(name: string): string {
  return name.startsWith('session-') ? name.slice('session-'.length) : name
}

/** 是不是目录（读不到就当不是）。 */
function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/**
 * 扫一遍转录根，建立「会话 id → 目录」索引。
 *
 * 同一个 id 同时存在带前缀与不带前缀的目录时，**优先带 `session-` 前缀的那个**
 * （归档集合里的 id 本身带前缀）。
 * @param sessionsRoot - `<dshHome>/sessions`。
 * @returns 归一化 id → 目录绝对路径。
 */
export function indexSessionDirs(sessionsRoot: string): Map<string, string> {
  const map = new Map<string, string>()
  if (!existsSync(sessionsRoot)) return map
  for (const workspace of readdirSync(sessionsRoot)) {
    const wsDir = join(sessionsRoot, workspace)
    if (!isDir(wsDir)) continue
    for (const name of readdirSync(wsDir)) {
      const entry = join(wsDir, name)
      if (!isDir(entry)) continue
      const key = dirKey(name)
      const existing = map.get(key)
      const prefer = name.startsWith('session-') && existing !== undefined && !basename(existing).startsWith('session-')
      if (existing === undefined || prefer) map.set(key, entry)
    }
  }
  return map
}

/** 递归求目录占用字节数（读不到的条目跳过，不抛错）。 */
export function dirSize(dir: string): number {
  let total = 0
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return 0
  }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      total += dirSize(path)
    } else {
      try {
        total += statSync(path).size
      } catch { /* 竞态：文件刚被删 */ }
    }
  }
  return total
}

/**
 * 解析一批会话在磁盘上的实体与占用（**只读，不删任何东西**）。
 *
 * 列表按行显示体积就走这里 —— 体积差异极大（实测单条缓存可达 23 MB、单条转录可达
 * 6 MB，也有 0 字节的），报一个总量对用户没有意义。
 * @param ids - 会话 id（带不带 `session-` 前缀都接受）。
 * @param dshHome - DSH 主目录。
 * @returns 会话 id → 实体位置与占用。
 */
export function locateSessionUsage(ids: readonly string[], dshHome: string): Map<string, StewardSessionUsage> {
  const dirs = indexSessionDirs(sessionsRootFor(dshHome))
  const cacheRoot = projCacheRootFor(dshHome)
  const out = new Map<string, StewardSessionUsage>()
  for (const sessionId of ids) {
    const key = dirKey(sessionId)
    const usage: StewardSessionUsage = { sessionId, bytes: 0, cacheBytes: 0 }
    const dir = dirs.get(key)
    if (dir !== undefined) {
      usage.dir = dir
      usage.bytes = dirSize(dir)
    }
    // 缓存文件名可能带前缀也可能不带 —— 两个候选都试。
    for (const name of [`${sessionId}.json`, `${key}.json`]) {
      const candidate = join(cacheRoot, name)
      if (existsSync(candidate)) {
        usage.cacheFile = candidate
        try {
          usage.cacheBytes = statSync(candidate).size
        } catch { /* 竞态 */ }
        break
      }
    }
    out.set(sessionId, usage)
  }
  return out
}

/**
 * 断言目标是 `root` 的**直接子项**（层级也校验）。
 *
 * 破坏性操作不能只靠「路径拼对了」—— 拼错一层就是删掉整个 sessions 根。
 * @param root - 允许的父目录。
 * @param target - 待删目标。
 * @param depth - 相对 root 的期望层数。
 * @returns 是否安全。
 */
export function isSafeChild(root: string, target: string, depth: number): boolean {
  const rel = relative(resolve(root), resolve(target))
  if (rel === '' || rel.startsWith('..') || resolve(root, rel) !== resolve(target)) return false
  return rel.split(sep).filter((part) => part !== '').length === depth
}

/** 清理结果。 */
export interface StewardHistoryPurgeResult {
  ok: boolean
  /** 成功清理的会话数。 */
  purged?: number
  /** 释放的字节数（转录 + 投影缓存）。 */
  freedBytes?: number
  /** 逐条失败原因；不阻断其余条目。 */
  failures?: { sessionId: string; reason: string }[]
  requiresRestart?: boolean
  error?: string
}

/** 单次清理的最大 id 数（与 prune 一致）。 */
export const MAX_PURGE_IDS = 5000

/** 清理选项。 */
export interface StewardPurgeOptions {
  /** DSH 主目录；**缺失时拒绝执行**（破坏性操作不接受猜测的路径）。 */
  dshHome?: string
  /** workspace.json 候选路径覆盖（测试注入用）。 */
  searchPaths?: readonly string[]
}

/**
 * `session-history-purge`：**真删除**归档会话的磁盘实体，并连带取消其归档状态。
 * @param payload - `{ sessionIds: string[] }`。
 * @param log - 可选日志出口。
 * @param options - `dshHome` 必填；`searchPaths` 可选覆盖。
 * @returns 清理条数、释放字节数与逐条失败。
 */
export function purgeHistory(
  payload: unknown,
  log?: (msg: string) => void,
  options?: StewardPurgeOptions,
): StewardHistoryPurgeResult {
  const dshHome = options?.dshHome
  if (dshHome === undefined || dshHome === '') {
    return { ok: false, error: '缺少 dshHome：破坏性清理拒绝在未知路径上执行' }
  }
  const record = payload as { sessionIds?: unknown } | null
  if (!Array.isArray(record?.sessionIds) || record.sessionIds.length === 0) {
    return { ok: false, error: '缺少 sessionIds 数组' }
  }
  const ids = [...new Set(record.sessionIds.filter((id): id is string => typeof id === 'string' && id !== ''))]
  if (ids.length === 0) return { ok: false, error: 'sessionIds 无有效值' }
  if (ids.length > MAX_PURGE_IDS) return { ok: false, error: `单次最多清理 ${MAX_PURGE_IDS} 个` }

  const wanted = new Set(ids)
  const usage = locateSessionUsage(ids, dshHome)

  // ── 第一步：改 workspace.json（归档状态 + 工作区成员表）。原子 + 备份；失败即整体中止。
  const candidates = options?.searchPaths ?? [join(dshHome, 'storages', 'workspace.json')]
  let edited = false
  let lastReason = `workspace 存储文件不存在（已试：${candidates.join('、')}）`
  for (const path of candidates) {
    const outcome = editWorkspaceDocument(path, (document) => {
      let changed = false
      // ③ 归档集合
      const global = document.global as { archivedSessionIds?: unknown } | undefined
      if (Array.isArray(global?.archivedSessionIds)) {
        const kept = global.archivedSessionIds.filter((id) => typeof id !== 'string' || !wanted.has(id))
        if (kept.length !== global.archivedSessionIds.length) {
          document.global = { ...global, archivedSessionIds: kept }
          changed = true
        }
      }
      // ④ 工作区成员表
      const tables = document.tables as { workspaces?: Record<string, { sessionIds?: unknown }> } | undefined
      if (tables?.workspaces !== undefined) {
        for (const [workspaceId, workspace] of Object.entries(tables.workspaces)) {
          if (!Array.isArray(workspace?.sessionIds)) continue
          const kept = workspace.sessionIds.filter((id) => typeof id !== 'string' || !wanted.has(id))
          if (kept.length !== workspace.sessionIds.length) {
            tables.workspaces[workspaceId] = { ...workspace, sessionIds: kept }
            changed = true
          }
        }
      }
      return changed
    }, log)
    if (!outcome.ok) { lastReason = outcome.reason; continue }
    edited = true
    break
  }
  if (!edited) return { ok: false, error: lastReason }

  // ── 第二步：删磁盘实体。逐条独立，失败只记不抛。
  const sessionsRoot = sessionsRootFor(dshHome)
  const cacheRoot = projCacheRootFor(dshHome)
  const failures: { sessionId: string; reason: string }[] = []
  let purged = 0
  let freedBytes = 0

  for (const sessionId of ids) {
    const entry = usage.get(sessionId)
    let missing = 0
    let entryFreed = 0

    if (entry?.dir !== undefined) {
      if (!isSafeChild(sessionsRoot, entry.dir, 2)) {
        failures.push({ sessionId, reason: `拒绝删除越界路径：${entry.dir}` })
        continue
      }
      try {
        rmSync(entry.dir, { recursive: true, force: true })
        entryFreed += entry.bytes
      } catch (err) {
        failures.push({ sessionId, reason: `删除转录目录失败：${String(err instanceof Error ? err.message : err)}` })
        continue
      }
    } else {
      missing++
    }

    if (entry?.cacheFile !== undefined) {
      if (!isSafeChild(cacheRoot, entry.cacheFile, 1)) {
        failures.push({ sessionId, reason: `拒绝删除越界缓存：${entry.cacheFile}` })
        continue
      }
      try {
        entryFreed += entry.cacheBytes
        rmSync(entry.cacheFile, { force: true })
      } catch (err) {
        failures.push({ sessionId, reason: `删除投影缓存失败：${String(err instanceof Error ? err.message : err)}` })
        continue
      }
    } else {
      missing++
    }

    if (missing === 2) {
      // 磁盘上本来就没有实体（可能上一轮删过）—— 状态已取消，算成功，但不释放空间。
      log?.(`purge: ${sessionId} had no on-disk entity; only the archive state was cleared`)
    }
    purged++
    freedBytes += entryFreed
  }

  log?.(`archive purge: cleared ${purged} of ${ids.length}; freed ${(freedBytes / 1048576).toFixed(1)}MB; failures ${failures.length}`)
  return {
    ok: true,
    purged,
    freedBytes,
    requiresRestart: true,
    ...(failures.length === 0 ? {} : { failures }),
  }
}
