/**
 * 体检面板：体检（四门）→ 处方（命令清单）→ 出院（可逆处置 + before/after 对照）。
 *
 * 三态流转完全由 host 侧报告驱动，客户端只做展示与触发；重型动作都在 host，
 * 渲染周期内不发同步重活。
 */
import { createElement, useEffect, useState, type ReactElement } from 'react'
import {
  callHostAny,
  type HealthGate,
  type HealthRepairResponse,
  type HealthReport,
  type HealthScanResponse,
  type HealthSessionResponse,
} from './host-api.ts'
import { translate, type LocaleKey } from './locales.ts'

/** 面板收到的字典面。 */
export type PanelTranslate = (key: LocaleKey, params?: Record<string, unknown>) => string

const GATE_LABEL: Record<HealthGate['id'], LocaleKey> = {
  'log-integrity': 'health.gate.log-integrity',
  'projection-cache': 'health.gate.projection-cache',
  'lossless-json': 'health.gate.lossless-json',
  'cold-read': 'health.gate.cold-read',
}

const LEVEL_LABEL = {
  ok: 'health.level.ok',
  warn: 'health.level.warn',
  skipped: 'health.level.skipped',
  fail: 'health.level.fail',
} as const

/**
 * 单批扫描的会话数。
 *
 * 宿主侧 `scanSessions` 是同步循环，一次批太大就长时间占住事件循环、界面全无反馈。
 * 小批次连续调用把控制权交回客户端：每批之间有真实的进度与计时，且宿主无需持有
 * 跨请求状态（见 host/health/scan.ts 的 offset 语义）。
 */
const SCAN_BATCH = 5

