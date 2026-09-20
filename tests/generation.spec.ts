/**
 * 代次文件名契约与代次事实读取。
 *
 * 这组测试的**核心价值是与宿主 session 操作核心的耦合**：第 1 组用例逐条复刻
 * `@deepseek-ai/dsh-session-format/tests/filename.spec.ts` 的断言。本插件不能
 * import 宿主包（零硬依赖），只能镜像语法；镜像一旦落后于宿主，这里就会失败。
 *
 * 第 2 组的由来（用户实测）：449 个会话目录里有 61 个只留当前代
 * （`session.v3.jsonl.zstd`），旧发现逻辑写死 `session.jsonl.zstd`，对它们
 * 一条都发现不了 —— 既扫不到也修不了。
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  classifyGenerationFilename,
  gateGeneration,
  generationLogFilename,
  isMigrationStagingFilename,
  latestArtifactMtime,
  parseGenerationLogFilename,
  readSessionGenerations,
  sessionPriority,
} from '../src/index.ts'

describe('规范日志名：与宿主 session-format 的语法逐条对齐', () => {
  it('代 0 不带版本号，后续代次带 .vN', () => {
    // 无版本号的只有裸名部分；压缩后缀照常拼上（缺省编码是 zstd）。
    expect(generationLogFilename(0, 'none')).toBe('session.jsonl')
    expect(generationLogFilename(0)).toBe('session.jsonl.zstd')
    expect(generationLogFilename(1, 'zstd')).toBe('session.v1.jsonl.zstd')
    expect(generationLogFilename(27, 'none')).toBe('session.v27.jsonl')
    for (const invalid of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN]) {
      expect(() => generationLogFilename(invalid)).toThrow(/non-negative safe integer/)
    }
  })

  it('只解析规范名（宿主 filename.spec.ts 的全部拒绝用例）', () => {
    expect(parseGenerationLogFilename('session.jsonl', 'none')).toBe(0)
    expect(parseGenerationLogFilename('session.v1.jsonl', 'none')).toBe(1)
    expect(parseGenerationLogFilename('session.v27.jsonl', 'none')).toBe(27)
    expect(parseGenerationLogFilename('session.v9007199254740992.jsonl', 'none')).toBeUndefined()
    for (const name of [
      'session.v0.jsonl',
      'session.v01.jsonl',
      'session.V1.jsonl',
      'session.v1.backup.jsonl',
      'session.migration.deadbeef.tmp.jsonl',
      'session.1.jsonl',
    ]) {
      expect(parseGenerationLogFilename(name, 'none')).toBeUndefined()
    }
    // 压缩后缀不是代次名的一部分：'.jsonl.zstd' 只在 zstd 编码下是规范名。
    expect(parseGenerationLogFilename('session.v1.jsonl.zstd', 'zstd')).toBe(1)
    expect(parseGenerationLogFilename('session.v1.jsonl.zstd', 'none')).toBeUndefined()
    expect(parseGenerationLogFilename('session.v1.jsonl', 'zstd')).toBeUndefined()
  })

  it('classifyGenerationFilename 两种编码都认，并带回编码', () => {
    expect(classifyGenerationFilename('session.jsonl.zstd')).toEqual({ version: 0, compression: 'zstd' })
    expect(classifyGenerationFilename('session.v3.jsonl')).toEqual({ version: 3, compression: 'none' })
    expect(classifyGenerationFilename('session.migration.7b634e51633faa1d.jsonl.zstd.tmp')).toBeUndefined()
    expect(classifyGenerationFilename('metadata.json')).toBeUndefined()
  })
})

describe('迁移暂存名（当前代的发布源）', () => {
  it('认宿主 generation.ts:725 的写入名', () => {
    expect(isMigrationStagingFilename('session.migration.7b634e51633faa1d.jsonl.zstd.tmp')).toBe(true)
    expect(isMigrationStagingFilename('session.migration.deadbeef.jsonl.tmp')).toBe(true)
    // token 位数是宿主内部细节：换长度不该让本插件失明。
    expect(isMigrationStagingFilename('session.migration.ab.jsonl.zstd.tmp')).toBe(true)
  })

  it('不把规范产物或别的东西当暂存', () => {
    for (const name of [
      'session.jsonl.zstd',
      'session.v3.jsonl.zstd',
      'session.migration.deadbeef.tmp.jsonl',
      'session.migration.deadbeef.jsonl.zstd',
      'session.migration.DEADBEEF.jsonl.zstd.tmp',
      'metadata.json',
    ]) {
      expect(isMigrationStagingFilename(name)).toBe(false)
    }
  })
})

describe('代次事实读取', () => {
  let root = ''
  beforeAll(() => { root = mkdtempSync(join(tmpdir(), 'steward-gen-')) })
  afterAll(() => { rmSync(root, { recursive: true, force: true }) })

  /** 造一个会话目录，写入给定的文件名。 */
  function seed(name: string, files: string[]): string {
    const dir = join(root, name)
    mkdirSync(dir, { recursive: true })
    for (const file of files) writeFileSync(join(dir, file), `bytes-of-${file}`, 'utf8')
    return dir
  }

  it('历史代 + 当前代 + 暂存残留 → 当前代取最高代次，并认出发布源', () => {
    const dir = seed('both', [
      'session.jsonl.zstd',
      'session.v3.jsonl.zstd',
      'session.migration.7b634e51633faa1d.jsonl.zstd.tmp',
    ])
    const facts = readSessionGenerations(dir)
    expect(facts.canonical.map(artifact => artifact.version)).toEqual([0, 3])
    expect(facts.current?.name).toBe('session.v3.jsonl.zstd')
    expect(facts.current?.compression).toBe('zstd')
    expect(facts.legacy?.name).toBe('session.jsonl.zstd')
    expect(facts.staging.map(artifact => artifact.name)).toEqual(['session.migration.7b634e51633faa1d.jsonl.zstd.tmp'])
    expect(facts.legacyOnly).toBe(false)
    expect(sessionPriority(facts)).toBe('high')
  })

  it('只有当前代（旧逻辑完全看不见的形态）→ 当前代非 0，优先级 high', () => {
    const facts = readSessionGenerations(seed('v3only', ['session.v3.jsonl.zstd']))
    expect(facts.canonical.map(artifact => artifact.version)).toEqual([3])
    expect(facts.current?.version).toBe(3)
    expect(facts.legacy).toBeUndefined()
    expect(facts.staging).toEqual([])
    expect(sessionPriority(facts)).toBe('high')
  })

  it('只有历史代 → 未发布，优先级 normal（旧逻辑读的就是它）', () => {
    const facts = readSessionGenerations(seed('v0only', ['session.jsonl.zstd']))
    expect(facts.current?.version).toBe(0)
    expect(facts.legacyOnly).toBe(true)
    expect(sessionPriority(facts)).toBe('normal')
  })

  it('只有迁移暂存、当前代尚未发布 → 仍算会话目录，但没有可读产物', () => {
    const facts = readSessionGenerations(seed('stranded', ['session.migration.deadbeef.jsonl.zstd.tmp']))
    expect(facts.canonical).toEqual([])
    expect(facts.current).toBeUndefined()
    expect(facts.staging).toHaveLength(1)
    expect(sessionPriority(facts)).toBe('high')
  })

  it('非日志文件不算产物，也不影响 mtime 归并', () => {
    const facts = readSessionGenerations(seed('noise', ['session.v2.jsonl.zstd', 'metadata.json', 'attachments']))
    expect(facts.canonical).toHaveLength(1)
    expect(latestArtifactMtime(facts)).toBe(facts.current?.mtimeMs)
  })

  it('空目录 / 不存在的目录 → 没有产物，不抛', () => {
    const empty = readSessionGenerations(seed('empty', []))
    expect(empty).toMatchObject({ canonical: [], staging: [], legacyOnly: false })
    expect(latestArtifactMtime(empty)).toBeUndefined()
    expect(readSessionGenerations(join(root, 'does-not-exist')).canonical).toEqual([])
  })
})

