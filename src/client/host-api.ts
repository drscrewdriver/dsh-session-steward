/**
 * 客户端 host 调用助手：一切经 fenced `/session-steward/api/<method>` 路由，
 * 不 value-import 任何官方包（与 dsh-session-search-toggle 的 host-api.ts 同范式，
 * 仅把路由前缀换成会话管家自己的）。
 */

/** 单次 host 调用超时（导入类大响应可单独放宽）。 */
const FETCH_TIMEOUT = 20_000

/** POST 一个 JSON body 到会话管家的 fenced API（items 形状）。 */
export function callHost<T>(method: string, body: unknown): Promise<{ ok: boolean; items: T[]; error?: string }> {
  const controller = typeof AbortController === 'undefined' ? undefined : new AbortController()
  const timer = controller !== undefined && typeof setTimeout === 'function'
    ? setTimeout(() => { controller.abort() }, FETCH_TIMEOUT)
    : undefined
  return fetch(`/session-steward/api/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller?.signal,
  })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((data: unknown) => {
      const record = data as { ok?: boolean; items?: T[]; error?: string }
      if (record && record.ok === true && Array.isArray(record.items)) {
        return { ok: true, items: record.items }
      }
      return { ok: false, items: [], error: record?.error ?? '请求失败' }
    })
    .catch((err: unknown) => ({
      ok: false,
      items: [],
      error: err instanceof DOMException && err.name === 'AbortError' ? '请求超时' : String(err instanceof Error ? err.message : err),
    }))
    .finally(() => {
      if (timer !== undefined) clearTimeout(timer)
    })
}

/** POST 一个 JSON body，返回整条记录。 */
export function callHostAny<T>(
  method: string,
  body: unknown,
  timeout = FETCH_TIMEOUT,
): Promise<Partial<T> & { ok: boolean; error?: string }> {
  const controller = typeof AbortController === 'undefined' ? undefined : new AbortController()
  const timer = typeof setTimeout === 'function'
    ? setTimeout(() => { controller?.abort() }, timeout)
    : undefined
  return fetch(`/session-steward/api/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller?.signal,
  })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .catch((err: unknown) => ({
      ok: false,
      error: err instanceof DOMException && err.name === 'AbortError' ? '请求超时' : String(err instanceof Error ? err.message : err),
    }))
    .finally(() => {
      if (timer !== undefined) clearTimeout(timer)
    })
}

/** 一条历史文件行（与 host 侧 StewardHistoryRow 对齐）。 */
export interface HistoryRow {
  sessionId: string
  title: string
  cwd: string
  updatedAt: number
  /** 转录目录占用字节数（0 = 未知或磁盘上无实体）。 */
  bytes: number
  /** 投影缓存占用字节数。 */
  cacheBytes: number
}

/** 历史文件列表响应。 */
export interface HistoryListResponse {
  ok: boolean
  items?: HistoryRow[]
  source?: 'registry' | 'storage-file' | 'none'
  degraded?: string
  /** 已从存储文件移除、但宿主内存里仍生效的 id 数。 */
  pendingRestart?: number
  error?: string
}

/** 归档文件清理（真删除）响应。 */
export interface HistoryPurgeResponse {
  ok: boolean
  purged?: number
  freedBytes?: number
  failures?: { sessionId: string; reason: string }[]
  requiresRestart?: boolean
  error?: string
}

/** 一个 gate 的结果（与 host 侧 GateResult 对齐）。 */
export interface HealthGate {
  id: 'log-integrity' | 'projection-cache' | 'lossless-json' | 'cold-read'
  level: 'ok' | 'warn' | 'fail' | 'skipped'
  evidence: string
  attribution?: { projection?: string; package?: string; field?: string }
  detail?: Record<string, unknown>
}

/** 单会话体检报告。 */
export interface HealthReport {
  sessionId: string
  /** 总判：聚合时 `skipped` 不抬升（见 host 侧 buildSessionReport）。 */
  level: 'ok' | 'warn' | 'fail'
  gates: HealthGate[]
  generatedAt: number
}

/** 体检扫描响应。 */
export interface HealthScanResponse {
  ok: boolean
  /** 本次响应是否来自缓存（`resume: true` 时的命中标记）。 */
  cached?: boolean
  /** 本批已访问的会话数（分批扫描的进度步长）。 */
  scanned?: number
  /** 语料总数（进度分母）；缓存命中时为**缓存生成时**的语料总数。 */
  total?: number
  /** 本批起点（原样回显）。 */
  offset?: number
  findings?: HealthReport[]
  /** 缓存的生成时刻（epoch ms）；仅缓存命中时给出。 */
  generatedAt?: number
  /** 当前语料总数；与 `total` 不一致即「语料已变化」。 */
  currentTotal?: number
  error?: string
}

/** 单会话体检响应。 */
export interface HealthSessionResponse {
  ok: boolean
  report?: HealthReport
  prescriptions?: string[]
  error?: string
}

/** 处置结果的定性分类（与 host 侧 RepairVerdict 对齐）。 */
export type RepairVerdict =
  | 'nothing-to-do'
  | 'repaired'
  | 'repaired-with-residual'
  | 'not-applicable'
  | 'failed'

/** 出院（可逆处置）响应。 */
export interface HealthRepairResponse {
  ok: boolean
  changed?: boolean
  before?: HealthReport
  after?: HealthReport
  repair?: { ok: boolean; from?: string; to?: string; error?: string; requiresRestart?: boolean }
  /** 处置结果的定性分类：区分「生效」「生效但有无关残留」「无可处置项」「失败」。 */
  verdict?: RepairVerdict
  /** 人读说明：为什么处置后仍然异常（或已恢复）。 */
  explanation?: string
  /** 处置后仍未解决的门。 */
  residual?: { id: HealthGate['id']; level: HealthGate['level'] }[]
  prescriptions?: string[]
  error?: string
}

/** 状态响应。 */
export interface HealthStatusResponse {
  ok: boolean
  switches?: { enabled: boolean; historyFiles: boolean; healthCheck: boolean }
  historyMethods?: string[]
  healthMethods?: string[]
  home?: string
  error?: string
}
