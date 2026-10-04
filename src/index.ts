/**
 * dsh-session-steward 主机半身（合并包）：两条 fenced HTTP 路由 ——
 *
 * - `/session-steward/api`：管家子域，方法名一律 `session-*`；
 * - `/switch-search/api`：搜索索引子域（历史前缀，浏览器旧 bundle 依赖），方法名 `index-*`/`list-sessions` 等。
 *
 * 三个子域开关（feature gate，关掉不注册对应方法，调用返回显式 disabled 错误，不留空壳）：
 * - `historyFiles`（会话历史文件 / 养老院）：`session-history-*`；
 * - `healthCheck`（健康检查 / 体检）：`session-health-*`；
 * - `search`（搜索索引）：`index-*` 及侧栏搜索入口。
 * 另有插件总开关 `enabled`：关闭后不注册任何路由。
 *
 * 搜索子域自带独立索引（node:sqlite FTS5，本插件自有的文件，绝非宿主官方
 * session-query 索引）：`list-sessions` 标题语料、`content-search` 按会话聚合的
 * 内容搜索、`index-status/rebuild/export/import` 索引生命周期面。
 *
 * 只读诊断 + 可逆处置；不改会话日志、不改历史数据、不静默丢弃字段。
 */
import type { Context } from 'cordis'
import z from '@deepseek-ai/schemastery'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  DEFAULT_CONFIG,
  STEWARD_API_PREFIX,
  STEWARD_SETTINGS_NAMESPACE,
  SWITCH_API_PREFIX,
  SWITCH_DEFAULT_CONFIG,
  type StewardConfig,
  type SwitchSearchConfig,
} from './config.ts'
import { listHistory, pruneHistory, storagePathsFor } from './host/history/archive.ts'
import type { StewardRegistryFace } from './host/history/archive-source.ts'
import { purgeHistory } from './host/history/purge.ts'
import { buildProjectionOwnerIndex, createAttributor, defaultProfileNodeModules } from './host/health/attribution.ts'
import { HealthCache } from './host/health/cache.ts'
import { buildSessionReport, type SessionHealthReport } from './host/health/gates.ts'
import { decodeSessionLogFile } from './host/health/decode.ts'
import { assessRepair, prescribe, quarantineProjectionCache } from './host/health/repair.ts'
import { countCorpus, findSession, scanSessions } from './host/health/scan.ts'
import { gateSourceKind, migrateSessionSourceKind, readSourceKindFacts } from './host/health/source-kind.ts'
import { SwitchIndexEngine, type SwitchIndexContentType, type SwitchSearchSort } from './host/index/engine.ts'
import { SwitchWatermarkSync, type SwitchSyncState } from './host/index/sync.ts'
import { createArchiveSource, type SwitchArchiveDiagnostics } from './host/index/archive-source.ts'
import { detectSteward } from './host/index/peers.ts'
// 归档集合的写方（prune）在管家子域：搜索子域只读归档集合把归档会话折进索引
// 状态（单一写方，一个 owner —— 合并后 owner 就在本包 history 子域）。
export { createArchiveSource, type SwitchArchiveDiagnostics } from './host/index/archive-source.ts'
import {
  DEFAULT_INDEX_LAYOUT,
  importIntoIndex,
  listArchives,
  recoverIndex,
  rebuildIndex,
  resolveIndexDir,
  type SwitchIndexLayout,
  type SwitchRebuildState,
} from './host/index/rebuild.ts'
import { exportSnapshot, parseSnapshot } from './host/index/snapshot.ts'
import type { SwitchRawEvent } from './host/index/extract.ts'

export { DEFAULT_CONFIG, STEWARD_API_PREFIX, STEWARD_SETTINGS_NAMESPACE, SWITCH_API_PREFIX, SWITCH_DEFAULT_CONFIG } from './config.ts'
export type { StewardConfig, SwitchSearchConfig } from './config.ts'
export { readArchiveSet, pruneArchiveFile, editWorkspaceDocument } from './host/history/archive-source.ts'
export { listHistory, pruneHistory } from './host/history/archive.ts'
export { purgeHistory, locateSessionUsage, indexSessionDirs, isSafeChild, dirSize, sessionsRootFor, projCacheRootFor, isSourceMigrateBackupName, backupFilesIn } from './host/history/purge.ts'
export { buildSessionReport, gateColdRead, gateGeneration, gateLogIntegrity, gateLosslessJson, gateProjectionCache, readProjectionCache, readTailFacts } from './host/health/gates.ts'
export { gateSourceKind, migrateSessionSourceKind, migrateLegacySource, readSourceKindFacts, SOURCE_MIGRATE_BACKUP_SUFFIX, V4_HOST_MIN } from './host/health/source-kind.ts'
export { firstLosslessViolation, isLossless } from './host/health/lossless.ts'
export { decodeSessionLogBytes, decodeSessionLogFile, scanZstdFrames } from './host/health/decode.ts'
export {
  classifyGenerationFilename,
  generationLogFilename,
  isMigrationStagingFilename,
  latestArtifactMtime,
  parseGenerationLogFilename,
  readSessionGenerations,
  sessionPriority,
} from './host/health/generation.ts'
export type {
  GenerationArtifact,
  LogArtifact,
  LogCompression,
  SessionGenerations,
  SessionPriority,
} from './host/health/generation.ts'
export { buildProjectionOwnerIndex, createAttributor } from './host/health/attribution.ts'
export { prescribe, quarantineProjectionCache } from './host/health/repair.ts'
export { countCorpus, discoverSessions, findSession, findSessionLog, scanSessions } from './host/health/scan.ts'
export type { DiscoveredSession } from './host/health/scan.ts'
export { HealthCache } from './host/health/cache.ts'
export type { HealthCacheEntry } from './host/health/cache.ts'
export { assessRepair } from './host/health/repair.ts'
export type { RepairAssessment, RepairVerdict } from './host/health/repair.ts'
export { SwitchIndexEngine } from './host/index/engine.ts'
export { SwitchWatermarkSync } from './host/index/sync.ts'
export { rebuildIndex, importIntoIndex, recoverIndex, DEFAULT_INDEX_LAYOUT } from './host/index/rebuild.ts'
export { exportSnapshot, parseSnapshot } from './host/index/snapshot.ts'
export { detectSteward, probePeer } from './host/index/peers.ts'

