/**
 * 批量管理台（workspace 视角）—— 管家面板「管理」页签的主体。
 *
 * beta.5 评审:管理是管家职能,不该出现在搜索面板的模式切换里;本组件从
 * search/panel.tsx 抽出,挂在 StewardPanel 第三页签。样式自带注入（幂等）,
 * 与搜索面板是否启用解耦。
 *
 * 数据面:list-sessions 读统一索引语料（活跃+归档,archived 随行）;
 * 动作面:session-history-archive / prune / purge（写官方存储文件,重启后
 * 侧栏完全生效——宿主半在成功路径上已同步联动索引）。
 */
import { createElement, useEffect, useMemo, useState, type ReactElement } from 'react'
import { callHost, callSteward, type HostSessionItem } from './host-api.ts'
import { translate, type LocaleKey } from './locales.ts'

/** 管理台字典面（search 子域命名空间的键集）。 */
export type ManageTranslate = (key: LocaleKey, params?: Record<string, unknown>) => string

/** 样式（幂等注入;类名沿用 dsws_ 前缀,与搜索面板共享视觉语言）。 */
function injectManageStyles(): () => void {
  if (typeof document === 'undefined') return () => {}
  if (document.querySelector('style[data-plugin-css="dsh-session-steward/manage"]') !== null) return () => {}
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-session-steward'
  tag.dataset.pluginCss = 'dsh-session-steward/manage'
  tag.textContent = `
.dsws_manageList{flex:1 1 auto;min-height:0;overflow-y:auto;margin:8px 0 0;padding:0 6px 8px}
.dsws_group{margin-bottom:6px}
.dsws_groupHead{position:sticky;top:0;z-index:1;display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--dsw-specific-tip);border-bottom:1px solid var(--dsw-alias-border-l2);cursor:pointer;user-select:none}
.dsws_groupTitle{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary)}
.dsws_groupCount{flex:none;color:var(--dsw-alias-label-caption);font-size:11px;font-variant-numeric:tabular-nums}
.dsws_check{flex:none;display:inline-flex;align-items:center}
.dsws_check input{width:13px;height:13px;accent-color:var(--dsw-alias-state-business-primary);cursor:pointer}
.dsws_tagArch{flex:none;color:var(--dsw-alias-state-warn-label,var(--dsw-alias-label-caption));font-size:10px;line-height:16px;border:1px solid currentColor;border-radius:999px;padding:0 6px;white-space:nowrap}
.dsws_batchBar{flex:none;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;border-top:1px solid var(--dsw-alias-border-l1)}
.dsws_batchInfo{flex:1 1 auto;min-width:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.dsws_btnDanger{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.dsws_manageHint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;padding:8px 10px 0}
`
  document.head.appendChild(tag)
  return () => {
    if (tag.parentNode !== null) tag.parentNode.removeChild(tag)
  }
}

