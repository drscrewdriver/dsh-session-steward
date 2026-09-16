/**
 * 养老院（会话历史文件）面板 —— 自 dsh-session-search-toggle `src/client/archive-panel.tsx`
 * **迁入**并适配到本包的方法名（`session-history-list` / `session-history-prune`）。
 *
 * 行为与迁移前一致（含「显式编辑模式才允许清理」的门禁与 JS confirm）：
 * 行不可导航（归档会话已离开活跃系统）；清理写存储文件（自动备份）并需要重启 DSH。
 * 差异：列表来源改为官方归档集合真值，因此额外显示来源与降级提示。
 */
import { createElement, useEffect, useState, type ReactElement } from 'react'
import { callHost, callHostAny, type HistoryRow } from './host-api.ts'
import { translate, type LocaleKey } from './locales.ts'

/** 面板收到的字典面。 */
export type PanelTranslate = (key: LocaleKey, params?: Record<string, unknown>) => string

/** 养老院面板。 */
export function HistoryPanel({
  t,
  onClose,
}: {
  t?: PanelTranslate
  onClose: () => void
}): ReactElement {
  const [items, setItems] = useState<HistoryRow[] | null>(null)
  const [source, setSource] = useState<string>('')
  const [degraded, setDegraded] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [pruning, setPruning] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    let cancelled = false
    setError(null)
    callHostAny<{ items?: HistoryRow[]; source?: string; degraded?: string; error?: string }>(
      'session-history-list',
      {},
    ).then((res) => {
      if (cancelled) return
      if (res.ok === true && Array.isArray(res.items)) {
        setItems(res.items)
        setSource(typeof res.source === 'string' ? res.source : '')
        setDegraded(typeof res.degraded === 'string' ? res.degraded : '')
      } else {
        setError(res.error ?? '读取归档列表失败')
      }
    })
    return () => { cancelled = true }
  }, [attempt])

  // Escape 关闭面板。
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey) }
  }, [onClose])

  const toggleRow = (sessionId: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(sessionId)) next.delete(sessionId)
      else next.add(sessionId)
      return next
    })
  }

  /** 进出编辑模式；离开时清空选择。 */
  const toggleEditing = (): void => {
    setEditing(prev => !prev)
    setSelected(new Set())
    setNote(null)
  }

  const toggleAll = (): void => {
    setSelected(prev => (prev.size === (items?.length ?? 0)
      ? new Set<string>()
      : new Set((items ?? []).map(item => item.sessionId))))
  }

  /** JS confirm 门禁，然后提交清理。 */
  const pruneSelected = (): void => {
    const ids = [...selected]
    if (ids.length === 0) return
    const summary = ids.length <= 5
      ? ids.map(id => `${id.slice(0, 22)}…`).join('\n')
      : `${ids.slice(0, 4).map(id => `${id.slice(0, 22)}…`).join('\n')}\n… 共 ${ids.length} 个`
    const confirmed = typeof window !== 'undefined' && typeof window.confirm === 'function'
      ? window.confirm(translate(t, 'history.confirm', { n: ids.length, summary }))
      : false
    if (!confirmed) return
    setPruning(true)
    setNote(null)
    void callHostAny<{ removed?: number; remaining?: number }>('session-history-prune', { sessionIds: ids }, 60_000)
      .then((res) => {
        if (res.ok === true) {
          setNote(translate(t, 'history.restartHint', {
            removed: res.removed ?? ids.length,
            remaining: res.remaining ?? '?',
          }))
          setSelected(new Set())
          setAttempt(n => n + 1)
        } else {
          setNote(res.error ?? '清理失败')
        }
      })
      .catch((err: unknown) => setNote(`清理失败：${String(err instanceof Error ? err.message : err)}`))
      .finally(() => setPruning(false))
  }

  const children: ReactElement[] = []
  if (error !== null) {
    children.push(createElement('div', { key: 'err', className: 'dss_error' }, [
      createElement('div', { key: 'msg' }, error === '请求超时'
        ? '读取归档列表超时：Host 可能正忙，稍后重试。'
        : error),
      createElement('button', {
        key: 'retry',
        type: 'button',
        className: 'dss_actBtn',
        style: { marginTop: '6px' },
        onClick: () => { setAttempt(n => n + 1) },
      }, '重试'),
    ]))
  } else if (items === null) {
    children.push(createElement('div', { key: 'loading', className: 'dss_status' }, translate(t, 'history.loading')))
  } else if (items.length === 0) {
    children.push(createElement('div', { key: 'empty', className: 'dss_empty' }, translate(t, 'history.empty')))
  } else {
    const allSelected = selected.size === items.length
    if (editing) {
      children.push(createElement('div', { key: 'manage', className: 'dss_btnRow', style: { padding: '4px 10px 0' } }, [
        createElement('button', { key: 'all', type: 'button', className: 'dss_actBtn', onClick: toggleAll },
          allSelected ? translate(t, 'history.unselectAll') : translate(t, 'history.selectAll')),
        createElement('button', {
          key: 'prune',
          type: 'button',
          className: 'dss_actBtn dss_dangerBtn',
          disabled: pruning || selected.size === 0,
          onClick: pruneSelected,
        }, pruning ? translate(t, 'history.deleting') : translate(t, 'history.delete', { n: selected.size })),
      ]))
    }
    children.push(createElement('ul', {
      key: 'list',
      className: 'dss_list',
      role: 'list',
      'aria-label': translate(t, 'history.source.registry'),
    }, items.map(item => createElement('li', { key: item.sessionId, className: 'dss_row' }, [
      editing && createElement('label', { key: 'sel', className: 'dss_check' }, [
        createElement('input', {
          type: 'checkbox',
          checked: selected.has(item.sessionId),
          onChange: () => { toggleRow(item.sessionId) },
        }),
      ]),
      createElement('span', { key: 't', className: 'dss_rowTitle' }, [
        createElement('span', { key: 'x', className: 'dss_titleText' }, item.title || translate(t, 'panel.untitled')),
        item.updatedAt > 0 && createElement('span', { key: 'tag', className: 'dss_tag' }, fmtTime(item.updatedAt)),
      ]),
      item.cwd !== '' && createElement('span', { key: 'c', className: 'dss_meta' }, item.cwd),
      createElement('span', { key: 'id', className: 'dss_meta dss_uuid' }, item.sessionId),
    ]))))
  }

  return createElement('div', { className: 'dss_tabBody' }, [
    note !== null && createElement('div', { key: 'note', className: 'dss_status' }, note),
    editing && createElement('div', { key: 'hint', className: 'dss_status' }, translate(t, 'history.editingHint')),
    degraded !== '' && createElement('div', { key: 'degraded', className: 'dss_status dss_warnText' }, degraded),
    source !== '' && createElement('div', { key: 'source', className: 'dss_metaLine' },
      translate(t, source === 'registry' ? 'history.source.registry' : source === 'storage-file' ? 'history.source.storage-file' : 'history.source.none')),
    createElement('div', { key: 'headBtns', className: 'dss_btnRow' }, [
      createElement('button', {
        key: 'edit',
        type: 'button',
        className: `dss_actBtn${editing ? ' dss_editActive' : ''}`,
        onClick: toggleEditing,
      }, editing ? translate(t, 'history.done') : translate(t, 'history.edit')),
    ]),
    ...children,
  ])
}

/** 时间格式化（与迁移前一致）。 */
export function fmtTime(ms: number): string {
  if (!ms || typeof ms !== 'number') return ''
  try {
    const date = new Date(ms)
    const now = new Date()
    const pad = (n: number): string => String(n).padStart(2, '0')
    const sameDay = date.getFullYear() === now.getFullYear()
      && date.getMonth() === now.getMonth()
      && date.getDate() === now.getDate()
    const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`
    if (sameDay) return time
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${time}`
  } catch {
    return ''
  }
}

/** 供单测使用：确认面板依赖的方法名（防止与 index-* 冲突）。 */
export const HISTORY_METHOD_NAMES = ['session-history-list', 'session-history-prune'] as const