/** 本插件声明的宿主服务（与 toggle 相同的注入面）。 */
export const inject = ['webServer', 'webRuntime']

/** webServer 服务面（结构化镜像，零 value import）。 */
interface StewardWebServer {
  register(route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }): () => void
}

/** web runtime 服务面：绑定派生的可信 authority。 */
interface StewardWebRuntime {
  trustedHosts: readonly string[]
}

/** Live reference the 0.1.7 loader hands `apply` for `.volatile()` config fields. */
interface VolatileRef<T> {
  get(): T
}

/** Resolve one possibly-volatile field: a live ref on 0.1.7+, a plain value otherwise. */
function readVolatileValue<T>(value: T | VolatileRef<T> | undefined): T | undefined {
  if (value !== null && typeof value === 'object' && typeof (value as VolatileRef<T>).get === 'function') {
    return (value as VolatileRef<T>).get()
  }
  return value as T | undefined
}

/**
 * `.volatile()` 探针回退（preset-manager 的 volatile breakpoint 同款）：宿主
 * schemastery 只在 0.1.7+ 线提供 `.volatile()`，老线上该方法是 undefined ——
 * 在模块加载期链式调用直接 TypeError，插件整包起不来。这里探测到才链，探测
 * 不到就返回普通字段（老线的配置只来自组合入口，无设置表单，行为正确）。
 */
function withVolatile<T extends { volatile?: unknown }>(field: T): T {
  if (field !== null && typeof field === 'object' && typeof field.volatile === 'function') {
    return (field as { volatile: () => T }).volatile()
  }
  return field
}

/** 运行时配置 schema（与 src/config.ts 的形状保持一致）。0.1.7+：volatile 字段即设置表单。 */
export const Config = z.object({
  enabled: withVolatile(z.boolean().default(true)),
  historyFiles: withVolatile(z.boolean().default(true)),
  healthCheck: withVolatile(z.boolean().default(true)),
  search: withVolatile(z.boolean().default(true)),
  defaultMode: withVolatile(z.union(['title', 'content']).default('title')),
  autoSync: withVolatile(z.boolean().default(true)),
  syncIntervalMs: withVolatile(z.number().default(30_000)),
  archiveKeep: withVolatile(z.number().default(2)),
  indexDir: withVolatile(z.string().default('')),
})

/** 单次请求体的上限（防御无界读取）。 */
const MAX_BODY_BYTES = 16 << 20

/** content-search 单次返回的默认会话数上限。 */
const DEFAULT_LIMIT = 20

/** 独立索引目录的环境变量覆盖。 */
const INDEX_DIR_ENV = 'DSH_SWITCH_SEARCH_DIR'

/** 改名/自动标题落盘的 log-only 事件（追加进日志，会推 version，水位轮询本可迟到一轮兜住）。 */
const TITLE_EVENT_TYPE = 'session/title'

/** 改名风暴合并为一次标题折叠（自动标题一轮会连发多条）。 */
const TITLE_FLUSH_MS = 250

/** 归一化 Host authority，无法解析时为 undefined。 */
function parseAuthority(authority: string): URL | undefined {
  try {
    return new URL(`http://${authority}`)
  } catch {
    return undefined
  }
}

/** 主机名是否本机回环。 */
function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/** Host 是否命中 trustedHosts（精确或省略端口）。 */
function isTrustedAuthority(hostUrl: URL, trustedHosts: readonly string[]): boolean {
  return trustedHosts.some((entry) => {
    const entryUrl = parseAuthority(entry)
    if (entryUrl === undefined) return false
    const canonical = entryUrl.port === '' ? entryUrl.hostname : entryUrl.host
    return canonical === hostUrl.host
  })
}

/** 浏览器可信围栏（与 /api 网关行为一致）：DNS 重绑定/跨站防御，不是鉴权。 */
function isTrustedApiRequest(req: IncomingMessage, trustedHosts: readonly string[]): boolean {
  const host = req.headers.host
  if (host === undefined) return false
  const hostUrl = parseAuthority(host)
  if (hostUrl === undefined) return false
  if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false
  const fetchSite = req.headers['sec-fetch-site']
  if (typeof fetchSite === 'string' && fetchSite === 'cross-site') return false
  const origin = req.headers.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

/** 读原始请求体（有界）。 */
async function readRawBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)
    total += buffer.length
    if (total > MAX_BODY_BYTES) throw new Error('request body too large')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/** 读 JSON 请求体（空体视为 {}）。 */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const text = await readRawBody(req)
  if (text.trim() === '') return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error('request body is not JSON')
  }
}

/** 写 JSON 响应。 */
function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(text)
}

/** 写原始文本响应。 */
function writeRaw(res: ServerResponse, status: number, contentType: string, body: string): void {
  res.writeHead(status, { 'content-type': contentType, 'cache-control': 'no-cache' })
  res.end(body)
}

/** 会话 id 形状校验（拒绝任意字符串进入路径拼接）。 */
function asSessionId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed === '' || trimmed.length > 200) return undefined
  if (!/^[A-Za-z0-9._:-]+$/.test(trimmed)) return undefined
  return trimmed
}

/** 单会话体检的最大扫描上限。 */
const MAX_SCAN_LIMIT = 200

