/**
 * 会话日志的「代次」文件名契约（对齐宿主 session 操作核心）。
 *
 * 一个会话目录里可以同时存在多份日志产物：
 *
 *     session.jsonl.zstd                          历史代 0（无版本号）
 *     session.v<N>.jsonl.zstd                     当前代 N（N ≥ 1）
 *     session.migration.<token>.jsonl.zstd.tmp    迁移暂存（当前代的发布源）
 *
 * **当前代由目录实测的最高代次决定，不硬编码 `v3`；日志名由代次推导，不硬编码
 * `session.jsonl.zstd`。** 硬编码 v0 正是本插件此前「看不见任何已发布当前代的
 * 会话」的病根：实测 449 个会话目录中有 61 个只留当前代，旧发现逻辑对它们一条
 * 都发现不了，因而既扫不到也修不了。
 *
 * 宿主侧的代次发布顺序是「写暂存 → fsync → 校验 → 原子发布成当前代」，所以
 * **当前代次非 0 等价于「这份日志是从 TMP 里移出来的」**；目录内仍有暂存残留
 * 则是发布源仍在原地的物证。本模块据此给出处置优先级。
 *
 * 语法逐条对齐宿主包，改动它们必须同步这里（`tests/generation.spec.ts` 复刻了
 * 宿主的全部拒绝用例，宿主放宽/收紧时该组测试会失败）：
 *   - `@deepseek-ai/dsh-session-format/src/filename.ts`
 *     `CANONICAL_LOG_FILENAME = /^session(?:\.v([1-9][0-9]*))?\.jsonl$/u`
 *   - `@deepseek-ai/dsh-session-persistence-jsonl/src/format.ts` 的压缩后缀
 *   - `@deepseek-ai/dsh-session-persistence-jsonl/src/generation.ts:725`
 *     暂存名 `session.migration.${randomToken()}${suffix}.tmp`（token 为 16 位小写十六进制）
 */
import { readdirSync, statSync, type Dirent } from 'node:fs'
import { join } from 'node:path'

/** 日志的物理编码（对齐宿主的 `JsonlCompression`）。 */
export type LogCompression = 'zstd' | 'none'

/** 处置优先级：`high` = 该会话的当前代是从暂存（TMP）发布出来的。 */
export type SessionPriority = 'high' | 'normal'

/**
 * 规范日志名的语法（不含压缩后缀）。
 *
 * 与宿主 `session-format/src/filename.ts` 逐字一致：版本 0 不带版本号，
 * 后续代次必须是小写数字且无前导零；`.v0`、`.v01`、`.V1`、`session.v1.backup.jsonl`
 * 都不识别为规范代次。
 */
const CANONICAL_LOG_BASENAME = /^session(?:\.v([1-9][0-9]*))?\.jsonl$/u

/**
 * 迁移暂存名的语法（对齐 `generation.ts:725` 的写入名）。
 *
 * token 的位数与字符集是宿主内部细节，这里只固定**形状**
 * `session.migration.<hex>.jsonl[.zstd].tmp`，宿主换 token 长度时本插件不会失明。
 */
const MIGRATION_STAGING_NAME = /^session\.migration\.[0-9a-f]+\.jsonl(?:\.zstd)?\.tmp$/u

/** 一份日志产物在磁盘上的事实。 */
export interface LogArtifact {
  /** 文件名（不含目录）。 */
  name: string
  /** 绝对路径。 */
  path: string
  bytes: number
  /** mtime（epoch ms）。 */
  mtimeMs: number
}

/** 一份规范代次产物。 */
export interface GenerationArtifact extends LogArtifact {
  /** 该文件承载的格式代次；0 为无版本号的历史代。 */
  version: number
  /** 该文件的物理编码。 */
  compression: LogCompression
}

/** 一个会话目录的代次事实。 */
export interface SessionGenerations {
  /** 目录内全部规范产物，按代次升序（同代次再按 mtime 升序）。 */
  canonical: GenerationArtifact[]
  /** 当前代 = 规范产物中代次最高的一份；目录内没有规范产物时为 undefined。 */
  current?: GenerationArtifact
  /** 历史代（代次 0）；宿主按契约保留已提交的旧代次，不删不改。 */
  legacy?: GenerationArtifact
  /** 迁移暂存残留（发布源）。 */
  staging: LogArtifact[]
  /** 只有历史代、尚无更高代次：宿主首次写访问才会发布，冷读要全量内存迁移。 */
  legacyOnly: boolean
}

function compressionSuffix(compression: LogCompression): '.zstd' | '' {
  return compression === 'zstd' ? '.zstd' : ''
}

/**
 * 某代次的规范日志文件名。
 * @param version - 非负安全整数的格式代次。
 * @param compression - 物理编码（缺省 zstd）。
 * @returns 该代次在会话目录内的文件名。
 */
export function generationLogFilename(version: number, compression: LogCompression = 'zstd'): string {
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new Error(`session log generation must be a non-negative safe integer, got ${String(version)}`)
  }
  const basename = version === 0 ? 'session.jsonl' : `session.v${version}.jsonl`
  return `${basename}${compressionSuffix(compression)}`
}

