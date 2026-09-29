/**
 * 插件署名格式（source kind）体检门与转换。
 *
 * ## 背景：会话格式 v4 的署名要求
 *
 * 宿主 0.1.7-rc.1 起（会话格式 v4）废弃裸 `source: { kind: 'plugin', plugin: '<name>' }`
 * 的署名方式，要求每条插件写入的消息使用生产者自有 kind（`plugin:<name>`）。
 * 校验失败时**整轮失败**（SessionFormatError），不是丢一条消息。
 * 修复模式（与已适配的 aegis、dsh-better-sidebar 一致）：
 *   `{ kind: 'plugin', plugin: '<name>' }` → `{ kind: 'plugin:<name>' }`（删除 plugin 字段）。
 *
 * ## 版本依赖表（各格式代次依赖的宿主固定版本与处置策略）
 *
 * | 格式代次 | 宿主版本线          | 旧署名行是否合法 | 处置策略                                   |
 * |---|---|---|---|
 * | v1       | 未考证（早期线）     | 合法             | 不动（leave-asis）                          |
 * | v2       | 未考证               | 合法             | 不动                                        |
 * | v3       | 0.1.6 时代（待考证） | 合法             | 不动：宿主 v3→v4 迁移负责，插件越权改写属过度操作 |
 * | v4       | ≥ 0.1.7-rc.1（已实锤）| **拒绝**（SessionFormatError） | 检测 + 可选转换（本模块） |
 *
 * 判定依据是**日志 header 的 version 字段**（`decode.ts` 已解析为 `SessionLogRead.header`），
 * 不猜文件名、不猜宿主安装版本：同一份磁盘语料可能混有多条版本线的产物，
 * 每份日志按它自己的 header 代次走对应的策略线。
 *
 * ## 红线（与 repair.ts 的红线关系）
 *
 * repair.ts 的红线是「禁止改写会话日志」。本模块的转换是**经用户显式触发的唯一例外**：
 * 只改 `source.kind` / `source.plugin` 两个署名字段，其余字节原样保留；改前整文件备份；
 * 日志完整性不合格（撕裂尾帧 / 解码失败 / seq 缺口）或代次不在 v4 线时**拒绝执行**。
 * 这三道闸缺一不可，否则就退化成「静默改历史数据」。
 */
import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import zlib from 'node:zlib'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { scanZstdFrames, type SessionLogRead } from './decode.ts'
import type { GateLevel } from './gates.ts'

/** v4 线起点的宿主版本（会话格式 v4 引入 producer-owned source kind）。 */
export const V4_HOST_MIN = '0.1.7-rc.1'

/** 旧署名（v3 形态）：`kind === 'plugin'` 且带独立 `plugin` 字段。 */
export interface LegacySource {
  kind: 'plugin'
  plugin: string
  form?: unknown
}

/** 一份日志里的旧署名事实。 */
export interface SourceKindFacts {
  /** 旧署名事件总数。 */
  legacyCount: number
  /** 按生产者插件名统计。 */
  byPlugin: Record<string, number>
  /** 命中样例（seq + 插件名），最多 5 条，供证据展示。 */
  examples: { seq: number; plugin: string }[]
  /** 日志 header 的格式代次（无从读取时 undefined）。 */
  headerVersion?: number
}

/** 从解码后的日志提取旧署名事实（只读）。 */
export function readSourceKindFacts(log: SessionLogRead): SourceKindFacts {
  const byPlugin: Record<string, number> = {}
  const examples: { seq: number; plugin: string }[] = []
  for (const event of log.events) {
    // 署名出现在事件 data.source（消息类事件的归属信息）；打包行已由解码层展开。
    const data = event.data as { source?: unknown } | undefined
    const source = data?.source as LegacySource | undefined
    if (
      source === undefined || typeof source !== 'object' ||
      source.kind !== 'plugin' || typeof source.plugin !== 'string' || source.plugin === ''
    ) continue
    byPlugin[source.plugin] = (byPlugin[source.plugin] ?? 0) + 1
    if (examples.length < 5) examples.push({ seq: event.seq, plugin: source.plugin })
  }
  const headerVersion = typeof log.header?.['version'] === 'number' ? log.header['version'] as number : undefined
  const legacyCount = Object.values(byPlugin).reduce((sum, n) => sum + n, 0)
  return {
    legacyCount,
    byPlugin,
    examples,
    ...(headerVersion === undefined ? {} : { headerVersion }),
  }
}