/** 运行时依赖。 */
export interface StewardRuntime {
  config: () => Required<StewardConfig>
  dshHome: string
  registry: () => StewardRegistryFace | undefined
  projectionStateFor: (sessionId: string) => Record<string, unknown> | undefined
  attribute: (projection: string) => { projection?: string; package?: string; field?: string } | undefined
  log: (message: string) => void
  /**
   * 体检结果缓存（进程内，随 fiber 存活）。
   *
   * 可选：缺省表示本次装配不启用缓存（只影响「关面板重开」是否零延迟，
   * 不影响任何判定结果）。`apply()` 总是提供实例。
   */
  cache?: HealthCache
}

/**
 * 支持的路由方法（按子域分组；用于对外声明与测试断言）。
 *
 * `session-history-prune` 与 `session-history-purge` 是**两件事**，不可合并：
 * prune = 取消归档状态（可逆，会话回到侧边栏）；purge = 清理归档文件（不可逆，真删实体）。
 */
export const HISTORY_METHODS = ['session-history-list', 'session-history-prune', 'session-history-purge'] as const
export const HEALTH_METHODS = [
  'session-health-status',
  'session-health-scan',
  'session-health-session',
  'session-health-repair',
  'session-health-source-migrate',
] as const
/** 搜索索引子域方法（`/switch-search/api`；index-export/import 走原始体，其余 JSON）。 */
export const INDEX_METHODS = [
  'list-sessions',
  'content-search',
  'search-status',
  'index-status',
  'index-rebuild',
  'index-export',
  'index-import',
] as const

/** 依据开关判定某方法是否启用。 */
export function methodEnabled(method: string, config: Required<StewardConfig>): boolean {
  if ((HISTORY_METHODS as readonly string[]).includes(method)) return config.historyFiles !== false
  if ((HEALTH_METHODS as readonly string[]).includes(method)) return config.healthCheck !== false
  if ((INDEX_METHODS as readonly string[]).includes(method)) return config.search !== false
  return false
}

/** ------------------------------------------------------------------ 搜索子域 handlers */

/**
 * One session header shape the query service returns (structural subset).
 */
interface SwitchSessionHeader {
  id: string
  version: number
  createdAt: number
  cwd?: string
  parentSession?: string
  seedLength?: number
  delegationDepth?: number
  agentPreset?: string
}

/** One logical-session record (structural subset). */
interface SwitchSessionRecord {
  header: SwitchSessionHeader
  live: boolean
  persisted: boolean
}

/** One title observation result (structural subset). */
interface SwitchTitleObservationResult {
  status: 'fulfilled' | 'rejected'
  value?: { session: SwitchSessionHeader; title?: { title: string } }
  reason?: unknown
}

/** The session-query service face: corpus reads, title folding, FTS5 search. */
interface SwitchSessionQuery {
  listSessions(signal?: AbortSignal): Promise<readonly SwitchSessionRecord[]>
  readSession?(sessionId: string): Promise<{
    session: SwitchSessionHeader
    events: readonly SwitchRawEvent[]
  }>
  readTitleSnapshots(
    sessionIds: readonly string[],
    signal?: AbortSignal,
  ): Promise<readonly SwitchTitleObservationResult[]>
  searchSessions?(
    request: { query: string; eventFilters?: readonly unknown[]; limit?: number },
    exec?: { signal?: AbortSignal },
  ): Promise<{ items: readonly unknown[]; nextCursor?: string }>
}

/**
 * The workspace registry face the search side reads (structural mirror): the
 * official archive set. Read lazily — the registry may mount after plugins.
 */
interface SwitchWorkspaceRegistry {
  readonly archivedSessionIds: readonly string[]
}

/** Fold titles for a set of sessions into a sessionId → title map. */
async function titleMap(
  sessionQuery: SwitchSessionQuery,
  sessionIds: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  if (sessionIds.length === 0) return new Map()
  const observations = await sessionQuery.readTitleSnapshots([...new Set(sessionIds)])
  const map = new Map<string, string>()
  for (const observation of observations) {
    if (observation.status !== 'fulfilled' || observation.value === undefined) continue
    const title = observation.value.title?.title
    if (typeof title === 'string' && title.trim().length > 0) map.set(observation.value.session.id, title)
  }
  return map
}

/** list-sessions: the title-search corpus (index-served, live fallback). */
async function listSessions(srt: SearchRuntime): Promise<{ ok: boolean; items?: unknown[]; error?: string }> {
  const index = srt.index
  const sessionQuery = srt.sessionQuery
  // Fast path: the independent index caches every session header (title/cwd/
  // updatedAt). Serving from it keeps the panel instant — the live-preferred
  // corpus projection (readTitleSnapshots per session) is what used to blow
  // the client's 10s timeout on large corpora. A refresh sync runs in the
  // background so newly created sessions appear on the next open.
  if (index.engine.isOpen && index.engine.countSessions() > 0) {
    if (sessionQuery !== undefined && index.sync.snapshot().state !== 'syncing') {
      void index.sync.poll().catch(() => {})
    }
    return {
      ok: true,
      items: index.engine.listIndexedSessions().map(session => ({
        sessionId: session.sessionId,
        title: session.title,
        cwd: session.cwd,
        updatedAt: session.updatedAt,
      })),
    }
  }
  if (sessionQuery === undefined) {
    return { ok: false, error: 'sessionQuery 服务不可用，且独立索引尚未建立' }
  }
  try {
    const records = await sessionQuery.listSessions()
    const titles = await titleMap(sessionQuery, records.map(record => record.header.id))
    return {
      ok: true,
      items: records.map(record => ({
        sessionId: record.header.id,
        title: titles.get(record.header.id) ?? '',
        cwd: record.header.cwd ?? '',
        updatedAt: record.header.createdAt,
      })),
    }
  } catch (err) {
    return { ok: false, error: String(err instanceof Error ? err.message : err) }
  }
}

/**
 * content-search: session-grouped hits from the independent index.
 * `sortBy: 'time'` orders by session recency (`updatedAt`), anything else by
 * relevance; the host orders before truncating so the page is honest.
 */
