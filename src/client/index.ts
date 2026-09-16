/**
 * 会话管家客户端半身：样式、字典、侧边栏入口（dsh-session-steward）与设置卡。
 *
 * 侧边栏入口点击后打开「养老院 / 体检」双页签对话框；两个页签的可见性由配置开关决定，
 * 关掉的子域不渲染页签，也不留空壳。开关读取走 settingsScope 的订阅快照，
 * 写通道只有设置卡（显式控件）。
 */
import type { Context } from 'cordis'
import { createElement, useState, useSyncExternalStore, type ReactElement } from 'react'
import {
  DEFAULT_CONFIG,
  STEWARD_ENTRY_ID,
  STEWARD_SETTINGS_NAMESPACE,
  type StewardConfig,
} from '../config.ts'
import { StewardSettingsCard, type StewardCardScope } from './card.tsx'
import { en, translate, zh, type LocaleKey } from './locales.ts'
import { StewardFooter, StewardPanel, TAB_HEALTH, TAB_HISTORY } from './panel.tsx'

export { STEWARD_ENTRY_ID, STEWARD_SETTINGS_NAMESPACE, TAB_HEALTH, TAB_HISTORY }
export { translate } from './locales.ts'

/** 字典命名空间（locale.register 用）。 */
export const NS = 'dsh-session-steward'

/** 槽位服务面（结构化镜像）。 */
interface StewardSlotsService {
  inject(name: string, callback: () => unknown, label?: string): void
  register(config: Record<string, unknown>, component: unknown): unknown
}

/** locale 服务面。 */
interface StewardLocaleService {
  register(ns: string, dictionaries: { zh: unknown; en: unknown }): () => void
}

/** settingsScope 服务面。 */
interface StewardSettingsScope {
  bind<U>(input: { namespace: string }): (StewardCardScope & { getSnapshot(): { value: U | undefined } }) | undefined
}

/** 客户端插件声明的注入面。 */
export const inject = ['slots']

/** 侧边栏脚部入口的 props（结构子集）。 */
export interface StewardFooterProps {
  onClick?: () => void
  title?: string
}

