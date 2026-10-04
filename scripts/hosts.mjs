// SPDX-License-Identifier: MIT
/**
 * 宿主版本单源（single source of truth）。
 *
 * 本文件是 peers / engines / dsh.plugin.json / README 兼容句的唯一出处，
 * 由 `sync-hosts.mjs` 消费（默认校验漂移，`--write` 回写）。**禁止**手改
 * package.json 里的 dsh peer 范围或 engines.dsh —— 一律改这里再跑：
 *
 *   node scripts/sync-hosts.mjs --write
 *
 * supportedHosts 语义：**已声明支持**的宿主版本精确枚举（不是 semver 范围）。
 * semver 预发布规则下，范围（如 `>=0.1.7-rc.1`）匹配不了异元组的 rc，且枚举
 * 本身就是"逐版本实测过"的白名单 —— 每加一个 rc，先过 CI matrix（P2-T11）
 * 再入列。alpha/beta 永不入列（0.2.1 只盯 rc，发布后人工加一行）。
 */

/** 已声明支持的 DSH 宿主版本（0.1.0 → 0.2.0 全部 rc；npm 实查，0.1.0-rc.4/5 未发布）。 */
export const supportedHosts = Object.freeze([
  '0.1.0-rc.2', '0.1.0-rc.3', '0.1.0-rc.6', '0.1.0-rc.7', '0.1.0-rc.8',
  '0.1.1-rc.1', '0.1.1-rc.2',
  '0.1.2-rc.1',
  '0.1.5-rc.1', '0.1.5-rc.2', '0.1.5-rc.3',
  '0.1.7-rc.1', '0.1.7-rc.2',
  '0.2.0-rc.1', '0.2.0-rc.2',
])

/** 开发/类型检查所钉的宿主版本（devDependencies 只钉它）。 */
export const developmentHost = '0.2.0-rc.2'

/**
 * 声明为枚举 peer 的 `@deepseek-ai/dsh-*` 包（版本随宿主逐 rc 联动）。
 * cordis / schemastery / react 不随宿主改版，保持 caret，不在此列。
 * 老线不存在的包（如 dsh-session-format-catalog）将来加入时必须同时声明
 * peerDependenciesMeta.optional。
 */
export const dshPeers = Object.freeze([
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-ui-settings',
  '@deepseek-ai/dsh-client-ui-settings-general',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-session',
  // P1 服务替换面:子类继承官方 WorkspaceRegistry;spill 清理软导入。
  // npm 实查 8 条抽样线全覆盖(0.1.0-rc.2 → 0.2.0-rc.2)。
  '@deepseek-ai/dsh-workspace',
  '@deepseek-ai/dsh-spill-local',
])

/** 生成枚举 OR-list 范围（与 AM 同形：`0.1.0-rc.2 || 0.1.0-rc.3 || ...`）。 */
export function peerRange() {
  return supportedHosts.join(' || ')
}

/** devDependencies 里随宿主钉版的包 → 精确 developmentHost。 */
export function devHostDeps() {
  return {
    '@deepseek-ai/dsh-client-ui-slots': developmentHost,
    '@deepseek-ai/dsh-session': developmentHost,
    '@deepseek-ai/dsh-workspace': developmentHost,
    '@deepseek-ai/dsh-spill-local': developmentHost,
  }
}