async function contentSearch(
  srt: SearchRuntime,
  payload: unknown,
): Promise<{ ok: boolean; items?: unknown[]; error?: string }> {
  const record = payload as { query?: unknown; limit?: unknown; types?: unknown; sortBy?: unknown } | null
  const query = typeof record?.query === 'string' ? record.query.trim() : ''
  if (query === '') return { ok: false, error: '缺少 query' }
  const requestedLimit = typeof record?.limit === 'number' && Number.isSafeInteger(record.limit)
    ? record.limit
    : DEFAULT_LIMIT
  const limit = Math.min(Math.max(1, requestedLimit), 100)
  // Unknown or absent ordering degrades to relevance — never to an error, so an
  // old client half talking to a new host half keeps working.
  const sortBy: SwitchSearchSort = record?.sortBy === 'time' ? 'time' : 'relevance'
  let types: readonly SwitchIndexContentType[]
  if (Array.isArray(record?.types) && record.types.length > 0) {
    types = record.types.filter((entry): entry is SwitchIndexContentType =>
      entry === 'all' || entry === 'user' || entry === 'reply' || entry === 'tool')
  } else {
    types = ['user', 'reply']
  }
  const index = srt.index
  if (index.engine.isOpen === false) {
    return { ok: false, error: '独立索引未就绪：请在面板或设置中先建立索引（整理索引）' }
  }
  try {
    return {
      ok: true,
      items: index.engine.search({ query, types, limit, sortBy }),
    }
  } catch (err) {
    return { ok: false, error: String(err instanceof Error ? err.message : err) }
  }
}

/** search-status: probe the independent index readiness and progress. */
async function searchStatus(srt: SearchRuntime): Promise<unknown> {
  const index = srt.index
  const sync = index.sync.snapshot()
  return {
    ok: true,
    available: index.engine.isOpen && index.engine.countSessions() > 0,
    reason: index.engine.isOpen ? undefined : 'not-open',
    indexing: sync.state === 'syncing',
    archivedSessions: index.engine.countArchived(),
    archive: index.archiveReader.diagnostics(),
    sync,
    rebuild: index.rebuild,
  }
}

/** index-status: full lifecycle surface for the settings row. */
async function indexStatus(srt: SearchRuntime): Promise<unknown> {
  const index = srt.index
  const sync = index.sync.snapshot()
  let indexed = sync.indexed
  if (index.engine.isOpen) indexed = index.engine.countSessions()
  return {
    ok: true,
    available: index.engine.isOpen && indexed > 0,
    archivedSessions: index.engine.isOpen ? index.engine.countArchived() : 0,
    // 归档子域的 owner 就是本包（history 子域）；保留探针字段形状，旧客户端
    // 的「会话管家负责」提示语在新包语境下依然为真。
    steward: detectSteward(),
    driver: index.engine.driverLabel,
    archive: index.archiveReader.diagnostics() as SwitchArchiveDiagnostics,
    dir: index.layout.dir,
    archives: await listArchives(index.layout).catch(() => []),
    sync: { ...sync, indexed } satisfies SwitchSyncState,
    rebuild: index.rebuild,
  }
}

/**
 * index-rebuild: start the non-destructive 整理 (shadow build → atomic swap →
 * archives). Responds immediately; progress rides index-status.
 */
async function indexRebuild(srt: SearchRuntime): Promise<{ ok: boolean; started?: boolean; error?: string }> {
  const index = srt.index
  if (index.rebuild.state === 'building' || index.rebuild.state === 'swapping') {
    return { ok: false, error: '整理已在进行中' }
  }
  const sessionQuery = srt.sessionQuery
  if (sessionQuery === undefined || sessionQuery.readSession === undefined) {
    return { ok: false, error: 'sessionQuery 服务不可用，无法读取会话日志' }
  }
  const config = srt.config()
  const keepArchives = Math.max(0, config.archiveKeep ?? SWITCH_DEFAULT_CONFIG.archiveKeep)
  void rebuildIndex(
    index.engine,
    index.layout,
    {
      listSessions: () => sessionQuery.listSessions(),
      readSession: async (sessionId: string) => {
        const snapshot = await sessionQuery.readSession!(sessionId)
        return { session: snapshot.session, events: snapshot.events }
      },
    },
    keepArchives,
    undefined,
    srt.registry,
    {
      log: srt.log,
      onState: (live) => { index.rebuild = live },
    },
  ).then((state) => {
    index.rebuild = state
  }).catch((err) => {
    index.rebuild = {
      state: 'error',
      done: 0,
      total: 0,
      startedAt: Date.now(),
      finishedAt: 0,
      failures: [],
      error: String(err instanceof Error ? err.message : err),
    }
  })
  index.rebuild = { state: 'building', done: 0, total: 0, startedAt: Date.now(), finishedAt: 0, failures: [] }
  return { ok: true, started: true }
}

/**
 * Tombs for the two methods the search package used to own before the
 * steward merge. A stale client bundle (browser refresh does not reload the
 * host half) must fail LOUDLY and be told where the feature went — a silent
 * 404 would read as "archiving is broken".
 */
const MOVED_TO_HISTORY: Record<string, string> = {
  'list-archived': 'session-history-list',
  'archive-prune': 'session-history-prune',
}

/** Build the explicit "moved" error body for a tombstoned method. */
function movedToHistory(method: string): { ok: false; error: string } {
  const replacement = MOVED_TO_HISTORY[method]
  return {
    ok: false,
    error: `"${method}" 已并入会话管家 history 子域：请改用 POST ${STEWARD_API_PREFIX}/${replacement}`,
  }
}

/** index-export: dump the active index as JSON Lines. */
async function indexExport(srt: SearchRuntime, res: ServerResponse): Promise<void> {
  const index = srt.index
  if (index.engine.isOpen === false) {
    writeJson(res, 200, { ok: false, error: '独立索引未就绪' })
    return
  }
  writeRaw(res, 200, 'application/x-ndjson; charset=utf-8', exportSnapshot(index.engine))
}

