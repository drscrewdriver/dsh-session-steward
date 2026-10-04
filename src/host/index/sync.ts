/**
 * Watermark-driven incremental sync between the live-preferred sessionQuery
 * corpus and the independent switch-search index.
 *
 * One pass lists the logical corpus, diffs stored `version` watermarks, and
 * re-reads only new or changed sessions. Per-session failures are isolated and
 * reported; one broken log never stalls the whole sync.
 */
import type { SwitchIndexEngine } from './engine.ts'
import { extractTitleFromEvents, type SwitchRawEvent } from './extract.ts'

/** 标题折叠的分块大小（一次 readTitleSnapshots 的 id 数上限,防整批一坏全坏）。 */
const TITLE_CHUNK = 50

/** The sessionQuery faces the sync reads (structural mirrors). */
export interface SwitchSyncSessionQuery {
  listSessions(): Promise<readonly { header: { id: string; version: number; createdAt?: number; cwd?: string } }[]>
  readSession(sessionId: string): Promise<{
    session: { id: string; version: number; createdAt?: number; cwd?: string }
    events: readonly SwitchRawEvent[]
  }>
  readTitleSnapshots?(sessionIds: readonly string[]): Promise<readonly {
    status: 'fulfilled' | 'rejected'
    value?: { session: { id: string }; title?: { title: string } }
  }[]>
}

/** Live sync progress reported to the status endpoint. */
export interface SwitchSyncState {
  /** What the syncer is doing right now. */
  state: 'idle' | 'syncing' | 'error'
  /** Epoch ms of the last completed pass. */
  lastSyncAt: number
  /** Sessions currently in the index. */
  indexed: number
  /** Sessions seen in the corpus at the last pass. */
  total: number
  /** Sessions re-read in the last pass. */
  updated: number
  /** Per-session failures from the last pass. */
  failures: { sessionId: string; error: string }[]
  /** Last pass error (whole-pass abort), if any. */
  error?: string
}

/**
 * The official archive-set face (workspaceRegistry mirror): read-only.
 * Resolved lazily per pass — the registry may mount after this plugin.
 */
export interface SwitchArchiveSource {
  readonly archivedSessionIds: readonly string[]
}

/**
 * One watermark syncer bound to one open engine. `poll()` is re-entrant-safe:
 * overlapping calls collapse into the running pass.
 */
export class SwitchWatermarkSync {
  private running: Promise<SwitchSyncState> | undefined
  private readonly state: SwitchSyncState = {
    state: 'idle',
    lastSyncAt: 0,
    indexed: 0,
    total: 0,
    updated: 0,
    failures: [],
  }

  /**
   * @param readSessionFromFile - 可选的**文件级兜底读取器**（管家 health 侧的
   * 多帧 zstd 读取器）：sessionQuery.readSession 对某些会话（典型:归档会话,
   * 或服务面退化）失败时改读转录文件。返回 undefined 表示文件也不可用。
   */
  constructor(
    private readonly engine: SwitchIndexEngine,
    private readonly sessionQuery: SwitchSyncSessionQuery,
    private readonly readArchiveSource?: () => SwitchArchiveSource | undefined,
    private readonly log?: (msg: string) => void,
    private readonly readSessionFromFile?: (sessionId: string) => Promise<{
      session: { id: string; version: number; createdAt?: number; cwd?: string }
      events: readonly SwitchRawEvent[]
    } | undefined>,
    /**
     * 第三标题源（可选）:官方投影缓存里的 title 行。事件流没有 session/title
     * 的老会话,快照服务又整片不可用时,这是最后兜底。
     */
    private readonly readProjectionTitle?: (sessionId: string) => string,
  ) {

  }

  /**
   * 读取一个会话的日志:服务面优先,失败落文件兜底。两条路都失败时抛最后
   * 一个错误,由调用方按会话隔离记失败。
   */
  private async readSessionLog(header: { id: string; version: number; createdAt?: number; cwd?: string }): Promise<{
    session: { id: string; version: number; createdAt?: number; cwd?: string }
    events: readonly SwitchRawEvent[]
  }> {
    try {
      return await this.sessionQuery.readSession(header.id)
    } catch (serviceError) {
      if (this.readSessionFromFile === undefined) throw serviceError
      const fromFile = await this.readSessionFromFile(header.id)
      if (fromFile !== undefined) {
        this.log?.(`session ${header.id}: sessionQuery read failed, served from transcript file (${String(serviceError instanceof Error ? serviceError.message : serviceError)})`)
        return fromFile
      }
      throw serviceError
    }
  }

