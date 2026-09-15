/**
 * 官方归档集合（archive set）的读取与清理 —— 自 dsh-session-search-toggle
 * `src/host/archive-source.ts` **逐字迁入**（只依赖 node:fs/os/path），行为与迁移前等价。
 *
 * 读取顺序：优先进程内 `workspaceRegistry` 服务（UI 过滤所用的同一事实）；
 * 回退直接读规范存储文件（workspace domain 把 `archivedSessionIds` 落在
 * `global` 段：storage-json 即 `~/.dsh/storages/workspace.json`）。
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

/**
 * 解析一次官方归档集合。
 * @param registry - 惰性 workspaceRegistry 面（可能缺失或抛错）。
 * @param searchPaths - 可选候选路径覆盖（DSH_HOME 非默认值或测试注入时使用）。
 * @returns 归档 ids 以及服务它的来源。
 */
export function readArchiveSet(registry?: StewardRegistryFace, searchPaths?: readonly string[]): StewardArchiveRead {
  if (registry !== undefined) {
    try {
      const ids = registry.archivedSessionIds
      if (Array.isArray(ids)) return { ids, source: 'registry' }
    } catch { /* registry 尚未启动 —— 落到文件 */ }
  }
  for (const path of searchPaths ?? storageFileCandidates()) {
    if (!existsSync(path)) continue
    try {
      return { ids: readStorageFile(path), source: 'storage-file' }
    } catch { /* 文件畸形 —— 试下一个候选 */ }
  }
  return { ids: [], source: 'none' }
}

/**
 * 从存储中枢的 global.archivedSessionIds 中移除会话 id。
 *
 * 官方后端没有 unarchive 端点，因此直接编辑规范文件，遵循 storage-json 自身的协议：
 * 备份、同目录临时写入、改名。运行中的宿主把集合留在内存里、只在启动时重载 ——
 * 调用方必须提示需要重启 DSH。
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
  for (const path of searchPaths ?? storageFileCandidates()) {
    if (!existsSync(path)) continue
    let document: { global?: { archivedSessionIds?: unknown }; [key: string]: unknown }
    try {
      document = JSON.parse(readFileSync(path, 'utf8')) as typeof document
    } catch (err) {
      log?.(`archive prune: cannot parse "${path}": ${String(err instanceof Error ? err.message : err)}`)
      continue
    }
    const current = document.global?.archivedSessionIds
    if (!Array.isArray(current)) {
      log?.(`archive prune: "${path}" holds no global.archivedSessionIds array`)
      continue
    }
    const kept = current.filter((id): id is string => typeof id === 'string' && !wanted.has(id))
    const removed = current.length - kept.length
    if (removed === 0) return { removed: 0, remaining: current.length, file: path }
    // 在文件旁备份，然后原子替换（tmp + rename），与 storage-json 的发布协议及 2 空格序列化一致。
    const backup = `${path}.bak-${Date.now()}`
    copyFileSync(path, backup)
    const next = { ...document, global: { ...document.global, archivedSessionIds: kept } }
    const tmp = `${path}.prune-tmp`
    writeFileSync(tmp, `${JSON.stringify(next, null, 2)}
`, 'utf8')
    renameSync(tmp, path)
    log?.(`archive prune: removed ${removed} of ${current.length} ids; backup=${backup}`)
    return { removed, remaining: kept.length, file: path }
  }
  throw new Error('workspace storage file not found (searched ~/.dsh/storages/workspace.json)')
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