/** index-import: parse a JSON Lines snapshot and swap it in as the active index. */
async function indexImport(srt: SearchRuntime, text: string) {
  const index = srt.index
  if (index.rebuild.state === 'building' || index.rebuild.state === 'swapping') {
    return { ok: false, error: '整理/导入已在进行中' }
  }
  // Body is either raw JSON Lines or a JSON envelope { snapshot: "..." }.
  if (text.includes('"snapshot"')) {
    try {
      const envelope = JSON.parse(text) as { snapshot?: unknown }
      if (typeof envelope.snapshot === 'string') text = envelope.snapshot
    } catch { /* treat as plain JSONL */ }
  }
  const parsed = parseSnapshot(text)
  if (parsed.records.length === 0) return { ok: false, error: `快照无可导入会话（跳过 ${parsed.skipped} 行）` }
  const config = srt.config()
  const keepArchives = Math.max(0, config.archiveKeep ?? SWITCH_DEFAULT_CONFIG.archiveKeep)
  void importIntoIndex(index.engine, index.layout, parsed.records, keepArchives)
    .then((state) => { index.rebuild = state })
    .catch((err) => {
      index.rebuild = {
        state: 'error',
        done: 0,
        total: parsed.records.length,
        startedAt: Date.now(),
        finishedAt: 0,
        failures: [],
        error: String(err instanceof Error ? err.message : err),
      }
    })
  index.rebuild = { state: 'building', done: 0, total: parsed.records.length, startedAt: Date.now(), finishedAt: 0, failures: [] }
  return { ok: true, started: true, sessions: parsed.records.length, skipped: parsed.skipped }
}

/** ------------------------------------------------------------------ index service */

/** The per-activation index service state, carried in the apply closure. */
export interface SwitchIndexServiceState {
  engine: SwitchIndexEngine
  sync: SwitchWatermarkSync
  layout: SwitchIndexLayout
  rebuild: SwitchRebuildState
  /** Official archive-set reader (registry first, storage-hub file fallback). */
  archiveReader: ReturnType<typeof createArchiveSource>
}

/**
 * Everything the search handlers need, captured from the apply closure: the
 * optional live sessionQuery, the index service state, and the latest config.
 * Handlers never touch the cordis context — arbitrary property writes on a
 * Context are rejected ("cannot set property ... without provide").
 */
export interface SearchRuntime {
  sessionQuery: SwitchSessionQuery | undefined
  index: SwitchIndexServiceState
  config: () => Required<StewardConfig> & SwitchSearchConfig
  /** Lazy official archive-set source (registry first, file fallback). */
  registry: () => { archivedSessionIds: readonly string[] }
  /** Cordis logger bridge ([session-steward] prefixed). */
  log: (msg: string) => void
}

/** JSON 面的搜索子域方法分发（index-export/import 走原始体，在路由层特判）。 */
export async function handleIndexMethod(method: string, payload: unknown, srt: SearchRuntime): Promise<unknown> {
  if (method === 'list-sessions') return await listSessions(srt)
  if (method === 'content-search') return await contentSearch(srt, payload)
  if (method === 'search-status') return await searchStatus(srt)
  if (method === 'index-status') return await indexStatus(srt)
  if (method === 'index-rebuild') return await indexRebuild(srt)
  return { ok: false, error: `未知的 switch-search API 方法 "${method}"` }
}

/**
 * 处理一次管家子域 API 调用（导出以便单测直接驱动，不需要起 HTTP）。
 * @param method - 路由方法名。
 * @param payload - 已解析的请求体。
 * @param runtime - 运行时依赖。
 */