/** 注入样式（幂等）。 */
function injectStyles(): () => void {
  const id = 'dsh-session-steward-styles'
  if (typeof document === 'undefined') return () => {}
  if (document.getElementById(id) !== null) return () => {}
  const style = document.createElement('style')
  style.id = id
  style.textContent = `
.dss_entryWrap{display:inline-flex;align-items:center}
.dss_footerEntry{width:28px;height:28px;border:none;background:transparent;cursor:pointer;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary)}
.dss_footerEntry:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dss_footerIcon{font-size:15px;line-height:1}
.dss_backdrop{position:fixed;inset:0;background:rgba(15,20,30,.42);z-index:1000}
.dss_panel{position:fixed;z-index:1001;left:50%;top:8vh;transform:translateX(-50%);width:min(760px,92vw);max-height:78vh;overflow:auto;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:14px;box-shadow:0 18px 48px rgba(0,0,0,.18);padding:10px 14px 14px}
.dss_dialogHead{display:flex;align-items:center;gap:10px;min-height:34px}
.dss_dialogTitle{font-weight:600;color:var(--dsw-alias-label-primary,#111827);flex:1 1 auto;min-width:0}
.dss_tabRow{display:inline-flex;gap:4px}
.dss_tab{border:1px solid var(--dsw-alias-border-l2,#e5e7eb);background:transparent;border-radius:8px;padding:3px 10px;cursor:pointer;font-size:12px;color:var(--dsw-alias-label-secondary,#6b7280)}
.dss_tabActive{background:var(--dsw-alias-interactive-bg-active,rgba(63,99,216,.12));color:var(--dsw-alias-label-primary,#111827)}
.dss_tabBody{display:flex;flex-direction:column;gap:8px;padding-top:8px}
.dss_actBtn{border:1px solid var(--dsw-alias-border-l2,#e5e7eb);background:transparent;border-radius:8px;padding:4px 10px;cursor:pointer;font-size:12px;color:var(--dsw-alias-label-primary,#111827)}
.dss_actBtn:disabled{opacity:.5;cursor:default}
.dss_dangerBtn{border-color:var(--dsw-alias-state-error-primary,#dc2626);color:var(--dsw-alias-state-error-primary,#dc2626)}
.dss_editActive{background:var(--dsw-alias-interactive-bg-active,rgba(63,99,216,.12))}
.dss_btnRow{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.dss_list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
.dss_row{display:flex;gap:8px;align-items:center;padding:5px 8px;border-radius:8px;border:1px solid transparent}
.dss_row:hover{border-color:var(--dsw-alias-border-l2,#e5e7eb)}
.dss_rowTitle{display:flex;gap:6px;align-items:center;flex:1 1 auto;min-width:0}
.dss_titleText{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dss_tag{font-size:11px;color:var(--dsw-alias-label-tertiary,#9ca3af)}
.dss_meta{font-size:11px;color:var(--dsw-alias-label-tertiary,#9ca3af)}
.dss_metaLine{font-size:11px;color:var(--dsw-alias-label-tertiary,#9ca3af)}
.dss_uuid{font-family:var(--ds-font-family-code,monospace)}
.dss_check{display:inline-flex;align-items:center}
.dss_status{font-size:12px;color:var(--dsw-alias-label-secondary,#6b7280)}
.dss_warnText{color:var(--dsw-alias-state-warning-primary,#d97706)}
.dss_error{font-size:12px;color:var(--dsw-alias-state-error-primary,#dc2626)}
.dss_empty{font-size:12px;color:var(--dsw-alias-label-tertiary,#9ca3af);padding:10px 2px}
.dss_gateList{display:flex;flex-direction:column;gap:6px}
.dss_gate{display:flex;flex-wrap:wrap;gap:6px;align-items:baseline;border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:10px;padding:6px 10px}
.dss_gateName{font-weight:600;font-size:12px}
.dss_gateEvidence{font-size:12px;color:var(--dsw-alias-label-secondary,#6b7280);flex:1 1 100%}
.dss_levelPill{font-size:11px;border-radius:999px;padding:1px 8px;border:1px solid transparent}
.dss_level_ok{background:rgba(22,163,74,.12);color:#15803d}
.dss_level_warn{background:rgba(217,119,6,.14);color:#b45309}
.dss_level_fail{background:rgba(220,38,38,.14);color:#b91c1c}
.dss_level_skipped{background:rgba(107,114,128,.14);color:#4b5563}
.dss_progressRow{display:flex;align-items:center;gap:8px;margin-top:2px}
.dss_progressTrack{flex:1;height:6px;border-radius:999px;background:var(--dsw-alias-bg-layer-1,#eef0f3);overflow:hidden}
.dss_progressFill{height:100%;border-radius:999px;background:var(--dsw-alias-state-business-primary,#3d5be0);transition:width .2s ease}
.dss_progressIndeterminate{width:35%;animation:dssSlide 1.1s ease-in-out infinite}
.dss_why{font-size:12px;color:var(--dsw-alias-label-secondary,#6b7280);flex:1;min-width:0}
.dss_spinner{width:11px;height:11px;margin-right:6px;border-radius:50%;display:inline-block;vertical-align:-1px;border:2px solid currentColor;border-top-color:transparent;animation:dssSpin .7s linear infinite}
@keyframes dssSpin{to{transform:rotate(360deg)}}
@keyframes dssSlide{0%{margin-left:-35%}100%{margin-left:100%}}
@media (prefers-reduced-motion:reduce){.dss_spinner{animation:none}.dss_progressIndeterminate{animation:none;width:100%;opacity:.5}}
.dss_verdict{font-size:12px;line-height:18px;border-radius:8px;padding:6px 10px;margin-top:6px;border:1px solid transparent}
.dss_verdict_repaired{background:rgba(22,163,74,.10);color:#15803d;border-color:rgba(22,163,74,.28)}
.dss_verdict_repaired-with-residual{background:rgba(217,119,6,.10);color:#b45309;border-color:rgba(217,119,6,.28)}
.dss_verdict_nothing-to-do{background:rgba(107,114,128,.10);color:#4b5563;border-color:rgba(107,114,128,.28)}
.dss_verdict_not-applicable{background:rgba(107,114,128,.10);color:#4b5563;border-color:rgba(107,114,128,.28)}
.dss_verdict_failed{background:rgba(220,38,38,.10);color:#b91c1c;border-color:rgba(220,38,38,.28)}
.dss_phaseRow{display:flex;gap:8px;align-items:center}
.dss_phase{font-weight:600;font-size:12px}
.dss_cmdBlock{display:flex;flex-direction:column;gap:4px;border:1px dashed var(--dsw-alias-border-l2,#e5e7eb);border-radius:10px;padding:6px 8px}
.dss_cmdLine{display:flex;gap:6px;align-items:center}
.dss_cmd{flex:1 1 auto;font-family:var(--ds-font-family-code,monospace);font-size:11px;white-space:pre-wrap;word-break:break-all}
.dss_setBody{display:flex;flex-direction:column;gap:2px}
.dss_setRow{display:flex;align-items:center;gap:10px;padding:6px 0}
.dss_setText{display:flex;flex-direction:column;flex:1 1 auto;min-width:0}
.dss_setTitle{font-size:13px;color:var(--dsw-alias-label-primary,#111827)}
.dss_setDesc{font-size:12px;color:var(--dsw-alias-label-tertiary,#9ca3af)}
.dss_toggle{display:inline-flex;align-items:center;cursor:pointer;position:relative}
.dss_toggle input{position:absolute;opacity:0;width:0;height:0}
.dss_toggleTrack{width:34px;height:18px;border-radius:999px;background:var(--dsw-alias-border-l2,#d1d5db);position:relative;transition:background .15s ease}
.dss_toggleKnob{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left .15s ease}
.dss_toggleOn .dss_toggleTrack{background:var(--dsw-alias-button-primary-fill,#3f63d8)}
.dss_toggleOn .dss_toggleKnob{left:18px}
`
  document.head.appendChild(style)
  return () => { style.remove() }
}