describe('代次门', () => {
  it('未提供代次事实 → skipped（不猜、也不当正常）', () => {
    expect(gateGeneration(undefined).level).toBe('skipped')
  })

  it('暂存残留 → warn，证据点名残留文件', () => {
    const gate = gateGeneration({
      canonical: [{ name: 'session.v3.jsonl.zstd', path: '/x/session.v3.jsonl.zstd', bytes: 1, mtimeMs: 2, version: 3, compression: 'zstd' }],
      current: { name: 'session.v3.jsonl.zstd', path: '/x/session.v3.jsonl.zstd', bytes: 1, mtimeMs: 2, version: 3, compression: 'zstd' },
      staging: [{ name: 'session.migration.ab.jsonl.zstd.tmp', path: '/x/session.migration.ab.jsonl.zstd.tmp', bytes: 1, mtimeMs: 1 }],
      legacyOnly: false,
    })
    expect(gate.level).toBe('warn')
    expect(gate.evidence).toContain('session.migration.ab.jsonl.zstd.tmp')
    expect(gate.detail?.['priority']).toBe('high')
  })

  it('没有任何规范产物 → fail：当前代尚未从暂存发布', () => {
    const gate = gateGeneration({
      canonical: [],
      staging: [{ name: 'session.migration.ab.jsonl.zstd.tmp', path: '/x/session.migration.ab.jsonl.zstd.tmp', bytes: 1, mtimeMs: 1 }],
      legacyOnly: false,
    })
    expect(gate.level).toBe('fail')
    expect(gate.evidence).toContain('尚未从暂存发布')
  })

  it('文件名代次与 header 代次不一致 → warn（发布不变量被破坏）', () => {
    const gate = gateGeneration(
      {
        canonical: [{ name: 'session.v3.jsonl.zstd', path: '/x/session.v3.jsonl.zstd', bytes: 1, mtimeMs: 2, version: 3, compression: 'zstd' }],
        current: { name: 'session.v3.jsonl.zstd', path: '/x/session.v3.jsonl.zstd', bytes: 1, mtimeMs: 2, version: 3, compression: 'zstd' },
        staging: [],
        legacyOnly: false,
      },
      { events: [], frames: 1, recoveredFromTorn: 0, issues: [], decoder: 'local', header: { version: 2 } },
    )
    expect(gate.level).toBe('warn')
    expect(gate.evidence).toContain('header.version=2')
  })

  it('历史代与当前代并存（契约要求保留）→ ok，不抬档', () => {
    const gate = gateGeneration({
      canonical: [
        { name: 'session.jsonl.zstd', path: '/x/session.jsonl.zstd', bytes: 9, mtimeMs: 1, version: 0, compression: 'zstd' },
        { name: 'session.v3.jsonl.zstd', path: '/x/session.v3.jsonl.zstd', bytes: 1, mtimeMs: 2, version: 3, compression: 'zstd' },
      ],
      current: { name: 'session.v3.jsonl.zstd', path: '/x/session.v3.jsonl.zstd', bytes: 1, mtimeMs: 2, version: 3, compression: 'zstd' },
      legacy: { name: 'session.jsonl.zstd', path: '/x/session.jsonl.zstd', bytes: 9, mtimeMs: 1, version: 0, compression: 'zstd' },
      staging: [],
      legacyOnly: false,
    })
    expect(gate.level).toBe('ok')
    expect(gate.evidence).toContain('当前代 v3')
  })
})