export async function handleMethod(
  method: string,
  payload: unknown,
  runtime: StewardRuntime,
): Promise<unknown> {
  const config = runtime.config()
  const known = [...HISTORY_METHODS, ...HEALTH_METHODS] as readonly string[]
  if (!known.includes(method)) {
    return { ok: false, error: `未知的 session-steward API 方法 "${method}"` }
  }
  if (!methodEnabled(method, config)) {
    const which = (HISTORY_METHODS as readonly string[]).includes(method) ? 'historyFiles' : 'healthCheck'
    return { ok: false, error: `子域已关闭（${which}=false）：${method} 未注册` }
  }

  if (method === 'session-history-list') {
    return await listHistory(runtime.registry, undefined, storagePathsFor(runtime.dshHome), runtime.dshHome)
  }
  if (method === 'session-history-prune') {
    return pruneHistory(payload, runtime.log, storagePathsFor(runtime.dshHome))
  }
  if (method === 'session-history-purge') {
    return purgeHistory(payload, runtime.log, {
      dshHome: runtime.dshHome,
      searchPaths: storagePathsFor(runtime.dshHome),
    })
  }

  if (method === 'session-health-status') {
    return {
      ok: true,
      namespace: STEWARD_SETTINGS_NAMESPACE,
      prefix: STEWARD_API_PREFIX,
      switches: { enabled: config.enabled, historyFiles: config.historyFiles, healthCheck: config.healthCheck },
      historyMethods: [...HISTORY_METHODS],
      healthMethods: [...HEALTH_METHODS],
      home: runtime.dshHome,
    }
  }

  if (method === 'session-health-scan') {
    const request = (payload ?? {}) as { limit?: unknown; offset?: unknown; onlyProblems?: unknown; resume?: unknown }
    const onlyProblems = request.onlyProblems !== false

    // resume：**纯读缓存，不扫描**（面板挂载时零成本探一次）。
    // 无缓存时如实回 cached:false 并捎带语料总数，让面板知道「有多少待体检」，
    // 而不是偷偷跑一批——挂载就干重活是上一版被诟病的问题。
    if (request.resume === true) {
      const cached = runtime.cache?.read()
      if (cached === undefined) {
        return { ok: true, cached: false, scanned: 0, total: countCorpus(runtime.dshHome), offset: 0, findings: [] }
      }
      return {
        ok: true,
        cached: true,
        scanned: 0,
        total: cached.total,
        offset: 0,
        findings: cached.findings,
        generatedAt: cached.generatedAt,
        // 当前语料总数：客户端据此提示「语料已变化，建议刷新」。
        currentTotal: countCorpus(runtime.dshHome),
      }
    }

    const limit = typeof request.limit === 'number' && Number.isFinite(request.limit)
      ? Math.max(1, Math.min(MAX_SCAN_LIMIT, Math.floor(request.limit)))
      : 30
    // offset 支持分批扫描：客户端用小批次连续调用并自行累计进度。
    const offset = typeof request.offset === 'number' && Number.isFinite(request.offset) && request.offset > 0
      ? Math.floor(request.offset)
      : 0
    const result = scanSessions({
      dshHome: runtime.dshHome,
      limit,
      offset,
      onlyProblems,
      attribute: runtime.attribute,
      projectionStateFor: runtime.projectionStateFor,
    })
    // 累积缓存：`offset: 0` 起一轮，走满语料才成型（半途而废不留半份缓存）。
    // 只累积「只列问题」的视图；onlyProblems=false 的扫描不碰缓存。
    if (result.ok && onlyProblems) {
      if (offset === 0) runtime.cache?.begin(result.total)
      runtime.cache?.append(result.findings, result.scanned)
    }
    return result
  }

  const request = (payload ?? {}) as { sessionId?: unknown }
  const sessionId = asSessionId(request.sessionId)
  if (sessionId === undefined) return { ok: false, error: '缺少合法的 sessionId' }
  // 按代次定位：会话存在但尚未发布当前代时 logPath 为 undefined，此时仍要出报告
  // （generation / log-integrity 两门如实报出），不能笼统回「未找到会话日志」。
  const session = findSession(sessionId, runtime.dshHome)
  if (session === undefined) return { ok: false, error: `未找到会话日志：${sessionId}` }

  const projectionState = runtime.projectionStateFor(sessionId)
  const reportFor = (): SessionHealthReport => buildSessionReport({
    sessionId,
    dshHome: runtime.dshHome,
    ...(session.logPath === undefined ? {} : { logPath: session.logPath }),
    generations: session.generations,
    ...(projectionState === undefined ? {} : { projectionState }),
    attribute: runtime.attribute,
  })

  if (method === 'session-health-session') {
    const report = reportFor()
    // 单条体检可能改变该会话的档位（如宿主已结算 open step）：就地回写缓存，
    // 免得为了刷新一行而重扫整个语料。
    runtime.cache?.patch(report)
    return { ok: true, report, prescriptions: prescribe(report, runtime.dshHome) }
  }

  // session-health-source-migrate：把 v4 日志里的旧署名行（kind:'plugin' + plugin 字段）
  // 转换为 producer-owned kind。这是「禁止改写会话日志」红线的唯一显式例外：
  // 只动 source 署名字段、先整文件备份、v3 及更早版本线拒绝执行（见 source-kind.ts 的版本依赖表）。
  if (method === 'session-health-source-migrate') {
    if (session.logPath === undefined) {
      return { ok: false, error: '会话尚未发布当前代日志，无从转换（先用会话代次工具发布）' }
    }
    const log = decodeSessionLogFile(session.logPath)
    const outcome = migrateSessionSourceKind(sessionId, session.logPath, log, runtime.dshHome)
    // 转换后重出报告：source-kind 门应转 ok；失败时报告原样（便于面板对照）。
    const after = buildSessionReport({
      sessionId,
      dshHome: runtime.dshHome,
      logPath: session.logPath,
      generations: session.generations,
      ...(projectionState === undefined ? {} : { projectionState }),
      attribute: runtime.attribute,
    })
    runtime.cache?.patch(after)
    runtime.log(
      `source-kind migrate ${sessionId}: ok=${outcome.ok} changed=${outcome.changedRows ?? 0}` +
        (outcome.error === undefined ? '' : ` error=${outcome.error}`),
    )
    return { ok: outcome.ok, outcome, after, report: after, error: outcome.error }
  }

  // session-health-repair：出院前的可逆处置 + before/after 对照 + 结果定性
  const before = reportFor()
  if (before.level === 'ok') {
    // 缓存里可能还留着这个会话的旧档位（扫描时是 warn，宿主后来结算了）：
    // 就地回写把这个陈旧行摘掉。
    runtime.cache?.patch(before)
    const clean = assessRepair({ before, after: before, repair: { ok: false, action: 'quarantine-projection-cache', sessionId, from: '' } })
    return {
      ok: true,
      changed: false,
      before,
      after: before,
      repair: null,
      verdict: clean.verdict,
      explanation: clean.explanation,
      residual: clean.residual,
      prescriptions: ['# 全部检查通过：无需处置'],
    }
  }
  const repair = quarantineProjectionCache(sessionId, runtime.dshHome)
  const after = reportFor()
  // 处置只隔离投影缓存记录；异常若来自别处（如 open step），处置必然无变化。
  // 定性结论把这个事实讲清楚，否则用户只看到「异常 → 异常」会以为功能坏了。
  const assessment = assessRepair({ before, after, repair })
  // 处置本就重算了 after：把它写回缓存，面板退回列表时该行即是最新档位。
  runtime.cache?.patch(after)
  runtime.log(
    `health repair ${sessionId}: verdict=${assessment.verdict} quarantine=${repair.ok ? 'ok' : repair.error ?? 'skipped'} before=${before.level} after=${after.level}`,
  )
  return {
    ok: true,
    changed: repair.ok,
    repair,
    before,
    after,
    verdict: assessment.verdict,
    explanation: assessment.explanation,
    residual: assessment.residual,
    prescriptions: prescribe(after, runtime.dshHome),
  }
}

/**
 * 插件主体：装配运行时、挂载两条 fenced 路由与索引生命周期。
 * @param ctx - host 插件上下文（webServer / webRuntime / 可选 sessionQuery、workspaceRegistry）。
 * @param config - 组合条目（0.1.7：`.volatile()` 字段为 live ref）。
 */
