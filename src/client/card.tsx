/**
 * 设置卡（插件配置行）：两个开关 —— 会话历史文件 / 健康检查。
 *
 * 与 dsh-session-search-toggle 的 card 同范式：`Row`（标题+说明+控件）+ `Toggle`，
 * 读写走 settingsScope 的显式 `set`（用户在控件上的直接操作，非隐式提交）。
 */
import { createElement, useSyncExternalStore, type JSX } from 'react'
import { DEFAULT_CONFIG, type StewardConfig } from '../config.ts'
import { translate, type LocaleKey } from './locales.ts'

/** 卡片字典面。 */
export type CardTranslate = (key: LocaleKey, params?: Record<string, unknown>) => string

/** 设置 scope 面（结构化镜像，与 toggle 的 SwitchCardScope 同形状）。 */
export interface StewardCardScope {
  getSnapshot(): {
    status: 'ready' | 'loading' | 'unavailable'
    value: StewardConfig | undefined
    revision?: number
    writable: boolean
  }
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<void>
}

/** 卡片入参。 */
export interface StewardCardProps {
  t?: CardTranslate
  scope: StewardCardScope
}

/** 一行设置项。 */
function Row(props: { title: string; desc?: string; control: JSX.Element }): JSX.Element {
  return createElement('div', { className: 'dss_setRow' }, [
    createElement('div', { key: 'text', className: 'dss_setText' }, [
      createElement('span', { key: 't', className: 'dss_setTitle' }, props.title),
      props.desc !== undefined && createElement('span', { key: 'd', className: 'dss_setDesc' }, props.desc),
    ]),
    createElement('div', { key: 'ctl' }, props.control),
  ])
}

/** 一个布尔开关（原生 checkbox 语义，样式由本插件 CSS 提供）。 */
function Toggle(props: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }): JSX.Element {
  return createElement('label', { className: `dss_toggle${props.checked ? ' dss_toggleOn' : ''}` }, [
    createElement('input', {
      key: 'i',
      type: 'checkbox',
      checked: props.checked,
      disabled: props.disabled === true,
      onChange: (event: { target: { checked: boolean } }) => { props.onChange(event.target.checked) },
    }),
    createElement('span', { key: 's', className: 'dss_toggleTrack' }, createElement('span', { className: 'dss_toggleKnob' })),
  ])
}

/** 插件设置卡主体。 */
export function StewardSettingsCard({ t, scope }: StewardCardProps): JSX.Element {
  const snapshot = useSyncExternalStore(
    (listener) => scope.subscribe(listener),
    () => scope.getSnapshot(),
  )
  const value: Partial<StewardConfig> = snapshot.value ?? {}
  const writable = snapshot.writable

  if (snapshot.status === 'unavailable') {
    return createElement('div', { className: 'dss_setRow' },
      createElement('span', { className: 'dss_setTitle' }, translate(t, 'card.unavailable')))
  }

  const rows: JSX.Element[] = [
    createElement(Row, {
      key: 'enabled',
      title: translate(t, 'card.enabled'),
      desc: translate(t, 'card.enabled.desc'),
      control: createElement(Toggle, {
        checked: value.enabled ?? DEFAULT_CONFIG.enabled,
        disabled: !writable,
        onChange: (checked) => { void scope.set('enabled', checked) },
      }),
    }),
    createElement(Row, {
      key: 'history',
      title: translate(t, 'card.history'),
      desc: translate(t, 'card.history.desc'),
      control: createElement(Toggle, {
        checked: value.historyFiles ?? DEFAULT_CONFIG.historyFiles,
        disabled: !writable,
        onChange: (checked) => { void scope.set('historyFiles', checked) },
      }),
    }),
    createElement(Row, {
      key: 'health',
      title: translate(t, 'card.health'),
      desc: translate(t, 'card.health.desc'),
      control: createElement(Toggle, {
        checked: value.healthCheck ?? DEFAULT_CONFIG.healthCheck,
        disabled: !writable,
        onChange: (checked) => { void scope.set('healthCheck', checked) },
      }),
    }),
  ]
  if (!writable) rows.push(createElement('div', { key: 'ro', className: 'dss_setDesc' }, translate(t, 'card.readonly')))

  return createElement('div', { className: 'dss_setBody' }, rows)
}