/** 体检面板。 */
export function HealthPanel({ t, onClose }: { t?: PanelTranslate; onClose: () => void }): ReactElement {
  const [scanning, setScanning] = useState(false)
  const [findings, setFindings] = useState<HealthReport[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<HealthSessionResponse | null>(null)
  const [repairing, setRepairing] = useState(false)
  const [discharge, setDischarge] = useState<HealthRepairResponse | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  /** 分批扫描进度：done = 已访问会话数，total = 语料总数（0 表示尚未拿到分母）。 */
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [startedAt, setStartedAt] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey) }
  }, [onClose])

  // 计时器只在扫描期间跑：给「不知道是否还在运行」一个可动的读数。
  useEffect(() => {
    if (!scanning || startedAt === 0) return
    const timer = setInterval(() => { setElapsedMs(Date.now() - startedAt) }, 100)
    return () => { clearInterval(timer) }
  }, [scanning, startedAt])

  const runScan = (): void => {
    setScanning(true)
    setError(null)
    setDetail(null)
    setDischarge(null)
    setFindings(null)
    setProgress({ done: 0, total: 0 })
    setStartedAt(Date.now())
    setElapsedMs(0)
    void (async () => {
      const collected: HealthReport[] = []
      let offset = 0
      try {
        for (;;) {
          const res = await callHostAny<HealthScanResponse>(
            'session-health-scan',
            { limit: SCAN_BATCH, offset, onlyProblems: true },
            120_000,
          )
          if (res.ok !== true) {
            setError(res.error ?? '体检失败')
            return
          }
          const total = res.total ?? 0
          const scanned = res.scanned ?? 0
          collected.push(...(res.findings ?? []))
          offset += scanned
          setProgress({ done: offset, total })
          // scanned 为 0 = 本批没有可扫的会话；offset >= total = 语料已走完。
          if (scanned === 0 || offset >= total) break
        }
        setFindings(collected)
      } catch (err: unknown) {
        setError(String(err instanceof Error ? err.message : err))
      } finally {
        setScanning(false)
      }
    })()
  }

  const openDetail = (sessionId: string): void => {
    setError(null)
    setDischarge(null)
    void callHostAny<HealthSessionResponse>('session-health-session', { sessionId }, 120_000)
      .then((res) => {
        if (res.ok === true) setDetail(res)
        else setError(res.error ?? '读取体检详情失败')
      })
      .catch((err: unknown) => setError(String(err instanceof Error ? err.message : err)))
  }

  const runRepair = (sessionId: string): void => {
    setRepairing(true)
    setError(null)
    void callHostAny<HealthRepairResponse>('session-health-repair', { sessionId }, 120_000)
      .then((res) => {
        if (res.ok === true) {
          setDischarge(res)
          if (res.after !== undefined) setDetail({ ok: true, report: res.after, prescriptions: res.prescriptions })
        } else {
          setError(res.error ?? '处置失败')
        }
      })
      .catch((err: unknown) => setError(String(err instanceof Error ? err.message : err)))
      .finally(() => setRepairing(false))
  }

  const copy = (text: string): void => {
    try {
      void navigator.clipboard?.writeText(text)
      setCopied(text)
    } catch { /* 剪贴板不可用时仍然展示命令 */ }
  }

  const report = detail?.report ?? discharge?.after
  const lines: (ReactElement | null)[] = []

  lines.push(createElement('div', { key: 'phase1', className: 'dss_phaseRow' }, [
    createElement('span', { key: 'l', className: 'dss_phase' }, translate(t, 'health.phase.checkup')),
    createElement('button', {
      key: 'scan',
      type: 'button',
      className: 'dss_actBtn',
      disabled: scanning,
      onClick: runScan,
    }, scanning ? translate(t, 'health.scanning') : translate(t, 'health.scan')),
  ]))

  // 分批扫描进度：进度条 + `已访问/总数 · 已用 Xs`。
  // total 尚未拿到（首批未返回）时走不确定态动画——仍能证明程序在跑，
  // 这正是「不知道是否正常运行」要解决的问题。
  if (scanning && progress !== null) {
    const total = progress.total
    const pct = total > 0 ? Math.min(100, Math.round((progress.done / total) * 100)) : 0
    lines.push(createElement('div', { key: 'progress', className: 'dss_progressRow' }, [
      createElement('div', { key: 'track', className: 'dss_progressTrack' },
        createElement('div', {
          key: 'fill',
          className: total > 0 ? 'dss_progressFill' : 'dss_progressFill dss_progressIndeterminate',
          ...(total > 0 ? { style: { width: `${pct}%` } } : {}),
        })),
      createElement('span', { key: 'read', className: 'dss_meta' },
        translate(t, 'health.progress', {
          done: progress.done,
          total: total > 0 ? total : '?',
          sec: (elapsedMs / 1000).toFixed(1),
        })),
    ]))
  }

  if (error !== null) lines.push(createElement('div', { key: 'err', className: 'dss_error' }, error))
  if (detail !== null || discharge !== null) {
    lines.push(createElement('div', { key: 'back', className: 'dss_btnRow' }, [
      createElement('button', {
        key: 'b',
        type: 'button',
        className: 'dss_actBtn',
        onClick: () => { setDetail(null); setDischarge(null) },
      }, translate(t, 'health.back')),
    ]))
  }

  if (report !== undefined) {
    lines.push(createElement('div', { key: 'gates', className: 'dss_gateList' }, report.gates.map(gate =>
      createElement('div', { key: gate.id, className: `dss_gate dss_gate_${gate.level}` }, [
        createElement('span', { key: 'n', className: 'dss_gateName' }, translate(t, GATE_LABEL[gate.id])),
        createElement('span', { key: 'lv', className: `dss_levelPill dss_level_${gate.level}` }, translate(t, LEVEL_LABEL[gate.level])),
        createElement('span', { key: 'ev', className: 'dss_gateEvidence' }, gate.evidence),
        gate.attribution !== undefined && createElement('span', { key: 'at', className: 'dss_meta' },
          `${translate(t, 'health.attribution')}: ${gate.attribution.package ?? 'unknown'}${gate.attribution.projection !== undefined ? ` · ${gate.attribution.projection}` : ''}${gate.attribution.field !== undefined ? ` · ${translate(t, 'health.field')} ${gate.attribution.field}` : ''}`),
      ]),
    )))
  } else if (findings !== null) {
    if (findings.length === 0) {
      lines.push(createElement('div', { key: 'clean', className: 'dss_empty' }, translate(t, 'health.empty')))
    } else {
      lines.push(createElement('ul', { key: 'list', className: 'dss_list', role: 'list' }, findings.map((item) => {
        // 行内列出「哪一门·什么档位」。只有总判徽标时，30 行「注意」彼此不可区分，
        // 用户必须逐条点开才发现原因（实测体验问题）；门摘要让信号可扫读。
        // `skipped` 一并列出：它是「未检查」而非异常，不应与 warn 混为一谈。
        const reasons = item.gates
          .filter(gate => gate.level !== 'ok')
          .map(gate => `${translate(t, GATE_LABEL[gate.id])}·${translate(t, LEVEL_LABEL[gate.level])}`)
          .join(' · ')
        return createElement('li', { key: item.sessionId, className: 'dss_row' }, [
          createElement('span', { key: 'lv', className: `dss_levelPill dss_level_${item.level}` }, translate(t, LEVEL_LABEL[item.level])),
          createElement('span', { key: 'id', className: 'dss_meta dss_uuid' }, item.sessionId),
          reasons !== '' && createElement('span', { key: 'why', className: 'dss_why' }, reasons),
          createElement('button', {
            key: 'd',
            type: 'button',
            className: 'dss_actBtn',
            onClick: () => { openDetail(item.sessionId) },
          }, translate(t, 'health.detail')),
        ])
      })))
    }
  }

  if (report !== undefined) {
    lines.push(createElement('div', { key: 'phase2', className: 'dss_phaseRow' }, [
      createElement('span', { key: 'l', className: 'dss_phase' }, translate(t, 'health.phase.prescribe')),
      createElement('button', {
        key: 'repair',
        type: 'button',
        className: 'dss_actBtn',
        disabled: repairing || report.level === 'ok',
        onClick: () => { runRepair(report.sessionId) },
      }, [
        // 处置只涉及单会话（2 次报告 + 1 次文件操作），耗时不足以支撑进度条；
        // 但必须有**可动的**忙碌反馈，否则点击后界面静止，用户不知道是否在跑。
        repairing ? createElement('span', { key: 'sp', className: 'dss_spinner', 'aria-hidden': 'true' }) : null,
        createElement('span', { key: 'tx' }, repairing ? translate(t, 'health.repairing') : translate(t, 'health.repair')),
      ]),
    ]))
    const prescriptions = detail?.prescriptions ?? discharge?.prescriptions ?? []
    if (prescriptions.length > 0) {
      lines.push(createElement('div', { key: 'cmds', className: 'dss_cmdBlock' }, [
        createElement('div', { key: 'h', className: 'dss_meta' }, translate(t, 'health.commands')),
        ...prescriptions.map((line, index) => createElement('div', { key: `c${index}`, className: 'dss_cmdLine' }, [
          createElement('code', { key: 'code', className: 'dss_cmd' }, line),
          createElement('button', {
            key: 'cp',
            type: 'button',
            className: 'dss_actBtn',
            onClick: () => { copy(line) },
          }, copied === line ? translate(t, 'health.copied') : translate(t, 'health.copy')),
        ])),
      ]))
    }
  }

  if (discharge !== null) {
    lines.push(createElement('div', { key: 'phase3', className: 'dss_phaseRow' }, [
      createElement('span', { key: 'l', className: 'dss_phase' }, translate(t, 'health.phase.discharge')),
      createElement('span', { key: 'b', className: `dss_levelPill dss_level_${discharge.before?.level ?? 'warn'}` },
        `${translate(t, 'health.before')}: ${translate(t, LEVEL_LABEL[discharge.before?.level ?? 'warn'])}`),
      createElement('span', { key: 'a', className: `dss_levelPill dss_level_${discharge.after?.level ?? 'warn'}` },
        `${translate(t, 'health.after')}: ${translate(t, LEVEL_LABEL[discharge.after?.level ?? 'warn'])}`),
    ]))
    // 定性结论优先于机械的 before/after：处置只隔离投影缓存，
    // 异常若来自会话日志（如 open step），两个档位都会是「异常」，
    // 只摆档位会让人以为处置失败。explanation 直接说清是什么情况。
    if (discharge.explanation !== undefined && discharge.explanation !== '') {
      lines.push(createElement('div', {
        key: 'verdict',
        className: `dss_verdict dss_verdict_${discharge.verdict ?? 'failed'}`,
      }, discharge.explanation))
    }
    if (discharge.repair?.ok === true) {
      lines.push(createElement('div', { key: 'repairNote', className: 'dss_status' },
        `${translate(t, 'health.quarantined')} → ${discharge.repair.to ?? ''}`))
    } else if (discharge.repair?.error !== undefined) {
      lines.push(createElement('div', { key: 'repairErr', className: 'dss_status' }, discharge.repair.error))
    }
  }

  return createElement('div', { className: 'dss_tabBody' }, lines)
}

/** 供单测断言：面板依赖的方法名（必须全部以 session- 开头）。 */
export const HEALTH_METHOD_NAMES = [
  'session-health-scan',
  'session-health-session',
  'session-health-repair',
] as const
