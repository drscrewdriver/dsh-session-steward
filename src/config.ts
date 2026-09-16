/**
 * dsh-session-steward 的共享配置面。
 *
 * 与 host 半身（schemastery schema 在 src/index.ts）以及浏览器半身共用同一形状，
 * 使一处 admitted 的值在另一处也 admitted —— 与 dsh-session-search-toggle /
 * dsh-thinking-levels 的 config 面惯例一致。
 */

/** 会话管家运行时配置（设置命名空间 + 组合入口）。 */
export interface StewardConfig {
  /** 插件总开关。 */
  enabled: boolean
  /** 会话历史文件（归档浏览与清理）。关闭后不注册 history 路由、不渲染「养老院」页签。 */
  historyFiles?: boolean
  /** 会话健康检查（体检 → 处方 → 出院）。关闭后不注册 health 路由、不渲染「体检」页签。 */
  healthCheck?: boolean
}

/** 缺省值。 */
export const DEFAULT_CONFIG: Required<StewardConfig> = {
  enabled: true,
  historyFiles: true,
  healthCheck: true,
}

/** host 半身注册的设置命名空间（与 src/index.ts 保持一致）。 */
export const STEWARD_SETTINGS_NAMESPACE = 'session-steward'

/** 侧边栏入口 id（客户端注册 id）。 */
export const STEWARD_ENTRY_ID = 'dsh-session-steward'

/** host 路由前缀（与搜索索引插件的 /switch-search/api 互不干扰）。 */
export const STEWARD_API_PREFIX = '/session-steward/api'
