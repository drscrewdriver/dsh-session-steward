/**
 * 体检结果的进程内缓存（**不落盘**）。
 *
 * 为什么要缓存：面板每打开一次就全量重扫语料（每个会话都要解 zstd、跑四门），
 * 关掉再打开等于重做一遍。有缓存后「关面板 → 重开」零延迟出内容。
 *
 * 为什么不落盘：会话日志与语料一直在变，落盘就必须配失效策略，而判断失效的代价
 * （枚举语料、比对各日志的 mtime/size）已经接近重扫本身。本切片取 YAGNI，
 * DSH 重启即失效——面板会显示生成时间，不会把旧结果冒充成刚扫的。
 *
 * 语义约定：缓存只承载「只列问题」的视图（`onlyProblems: true`，面板即如此）。
 * `onlyProblems: false` 的扫描**不参与**缓存，避免两种视图互相污染。
 */
import type { SessionHealthReport } from './gates.ts'

/** 一份已成型的缓存。 */
export interface HealthCacheEntry {
  /** 非 ok 的会话报告（与 `onlyProblems: true` 的扫描结果同构）。 */
  findings: SessionHealthReport[]
  /** 生成这份缓存时的语料总数（用于「语料已变化」判断）。 */
  total: number
  /** 生成时刻（epoch ms）。面板据此显示「N 分钟前」。 */
  generatedAt: number
}

/** 正在累积的分批扫描。 */
interface PendingScan {
  total: number
  findings: SessionHealthReport[]
  visited: number
}

/** 进程内体检缓存：分批扫描过程中累积，走完一遍语料才成型。 */
export class HealthCache {
  private ready: HealthCacheEntry | undefined
  private pending: PendingScan | undefined

  /** 读当前成型的缓存（未成型则 undefined）。 */
  read(): HealthCacheEntry | undefined {
    return this.ready
  }

  /** 开始一轮分批扫描（客户端以 `offset: 0` 发起时调用）。 */
  begin(total: number): void {
    this.pending = { total: Math.max(0, Math.floor(total)), findings: [], visited: 0 }
  }

  /**
   * 追加一批扫描结果。
   *
   * 只有累积的已访问数走满语料总数才成型；语言中途断掉（关面板、报错）不会留下
   * 半份缓存冒充完整结果。
   * @param findings - 本批的非 ok 报告。
   * @param scanned - 本批**已访问**的会话数（不是命中数）。
   * @param now - 时间源（测试可控）。
   * @returns 本批追加后缓存是否刚好成型。
   */
  append(findings: SessionHealthReport[], scanned: number, now: () => number = Date.now): boolean {
    const pending = this.pending
    if (pending === undefined) return false
    pending.findings.push(...findings)
    pending.visited += Math.max(0, Math.floor(scanned))
    if (pending.visited < pending.total) return false
    this.ready = { findings: pending.findings, total: pending.total, generatedAt: now() }
    this.pending = undefined
    return true
  }

  /**
   * 单条就地回写（单会话体检 / 可逆处置后调用）。
   *
   * 这是缓存的**关键收益**：处置本就重算了 `after` 报告，把它写回即可，
   * 不必为了刷新一行而重扫整个语料。
   * @param report - 重算出的单会话报告。
   * @returns 是否真的改动了缓存（无缓存时为 false）。
   */
  patch(report: SessionHealthReport): boolean {
    const ready = this.ready
    if (ready === undefined) return false
    const index = ready.findings.findIndex(entry => entry.sessionId === report.sessionId)
    // 缓存视图只列非 ok：转好的行移出，新坏的（或原本未在列的）行加入。
    if (report.level === 'ok') {
      if (index < 0) return false
      ready.findings.splice(index, 1)
      return true
    }
    if (index >= 0) ready.findings[index] = report
    else ready.findings.push(report)
    return true
  }

  /** 丢弃缓存与未完成的累积。 */
  clear(): void {
    this.ready = undefined
    this.pending = undefined
  }
}
