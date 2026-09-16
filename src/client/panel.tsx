/**
 * 会话管家面板壳：一个侧边栏入口，两个页签（养老院 / 体检）。
 *
 * 页签可见性由开关决定：`historyFiles=false` 时「养老院」消失，`healthCheck=false`
 * 时「体检」消失；两者都关时进入面板直接显示空壳提示（客户端也会隐藏入口）。
 */
import { createElement, useEffect, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { HistoryPanel } from './history-panel.tsx'
import { HealthPanel } from './health-panel.tsx'
import { translate, type LocaleKey } from './locales.ts'

/** 面板字典面。 */
export type PanelTranslate = (key: LocaleKey, params?: Record<string, unknown>) => string

/** 页签 id（导出供测试断言）。 */
export const TAB_HISTORY = 'dss-tab-history'
export const TAB_HEALTH = 'dss-tab-health'

/** 面板入参。 */
export interface StewardPanelProps {
  t?: PanelTranslate
  /** 历史文件子域是否可见。 */
  historyFiles: boolean
  /** 健康检查子域是否可见。 */
  healthCheck: boolean
  onClose: () => void
}

/** 会话管家对话框。 */
export function StewardPanel({ t, historyFiles, healthCheck, onClose }: StewardPanelProps): ReactElement {
  const [tab, setTab] = useState<'history' | 'health'>(historyFiles ? 'history' : 'health')

  // 开关变化后收敛到仍然可见的页签。
  useEffect(() => {
    if (tab === 'history' && !historyFiles && healthCheck) setTab('health')
    if (tab === 'health' && !healthCheck && historyFiles) setTab('history')
  }, [tab, historyFiles, healthCheck])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey) }
  }, [onClose])

  const tabs: ReactElement[] = []
  if (historyFiles) {
    tabs.push(createElement('button', {
      key: TAB_HISTORY,
      id: TAB_HISTORY,
      type: 'button',
      className: `dss_tab${tab === 'history' ? ' dss_tabActive' : ''}`,
      'aria-selected': tab === 'history',
      onClick: () => { setTab('history') },
    }, translate(t, 'panel.tab.history')))
  }
  if (healthCheck) {
    tabs.push(createElement('button', {
      key: TAB_HEALTH,
      id: TAB_HEALTH,
      type: 'button',
      className: `dss_tab${tab === 'health' ? ' dss_tabActive' : ''}`,
      'aria-selected': tab === 'health',
      onClick: () => { setTab('health') },
    }, translate(t, 'panel.tab.health')))
  }

  const body: ReactElement = tab === 'history' && historyFiles
    ? createElement(HistoryPanel, { t, onClose })
    : tab === 'health' && healthCheck
      ? createElement(HealthPanel, { t, onClose })
      : createElement('div', { className: 'dss_empty' }, translate(t, 'card.enabled.desc'))

  return createPortal(createElement('div', { key: 'steward-root' }, [
    createElement('div', { key: 'backdrop', className: 'dss_backdrop', onClick: onClose }),
    createElement('div', {
      key: 'panel',
      className: 'dss_panel',
      role: 'dialog',
      'aria-label': translate(t, 'panel.title'),
    }, [
      createElement('div', { key: 'head', className: 'dss_dialogHead' }, [
        createElement('span', { key: 'title', className: 'dss_dialogTitle' }, translate(t, 'panel.title')),
        createElement('span', { key: 'tabs', className: 'dss_tabRow' }, tabs),
        createElement('button', {
          key: 'close',
          type: 'button',
          className: 'dss_actBtn',
          onClick: onClose,
        }, translate(t, 'panel.close')),
      ]),
      body,
    ]),
  ]), document.body)
}

/** 侧边栏脚部入口：宽栏带文案成行控件，收起轨道退化为 36x36 图标钮。 */
export function StewardFooter(props: {
  onClick?: () => void
  title?: string
  label?: string
  wide?: boolean
}): ReactElement {
  const wide = props.wide === true
  return createElement('button', {
    type: 'button',
    className: wide ? 'dss_footerEntry' : 'dss_footerEntry dss_footerEntryRail',
    title: props.title,
    'aria-label': props.title,
    onClick: props.onClick,
  }, [
    createElement('span', { key: 'icon', className: 'dss_footerIcon', 'aria-hidden': true }, '🧭'),
    // 收起轨道里 36px 装不下文案，标签与宽栏同条件出现，与搜索入口一致。
    wide && props.label !== undefined
      ? createElement('span', { key: 'label', className: 'dss_footerLabel' }, props.label)
      : null,
  ])
}