  /** Current progress snapshot (cloned). */
  snapshot(): SwitchSyncState {
    return { ...this.state, failures: [...this.state.failures] }
  }

  /**
   * Fold titles for an explicit id set without running a full pass.
   *
   * Used by the `session/title` event listener so a rename lands immediately
   * rather than at the next poll. It deliberately leaves watermarks alone: a
   * title-only refresh can never make the index claim content it has not read,
   * and the next poll still re-ingests the session off its bumped version.
   * Safe for unknown ids — the header write is a no-op when no row exists.
   * @param sessionIds - sessions whose titles should be re-folded.
   */
  async refreshTitles(sessionIds: readonly string[]): Promise<void> {
    await this.backfillTitles(sessionIds)
  }

  /**
   * Run one incremental pass (or await the running one).
   * @returns the state after the pass completes.
   */
  poll(): Promise<SwitchSyncState> {
    if (this.running !== undefined) return this.running
    this.running = this.runPass().finally(() => {
      this.running = undefined
    })
    return this.running
  }

  private async runPass(): Promise<SwitchSyncState> {
    this.state.state = 'syncing'
    const passStart = Date.now()
    try {
      const records = await this.sessionQuery.listSessions()
      this.state.total = records.length
      // 官方归档集合：纯 flag 翻转（R1 合表复用语义——归档保留 docs,恢复不重灌）。
      // Registry absent -> no-op。
      const archiveSource = this.readArchiveSource?.()
      const archivedSet = new Set(archiveSource?.archivedSessionIds ?? [])
      this.engine.setArchived(archivedSet)
      const failures: { sessionId: string; error: string }[] = []
      let updated = 0
      const changedIds: string[] = []
      for (const record of records) {
        const header = record.header
        const existing = this.engine.getSession(header.id)
        // 归档与活跃同一读取通路：readSession 对归档会话是 replay-validate 不激活
        // （宿主 session-query 保证）。归档正文因此入索引（可被 archived 域检索）。
        if (existing !== undefined && existing.version === header.version) continue
        changedIds.push(header.id)
        try {
          const log = await this.readSessionLog(header)
          this.engine.upsertSession({
            sessionId: header.id,
            version: header.version,
            cwd: log.session.cwd ?? header.cwd ?? '',
            updatedAt: log.session.createdAt ?? header.createdAt ?? 0,
            // 标题基础层:事件流白拿（归档 id 也能拿到）;快照折叠只做精修。
            title: extractTitleFromEvents(log.events),
            events: log.events,
            // 新行插入时带上归档标记（ON CONFLICT 不动旧行的 flag,翻转仍归
            // setArchived）—— 免掉"插行要等下一轮 setArchived 才翻 flag"的单轮滞后。
            archived: archivedSet.has(header.id),
          })
          updated += 1
        } catch (err) {
          failures.push({ sessionId: header.id, error: String(err instanceof Error ? err.message : err) })
        }
      }
      // 归档覆盖:某些宿主线的 listSessions 可能不含归档会话 —— 归档集合里的
      // id 若还没有索引行,这里显式补齐（readSession 对归档是 replay-validate,
      // 失败时走文件兜底）。
      for (const archivedId of archivedSet) {
        if (this.engine.getSession(archivedId) !== undefined) continue
        try {
          const log = await this.readSessionLog({ id: archivedId, version: -1 })
          this.engine.upsertSession({
            sessionId: archivedId,
            version: log.session.version,
            cwd: log.session.cwd ?? '',
            updatedAt: log.session.createdAt ?? 0,
            title: extractTitleFromEvents(log.events),
            events: log.events,
            archived: true,
          })
          updated += 1
        } catch (err) {
          failures.push({ sessionId: archivedId, error: `archived: ${String(err instanceof Error ? err.message : err)}` })
        }
      }
      // Drop sessions that vanished from the corpus —— 但**归档集合里的行不删**：
      // 某些宿主线的 listSessions 可能过滤归档,归档集合才是删除真值（purge 会把
      // id 从归档数组里摘掉,彼时下一轮自然清行）。
      const corpusIds = new Set(records.map(record => record.header.id))
      for (const indexed of this.engine.listIndexedSessions()) {
        if (!corpusIds.has(indexed.sessionId) && !archivedSet.has(indexed.sessionId)) {
          this.engine.removeSession(indexed.sessionId)
        }
      }
      await this.backfillTitles(changedIds)
      // 空标题扫尾:重建行/老会话可能没有 session/title 事件,快照精修后仍空
      // 的行用投影缓存兜底。每轮封顶 100 行,标题落地后集合自然收缩。
      const emptyTitles = this.engine.listIndexedSessions()
        .filter(session => session.title.trim() === '')
        .map(session => session.sessionId)
        .slice(0, 100)
      if (emptyTitles.length > 0) {
        await this.backfillTitles(emptyTitles)
        let filled = 0
        for (const id of emptyTitles) {
          const row = this.engine.getSession(id)
          if (row !== undefined && row.title.trim() !== '') continue
          const fromProjection = this.readProjectionTitle?.(id) ?? ''
          if (fromProjection.trim() !== '') {
            this.engine.updateSessionHeader({ sessionId: id, title: fromProjection })
            filled += 1
          }
        }
        if (filled > 0) this.log?.(`title sweep: ${filled}/${emptyTitles.length} filled from projection cache`)
      }
      this.state.updated = updated
      this.state.failures = failures
      this.state.indexed = this.engine.countSessions()
      this.state.lastSyncAt = Date.now()
      this.state.state = 'idle'
      this.state.error = undefined
      this.log?.(`sync pass: scanned=${this.state.total} updated=${updated} archived=${archivedSet.size} failures=${failures.length} indexed=${this.state.indexed} duration=${Date.now() - passStart}ms driver=${this.engine.driverLabel}`)
    } catch (err) {
      this.state.state = 'error'
      this.state.error = String(err instanceof Error ? err.message : err)
      this.log?.(`sync pass FAILED: ${this.state.error}`)
    }
    return this.snapshot()
  }

