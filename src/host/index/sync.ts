/**
 * Watermark-driven incremental sync between the live-preferred sessionQuery
 * corpus and the independent switch-search index.
 *
 * One pass lists the logical corpus, diffs stored `version` watermarks, and
 * re-reads only new or changed sessions. Per-session failures are isolated and
 * reported; one broken log never stalls the whole sync.
 */
import type { SwitchIndexEngine } from './engine.ts'
import type { SwitchRawEvent } from './extract.ts'

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

  constructor(
    private readonly engine: SwitchIndexEngine,
    private readonly sessionQuery: SwitchSyncSessionQuery,
    private readonly readArchiveSource?: () => SwitchArchiveSource | undefined,
    private readonly log?: (msg: string) => void,
  ) {

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
          const log = await this.sessionQuery.readSession(header.id)
          this.engine.upsertSession({
            sessionId: header.id,
            version: log.session.version,
            cwd: log.session.cwd ?? '',
            updatedAt: log.session.createdAt ?? 0,
            events: log.events,
          })
          updated += 1
        } catch (err) {
          failures.push({ sessionId: header.id, error: String(err instanceof Error ? err.message : err) })
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

  /** Fold latest titles for changed sessions into the index header rows. */
  private async backfillTitles(sessionIds: readonly string[]): Promise<void> {
    const readTitles = this.sessionQuery.readTitleSnapshots
    if (readTitles === undefined || sessionIds.length === 0) return
    try {
      const observations = await readTitles([...new Set(sessionIds)])
      for (const observation of observations) {
        if (observation.status !== 'fulfilled' || observation.value === undefined) continue
        const title = observation.value.title?.title
        // 归档行的标题同样折叠（归档会话仍可改名,索引标题要跟上）。
        if (typeof title === 'string' && title.trim().length > 0) {
          this.engine.updateSessionHeader({ sessionId: observation.value.session.id, title })
        }
      }
    } catch {
      // Title backfill is cosmetic; index rows keep their previous titles.
    }
  }
}
