/**
 * 替换官方 workspace 注册表的管家子类(P1 服务替换,AM 架构轻量版)。
 *
 * cordis.patch.yml 禁用官方 `workspace` 行并插入本类(`dsh-session-steward/registry`):
 * - 归档/取消归档/记账完全继承官方行为(setState 自带持久化,免重启);
 * - 覆写 sessionKnown / indexHeader 挂**墓碑**:本进程已物理删除的会话不被
 *   stale `persistence.list()` 重新编入索引、不被重新写回归档集合;
 * - 冷复用探针:其他进程以同 id 重建且日志身份不同(createdAt/cwd)的新会话
 *   撤墓碑放行,避免误挡;
 * - `deleteSession`:全痕删除七步 —— 实时 flush/detach → 等投影写尾 → 删缓存
 *   文件 → subagent 后代级联(fork 不级联)→ 清 spill → 删转录目录(越界防护)
 *   → 记账清理(归档集合 + 工作区成员表)+ 父类内存索引遗忘。物理成功才提交
 *   记账,失败保留现场可重试。
 *
 * 已知边界:官方投影缓存服务无 delete API,缓存行走"等写尾 + 删文件"直删
 * (官方缓存 fail-soft 自愈兜底);whenIdle 只覆盖本类感知的在途写。
 *
 * 类型策略(AM 同款):官方把 sessionKnown/indexHeader/requireState 等声明为
 * TS private,子类用结构化镜像接口松化基类构造器 —— 运行时成员逐一存在
 * (0.1.7/0.2.0 实证),逐段 try/catch 容忍老线形状漂移。
 */
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import type { Context } from 'cordis'
import { WorkspaceRegistry } from '@deepseek-ai/dsh-workspace'
import { dirKey, isSafeChild, locateSessionUsage, projCacheRootFor, sessionsRootFor } from '../history/purge.ts'

/** 官方 sessions 服务面(结构化镜像,全线存在)。 */
interface RegistrySessionsFace {
  get?(id: string): { id?: string; header?: StewardHeaderLike } | undefined
  list?(): { id?: string; header?: StewardHeaderLike }[]
  flush?(live: unknown): Promise<void>
  liveEntryFor?(live: unknown): unknown
  detachEntered?(entry: unknown): void
}

/** 会话头部子集(父类内部 headers / persistence.list 的公共形状)。 */
interface StewardHeaderLike {
  id?: string
  createdAt?: number
  cwd?: string
  parentSession?: string
  origin?: string
}

/**
 * 父类运行时面的结构化镜像:private 成员在此公开化。成员按 0.1.7/0.2.0
 * 实测形状声明;调用点逐段 try/catch,老线缺失时删除路径报错可重试。
 */
interface StewardRegistryCompat {
  ctx: Context
  headers?: Map<string, StewardHeaderLike>
  sessionPaths?: Map<string, unknown>
  invalidSessionPaths?: Set<string>
  entities?: Map<string, { record?: unknown }>
  sessionKnown(id: string): Promise<boolean>
  indexHeader(header: StewardHeaderLike): Promise<void>
  listStoredHeaders?(): Promise<StewardHeaderLike[]>
  requireState?(): { archivedSessionIds?: string[]; workspaceIds?: readonly string[] }
  setState?(state: unknown): Promise<void>
  requireTable?(): {
    get?(id: string): { sessionIds?: string[] } | undefined
    update?(id: string, fn: (current: { sessionIds: string[] }) => unknown): Promise<unknown>
  }
}

type StewardWorkspaceConstructor = { new (ctx: Context): StewardRegistryCompat }

const TOMBSTONE_LIMIT = 4096

