/**
 * dsh-session-steward 的共享配置面（合并包：管家子域 + 搜索索引子域）。
 *
 * 与 host 半身（schemastery schema 在 src/index.ts）以及浏览器半身共用同一形状，
 * 使一处 admitted 的值在另一处也 admitted。
 *
 * 两个设置命名空间**并存且互不迁移**：
 * - `session-steward` —— 管家子域（enabled/historyFiles/healthCheck/search 等共享键）；
 * - `switch-search` —— 搜索子域的历史命名空间，存储键承诺保持稳定（见
 *   dsh-search-index README「存储键保持稳定，不做迁移」）；0.1.7 起两者实际
 *   都落在同一 composition entry（configForms），旧宿主才按命名空间分流。
 */

/** 会话管家运行时配置（设置命名空间 + 组合入口）。 */
export interface StewardConfig {
  /** 插件总开关（合并包唯一 master：关闭后不注册任何子域路由）。 */
  enabled: boolean
  /** 会话历史文件（归档浏览与清理）。关闭后不注册 history 路由、不渲染「养老院」页签。 */
  historyFiles?: boolean
  /** 会话健康检查（体检 → 处方 → 出院）。关闭后不注册 health 路由、不渲染「体检」页签。 */
  healthCheck?: boolean
  /** 搜索索引子域（`index-*` 路由与侧栏搜索入口）。关闭后索引子域整体停摆。 */
  search?: boolean
}

/** 缺省值。 */
export const DEFAULT_CONFIG: Required<StewardConfig> = {
  enabled: true,
  historyFiles: true,
  healthCheck: true,
  search: true,
}

/** host 半身注册的设置命名空间（与 src/index.ts 保持一致）。 */
export const STEWARD_SETTINGS_NAMESPACE = 'session-steward'

/** 侧边栏入口 id（客户端注册 id）。 */
export const STEWARD_ENTRY_ID = 'dsh-session-steward'

/** host 路由前缀（管家子域；与搜索子域的 /switch-search/api 互不干扰）。 */
export const STEWARD_API_PREFIX = '/session-steward/api'

/** ------------------------------------------------------------------ 搜索子域 */

/** 搜索子域的历史设置命名空间（存储键稳定承诺，永不迁移）。 */
export const SWITCH_SEARCH_SETTINGS_NAMESPACE = 'switch-search'

/** 搜索子域路由前缀（历史值，浏览器旧 bundle 与快照文件名依赖它，保持不变）。 */
export const SWITCH_API_PREFIX = '/switch-search/api'

/** 搜索面板打开时的默认模式。 */
export type SwitchSearchDefaultMode = 'title' | 'content'

/** 搜索子域可调配置（独立于 StewardConfig 的历史形状，字段名保持稳定）。 */
export interface SwitchSearchConfig {
  /**
   * 搜索卡上的「启用」开关。合并包里它与管家 `enabled` 是**同一个**组合入口
   * 字段（0.1.7 configForms 单 scope）；保留在此处是为了 legacy settingsScope
   * 回退路径（旧 switch-search 命名空间的存储形状）与设置卡类型不变。
   */
  enabled?: boolean
  /** 面板默认模式。 */
  defaultMode: SwitchSearchDefaultMode
  /** 独立索引是否后台自动同步（水位轮询）。 */
  autoSync?: boolean
  /** 增量同步间隔（ms）。 */
  syncIntervalMs?: number
  /** 整理索引后保留的归档份数。 */
  archiveKeep?: number
  /** 独立索引文件的可选绝对目录。 */
  indexDir?: string
}

/** 搜索子域缺省值。 */
export const SWITCH_DEFAULT_CONFIG: Required<SwitchSearchConfig> = {
  enabled: true,
  defaultMode: 'title',
  autoSync: true,
  syncIntervalMs: 30_000,
  archiveKeep: 2,
  indexDir: '',
}