export function apply(ctx: Context, config: Partial<StewardConfig & SwitchSearchConfig> = {}): void {
  // 0.1.7：volatile 字段每次读取解引出最新快照（开关即时生效），不再有任何
  // settings 注册调用。
  const current = (): Required<StewardConfig> & Required<SwitchSearchConfig> => ({
    enabled: readVolatileValue(config.enabled) ?? DEFAULT_CONFIG.enabled,
    historyFiles: readVolatileValue(config.historyFiles) ?? DEFAULT_CONFIG.historyFiles,
    healthCheck: readVolatileValue(config.healthCheck) ?? DEFAULT_CONFIG.healthCheck,
    search: readVolatileValue(config.search) ?? DEFAULT_CONFIG.search,
    defaultMode: readVolatileValue(config.defaultMode) ?? SWITCH_DEFAULT_CONFIG.defaultMode,
    autoSync: readVolatileValue(config.autoSync) ?? SWITCH_DEFAULT_CONFIG.autoSync,
    syncIntervalMs: readVolatileValue(config.syncIntervalMs) ?? SWITCH_DEFAULT_CONFIG.syncIntervalMs,
    archiveKeep: readVolatileValue(config.archiveKeep) ?? SWITCH_DEFAULT_CONFIG.archiveKeep,
    indexDir: readVolatileValue(config.indexDir) ?? SWITCH_DEFAULT_CONFIG.indexDir,
  })

  const log = (message: string): void => {
    try {
      const logger = (ctx as unknown as { logger?: { info?: (m: string) => void; warn?: (m: string) => void } }).logger
      logger?.info?.(`[session-steward] ${message}`)
    } catch { /* 日志绝不允许破坏宿主 */ }
  }

  const homeEnv = process.env['DSH_HOME']
  const resolvedHome = homeEnv !== undefined && homeEnv !== '' ? homeEnv : join(homedir(), '.dsh')

  // 结构镜像取宿主服务（本插件不 value-import 官方包，也不假设 Context 有这些属性）。
  const webServer = (ctx as unknown as { webServer?: StewardWebServer }).webServer
  const webRuntime = (ctx as unknown as { webRuntime?: StewardWebRuntime }).webRuntime
  if (webServer === undefined || webRuntime === undefined) {
    log('webServer / webRuntime 不可用：不注册路由')
    return
  }

  let ownerIndex: ReturnType<typeof buildProjectionOwnerIndex> | undefined
  const attributor = (projection: string): { projection?: string; package?: string } | undefined => {
    try {
      ownerIndex ??= buildProjectionOwnerIndex(defaultProfileNodeModules(resolvedHome))
    } catch (err) {
      log(`attribution index build failed: ${String(err instanceof Error ? err.message : err)}`)
      ownerIndex = []
    }
    return createAttributor(ownerIndex)(projection)
  }

  // 热态投影状态：宿主暴露 sessionProjections.checkpoint(session) 时取得逐行状态（真实判据来源）。
  const projectionStateFor = (sessionId: string): Record<string, unknown> | undefined => {
    try {
      const sessions = ctx.get('sessions') as { get?: (id: string) => unknown } | undefined
      const projections = ctx.get('sessionProjections') as
        | { checkpoint?: (session: unknown) => Record<string, unknown> }
        | undefined
      if (sessions?.get === undefined || projections?.checkpoint === undefined) return undefined
      const session = sessions.get(sessionId)
      if (session === undefined || session === null) return undefined
      return projections.checkpoint(session)
    } catch (err) {
      log(`projection checkpoint unavailable for ${sessionId}: ${String(err instanceof Error ? err.message : err)}`)
      return undefined
    }
  }

  const registry = (): StewardRegistryFace | undefined =>
    ctx.get('workspaceRegistry') as StewardRegistryFace | undefined

  const runtime: StewardRuntime = {
    config: () => current(),
    dshHome: resolvedHome,
    registry,
    projectionStateFor,
    attribute: attributor,
    log,
    cache: new HealthCache(),
  }

  // ── 搜索子域运行时：独立索引生命周期（引擎打开、水位同步、后台轮询）。
  // 全部是后台工作；HTTP 保持即时。
  const initial = current()
  const sessionQuery = ctx.get('sessionQuery') as SwitchSessionQuery | undefined
  const archiveReader = createArchiveSource(() => ctx.get('workspaceRegistry') as SwitchWorkspaceRegistry | undefined)
  const indexLayout: SwitchIndexLayout = {
    ...DEFAULT_INDEX_LAYOUT,
    dir: resolveIndexDir(initial.indexDir || process.env[INDEX_DIR_ENV]),
  }
  const engine = new SwitchIndexEngine({ path: `${indexLayout.dir}/${indexLayout.active}` })
  const indexState: SwitchIndexServiceState = {
    engine,
    archiveReader,
    sync: new SwitchWatermarkSync(engine, {
      listSessions: () => sessionQuery?.listSessions() ?? Promise.resolve([]),
      readSession: async (sessionId: string) => {
        if (sessionQuery?.readSession === undefined) throw new Error('sessionQuery.readSession 不可用')
        return sessionQuery.readSession(sessionId)
      },
      readTitleSnapshots: sessionQuery === undefined
        ? undefined
        : (ids) => sessionQuery.readTitleSnapshots(ids),
    }, () => ({ archivedSessionIds: archiveReader.read().ids }), log),
    layout: indexLayout,
    rebuild: { state: 'idle', done: 0, total: 0, startedAt: 0, finishedAt: 0, failures: [] },
  }
  const srt: SearchRuntime = {
    sessionQuery,
    index: indexState,
    config: () => current(),
    registry: () => ({ archivedSessionIds: archiveReader.read().ids }),
    log,
  }

  const initialConfig = current()
  if (initialConfig.enabled === false) {
    log('enabled=false：不注册任何路由')
    return
  }

  let syncTimer: ReturnType<typeof setInterval> | undefined
  const scheduleSync = (intervalMs: number): void => {
    if (syncTimer !== undefined) clearInterval(syncTimer)
    if (intervalMs <= 0) return
    syncTimer = setInterval(() => {
      const latest = current()
      if (latest.enabled === false || latest.search === false || latest.autoSync === false) return
      void indexState.sync.poll().catch(() => {})
    }, Math.max(5_000, intervalMs))
  }

  // Realtime titles. A rename appends the log-only `session/title` event, which
  // reaches the index one poll later (default 30s). Folding the title straight
  // off the append feed removes that latency without a full pass. The listener
  // is deliberately trivial — this feed carries EVERY appended event, streaming
  // chunks included — and never throws, because it runs inside the host's
  // fire-and-forget append publication.
  let pendingTitleIds = new Set<string>()
  let titleTimer: ReturnType<typeof setTimeout> | undefined
  const flushPendingTitles = (): void => {
    titleTimer = undefined
    const ids = [...pendingTitleIds]
    pendingTitleIds = new Set()
    if (ids.length === 0) return
    void indexState.sync.refreshTitles(ids).catch(() => {})
  }
  ctx.effect(() => {
    const bus = ctx as unknown as {
      on?: (name: string, listener: (session: { id?: unknown }, event: { type?: unknown }) => void) => () => void
    }
    if (typeof bus.on !== 'function') return () => {}
    try {
      return bus.on('session/event', (session, event) => {
        if (event?.type !== TITLE_EVENT_TYPE) return
        const latest = current()
        if (latest.enabled === false || latest.search === false || latest.autoSync === false) return
        const id = session?.id
        if (typeof id !== 'string' || id === '') return
        pendingTitleIds.add(id)
        if (titleTimer !== undefined) return
        titleTimer = setTimeout(flushPendingTitles, TITLE_FLUSH_MS)
      })
    } catch {
      // No event bus on this host: the poll stays the fallback path.
      return () => {}
    }
  }, 'dsh-session-steward: realtime titles')

  // 索引生命周期：恢复巡检 → 打开引擎 → 首轮水位同步 → 定时轮询。
  // search=false 时整套不启动（引擎不开、无后台任务）。
  if (initialConfig.search !== false) {
    void (async () => {
      try {
        const recovered = await recoverIndex(indexLayout, log)
        if (recovered.length > 0) log(`index recovery applied ${recovered.length} fix(es)`)
      } catch (err) {
        log(`index recovery failed: ${String(err instanceof Error ? err.message : err)}`)
      }
      await engine.open().catch(() => {})
      log(`index open: driver=${engine.driverLabel} dir=${indexLayout.dir}`)
      if (engine.driverLabel === 'node:sqlite') {
        log('tip: optional speedup not active — approve the better-sqlite3 build (add "better-sqlite3@*: true" under allowBuilds in the profile pnpm-workspace.yaml, then reinstall) to speed up index rebuilds; everything works without it')
      }
      if (initialConfig.autoSync !== false) await indexState.sync.poll().catch(() => {})
      scheduleSync(initialConfig.syncIntervalMs ?? SWITCH_DEFAULT_CONFIG.syncIntervalMs)
    })()
  }

  ctx.effect(() => () => {
    if (syncTimer !== undefined) clearInterval(syncTimer)
    if (titleTimer !== undefined) clearTimeout(titleTimer)
    engine.close()
  }, 'dsh-session-steward: index lifecycle')

  // ── 管家子域路由。
  ctx.effect(() => webServer.register({
    kind: 'prefix',
    path: STEWARD_API_PREFIX,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (!isTrustedApiRequest(req, webRuntime.trustedHosts)) {
        writeJson(res, 403, { ok: false, error: 'forbidden' })
        return
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
      const prefix = `${STEWARD_API_PREFIX}/`
      const method = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : undefined
      if (method === undefined || method === '' || method.includes('/')) {
        writeJson(res, 404, { ok: false, error: `unknown session-steward API method` })
        return
      }
      try {
        const payload = await readJsonBody(req)
        writeJson(res, 200, await handleMethod(method, payload, runtime))
      } catch (err) {
        // 显式失败：任何未识别方法/异常都返回错误，绝不静默。
        writeJson(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) })
      }
    },
  }), 'dsh-session-steward: /session-steward/api route')

  // ── 搜索子域路由（历史前缀 /switch-search/api）。
  ctx.effect(() => webServer.register({
    kind: 'prefix',
    path: SWITCH_API_PREFIX,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (!isTrustedApiRequest(req, webRuntime.trustedHosts)) {
        writeJson(res, 403, { ok: false, error: 'forbidden' })
        return
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
      const prefix = `${SWITCH_API_PREFIX}/`
      const method = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : undefined
      if (method === undefined || method === '' || method.includes('/')) {
        writeJson(res, 404, { ok: false, error: 'unknown switch-search API method' })
        return
      }
      // 墓碑：这两个方法在分包时代属搜索索引包，合并后已归 history 子域。
      // 旧 client bundle 必须响亮失败并指路，静默 404 会被读成「归档坏了」。
      if (method in MOVED_TO_HISTORY) {
        writeJson(res, 410, movedToHistory(method))
        return
      }
      try {
        if (methodEnabled(method, current()) === false) {
          writeJson(res, 200, { ok: false, error: `子域已关闭（search=false）：${method} 未注册` })
          return
        }
        if (method === 'index-export') {
          await indexExport(srt, res)
          return
        }
        if (method === 'index-import') {
          // The body is raw JSON Lines (or a { snapshot } envelope), not JSON.
          const text = await readRawBody(req)
          writeJson(res, 200, await indexImport(srt, text))
          return
        }
        const payload = await readJsonBody(req)
        writeJson(res, 200, await handleIndexMethod(method, payload, srt))
      } catch (err) {
        writeJson(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) })
      }
    },
  }), 'dsh-session-steward: /switch-search/api route')
}