/**
 * 客户端插件主体。
 * @param ctx - 客户端上下文（slots、可选 locale / settingsScope）。
 */
export function apply(ctx: Context): void {
  ctx.effect(() => injectStyles(), 'dsh-session-steward: stylesheet')

  const locale = ctx.get('locale') as StewardLocaleService | undefined
  if (locale !== undefined && typeof locale.register === 'function') {
    ctx.effect(() => locale.register(NS, { zh, en }), 'dsh-session-steward: dictionaries')
  }

  const settingsScope = ctx.get('settingsScope') as StewardSettingsScope | undefined
  const bound = settingsScope?.bind<StewardConfig>({ namespace: STEWARD_SETTINGS_NAMESPACE })

  const slots = ctx.get('slots') as StewardSlotsService | undefined
  if (slots === undefined) return

  // 侧边栏入口：一个按钮，打开「养老院 / 体检」双页签面板。
  slots.inject('sidebar.footer.action', () => slots.register(
    { name: 'sidebar.footer.action', id: STEWARD_ENTRY_ID, order: 12 },
    (props: StewardFooterProps) => createElement(StewardEntry, { ...props, scope: bound }),
  ), 'dsh-session-steward: sidebar footer entry')

  slots.inject('settings.plugin.item', () => slots.register({
    name: 'settings.plugin.item',
    id: STEWARD_SETTINGS_NAMESPACE,
    key: STEWARD_SETTINGS_NAMESPACE,
    locale: locale !== undefined ? NS : undefined,
    inject: () => ({
      scope: bound ?? {
        getSnapshot: () => ({
          status: 'ready' as const,
          value: DEFAULT_CONFIG,
          revision: undefined,
          writable: false,
        }),
        subscribe: () => () => {},
        set: async () => {},
      },
    }),
  }, StewardSettingsCard), 'dsh-session-steward: plugin settings card')
}

/** 入口按钮：持有面板开关；两个页签的可见性来自配置快照。 */
export function StewardEntry(
  props: StewardFooterProps & {
    scope?: (StewardCardScope & { getSnapshot(): { value: StewardConfig | undefined } }) | undefined
  },
): ReactElement {
  const [open, setOpen] = useState(false)
  const snapshot = useSyncExternalStore(
    (listener) => (props.scope !== undefined ? props.scope.subscribe(listener) : () => {}),
    () => (props.scope !== undefined ? props.scope.getSnapshot() : { value: DEFAULT_CONFIG }),
  )
  const config: StewardConfig = { ...DEFAULT_CONFIG, ...(snapshot.value ?? {}) }
  const historyFiles = config.historyFiles !== false
  const healthCheck = config.healthCheck !== false
  const visible = config.enabled !== false && (historyFiles || healthCheck)

  if (!visible) return createElement('span', { className: 'dss_entryWrap' })
  return createElement('span', { className: 'dss_entryWrap' }, [
    createElement(StewardFooter, {
      key: 'btn',
      title: translate(undefined, 'panel.title'),
      onClick: () => { setOpen(!open) },
    }),
    open
      ? createElement(StewardPanel, {
        key: 'panel',
        historyFiles,
        healthCheck,
        onClose: () => { setOpen(false) },
      })
      : null,
  ])
}

/** 导出字典查找 type 供消费者复用。 */
export type { LocaleKey }
