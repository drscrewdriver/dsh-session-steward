/**
 * 会话管家客户端半身：样式、字典、侧边栏入口（dsh-session-steward）与设置卡。
 *
 * 侧边栏入口点击后打开「养老院 / 体检」双页签对话框；两个页签的可见性由配置开关决定，
 * 关掉的子域不渲染页签，也不留空壳。开关读取：configForms（0.1.7，entry id 键）
 * / legacy 宿主走自家 webServer 设置桥（settingsScope.bind 是数据死路，见
 * bridge-scope.ts）；配置写入同链路。
 */
import type { Context } from 'cordis'
import { createElement, useState, useSyncExternalStore, type ReactElement } from 'react'
import {
  DEFAULT_CONFIG,
  STEWARD_ENTRY_ID,
  STEWARD_SETTINGS_NAMESPACE,
  type StewardConfig,
  type SwitchSearchConfig,
} from '../config.ts'
import { StewardCardScope, StewardSettingsCard, type CardTranslate } from './card.tsx'
import { searchBridgeScope, stewardBridgeScope, withBridgeFallback, type BridgeScope } from './bridge-scope.ts'
import { dictionaries, translate, type LocaleKey } from './locales.ts'
import { StewardFooter, StewardPanel, TAB_HEALTH, TAB_HISTORY } from './panel.tsx'
// 搜索子域（原 dsh-search-index client 半身）：面板/入口组件、设置卡、
// 打开会话的宿主服务面解析、独立字典命名空间（switch-search，键集不变）。
import { injectStyles as injectSearchStyles, SwitchFooter } from './search/panel.tsx'
import { SearchSettingsCard, type SwitchCardScope } from './search/card.tsx'
import { openSessionThrough } from './search/host-api.ts'
import { dictionaries as searchDictionaries, NS as SEARCH_NS, translate as translateSearch, type LocaleKey as SearchLocaleKey } from './search/locales.ts'

export { STEWARD_ENTRY_ID, STEWARD_SETTINGS_NAMESPACE, TAB_HEALTH, TAB_HISTORY }
export { translate } from './locales.ts'

/** 字典命名空间（locale.register 用）。 */
export const NS = 'dsh-session-steward'

/** 槽位服务面（结构化镜像）。 */
interface StewardSlotsService {
  inject(name: string, callback: () => unknown, label?: string): void
  register(config: Record<string, unknown>, component: unknown): unknown
  entries(name: string): Array<{ options: { id?: string; order?: number; label?: unknown } }>
  getVersion(name: string): number
  subscribe(name: string, listener: () => void): () => void
}

/** locale 服务面。 */
interface StewardLocaleService {
  register(ns: string, dicts: Record<string, Record<string, string>>): () => void
}

/** 旧宿主设置服务面（已弃用：≤0.1.5 的 bind 是数据死路，台账 A2——保留类型注释存档）。 */

/** configForms 服务面（0.1.7：以 profile entry id 取句柄）。 */
interface StewardConfigForms {
  get<U>(entryId: string): StewardCardScope & { getSnapshot(): { value: U | undefined } }
}

/** 客户端插件声明的注入面。 */
export const inject = ['slots', 'locale']