export const StewardWorkspaceRegistry = class extends (WorkspaceRegistry as unknown as StewardWorkspaceConstructor) {
  static inject = ['storageDomain', 'sessionPersistence']

  /** 本进程已物理删除的会话墓碑(FIFO 上限淘汰,宁多挡不错放)。 */
  deletedSessionIds = new Set<string>()
  deletedSessionOrder: string[] = []
  /** 被删生命周期的日志身份:冷复用探针区分"同 id 新会话"与 stale list()。 */
  deletedIdentities = new Map<string, { createdAt?: number; cwd?: string }>()
  /** 转录/缓存文件定位根(apply 装配时注入;缺失时文件删除跳过并记日志)。 */
  dshHome = ''

  private log(message: string): void {
    try {
      (this.ctx as unknown as { logger?: { info?: (m: string) => void; warn?: (m: string) => void } })
        .logger?.info?.(`[session-steward] ${message}`)
    } catch { /* 日志绝不破坏宿主 */ }
  }

  /** ── 墓碑层:覆写父类的已知性判定与头部索引 ── */

  async sessionKnown(id: string): Promise<boolean> {
    const sessions = this.ctx.get('sessions') as { get?: (id: string) => unknown } | undefined
    if (sessions?.get?.(id) !== undefined && sessions.get!(id) !== null) {
      this.clearTombstone(id)
      return true
    }
    if (this.deletedSessionIds.has(id)) return await this.coldReuseKnown(id)
    return await super.sessionKnown(id)
  }

  /** 冷复用探针:同 id 重建且日志身份不同 → 撤墓碑重新编入;身份不可考则保守维持未知。 */
  private async coldReuseKnown(id: string): Promise<boolean> {
    const deleted = this.deletedIdentities.get(id)
    if (deleted === undefined) return false
    const headers = await this.allStoredHeaders()
    const header = headers.find(item => item.id === id)
    if (header === undefined) return false
    if (header.createdAt === deleted.createdAt && header.cwd === deleted.cwd) return false
    this.clearTombstone(id)
    try {
      await this.indexHeader(header)
    } catch { /* 重编入失败不阻断已知性 */ }
    return true
  }

  async indexHeader(header: StewardHeaderLike): Promise<void> {
    if (header.id !== undefined && this.deletedSessionIds.has(header.id)) return
    await super.indexHeader(header)
  }

  clearTombstone(sessionId: string): void {
    this.deletedSessionIds.delete(sessionId)
    this.deletedIdentities.delete(sessionId)
    const idx = this.deletedSessionOrder.indexOf(sessionId)
    if (idx >= 0) this.deletedSessionOrder.splice(idx, 1)
  }

  /** ── 全痕删除 ── */

  /** 逐会话入口:任何一步失败都返回 ok:false + error,记账保留现场可重试。 */
  async deleteSession(sessionId: string): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
    try {
      return await this.deleteCore(sessionId)
    } catch (err) {
      const message = String(err instanceof Error ? err.message : err)
      this.log(`delete ${sessionId} failed: ${message}`)
      return { ok: false, error: message }
    }
  }

  private async deleteCore(sessionId: string, descendantHeaders?: StewardHeaderLike[]): Promise<{ ok: boolean; skipped?: boolean }> {
    if (!(await this.sessionKnown(sessionId))) {
      // 未知会话:清掉可能残留的记账(归档集合/工作区表),不留僵尸 id。
      await this.forgetBookkeeping(sessionId)
      this.log(`delete ${sessionId}: unknown session, residual bookkeeping cleared`)
      return { ok: true, skipped: true }
    }
    const sessions = this.ctx.get('sessions') as RegistrySessionsFace | undefined
    const live = sessions?.get?.(sessionId)
    const deletedHeader = this.headers?.get(sessionId) ?? live?.header
    if (live !== undefined) {
      // 持久化屏障先行:flush 过的会话不再持有打开的日志文件,目录删除不竞争。
      await sessions!.flush!(live)
      const entry = sessions!.liveEntryFor!(live)
      sessions!.detachEntered!(entry)
    }
    // 投影缓存:等 dispose 写尾落盘,再直删缓存文件(官方服务无 delete API)。
    const projCache = this.ctx.get('sessionProjectionCache') as { whenIdle?: () => Promise<void> } | undefined
    await projCache?.whenIdle?.()
    this.deleteProjectionCacheFile(sessionId)
    await this.deleteDescendants(sessionId, descendantHeaders)
    await this.cleanSpill(sessionId)
    this.removeTranscriptDirectory(sessionId)
    // 物理工件删除成功后才提交记账清理;失败时保留归档标记/成员表以便重试。
    await this.forgetBookkeeping(sessionId)
    this.forgetIndexedSession(sessionId)
    if (deletedHeader !== undefined) {
      this.deletedIdentities.set(sessionId, { createdAt: deletedHeader.createdAt, cwd: deletedHeader.cwd })
    }
    try {
      (this.ctx as unknown as { emit?: (name: string, payload?: unknown) => void }).emit?.('api-session/removed', sessionId)
    } catch { /* 通知失败不阻断删除结论 */ }
    return { ok: true }
  }

  /** subagent 后代级联:live 列表优先,stored headers 兜底;fork(parentSession 有值但 origin 非 subagent)不级联。 */
  private async deleteDescendants(sessionId: string, storedHeaders?: StewardHeaderLike[]): Promise<void> {
    try {
      const descendants: string[] = []
      const sessions = this.ctx.get('sessions') as RegistrySessionsFace & { list?: () => { id?: string; header?: StewardHeaderLike }[] } | undefined
      const listed = typeof sessions?.list === 'function' ? sessions.list() : []
      for (const session of listed) {
        const header = session?.header
        if (header?.parentSession === sessionId && header.origin === 'subagent' && typeof session.id === 'string') {
          descendants.push(session.id)
        }
      }
      if (descendants.length === 0) {
        const headers = storedHeaders ?? await this.allStoredHeaders()
        for (const header of headers) {
          if (header.parentSession === sessionId && header.origin === 'subagent' && typeof header.id === 'string') {
            descendants.push(header.id)
          }
        }
      }
      for (const child of descendants) {
        if (child === sessionId) continue
        await this.deleteCore(child, storedHeaders)
      }
      if (descendants.length > 0) this.log(`delete ${sessionId}: cascaded ${descendants.length} subagent descendant(s)`)
    } catch (err) {
      this.log(`descendant cascade for ${sessionId} failed: ${String(err instanceof Error ? err.message : err)}`)
    }
  }

  /** 父类 listStoredHeaders(0.1.5+)→ sessionPersistence.list 兜底 → 空数组。 */
  private async allStoredHeaders(): Promise<StewardHeaderLike[]> {
    try {
      const listed = await this.listStoredHeaders?.()
      if (Array.isArray(listed)) return listed
    } catch { /* 老线无此方法 → 兜底 */ }
    try {
      const persistence = this.ctx.get('sessionPersistence') as { list?: () => Promise<StewardHeaderLike[]> } | undefined
      const listed = await persistence?.list?.()
      if (Array.isArray(listed)) return listed
    } catch { /* 读不到就当空 */ }
    return []
  }

  /** spill 目录直删(sessionDir(root, sessionId) — spill-local 包自己的签名)。 */
  private async cleanSpill(sessionId: string): Promise<void> {
    try {
      const spill = this.ctx.get('spillStore') as { root?: string } | undefined
      if (spill === undefined || typeof spill.root !== 'string') return
      const spec = '@deepseek-ai/dsh-spill-local'
      const mod = (await import(spec)) as { sessionDir?: (root: string, id: string) => string }
      if (typeof mod.sessionDir !== 'function') return
      rmSync(mod.sessionDir(spill.root, sessionId), { recursive: true, force: true })
    } catch (err) {
      this.log(`spill cleanup for ${sessionId} failed: ${String(err instanceof Error ? err.message : err)}`)
    }
  }

  /** 转录目录删除:文件扫描定位(与文件路径同一套越界防护)。 */
  private removeTranscriptDirectory(sessionId: string): void {
    if (this.dshHome === '') {
      this.log(`transcript deletion for ${sessionId} skipped: dshHome not wired`)
      return
    }
    const usage = locateSessionUsage([sessionId], this.dshHome)
    const entry = usage.get(sessionId)
    if (entry?.dir === undefined) return
    if (!isSafeChild(sessionsRootFor(this.dshHome), entry.dir, 2)) {
      this.log(`refusing out-of-root transcript path: ${entry.dir}`)
      return
    }
    rmSync(entry.dir, { recursive: true, force: true })
  }

  /** 缓存文件直删:双候选文件名(带/不带 session- 前缀,与 purge.ts 同纪律)。 */
  private deleteProjectionCacheFile(sessionId: string): void {
    if (this.dshHome === '') return
    const cacheRoot = projCacheRootFor(this.dshHome)
    for (const name of [`${sessionId}.json`, `${dirKey(sessionId)}.json`]) {
      const candidate = join(cacheRoot, name)
      if (!isSafeChild(cacheRoot, candidate, 1)) continue
      try {
        rmSync(candidate, { force: true })
      } catch { /* 竞态:文件刚被删 */ }
    }
  }

  /** 记账清理:归档集合(setState)+ 工作区成员表(requireTable)。逐段容错。 */
  private async forgetBookkeeping(sessionId: string): Promise<void> {
    try {
      const state = this.requireState?.()
      if (state?.archivedSessionIds !== undefined && this.setState !== undefined
        && Array.isArray(state.archivedSessionIds) && state.archivedSessionIds.includes(sessionId)) {
        await this.setState({
          ...state,
          archivedSessionIds: state.archivedSessionIds.filter(id => id !== sessionId),
        })
      }
    } catch (err) {
      this.log(`archive-set bookkeeping cleanup for ${sessionId} failed: ${String(err instanceof Error ? err.message : err)}`)
    }
    try {
      const table = this.requireTable?.()
      const state = this.requireState?.()
      const workspaceIds = state?.workspaceIds
      if (table?.update === undefined || !Array.isArray(workspaceIds)) return
      for (const workspaceId of workspaceIds) {
        const record = table.get?.(workspaceId)
        if (record === undefined || !Array.isArray(record.sessionIds) || !record.sessionIds.includes(sessionId)) continue
        const next = await table.update(workspaceId, (current: { sessionIds: string[] }) => ({
          ...current,
          sessionIds: current.sessionIds.filter(id => id !== sessionId),
        }))
        const entity = this.entities?.get(workspaceId)
        if (entity !== undefined) entity.record = next
      }
    } catch (err) {
      this.log(`workspace bookkeeping cleanup for ${sessionId} failed: ${String(err instanceof Error ? err.message : err)}`)
    }
  }

  /** 父类内存索引遗忘 + 墓碑登记(FIFO 上限淘汰)。 */
  private forgetIndexedSession(sessionId: string): void {
    if (!this.deletedSessionIds.has(sessionId)) {
      this.deletedSessionIds.add(sessionId)
      this.deletedSessionOrder.push(sessionId)
    }
    while (this.deletedSessionOrder.length > TOMBSTONE_LIMIT) {
      const oldest = this.deletedSessionOrder.shift()
      // id 自身被挤出队列时保留在集合中:宁多挡不错放。
      if (oldest !== undefined && oldest !== sessionId) {
        this.deletedSessionIds.delete(oldest)
        this.deletedIdentities.delete(oldest)
      }
    }
    try { this.headers?.delete(sessionId) } catch { /* 内部形状漂移容忍 */ }
    try { this.sessionPaths?.delete?.(sessionId) } catch { /* 同上 */ }
    try { this.invalidSessionPaths?.delete?.(sessionId) } catch { /* 同上 */ }
  }
} as unknown as typeof WorkspaceRegistry

export type StewardWorkspaceRegistry = WorkspaceRegistry
