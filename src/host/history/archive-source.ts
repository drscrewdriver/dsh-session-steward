/**
 * 官方归档集合（archive set）的读取与清理 —— 自 dsh-session-search-toggle
 * `src/host/archive-source.ts` **逐字迁入**（只依赖 node:fs/os/path），行为与迁移前等价。
 *
 * 读取顺序：**优先直接读规范存储文件**（workspace domain 把 `archivedSessionIds`
 * 落在 `global` 段：storage-json 即 `~/.dsh/storages/workspace.json`），
 * 文件缺失时才回退到进程内 `workspaceRegistry` 服务。
 * 之所以不再让 registry 优先：prune 只能改文件，列表若以 registry 为准，
 * 清理成功后面板不会发生任何变化。registry 仍被读取，但只用作诊断面
 * （`registryIds`：指出「已出文件、仍在内存里生效」的悬挂项）。
 * 每次读取独立决定来源；失败降级为「空归档集合」并通过 diagnostics 面暴露。
 *
 * 写入（清理）：官方后端没有 unarchive 端点，因此按 storage-json 自身的协议直接编辑
 * 规范文件 —— 备份、同目录临时文件、原子改名。运行中的宿主只在启动时加载该集合，
 * 调用方必须提示需要重启 DSH。
 */
import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** 一次归档读取的结果：ids 以及服务它的来源。 */
export interface StewardArchiveRead {
  ids: readonly string[]
  source: 'registry' | 'storage-file' | 'none'
  /**
   * 宿主内存 registry 里的同一集合（尽力而为，读不到时缺省）。
   *
   * 与 `ids` 的差集 = 「已从存储文件移除、但本进程仍生效」的悬挂项：
   * registry 是宿主启动时载入的快照，prune 写不到它，重启才会重载。
   */
  registryIds?: readonly string[]
}

/** workspaceRegistry 镜像面（只读 getter）。 */
export interface StewardRegistryFace {
  readonly archivedSessionIds: readonly string[]
}

/** 描述归档集合解析情况的诊断信息。 */
export interface StewardArchiveDiagnostics {
  source: 'registry' | 'storage-file' | 'none'
  ids: number
  error?: string
}

/** workspace domain 的 DSH 存储中枢候选路径（json 后端）。 */
export function storageFileCandidates(): string[] {
  return [
    join(homedir(), '.dsh', 'storages', 'workspace.json'),
  ]
}

/** 解析存储文件 global.archivedSessionIds；内容畸形时抛错。 */
function readStorageFile(path: string): readonly string[] {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
    global?: { archivedSessionIds?: unknown }
  }
  const ids = parsed.global?.archivedSessionIds
  if (!Array.isArray(ids)) throw new Error(`storage hub "${path}" holds no global.archivedSessionIds array`)
  return ids.filter((id): id is string => typeof id === 'string')
}

/** 尽力读取宿主内存里的归档集合；不可用时返回 undefined。 */
function readRegistryIds(registry?: StewardRegistryFace): readonly string[] | undefined {
  if (registry === undefined) return undefined
  try {
    const ids = registry.archivedSessionIds
    return Array.isArray(ids) ? ids : undefined
  } catch {
    return undefined
  }
}

/**
 * 解析一次官方归档集合。
 *
 * **存储文件优先**：prune 唯一能改的就是这份文件，列表必须与「能被改的那份」
 * 同源，否则清理成功后面板看起来毫无变化 —— 宿主 registry 是进程启动时的快照，
 * 直接编辑文件不会回写它，于是「文件在瘦身、列表纹丝不动」。
 * registry 退居为文件缺失时的兜底，同时作为诊断面（`registryIds`）返回。
 * @param registry - 惰性 workspaceRegistry 面（可能缺失或抛错）。
 * @param searchPaths - 可选候选路径覆盖（DSH_HOME 非默认值或测试注入时使用）。
 * @returns 归档 ids、服务它的来源，以及宿主内存里的同一集合。
 */
export function readArchiveSet(registry?: StewardRegistryFace, searchPaths?: readonly string[]): StewardArchiveRead {
  const registryIds = readRegistryIds(registry)
  for (const path of searchPaths ?? storageFileCandidates()) {
    if (!existsSync(path)) continue
    try {
      const ids = readStorageFile(path)
      return { ids, source: 'storage-file', ...(registryIds === undefined ? {} : { registryIds }) }
    } catch { /* 文件畸形 —— 试下一个候选 */ }
  }
  if (registryIds !== undefined) return { ids: registryIds, source: 'registry', registryIds }
  return { ids: [], source: 'none' }
}