/**
 * 把一个规范日志名解析回代次。
 *
 * 与宿主 `parseGenerationLogFilename` 同语义：非规范名（临时、大写、前导零、
 * `.v0`、别的压缩后缀）一律返回 undefined，**不猜**。
 * @param filename - 会话目录里的一个文件名。
 * @param compression - 该目录使用的物理编码（缺省 zstd）。
 * @returns 其格式代次，或名字不构成规范代次时的 undefined。
 */
export function parseGenerationLogFilename(filename: string, compression: LogCompression = 'zstd'): number | undefined {
  const suffix = compressionSuffix(compression)
  if (!filename.endsWith(suffix)) return undefined
  const match = CANONICAL_LOG_BASENAME.exec(filename.slice(0, filename.length - suffix.length))
  if (match === null) return undefined
  if (match[1] === undefined) return 0
  const version = Number(match[1])
  return Number.isSafeInteger(version) ? version : undefined
}

/**
 * 两种压缩编码都试一遍，判定该名字是不是某代的规范产物。
 *
 * 发现路径不能假设部署里的 `compression` 配置：配置在 profile 侧，插件读不到，
 * 而日志就在磁盘上。因此按名字本身分类，编码作为结果一并带回。
 * @param filename - 会话目录里的一个文件名。
 * @returns 代次与编码，或该名字不是规范代次时的 undefined。
 */
export function classifyGenerationFilename(filename: string): { version: number; compression: LogCompression } | undefined {
  const zstd = parseGenerationLogFilename(filename, 'zstd')
  if (zstd !== undefined) return { version: zstd, compression: 'zstd' }
  const none = parseGenerationLogFilename(filename, 'none')
  if (none !== undefined) return { version: none, compression: 'none' }
  return undefined
}

/**
 * 该文件名是否是迁移暂存（当前代的发布源）。
 * @param filename - 会话目录里的一个文件名。
 * @returns 是否形如 `session.migration.<token>.jsonl[.zstd].tmp`。
 */
export function isMigrationStagingFilename(filename: string): boolean {
  return MIGRATION_STAGING_NAME.test(filename)
}

/**
 * 读取一个会话目录的代次事实（只读，不碰任何文件内容）。
 * @param dir - 会话目录的绝对路径。
 * @returns 规范产物（按代次升序）、当前代、历史代与暂存残留。
 */
export function readSessionGenerations(dir: string): SessionGenerations {
  const canonical: GenerationArtifact[] = []
  const staging: LogArtifact[] = []
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    // 目录在枚举与读取之间消失（宿主正在删会话）：如实返回「没有产物」，
    // 由调用方决定是否跳过这一步，不在这里抛。
    return { canonical: [], staging: [], legacyOnly: false }
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const path = join(dir, entry.name)
    let bytes: number
    let mtimeMs: number
    try {
      const stat = statSync(path)
      bytes = stat.size
      mtimeMs = stat.mtimeMs
    } catch {
      continue
    }
    const artifact: LogArtifact = { name: entry.name, path, bytes, mtimeMs }
    const generation = classifyGenerationFilename(entry.name)
    if (generation !== undefined) {
      canonical.push({ ...artifact, version: generation.version, compression: generation.compression })
      continue
    }
    if (isMigrationStagingFilename(entry.name)) staging.push(artifact)
  }
  canonical.sort((left, right) => left.version - right.version || left.mtimeMs - right.mtimeMs)
  staging.sort((left, right) => left.mtimeMs - right.mtimeMs)
  const current = canonical.at(-1)
  const legacy = canonical.find(artifact => artifact.version === 0)
  return {
    canonical,
    staging,
    ...(current === undefined ? {} : { current }),
    ...(legacy === undefined ? {} : { legacy }),
    legacyOnly: canonical.length > 0 && current?.version === 0,
  }
}

/** 目录内全部已识别产物的最新 mtime。 */
export function latestArtifactMtime(facts: SessionGenerations): number | undefined {
  const times = [...facts.canonical, ...facts.staging].map(artifact => artifact.mtimeMs)
  return times.length === 0 ? undefined : Math.max(...times)
}

/**
 * 该会话的处置优先级。
 *
 * `high` 的判据就是「从 TMP 移出来」本身：当前代次非 0（当前代是经
 * `session.migration.*.tmp` 暂存发布出来的），或目录内仍有暂存残留。
 * 代次 0 的历史代是宿主按契约保留的未发布会话，旧发现逻辑读的就是它 —— 这类
 * 会话既没有发布痕迹、也没有被读错，故为 `normal`。
 * @param facts - 会话目录的代次事实。
 * @returns 处置优先级。
 */
export function sessionPriority(facts: SessionGenerations): SessionPriority {
  if (facts.staging.length > 0) return 'high'
  return (facts.current?.version ?? 0) > 0 ? 'high' : 'normal'
}