/** 侧边栏脚部入口的 props（结构子集）。 */
export interface StewardFooterProps {
  /** 侧边栏是否渲染宽栏内容（false = 56px 收起轨道）。 */
  wide?: boolean
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
/* 侧栏 footer 槽位公约（2026-09-26；2026-10-01 收紧行距并强制居中）：一行多
   入口（第三方 dsh-context 等）会互相挤占 —— 宿主 .footerActions 是 nowrap
   flex 行。这里允许容器换行，并把本插件入口钉成独占一整行（flex-basis:100%）；
   其余入口（含第三方）自然落到后续行，各行内部自行布局，谁也不挤谁。
   justify-content:center 让行内所有入口（含不占满行的）统一居中；row-gap:0
   配合入口自身 32px 高度压缩纵向占位。类名用 [class*=] 中段匹配：宿主是 CSS
   Module 哈希类名（实测形如 hHd-Xa_footerActions —— <hash>_<name>，哈希在前），
   中段跨版本稳定。 */
[class*="footerActions"]{flex-wrap:wrap;justify-content:center;row-gap:0;height:auto;min-height:0}
/* —— 第三方矫正：dsh-context「上下文洞察」入口（2026-10-01）——
   .lc-ov-entry 按"独占整行"设计（width:calc(100% + 4px)、无 justify-content、
   42px 高、不对称 padding），与本槽位公约（每个入口独占一行、行内居中、32px）
   冲突，表现为文字靠左、纵向松散。这里按公约强制矫正；:not() 排除收起轨道的
   36px 圆钮形态。lc-ov-* 是 dsh-context 源码硬编码类名（非构建哈希），跨版本
   稳定（实测 0.56.1 / 0.60.0 规则一致）。两个自有插件各自携带同一矫正块：
   任一被禁用时矫正仍生效。 */
.lc-ov-entry:not(.lc-ov-entry-rail){width:auto!important;flex:0 0 100%!important;min-width:0!important;justify-content:center!important;height:32px!important;margin:0!important;padding:0 10px!important}
.lc-ov-entry-label{flex:0 1 auto!important}
/* 宽栏：独占一整行、放弃主动收缩（flex-shrink:0），行内居中；收起轨道回落自然宽度。 */
.dss_entryWrap{flex:0 1 auto;display:inline-flex;align-items:center;min-width:0}
.dss_entryWrapWide{flex:0 0 100%;width:100%;justify-content:center;margin-left:0}
/* 高度 32px（内容 22px 行高 + 上下各 5px）：宿主默认 42px 的上下裕度在多行
   堆叠后过于松散；左右内边距对称（10px/10px），否则整行居中时按钮内容会因
   不对称 padding 向左偏 1px。 */
.dss_footerEntry{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:4px;height:32px;padding:0 10px;border:none;border-radius:12px;background:transparent;cursor:pointer;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:14px;line-height:22px;white-space:nowrap;overflow:hidden;transition:background-color 160ms ease-out,color 160ms ease-out}
.dss_footerEntry:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dss_footerEntryRail{width:28px;height:28px;padding:0;gap:0;border-radius:50%}
.dss_footerIcon{flex:none;font-size:15px;line-height:1}
.dss_footerLabel{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dss_backdrop{position:fixed;inset:0;background:rgba(15,20,30,.42);z-index:1000}
.dss_panel{position:fixed;z-index:1001;left:50%;top:6vh;transform:translateX(-50%);width:min(860px,94vw);max-height:86vh;overflow:auto;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:14px;box-shadow:0 18px 48px rgba(0,0,0,.18);padding:10px 14px 14px}
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
/* 按行的磁盘占用：右对齐、不参与标题压缩，方便纵向比对「哪条最占地方」。 */
.dss_size{flex:none;font-variant-numeric:tabular-nums;white-space:nowrap}
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
.dss_cacheRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px}
.dss_spinner{width:11px;height:11px;margin-right:6px;border-radius:50%;display:inline-block;vertical-align:-1px;border:2px solid currentColor;border-top-color:transparent;animation:dssSpin .7s linear infinite}
@keyframes dssSpin{to{transform:rotate(360deg)}}
@keyframes dssSlide{0%{margin-left:-35%}100%{margin-left:100%}}
@media (prefers-reduced-motion:reduce){.dss_spinner{animation:none}.dss_progressIndeterminate{animation:none;width:100%;opacity:.5}.dss_setChev{transition:none}.dss_setCard{transition:none}}
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
.dss_setCard{border:1px solid var(--dsw-alias-border-l2,#e5e7eb);background:var(--dsw-alias-bg-layer-3,rgba(127,127,127,.05));border-radius:12px;transition:border-color .16s,background .16s}
.dss_setHead{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:none;border:0;border-radius:12px;display:flex;align-items:center;gap:12px;padding:14px 16px}
.dss_setHeadText{display:flex;flex-direction:column;gap:2px;flex:1 1 0%;min-width:0}
.dss_setCardTitle{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary,#111827)}
.dss_setCardDesc{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary,#9ca3af)}
.dss_setChev{color:var(--dsw-alias-label-tertiary,#9ca3af);flex:0 0 auto;transition:transform .16s}
.dss_setCardOpen .dss_setChev{transform:rotate(180deg)}
.dss_setBody{display:flex;flex-direction:column;gap:2px;padding:0 16px 12px}
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
 * @param ctx - 客户端上下文（slots、可选 locale / configForms）。
 */
export function apply(ctx: Context): void {
  ctx.effect(() => injectStyles(), 'dsh-session-steward: stylesheet')

  const locale = ctx.get('locale') as StewardLocaleService | undefined
  if (locale !== undefined && typeof locale.register === 'function') {
    ctx.effect(() => locale.register(NS, dictionaries), 'dsh-session-steward: dictionaries')
    // 搜索子域字典走独立命名空间 `switch-search`（键集与分包时代一致，不迁移）。
    ctx.effect(() => locale.register(SEARCH_NS, searchDictionaries), 'dsh-session-steward: search dictionaries')
  }
  // 搜索样式与管家样式各自幂等注入；两块类名前缀不同（dsws_ / dss_）不冲突。
  ctx.effect(() => injectSearchStyles(), 'dsh-session-steward: search stylesheet')

  // 数据面回退链（台账 A2 定案 + 0.1.7 实测补丁）：首选 configForms 原生句柄
  // （entry id 键），**渲染期**观测到 unavailable（出生死或 loading→死，A2 死
  // 路签名）就地落桥——自家 webServer 设置桥（settings-describe/mutate，宿主
  // 半 legacy settings 租约持久化；0.1.7 无 register → 只读真值投影）。两命名
  // 空间并存不迁移：session-steward / switch-search。
  const configForms = ctx.get('configForms') as StewardConfigForms | undefined
  const bound = withBridgeFallback(
    configForms?.get<StewardConfig>(STEWARD_ENTRY_ID) as BridgeScope<StewardConfig> | undefined,
    stewardBridgeScope(),
  )
  const searchBound = withBridgeFallback(
    configForms?.get<StewardConfig & SwitchSearchConfig>(STEWARD_ENTRY_ID) as BridgeScope<SwitchSearchConfig> | undefined,
    searchBridgeScope(),
  )

  const slots = ctx.get('slots') as StewardSlotsService | undefined
  if (slots === undefined) return

  // 搜索结果点击打开会话：click 时经 openSessionThrough 解析（uiWorkspace.openSession
  // 0.1.7+ 优先，旧宿主回退 sessions.open）—— 应用序早于导航模块，必须惰性取。
  const openSearchHit = (sessionId: string): void => {
    openSessionThrough((name) => ctx.get(name), sessionId)
  }

  // 侧边栏入口（两枚，同一 bundle 注册）：搜索（order 5，受 enabled+search 双门）与
  // 管家（order 6，受 enabled+historyFiles/healthCheck 门）。UI 收敛为单一操作台
  // 属 P2 批量台任务（.agents/plans/steward-merge-search-index T9）。
  slots.inject('sidebar.footer.action', () => slots.register(
    { name: 'sidebar.footer.action', id: 'dsh-search-index', order: 5 },
    (props: StewardFooterProps) => createElement(SearchEntry, {
      ...props,
      open: openSearchHit,
      scope: searchBound as unknown as SwitchCardScope,
    }),
  ), 'dsh-session-steward: sidebar footer search entry')

  // 侧边栏入口：一个按钮，打开「养老院 / 体检」双页签面板。
  slots.inject('sidebar.footer.action', () => slots.register(
    { name: 'sidebar.footer.action', id: STEWARD_ENTRY_ID, order: 6 },
    (props: StewardFooterProps) => createElement(StewardEntry, { ...props, scope: bound, openSession: openSearchHit }),
  ), 'dsh-session-steward: sidebar footer entry')

  // 插件族共用设置 tab（dsh-thinking-levels 的顶级「起子插件设置」节声明该子
  // 席位）。thinking-levels 缺席时本 inject 静默等待，不阻塞客户端半。
  // 搜索卡（order 30）与管家卡（order 40）各占一张，键集/命名空间互不迁移。
  slots.inject('dsh-family.tab', () => slots.register(
    {
      name: 'dsh-family.tab',
      id: 'dsh-search-index',
      order: 30,
      label: () => translateSearch((locale as { bind?: (n: string) => SearchCardTranslate } | undefined)?.bind?.(SEARCH_NS), 'card.title'),
      locale: SEARCH_NS,
    },
    (props: { t?: SearchCardTranslate }) => createElement(SearchSettingsCard, {
      scope: searchBound as unknown as SwitchCardScope,
      t: props.t,
    }),
  ), 'dsh-session-steward: family settings tab (search)')

  slots.inject('dsh-family.tab', () => slots.register(
    {
      name: 'dsh-family.tab',
      id: STEWARD_ENTRY_ID,
      order: 40,
      // 账本 label：读期求值，跟随当前 locale（translate 内建 zh/en 兜底）。
      label: () => translate((locale as { bind?: (n: string) => CardTranslate } | undefined)?.bind?.(NS), 'card.title'),
      locale: NS,
    },
    (props: { t?: CardTranslate }) => createElement(StewardSettingsCard, {
      scope: bound as StewardCardScope,
      t: props.t,
    }),
  ), 'dsh-session-steward: family settings tab')

  // Plugins 页配置卡（`plugins.bundle.config`，key = 包名，dsh-tidy-display
  // 已实证该模式）：0.1.7 宿主的 Plugins 页只渲染 key 与包名相等的条目。
  // 合并包只有 package name `dsh-session-steward` 一个键 —— 复合卡把搜索卡与
  // 管家卡同页纵排，scope 各自绑定（字段集不相交），页面 owner props 是
  // `{ view, form }` 不带 `t`，回退各卡的内置 zh 译器。
  slots.inject('plugins.bundle.config', () => slots.register(
    { name: 'plugins.bundle.config', key: STEWARD_ENTRY_ID },
    (props: { t?: CardTranslate }) => createElement('div', { style: { display: 'grid', gap: '12px' } }, [
      createElement(SearchSettingsCard, {
        scope: searchBound as unknown as SwitchCardScope,
        t: props.t as unknown as SearchCardTranslate | undefined,
      }),
      createElement(StewardSettingsCard, {
        scope: bound as StewardCardScope,
        t: props.t,
      }),
    ]),
  ), 'dsh-session-steward: plugins page config card')

  // 家族节宿主选举（次优先级）：宿主 dsh-thinking-levels 缺席时顶上「起子插件
  // 设置」节。下载量排名 session-steward(1090) 低于 session-guard(1522) → 宽限期
  // 更长，guard 先尝试接管；guard 也缺席时本插件按同一 id `dsh-family` 接管，
  // 声明同一个 dsh-family.tab 子席位并通用渲染全部贡献卡。与 guard 的并发竞争
  // 由 ui-slots 同 id 重复注册抛错仲裁，先到者胜、后到者放弃。
  const familyTabsHooks = makeFamilyTabsHooks(slots)
  ctx.effect(() => {
    let claimed: unknown
    const timer = setTimeout(() => {
      if (slots.entries('settings.section').some(e => e.options.id === FAMILY_SECTION_ID)) return
      try {
        claimed = slots.register({
          name: 'settings.section',
          id: FAMILY_SECTION_ID,
          order: 40,
          label: () => translate((locale as { bind?: (n: string) => CardTranslate } | undefined)?.bind?.(NS), 'family.title'),
          locale: NS,
          inject: () => ({ hooks: { tabs: familyTabsHooks } }),
          children: { [FAMILY_CHILD_KEY]: { kind: 'list', scope: 'root' } },
        }, StewardFamilySection)
      } catch {
        // 并发接管竞争落败（或设置壳未声明席位）：胜出方的节服务整个家族。
      }
    }, FAMILY_HOST_GRACE_MS)
    return () => { clearTimeout(timer); if (typeof claimed === 'function') (claimed as () => void)() }
  }, 'dsh-session-steward: family fallback host')
}

/** 家族节固定 id（与 thinking-levels / guard 的注册严格一致）。 */
const FAMILY_SECTION_ID = 'dsh-family'
/** 家族子席位 key（与 thinking-levels 的声明严格一致）。 */
const FAMILY_CHILD_KEY = 'dsh-family.tab'
/** 接管宽限期：guard 2000ms 先试，本插件 2600ms 兜底。 */
const FAMILY_HOST_GRACE_MS = 2600

/** 接管节的账本投影 hooks（与 thinking-levels 的 FamilySectionInjected 同形；locale 变更也触发重渲染）。 */
function makeFamilyTabsHooks(slots: StewardSlotsService): {
  getSnapshot: () => readonly FamilyTabEntry[]
  subscribe: (listener: () => void) => () => void
} {
  let version = -1
  let tabs: readonly FamilyTabEntry[] = []
  return {
    getSnapshot: () => {
      const next = slots.getVersion(FAMILY_CHILD_KEY)
      if (next !== version) {
        version = next
        tabs = slots.entries(FAMILY_CHILD_KEY)
          .map(entry => ({
            id: entry.options.id ?? '',
            order: entry.options.order ?? 0,
            label: typeof entry.options.label === 'function'
              ? (() => { try { return String((entry.options.label as () => unknown)() ?? entry.options.id ?? '') } catch { return String(entry.options.id ?? '') } })()
              : String(entry.options.label ?? entry.options.id ?? ''),
          }))
          .sort((a, b) => a.order - b.order)
      }
      return tabs
    },
    subscribe: (listener: () => void) => slots.subscribe(FAMILY_CHILD_KEY, listener),
  }
}

/** 账本条目（id/order/label，label 已解析为字符串）。 */
interface FamilyTabEntry {
  id: string
  order: number
  label: string
}

/**
 * 家族节接管组件（fallback host section）：纯通用渲染 —— 把 `dsh-family.tab`
 * 账本里的每张贡献卡（含本插件自己的，接管时本插件也声明了该子席位）按
 * order 依次 renderSlot；各卡本身是默认展开的抽屉，整节即一页抽屉。
 */
function StewardFamilySection(props: {
  renderSlot: (key: string, owner?: object, opts?: { only?: string; fallback?: unknown }) => unknown
  hooks: { tabs: { getSnapshot: () => readonly FamilyTabEntry[]; subscribe: (listener: () => void) => () => void } }
}): ReactElement {
  const tabs = useSyncExternalStore(props.hooks.tabs.subscribe, props.hooks.tabs.getSnapshot)
  return createElement('div', { style: { display: 'grid', gap: '12px' } },
    ...tabs.map(row => createElement('div', { key: row.id },
      props.renderSlot(FAMILY_CHILD_KEY, {}, { only: row.id, fallback: null }) as ReactElement,
    )),
  )
}

/** 入口按钮：持有面板开关；两个页签的可见性来自配置快照。 */
export function StewardEntry(
  props: StewardFooterProps & {
    scope?: (StewardCardScope & { getSnapshot(): { value: StewardConfig | undefined } }) | undefined
    openSession?: (sessionId: string) => void
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
  const searchEnabled = config.search !== false
  const visible = config.enabled !== false && (historyFiles || healthCheck || searchEnabled)
  const wide = props.wide === true
  // 入口文案与面板标题同源：字典是唯一出处，组件不再持有兜底中文。
  const label = translate(undefined, 'panel.title')

  if (!visible) return createElement('span', { className: 'dss_entryWrap' })
  return createElement('span', { className: wide ? 'dss_entryWrap dss_entryWrapWide' : 'dss_entryWrap' }, [
    createElement(StewardFooter, {
      key: 'btn',
      title: label,
      label,
      wide,
      onClick: () => { setOpen(!open) },
    }),
    open
      ? createElement(StewardPanel, {
        key: 'panel',
        historyFiles,
        healthCheck,
        searchEnabled,
        openSession: props.openSession,
        onClose: () => { setOpen(false) },
      })
      : null,
  ])
}

/** 搜索设置卡的译器形状（search/locales.ts 的 LocaleKey 键集）。 */
type SearchCardTranslate = (key: SearchLocaleKey, params?: Record<string, unknown>) => string

/**
 * 搜索侧栏入口（合并包装配）：双门可见性 —— 插件总开关 `enabled` 与搜索子域
 * 开关 `search` 任一关闭即不渲染；可见时交给 SwitchFooter（其内部再读一次
 * scope 的 enabled，与设置卡「启用会话搜索」同源，开关不会空转）。
 */
function SearchEntry(props: {
  wide?: boolean
  open: (sessionId: string) => void
  scope?: unknown
}): ReactElement {
  const scope = props.scope as
    | { subscribe(listener: () => void): () => void; getSnapshot(): { value?: Record<string, unknown> } }
    | undefined
  const snapshot = useSyncExternalStore(
    (listener) => scope?.subscribe(listener) ?? (() => {}),
    () => scope?.getSnapshot(),
  )
  const value = snapshot?.value ?? {}
  if (value['enabled'] === false || value['search'] === false) {
    return createElement('span', { className: 'dss_entryWrap' })
  }
  return createElement('span', {
    className: props.wide === true ? 'dss_entryWrap dss_entryWrapWide' : 'dss_entryWrap',
  }, createElement(SwitchFooter, {
    wide: props.wide === true,
    open: props.open,
    scope: props.scope as SwitchCardScope,
  }))
}

/** 导出字典查找 type 供消费者复用。 */
export type { LocaleKey }