/** 批量管理台主体（自持语料/勾选/批量状态）。 */
export function ManageConsole({ t, open }: { t?: ManageTranslate; open: (sessionId: string) => void }): ReactElement {
  const [sessions, setSessions] = useState<HostSessionItem[] | null>(null)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [batch, setBatch] = useState<{ busy: boolean; message: string; ok: boolean }>({ busy: false, message: '', ok: true })
  const [confirmPurge, setConfirmPurge] = useState(false)

  // 语料：挂载取一次;批量成功后 setSessions(null) 重取（宿主半已联动索引）。
  useEffect(() => {
    if (sessions !== null) return
    let cancelled = false
    callHost<HostSessionItem>('list-sessions', {}).then((res) => {
      if (cancelled) return
      if (res.ok) { setSessions(res.items); setSelected(new Set()); setConfirmPurge(false) }
      else setSessionsError(res.error ?? '读取会话列表失败')
    })
    return () => { cancelled = true }
  }, [sessions])

  // workspace（cwd）分组,未分组排最后。
  const manageGroups = useMemo<{ cwd: string; items: HostSessionItem[] }[]>(() => {
    if (sessions === null) return []
    const byCwd = new Map<string, HostSessionItem[]>()
    for (const item of sessions) {
      const list = byCwd.get(item.cwd)
      if (list === undefined) byCwd.set(item.cwd, [item])
      else list.push(item)
    }
    return [...byCwd.entries()]
      .sort((a, b) => (a[0] === '' ? 1 : 0) - (b[0] === '' ? 1 : 0) || a[0].localeCompare(b[0]))
      .map(([cwd, items]) => ({ cwd, items }))
  }, [sessions])

  /** 批量动作;删除两步确认。 */
  const runBatch = (kind: 'archive' | 'unarchive' | 'purge'): void => {
    const ids = [...selected]
    if (ids.length === 0 || batch.busy) return
    if (kind === 'purge' && !confirmPurge) { setConfirmPurge(true); return }
    setConfirmPurge(false)
    setBatch({ busy: true, message: '', ok: true })
    const method = kind === 'archive'
      ? 'session-history-archive'
      : kind === 'unarchive' ? 'session-history-prune' : 'session-history-purge'
    void callSteward<{ added?: number; removed?: number; purged?: number }>(method, { sessionIds: ids }).then((res) => {
      const message = !res.ok
        ? translate(t, 'manage.done.error', { error: res.error ?? '?' })
        : kind === 'archive'
          ? translate(t, 'manage.done.archive', { n: res.added ?? ids.length })
          : kind === 'unarchive'
            ? translate(t, 'manage.done.unarchive', { n: res.removed ?? ids.length })
            : translate(t, 'manage.done.purge', { n: res.purged ?? ids.length })
      setBatch({ busy: false, message, ok: res.ok === true })
      if (res.ok) {
        setSelected(new Set())
        setSessions(null)
      }
    })
  }

  const toggleOne = (sessionId: string): void => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(sessionId)) next.delete(sessionId)
      else next.add(sessionId)
      return next
    })
  }

  const toggleGroup = (items: readonly HostSessionItem[]): void => {
    setSelected(prev => {
      const next = new Set(prev)
      const allIn = items.every(item => next.has(item.sessionId))
      for (const item of items) {
        if (allIn) next.delete(item.sessionId)
        else next.add(item.sessionId)
      }
      return next
    })
  }

  useEffect(() => { injectManageStyles() }, [])

  if (sessionsError !== null) {
    return createElement('div', { className: 'dsws_error' }, sessionsError)
  }
  if (sessions === null) {
    return createElement('div', { className: 'dsws_status' }, translate(t, 'panel.loadingSessions'))
  }
  if (manageGroups.length === 0) {
    return createElement('div', { className: 'dsws_empty' }, translate(t, 'panel.noSessions'))
  }

  const children: ReactElement[] = [
    createElement('div', { key: 'hint', className: 'dsws_manageHint' }, [
      translate(t, 'manage.hint'),
      createElement('span', { key: 'sep', style: { display: 'block', marginTop: '2px' } }, translate(t, 'manage.restartHint')),
    ]),
    createElement('div', { key: 'groups', className: 'dsws_manageList' },
      ...manageGroups.map(group => createElement('div', { key: group.cwd === '' ? '(nocwd)' : group.cwd, className: 'dsws_group' }, [
        createElement('div', {
          key: 'head',
          className: 'dsws_groupHead',
          title: translate(t, 'manage.selectGroup'),
          onClick: () => { toggleGroup(group.items) },
        }, [
          createElement('span', { key: 'check', className: 'dsws_check' },
            createElement('input', {
              type: 'checkbox',
              checked: group.items.length > 0 && group.items.every(item => selected.has(item.sessionId)),
              onChange: () => { toggleGroup(group.items) },
              onClick: (e: { stopPropagation: () => void }) => { e.stopPropagation() },
            })),
          createElement('span', { key: 'title', className: 'dsws_groupTitle' }, group.cwd === '' ? translate(t, 'manage.group.nocwd') : group.cwd),
          createElement('span', { key: 'count', className: 'dsws_groupCount' }, `${group.items.length}`),
        ]),
        ...group.items.map(item => createElement('button', {
          key: item.sessionId,
          type: 'button',
          className: 'dsws_row',
          onClick: () => { open(item.sessionId) },
        }, [
          createElement('span', { key: 'line', className: 'dsws_rowTitle' }, [
            createElement('span', { key: 'check', className: 'dsws_check' },
              createElement('input', {
                type: 'checkbox',
                checked: selected.has(item.sessionId),
                onChange: () => { toggleOne(item.sessionId) },
                onClick: (e: { stopPropagation: () => void }) => { e.stopPropagation() },
              })),
            createElement('span', { key: 'x', className: 'dsws_titleText' }, item.title || translate(t, 'panel.untitled')),
            item.archived === true && createElement('span', { key: 'arch', className: 'dsws_tagArch' }, translate(t, 'tag.archived')),
            createElement('span', { key: 'tag', className: 'dsws_tag' }, fmtTime(item.updatedAt)),
          ]),
          createElement('span', { key: 'meta', className: 'dsws_meta' }, item.cwd),
        ])),
      ])),
    ),
  ]

  if (selected.size > 0) {
    children.push(createElement('div', { key: 'batch', className: 'dsws_batchBar' }, [
      createElement('span', { key: 'info', className: 'dsws_batchInfo' }, batch.message !== ''
        ? batch.message
        : translate(t, 'manage.selected', { n: selected.size })),
      createElement('button', {
        key: 'archive', type: 'button', className: 'dsws_actBtn', disabled: batch.busy,
        onClick: () => { runBatch('archive') },
      }, translate(t, 'manage.batch.archive')),
      createElement('button', {
        key: 'unarchive', type: 'button', className: 'dsws_actBtn', disabled: batch.busy,
        onClick: () => { runBatch('unarchive') },
      }, translate(t, 'manage.batch.unarchive')),
      createElement('button', {
        key: 'purge', type: 'button', className: `dsws_actBtn dsws_btnDanger`, disabled: batch.busy,
        style: confirmPurge ? { background: 'var(--dsw-alias-state-error-primary)', color: 'var(--dsw-specific-tip)' } : undefined,
        onClick: () => { runBatch('purge') },
      }, confirmPurge ? translate(t, 'manage.batch.confirm') : translate(t, 'manage.batch.delete')),
      batch.busy && createElement('span', { key: 'busy', className: 'dsws_batchInfo' }, translate(t, 'manage.batch.working')),
    ]))
  }

  return createElement('div', { className: 'dsws_manageRoot', style: { display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 } }, children)
}

/** Format an epoch-ms timestamp: today → HH:mm, else YYYY-MM-DD HH:mm. */
function fmtTime(ms: number): string {
  if (!ms || typeof ms !== 'number') return ''
  try {
    const d = new Date(ms)
    const now = new Date()
    const pad = (n: number): string => String(n).padStart(2, '0')
    const sameDay = d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate()
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
    if (sameDay) return time
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${time}`
  } catch {
    return ''
  }
}
