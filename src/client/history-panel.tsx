/**
 * 养老院（会话历史文件）面板 —— 自 dsh-session-search-toggle `src/client/archive-panel.tsx`
 * **迁入**并适配到本包的方法名。
 *
 * 与迁移前的关键差异（**两个操作刻意分开，不可互换**）：
 *
 * | 操作 | 路由 | 改什么 | 可逆 |
 * |---|---|---|---|
 * | 取消归档状态 | `session-history-prune` | 只改归档数组 | ✅ 重启后会话回到侧边栏 |
 * | 清理归档文件 | `session-history-purge` | **真删**转录目录 + 投影缓存 + 两处 id | ❌ 不可逆 |
 *
 * 「删除」一词在本面板**不存在** —— 旧文案承诺「删除」却只改了个数组，
 * 是导致「点了确认没反应」那类误判的一部分。
 * 体积**按行**显示（实测单条可从 0 到 23 MB，报一个总量没有意义），按钮上给所选小计。
 */
import { createElement, useEffect, useState, type ReactElement } from 'react'
import { callHostAny, type HistoryRow } from './host-api.ts'
import { translate, type LocaleKey } from './locales.ts'

/** 面板收到的字典面。 */
export type PanelTranslate = (key: LocaleKey, params?: Record<string, unknown>) => string

/** 当前正在跑的操作；任一进行中都锁住两个按钮。 */
type Busy = 'unarchive' | 'purge' | null