/**
 * gate 5：插件署名格式（v4 线要求 producer-owned kind）。
 *
 * 档位判据（有据才抬档）：
 * - header.version ≥ 4 且观测到旧署名行 → `warn`：v4 校验拒绝这种署名；存量行让
 *   未适配插件的读回判断（`kind === 'plugin' && plugin === name`）失配，转换可消除；
 * - header.version < 4 → `ok`：v3 及更早线旧行合法，宿主迁移负责，**不动**（防过度操作）；
 * - header.version 无从读取 → `skipped`：无从判定该走哪条版本线。
 * @param facts - 旧署名事实；undefined 表示未提供（无日志）。
 */
export function gateSourceKind(facts: SourceKindFacts | undefined): {
  id: 'source-kind'
  level: GateLevel
  evidence: string
  detail?: Record<string, unknown>
} {
  if (facts === undefined) {
    return { id: 'source-kind', level: 'skipped', evidence: '未提供日志读取结果，本门无从判定' }
  }
  const version = facts.headerVersion
  const plugins = Object.entries(facts.byPlugin)
  const detail = {
    headerVersion: version,
    legacyCount: facts.legacyCount,
    byPlugin: facts.byPlugin,
    examples: facts.examples,
    v4HostMin: V4_HOST_MIN,
  }
  if (version === undefined) {
    return { id: 'source-kind', level: 'skipped', evidence: '日志 header 无 version 字段，无从判定格式代次线', detail }
  }
  if (version < 4) {
    return {
      id: 'source-kind',
      level: 'ok',
      evidence: `格式代次 v${version}（v4 之前的版本线）：旧署名行合法，宿主 v3→v4 迁移负责，不做转换` +
        (plugins.length > 0 ? `（观测到 ${plugins.reduce((s, [, n]) => s + n, 0)} 行旧署名，按策略不动）` : ''),
      detail,
    }
  }
  if (plugins.length === 0) {
    return { id: 'source-kind', level: 'ok', evidence: `格式代次 v${version}：全部插件署名均为 producer-owned kind（plugin:<name>）`, detail }
  }
  const summary = plugins.map(([name, count]) => `${name}×${count}`).join('、')
  return {
    id: 'source-kind',
    level: 'warn',
    evidence: `格式代次 v${version} 但存在 ${facts.legacyCount} 行旧署名（${summary}）：宿主 v4 拒绝该形态，未适配插件读回判断也会失配；可执行署名转换`,
    detail,
  }
}

/** 转换结果。 */
export interface SourceKindMigrationOutcome {
  ok: boolean
  sessionId: string
  /** 被改写的日志路径。 */
  path: string
  /** 备份路径（改写前的完整副本；ok 且 changed 时必有）。 */
  backup?: string
  /** 改写的行数。 */
  changedRows?: number
  /** 按生产者插件名统计的改写行数。 */
  byPlugin?: Record<string, number>
  /**
   * 按生产者名统计的**跳过**行数（第一方名，宿主迁移职权，见
   * `isFirstPartyLegacyProducer`）。跳过是如实上报，不是静默丢弃。
   */
  skippedFirstParty?: Record<string, number>
  error?: string
}

/**
 * 从旧署名对象构造新署名：`{ kind: 'plugin', plugin: name, …rest }` → `{ kind: 'plugin:name', …rest }`。
 * 非 legacy（缺 plugin 字段 / kind 不符）返回 undefined，调用方跳过该行。
 *
 * ⚠️ 只对**第三方**生产者名成立（第四轮审计 ST1）：宿主 `producerKind`
 * （dsh-session-format-v3-to-v4@0.1.7-rc.2 lib/index.js:88-96）对第一方名走改名表
 * 或同名裸 kind，本函数无条件加前缀会对那 30 个名字写出宿主永不产出的 kind。
 * 第一方名由 `FIRST_PARTY_RENAMED_PRODUCERS` / `FIRST_PARTY_SAME_NAME_PRODUCERS`
 * 判定，`migrateSessionSourceKind` 命中即跳过并如实上报（宿主迁移职权，不代转换）。
 */
