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
  fail: 'health.level.fail',
} as const

/** 体检面板。 */
export function HealthPanel({ t, onClose }: { t?: PanelTranslate; onClose: () => void }): ReactElement {
  const [scanning, setScanning] = useState(false)
  const [findings, setFindings] = useState<HealthReport[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<HealthSessionResponse | null>(null)
  const [repairing, setRepairing] = useState(false)
  const [discharge, setDischarge] = useState<HealthRepairResponse | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey) }
  }, [onClose])

  const runScan = (): void => {
    setScanning(true)
    setError(null)
    setDetail(null)
    setDischarge(null)
    void callHostAny<HealthScanResponse>('session-health-scan', { limit: 30, onlyProblems: true }, 120_000)
      .then((res) => {
        if (res.ok === true) setFindings(res.findings ?? [])
        else setError(res.error ?? '体检失败')
      })
      .catch((err: unknown) => setError(String(err instanceof Error ? err.message : err)))
      .finally(() => setScanning(false))
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
      lines.push(createElement('ul', { key: 'list', className: 'dss_list', role: 'list' }, findings.map(item =>
        createElement('li', { key: item.sessionId, className: 'dss_row' }, [
          createElement('span', { key: 'lv', className: `dss_levelPill dss_level_${item.level}` }, translate(t, LEVEL_LABEL[item.level])),
          createElement('span', { key: 'id', className: 'dss_meta dss_uuid' }, item.sessionId),
          createElement('button', {
            key: 'd',
            type: 'button',
            className: 'dss_actBtn',
            onClick: () => { openDetail(item.sessionId) },
          }, translate(t, 'health.detail')),
        ]),
      )))
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
      }, repairing ? translate(t, 'health.repairing') : translate(t, 'health.repair')),
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
    if (discharge.repair?.ok === true) {
      lines.push(createElement('div', { key: 'repairNote', className: 'dss_status' },
        `已隔离投影缓存记录 → ${discharge.repair.to ?? ''}（重启 DSH 后重折叠）`))
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
