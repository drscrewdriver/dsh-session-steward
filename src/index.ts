/**
 * dsh-session-steward 主机半身：一条 fenced HTTP 路由 `/session-steward/api`
 * （与搜索索引插件的 `/switch-search/api` **完全隔离**，方法名一律 `session-*`）。
 *
 * 两个子域由两个开关做 feature gate：
 * - `historyFiles`（会话历史文件 / 养老院）：`session-history-*`；
 * - `healthCheck`（健康检查 / 体检）：`session-health-*`。
 * 关掉的子域**不注册对应方法**（调用返回显式 disabled 错误），不留空壳。
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
  type StewardConfig,
} from './config.ts'
import { listHistory, pruneHistory, storagePathsFor } from './host/history/archive.ts'
import type { StewardRegistryFace } from './host/history/archive-source.ts'
import { buildProjectionOwnerIndex, createAttributor, defaultProfileNodeModules } from './host/health/attribution.ts'
import { HealthCache } from './host/health/cache.ts'
import { buildSessionReport, type SessionHealthReport } from './host/health/gates.ts'
import { assessRepair, prescribe, quarantineProjectionCache } from './host/health/repair.ts'
import { countCorpus, findSessionLog, scanSessions } from './host/health/scan.ts'

export { DEFAULT_CONFIG, STEWARD_API_PREFIX, STEWARD_SETTINGS_NAMESPACE } from './config.ts'
export type { StewardConfig } from './config.ts'
export { readArchiveSet, pruneArchiveFile } from './host/history/archive-source.ts'
export { listHistory, pruneHistory } from './host/history/archive.ts'
export { buildSessionReport, gateColdRead, gateLogIntegrity, gateLosslessJson, gateProjectionCache, readProjectionCache, readTailFacts } from './host/health/gates.ts'
export { firstLosslessViolation, isLossless } from './host/health/lossless.ts'
export { decodeSessionLogBytes, decodeSessionLogFile, scanZstdFrames } from './host/health/decode.ts'
export { buildProjectionOwnerIndex, createAttributor } from './host/health/attribution.ts'
export { prescribe, quarantineProjectionCache } from './host/health/repair.ts'
export { countCorpus, discoverSessions, findSessionLog, scanSessions } from './host/health/scan.ts'
export { HealthCache } from './host/health/cache.ts'
export type { HealthCacheEntry } from './host/health/cache.ts'
export { assessRepair } from './host/health/repair.ts'
export type { RepairAssessment, RepairVerdict } from './host/health/repair.ts'

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

/** settings 服务面（结构化镜像）。 */
interface SettingsScopeLike {
  get(): unknown
  watch(callback: () => void): () => void
}
interface SettingsServiceLike {
  register(ns: string, schema: unknown, options?: { base?: unknown }): SettingsScopeLike
}
interface SettingsAwareCtx {
  inject(deps: readonly string[], fn: (sctx: {
    settings: SettingsServiceLike
    effect(cleanup: () => (() => void) | void, label?: string): void
  }) => void): void
}

/** 运行时配置 schema（与 src/config.ts 的形状保持一致）。 */
const Config = z.object({
  enabled: z.boolean().default(true),
  historyFiles: z.boolean().default(true),
  healthCheck: z.boolean().default(true),
})

/**
 * 官方 `installSettingsSection` 的内联等价：通过 settings 服务注册命名空间、
 * 以组合入口作为 `base` 层、并保持运行时来源实时（与 toggle / thinking-levels 同范式）。
 */
function installSettingsSection<T>(
  ctx: Context,
  ns: string,
  schema: unknown,
  entry: T,
  hooks: { setSource: (source: () => T) => void; onChange: () => void },
): void {
  ;(ctx as unknown as SettingsAwareCtx).inject(['settings'], (sctx) => {
    const scope = sctx.settings.register(ns, schema, { base: entry })
    hooks.setSource(() => scope.get() as T)
    hooks.onChange()
    sctx.effect(() => () => {
      hooks.setSource(() => entry)
      hooks.onChange()
    })
    scope.watch(() => hooks.onChange())
  })
}

/** 单次请求体的上限（防御无界读取）。 */
const MAX_BODY_BYTES = 16 << 20

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

/** 支持的路由方法（按子域分组；用于对外声明与测试断言）。 */
export const HISTORY_METHODS = ['session-history-list', 'session-history-prune'] as const
export const HEALTH_METHODS = [
  'session-health-status',
  'session-health-scan',
  'session-health-session',
  'session-health-repair',
] as const

/** 依据开关判定某方法是否启用。 */
export function methodEnabled(method: string, config: Required<StewardConfig>): boolean {
  if ((HISTORY_METHODS as readonly string[]).includes(method)) return config.historyFiles !== false
  if ((HEALTH_METHODS as readonly string[]).includes(method)) return config.healthCheck !== false
  return false
}

/**
 * 处理一次 API 调用（导出以便单测直接驱动，不需要起 HTTP）。
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
    return await listHistory(runtime.registry, undefined, storagePathsFor(runtime.dshHome))
  }
  if (method === 'session-history-prune') {
    return pruneHistory(payload, runtime.log, storagePathsFor(runtime.dshHome))
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
  const logPath = findSessionLog(sessionId, runtime.dshHome)
  if (logPath === undefined) return { ok: false, error: `未找到会话日志：${sessionId}` }

  const projectionState = runtime.projectionStateFor(sessionId)
  const reportFor = (): SessionHealthReport => buildSessionReport({
    sessionId,
    dshHome: runtime.dshHome,
    logPath,
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
      prescriptions: ['# 四门全绿：无需处置'],
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
 * 插件主体：注册设置命名空间、装配运行时、挂载 fenced 路由。
 * @param ctx - host 插件上下文（webServer / webRuntime / 可选 settings、sessionQuery、sessions、sessionProjections）。
 */
export function apply(ctx: Context): void {
  let current: () => Required<StewardConfig> = () => DEFAULT_CONFIG
  installSettingsSection(ctx, STEWARD_SETTINGS_NAMESPACE, Config, DEFAULT_CONFIG, {
    setSource: (source) => { current = () => ({ ...DEFAULT_CONFIG, ...(source() as Partial<StewardConfig>) }) },
    onChange: () => {},
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

  const initial = current()
  if (initial.enabled === false) {
    log('enabled=false：不注册任何路由')
    return
  }

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
}