export function migrateLegacySource(source: unknown): Record<string, unknown> | undefined {
  if (typeof source !== 'object' || source === null) return undefined
  const record = source as Record<string, unknown>
  if (record['kind'] !== 'plugin' || typeof record['plugin'] !== 'string' || record['plugin'] === '') return undefined
  const { plugin, ...rest } = record
  return { ...rest, kind: `plugin:${plugin as string}` }
}

/**
 * 宿主 v3→v4 迁移会**改名**的第一方生产者（出处：dsh-session-format-v3-to-v4@
 * 0.1.7-rc.2 lib/index.js:51-57 `RENAMED_PRODUCERS`，逐字照录）。
 */
export const FIRST_PARTY_RENAMED_PRODUCERS: Readonly<Record<string, string>> = Object.freeze({
  'compact': 'compact-checkpoint',
  'tools-code-mode': 'ptc-mode',
  'tools-ptc': 'ptc-mode',
  'dsh-compaction-basic': 'compact-basic',
  '@deepseek-ai/dsh-system-prompt': 'runtime-context',
})

/**
 * 宿主迁移后**保留同名裸 kind** 的第一方生产者（出处：同上 lib/index.js:59-84
 * `RELEASED_SAME_NAME_PRODUCERS`，逐字照录；注释明言限第一方）。
 * 注：`@deepseek-ai/dsh-system-prompt` 还有 role 敏感分支（role=system →
 * `system-prompt`），steward 无 role 上下文、结构性不可复刻——这正是第一方名
 * 一律跳过、交还宿主迁移的核心理由之一。
 */
export const FIRST_PARTY_SAME_NAME_PRODUCERS: ReadonlySet<string> = new Set([
  'agent-instructions',
  'session-reference',
  'team-message',
  'goal',
  'skill-invocation',
  'skill-catalog',
  'coordinator',
  'subagent-report',
  'subagent-settled',
  'webhook',
  'agent-message',
  'model-selection',
  'plan-mode',
  'time-context',
  'tmux-context',
  'user-approval',
  'repeat-tool-reminder',
  'tool-cordis',
  'cordis-host-runner',
  'tool-goal',
  'tool-jobs',
  'hooks-codex',
  'hooks-claude-code',
  'schedule',
  'dsh-session-title-llm',
])

/** 是否第一方生产者名（宿主迁移职权，steward 不代转换——防归因静默损坏）。 */
export function isFirstPartyLegacyProducer(plugin: string): boolean {
  return Object.hasOwn(FIRST_PARTY_RENAMED_PRODUCERS, plugin) || FIRST_PARTY_SAME_NAME_PRODUCERS.has(plugin)
}

/**
 * 转换一个会话日志里的旧署名行（v4 线专用；先备份，只动署名字段）。
 *
 * 执行闸（任一不满足即拒绝，不写盘）：
 * 1. 日志可整体解码且无完整性问题（撕裂尾帧 / 解码失败 / seq 缺口）；
 * 2. header.version ≥ 4（v3 及更早的旧行按契约由宿主迁移，不动）；
 * 3. 确有旧署名行（没有则空手而归，不做无谓重压缩）。
 * @param sessionId - 会话 id（用于结果标注）。
 * @param logPath - 当前代日志路径（必须 .zstd 结尾）。
 * @param log - 已解码的日志（复用体检结果，闸 1/2 在其上判定）。
 * @param dshHome - DSH home（备份不依赖它，参数保留与其它处置一致的面）。
 * @param now - 时间源（备份后缀，测试可控）。
 */