/** 一次存储文件编辑的结果。 */
export type StewardEditOutcome =
  | { ok: true; changed: boolean; file: string }
  | { ok: false; reason: string }

/**
 * **本插件写 workspace.json 的唯一入口。**
 *
 * 任何「改归档集合 / 改工作区成员表」都必须走这里 —— 出现第二个写文件的实现，
 * 就会重现「读的人和写的人不是同一份数据」那类问题。
 *
 * 协议与 storage-json 自身一致：读 → `edit(document)` 就地改 → 备份 → 同目录临时写入
 * → 原子改名。`edit` 返回 `false` 表示无需写入（此时**不产生备份**）。
 * @param path - 规范存储文件路径。
 * @param edit - 就地修改文档；返回是否真的改了。
 * @param log - 可选日志出口。
 * @returns 编辑结果；失败时给出原因而非抛错。
 */
export function editWorkspaceDocument(
  path: string,
  edit: (document: Record<string, unknown>) => boolean,
  log?: (msg: string) => void,
): StewardEditOutcome {
  if (!existsSync(path)) return { ok: false, reason: `存储文件不存在：${path}` }
  let document: Record<string, unknown>
  try {
    document = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  } catch (err) {
    return { ok: false, reason: `无法解析 "${path}"：${String(err instanceof Error ? err.message : err)}` }
  }
  let changed: boolean
  try {
    changed = edit(document)
  } catch (err) {
    return { ok: false, reason: `编辑 "${path}" 失败：${String(err instanceof Error ? err.message : err)}` }
  }
  if (!changed) return { ok: true, changed: false, file: path }
  // 在文件旁备份，然后原子替换（tmp + rename），序列化与 storage-json 一致。
  const backup = `${path}.bak-${Date.now()}`
  copyFileSync(path, backup)
  const tmp = `${path}.prune-tmp`
  writeFileSync(tmp, `${JSON.stringify(document, null, 2)}
`, 'utf8')
  renameSync(tmp, path)
  log?.(`workspace.json edited; backup=${backup}`)
  return { ok: true, changed: true, file: path }
}

/**
 * 从存储中枢的 `global.archivedSessionIds` 中移除会话 id（= 取消归档状态）。
 *
 * 官方后端没有 unarchive 端点，因此直接编辑规范文件；运行中的宿主把集合留在内存里、
 * 只在启动时重载 —— 调用方必须提示需要重启 DSH。
 * @param ids - 要从归档数组中移除的会话 id。
 * @param log - 可选日志出口。
 * @param searchPaths - 可选候选路径覆盖（测试注入用）。
 * @returns 实际移除数量与剩余数量。
 */
export function pruneArchiveFile(
  ids: readonly string[],
  log?: (msg: string) => void,
  searchPaths?: readonly string[],
): {
  removed: number
  remaining: number
  file?: string
} {
  const wanted = new Set(ids)
  let lastReason = 'workspace storage file not found (searched ~/.dsh/storages/workspace.json)'
  for (const path of searchPaths ?? storageFileCandidates()) {
    let removed = 0
    let remaining = 0
    const outcome = editWorkspaceDocument(path, (document) => {
      const global = document.global as { archivedSessionIds?: unknown } | undefined
      const current = global?.archivedSessionIds
      if (!Array.isArray(current)) throw new Error(`storage hub "${path}" holds no global.archivedSessionIds array`)
      const kept = current.filter((id): id is string => typeof id === 'string' && !wanted.has(id))
      removed = current.length - kept.length
      remaining = kept.length
      if (removed === 0) return false
      document.global = { ...global, archivedSessionIds: kept }
      return true
    }, log)
    if (!outcome.ok) { lastReason = outcome.reason; continue }
    if (outcome.changed) log?.(`archive prune: removed ${removed} ids; remaining ${remaining}`)
    return { removed, remaining, file: outcome.file }
  }
  throw new Error(lastReason)
}

/** 构造同步器期望的惰性来源面，并记录诊断。 */
export function createArchiveSource(getRegistry: () => StewardRegistryFace | undefined): {
  read: () => StewardArchiveRead
  diagnostics: () => StewardArchiveDiagnostics
} {
  let last: StewardArchiveDiagnostics = { source: 'none', ids: 0 }
  return {
    read: () => {
      const read = readArchiveSet(getRegistry())
      last = { source: read.source, ids: read.ids.length }
      return read
    },
    diagnostics: () => ({ ...last }),
  }
}