  /**
   * Fold latest titles for changed sessions into the index header rows.
   *
   * beta.4 教训:整批一次调用,任何一个坏 id（典型:归档 id）让整个 promise
   * reject,catch 一吞就是**全部**标题丢失。改为分块 + 块失败时逐 id 重试 ——
   * 单点坏 id 最多损失它自己的精修标题（入索引时的 extractTitleFromEvents
   * 基础层仍然在）。
   */
  private async backfillTitles(sessionIds: readonly string[]): Promise<void> {
    const readTitles = this.sessionQuery.readTitleSnapshots
    if (readTitles === undefined || sessionIds.length === 0) return
    const ids = [...new Set(sessionIds)]
    const foldOne = (observation: { status: 'fulfilled' | 'rejected'; value?: { session: { id: string }; title?: { title: string } } }): void => {
      if (observation.status !== 'fulfilled' || observation.value === undefined) return
      const title = observation.value.title?.title
      // 归档行的标题同样折叠（归档会话仍可改名,索引标题要跟上）。
      if (typeof title === 'string' && title.trim().length > 0) {
        this.engine.updateSessionHeader({ sessionId: observation.value.session.id, title })
      }
    }
    for (let start = 0; start < ids.length; start += TITLE_CHUNK) {
      const chunk = ids.slice(start, start + TITLE_CHUNK)
      try {
        const observations = await readTitles(chunk)
        observations.forEach(foldOne)
      } catch {
        // 整块失败 → 逐 id 重试,坏 id 只损失自己。
        for (const id of chunk) {
          try {
            const observations = await readTitles([id])
            observations.forEach(foldOne)
          } catch { /* 该 id 的精修标题放弃,基础层标题仍在 */ }
        }
      }
    }
  }
}
