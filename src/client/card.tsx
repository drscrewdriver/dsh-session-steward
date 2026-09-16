/**
 * 设置卡（插件配置行）：一个可折叠抽屉 —— 会话历史文件 / 健康检查。
 *
 * **chrome 必须自己渲染**：DSH 的「插件」设置分区（`dsh-client-ui-settings-plugins`）
 * 只做一件事——按 settings 命名空间分发 `settings.plugin.item`：
 *
 *     renderSlot('settings.plugin.item', {}, { entryKey: ns })
 *
 * 它**不提供任何外壳**。所以卡片的标题、说明、展开/收起全归插件自己所有
 * （同分区里 search-index 等卡片都是这个形态）。早期版本只渲染了裸行，
 * 结果既与分区内其它插件的抽屉形态不一致，又让 `card.title` / `card.desc`
 * 变成定义了却没人渲染的死文案。
 *
 * 读写走 settingsScope 的显式 `set`（用户在控件上的直接操作，非隐式提交）。
 */
import { createElement, useState, useSyncExternalStore, type JSX } from 'react'
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

/** 抽屉头：标题 + 说明 + chevron，整块可点。 */
function Header(props: { t?: CardTranslate; open: boolean; onToggle: () => void }): JSX.Element {
  return createElement('button', {
    key: 'head',
    type: 'button',
    className: 'dss_setHead',
    'aria-expanded': props.open,
    onClick: props.onToggle,
  }, [
    createElement('span', { key: 'text', className: 'dss_setHeadText' }, [
      createElement('span', { key: 't', className: 'dss_setCardTitle' }, translate(props.t, 'card.title')),
      createElement('span', { key: 'd', className: 'dss_setCardDesc' }, translate(props.t, 'card.desc')),
    ]),
    createElement('svg', {
      key: 'chev',
      className: 'dss_setChev',
      width: 16,
      height: 16,
      viewBox: '0 0 16 16',
      'aria-hidden': true,
    }, createElement('path', {
      d: 'M4 6l4 4 4-4',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.5,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    })),
  ])
}

/** 插件设置卡主体（抽屉）。默认收起，与「插件」分区内其它卡片一致。 */
export function StewardSettingsCard({ t, scope }: StewardCardProps): JSX.Element {
  const snapshot = useSyncExternalStore(
    (listener) => scope.subscribe(listener),
    () => scope.getSnapshot(),
  )
  const [open, setOpen] = useState(false)
  const value: Partial<StewardConfig> = snapshot.value ?? {}
  const writable = snapshot.writable

  const rows: JSX.Element[] = []
  if (snapshot.status === 'unavailable') {
    // 拿不到设置服务：抽屉仍要在（否则这个插件在分区里彻底消失），只是里面说明原因。
    rows.push(createElement('div', { key: 'unavailable', className: 'dss_setDesc' }, translate(t, 'card.unavailable')))
  } else {
    rows.push(
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
    )
    if (!writable) rows.push(createElement('div', { key: 'ro', className: 'dss_setDesc' }, translate(t, 'card.readonly')))
  }

  return createElement('div', {
    className: `dss_setCard${open ? ' dss_setCardOpen' : ''}`,
  }, [
    createElement(Header, { key: 'head', t, open, onToggle: () => { setOpen(current => !current) } }),
    open && createElement('div', { key: 'body', className: 'dss_setBody' }, rows),
  ])
}