/** 人类可读体积。 */
export function fmtSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${unit === 0 || value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

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
  const [pendingRestart, setPendingRestart] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [busy, setBusy] = useState<Busy>(null)
  const [note, setNote] = useState<string | null>(null)
  /** 清理失败明细（逐条）；空数组表示无失败。 */
  const [failures, setFailures] = useState<{ sessionId: string; reason: string }[]>([])
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    let cancelled = false
    setError(null)
    callHostAny<{
      items?: HistoryRow[]
      source?: string
      degraded?: string
      pendingRestart?: number
      error?: string
    }>(
      'session-history-list',
      {},
    ).then((res) => {
      if (cancelled) return
      if (res.ok === true && Array.isArray(res.items)) {
        setItems(res.items)
        setSource(typeof res.source === 'string' ? res.source : '')
        setDegraded(typeof res.degraded === 'string' ? res.degraded : '')
        setPendingRestart(typeof res.pendingRestart === 'number' ? res.pendingRestart : 0)
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
    setFailures([])
  }

  const toggleAll = (): void => {
    setSelected(prev => (prev.size === (items?.length ?? 0)
      ? new Set<string>()
      : new Set((items ?? []).map(item => item.sessionId))))
  }

  const selectedRows = (items ?? []).filter(item => selected.has(item.sessionId))
  const selectedBytes = selectedRows.reduce((sum, item) => sum + item.bytes + item.cacheBytes, 0)
  const totalBytes = (items ?? []).reduce((sum, item) => sum + item.bytes + item.cacheBytes, 0)

  /** 确认弹窗里的逐条摘要（清理时带体积，取消归档时不带）。 */
  const summarise = (rows: HistoryRow[], withSize: boolean): string => {
    const lines = rows.slice(0, 5).map((row) => {
      const label = row.title || translate(t, 'panel.untitled')
      const size = fmtSize(row.bytes + row.cacheBytes)
      return withSize ? `· ${label} — ${size}` : `· ${label}`
    })
    if (rows.length > 5) lines.push(`… 共 ${rows.length} 个`)
    return lines.join('\n')
  }

  const confirm = (message: string): boolean =>
    typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(message) : false

  /** 提交一次操作：确认 → 调用 → 刷新列表（列表以存储文件为准，因此立刻可见变化）。 */
  const run = (kind: Exclude<Busy, null>, method: string, confirmText: string): void => {
    const rows = selectedRows
    if (rows.length === 0) return
    if (!confirm(confirmText)) return
    setBusy(kind)
    setNote(null)
    setFailures([])
    void callHostAny<{
      removed?: number
      remaining?: number
      purged?: number
      freedBytes?: number
      failures?: { sessionId: string; reason: string }[]
    }>(
      method,
      { sessionIds: rows.map(row => row.sessionId) },
      60_000,
    )
      .then((res) => {
        if (res.ok === true) {
          if (kind === 'unarchive') {
            setNote(translate(t, 'history.restartHint', {
              removed: res.removed ?? rows.length,
              remaining: res.remaining ?? '?',
            }))
          } else {
            const freed = fmtSize(res.freedBytes ?? 0)
            const failed = res.failures?.length ?? 0
            setNote(failed === 0
              ? translate(t, 'history.purgeResult', { purged: res.purged ?? rows.length, size: freed })
              : translate(t, 'history.purgePartial', { purged: res.purged ?? rows.length, size: freed, failed }))
            setFailures(res.failures ?? [])
          }
          setSelected(new Set())
          setAttempt(n => n + 1)
        } else {
          setNote(res.error ?? '操作失败')
        }
      })
      .catch((err: unknown) => setNote(`操作失败：${String(err instanceof Error ? err.message : err)}`))
      .finally(() => setBusy(null))
  }

  const unarchiveSelected = (): void => {
    run('unarchive', 'session-history-prune',
      translate(t, 'history.confirmUnarchive', {
        n: selectedRows.length,
        summary: summarise(selectedRows, false),
      }))
  }

  const purgeSelected = (): void => {
    run('purge', 'session-history-purge',
      translate(t, 'history.confirmPurge', {
        n: selectedRows.length,
        summary: summarise(selectedRows, true),
        size: fmtSize(selectedBytes),
      }))
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
        // 可逆：只改归档数组。
        createElement('button', {
          key: 'unarchive',
          type: 'button',
          className: 'dss_actBtn',
          disabled: busy !== null || selected.size === 0,
          onClick: unarchiveSelected,
        }, busy === 'unarchive'
          ? translate(t, 'history.unarchiving')
          : translate(t, 'history.unarchive', { n: selected.size })),
        // 不可逆：真删磁盘实体。危险样式 + 体积小计。
        createElement('button', {
          key: 'purge',
          type: 'button',
          className: 'dss_actBtn dss_dangerBtn',
          disabled: busy !== null || selected.size === 0,
          onClick: purgeSelected,
        }, busy === 'purge'
          ? translate(t, 'history.purging')
          : translate(t, 'history.purge', { n: selected.size, size: fmtSize(selectedBytes) })),
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
      createElement('span', { key: 'size', className: 'dss_meta dss_size' },
        item.bytes + item.cacheBytes > 0
          ? translate(t, 'history.size', { t: fmtSize(item.bytes), c: fmtSize(item.cacheBytes) })
          : translate(t, 'history.sizeUnknown')),
      item.cwd !== '' && createElement('span', { key: 'c', className: 'dss_meta' }, item.cwd),
      createElement('span', { key: 'id', className: 'dss_meta dss_uuid' }, item.sessionId),
    ]))))
  }

  return createElement('div', { className: 'dss_tabBody' }, [
    note !== null && createElement('div', { key: 'note', className: 'dss_status' }, note),
    failures.length > 0 && createElement('div', { key: 'fail', className: 'dss_status dss_error' }, [
      createElement('div', { key: 'h' }, translate(t, 'history.purgeFailures')),
      ...failures.slice(0, 10).map((failure, index) => createElement('div', {
        key: `f${index}`,
        className: 'dss_meta',
      }, `${failure.sessionId.slice(0, 22)}… — ${failure.reason}`)),
    ]),
    editing && createElement('div', { key: 'hint', className: 'dss_status' }, translate(t, 'history.editingHint')),
    degraded !== '' && createElement('div', { key: 'degraded', className: 'dss_status dss_warnText' }, degraded),
    pendingRestart > 0 && createElement('div', { key: 'pending', className: 'dss_status dss_warnText' },
      translate(t, 'history.pendingRestart', { n: pendingRestart })),
    source !== '' && createElement('div', { key: 'source', className: 'dss_metaLine' },
      translate(t, source === 'registry' ? 'history.source.registry' : source === 'storage-file' ? 'history.source.storage-file' : 'history.source.none')),
    items !== null && error === null && createElement('div', { key: 'count', className: 'dss_metaLine' },
      translate(t, 'history.count', { n: items.length, size: fmtSize(totalBytes) })),
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

/** 供单测使用：面板依赖的方法名。锁住「两个操作是两条独立路由」，防止再被合并成一个动词。 */
export const HISTORY_METHOD_NAMES = [
  'session-history-list',
  'session-history-prune',
  'session-history-purge',
] as const