export function migrateSessionSourceKind(
  sessionId: string,
  logPath: string,
  log: SessionLogRead,
  dshHome?: string,
  now: () => number = Date.now,
): SourceKindMigrationOutcome {
  void dshHome
  const failure = (error: string): SourceKindMigrationOutcome => ({ ok: false, sessionId, path: logPath, error })
  if (!logPath.endsWith('.zstd')) return failure(`非 zstd 产物，拒绝处理：${logPath}`)
  if (log.issues.length > 0) return failure(`日志存在 ${log.issues.length} 条完整性问题，拒绝改写（先解决 log-integrity 门）`)
  if (log.tornStart !== undefined) return failure('存在撕裂尾帧，拒绝改写（先让宿主完成提交或处置 log-integrity 门）')
  const headerVersion = typeof log.header?.['version'] === 'number' ? log.header['version'] as number : undefined
  if (headerVersion === undefined) return failure('日志 header 无 version 字段，无法确认格式代次线，拒绝改写')
  if (headerVersion < 4) {
    return failure(`格式代次 v${headerVersion}：旧署名在该版本线合法，宿主迁移负责，不做转换（防过度操作）`)
  }

  // 逐行重写：只重序列化发生变化的行，其余行保持原字节（避免无谓的全量格式漂移）。
  let original: string
  try {
    original = readPlaintext(logPath)
  } catch (err) {
    return failure(`读取日志失败：${String(err instanceof Error ? err.message : err)}`)
  }
  const lines = original.split('\n')
  let changedRows = 0
  const byPlugin: Record<string, number> = {}
  const skippedFirstParty: Record<string, number> = {}
  const rewritten = lines.map((line, index) => {
    if (index === 0 || line.trim() === '') return line
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      return line // 非法行交给 log-integrity 门报，这里不添乱
    }
    if (typeof parsed !== 'object' || parsed === null) return line
    const record = parsed as Record<string, unknown>
    const data = record['data'] as Record<string, unknown> | undefined
    if (data === undefined || typeof data !== 'object') return line
    const legacy = data['source'] as Record<string, unknown> | undefined
    if (
      legacy === undefined || typeof legacy !== 'object' ||
      legacy['kind'] !== 'plugin' || typeof legacy['plugin'] !== 'string' || legacy['plugin'] === ''
    ) return line
    const plugin = legacy['plugin'] as string
    // ST1：第一方名跳过——宿主 producerKind 对它们走改名表/同名裸 kind（还有
    // role 敏感分支），无条件加前缀会写出宿主永不产出的 kind，静默损坏归因。
    // 跳过并如实上报，交还宿主迁移（防过度操作红线）。
    if (isFirstPartyLegacyProducer(plugin)) {
      skippedFirstParty[plugin] = (skippedFirstParty[plugin] ?? 0) + 1
      return line
    }
    const migrated = migrateLegacySource(legacy)
    if (migrated === undefined) return line
    data['source'] = migrated
    changedRows += 1
    byPlugin[plugin] = (byPlugin[plugin] ?? 0) + 1
    return JSON.stringify(record)
  })
  if (changedRows === 0) {
    const skippedTotal = Object.values(skippedFirstParty).reduce((sum, n) => sum + n, 0)
    return {
      ok: true,
      sessionId,
      path: logPath,
      changedRows: 0,
      byPlugin: {},
      ...(skippedTotal > 0 ? { skippedFirstParty } : {}),
    }
  }

  // 备份 → 原子落盘：先写临时文件再 rename，任何中断下原文件要么原样要么完整新态，
  // 且备份副本始终存在可回退。
  const backup = `${logPath}.pre-sourcemigrate-${now()}`
  try {
    copyFileSync(logPath, backup)
    const compressed = zlib.zstdCompressSync(Buffer.from(rewritten.join('\n'), 'utf8'))
    const tmp = `${logPath}.sourcemigrate-tmp`
    writeFileSync(tmp, compressed)
    renameSync(tmp, logPath)
    return {
      ok: true,
      sessionId,
      path: logPath,
      backup,
      changedRows,
      byPlugin,
      ...(Object.keys(skippedFirstParty).length > 0 ? { skippedFirstParty } : {}),
    }
  } catch (err) {
    return failure(`转换落盘失败（原文件未动，备份${existsSync(backup) ? '已生成' : '未生成'}）：${String(err instanceof Error ? err.message : err)}`)
  }
}

/** 读出整份 zstd 日志的明文；失败时抛出（调用方拒绝改写并如实上报）。 */
function readPlaintext(logPath: string): string {
  const bytes = readFileSync(logPath)
  const { frames, tornStart } = scanZstdFrames(bytes)
  if (tornStart !== undefined) throw new Error('存在撕裂尾帧，拒绝改写')
  const parts: Buffer[] = []
  for (const frame of frames) {
    parts.push(zlib.zstdDecompressSync(bytes.subarray(frame.start, frame.end)))
  }
  return Buffer.concat(parts).toString('utf8')
}

/** 备份文件的后缀约定（purge/清理工具可据此识别并一并处置）。 */
export const SOURCE_MIGRATE_BACKUP_SUFFIX = '.pre-sourcemigrate-'
