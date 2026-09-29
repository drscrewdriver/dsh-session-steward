/**
 * source-kind 门与署名转换的测试。
 *
 * 重点锁定三条闸：
 * - v4 日志观测到旧署名 → warn，转换后转 ok；
 * - v3（及更早）日志的旧行合法 → ok，转换**拒绝执行**（防过度操作）；
 * - 完整性不合格（撕裂/问题清单）拒绝改写。
 */
import { createRequire } from 'node:module'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { decodeSessionLogFile, type DecodedEvent, type SessionLogRead } from '../src/host/health/decode.ts'
import {
  FIRST_PARTY_RENAMED_PRODUCERS,
  FIRST_PARTY_SAME_NAME_PRODUCERS,
  gateSourceKind,
  isFirstPartyLegacyProducer,
  migrateSessionSourceKind,
  readSourceKindFacts,
} from '../src/host/health/source-kind.ts'
import { buildSessionReport } from '../src/host/health/gates.ts'

const require = createRequire(import.meta.url)
const zlib = require('node:zlib') as typeof import('node:zlib')

let home = ''
let dir = ''
beforeAll(() => {
  home = mkdtempSync(join(tmpdir(), 'steward-sourcemigrate-home-'))
  dir = mkdtempSync(join(tmpdir(), 'steward-sourcemigrate-log-'))
})
afterAll(() => {
  rmSync(home, { recursive: true, force: true })
  rmSync(dir, { recursive: true, force: true })
})

/** 写一份最小 zstd 会话日志（header + 若干事件行），返回路径。 */
function writeLog(name: string, version: number, sources: (Record<string, unknown> | undefined)[]): string {
  const lines = [JSON.stringify({ type: 'session', version })]
  sources.forEach((source, index) => {
    lines.push(JSON.stringify({ type: 'assistant/message', seq: index, time: index + 1, data: { ...(source === undefined ? {} : { source }) } }))
  })
  const path = join(dir, name)
  writeFileSync(path, zlib.zstdCompressSync(Buffer.from(lines.join('\n'), 'utf8')))
  return path
}

const legacySource = { kind: 'plugin', plugin: 'memory', form: 'recall' }
const modernSource = { kind: 'plugin:memory', form: 'recall' }

describe('readSourceKindFacts', () => {
  it('统计旧署名行并按插件归组', () => {
    const events: DecodedEvent[] = [
      { type: 'assistant/message', seq: 0, time: 1, data: { source: legacySource } },
      { type: 'assistant/message', seq: 1, time: 2, data: { source: { ...legacySource } } },
      { type: 'assistant/message', seq: 2, time: 3, data: { source: modernSource } },
      { type: 'assistant/message', seq: 3, time: 4, data: {} },
    ]
    const facts = readSourceKindFacts({ events, frames: 1, recoveredFromTorn: 0, issues: [], decoder: 'local', header: { type: 'session', version: 4 } })
    expect(facts.legacyCount).toBe(2)
    expect(facts.byPlugin).toEqual({ memory: 2 })
    expect(facts.examples).toHaveLength(2)
  })
})

describe('gateSourceKind：按格式代次分线', () => {
  it('v4 + 旧署名 → warn', () => {
    const gate = gateSourceKind({ legacyCount: 1, byPlugin: { memory: 1 }, examples: [{ seq: 3, plugin: 'memory' }], headerVersion: 4 })
    expect(gate.level).toBe('warn')
    expect(gate.evidence).toContain('memory×1')
  })

  it('v3 的旧行合法 → ok（宿主迁移负责，不动）', () => {
    const gate = gateSourceKind({ legacyCount: 3, byPlugin: { memory: 3 }, examples: [], headerVersion: 3 })
    expect(gate.level).toBe('ok')
    expect(gate.evidence).toContain('v3')
  })

  it('v4 全部 producer-owned → ok', () => {
    expect(gateSourceKind({ legacyCount: 0, byPlugin: {}, examples: [], headerVersion: 4 }).level).toBe('ok')
  })

  it('header 无 version → skipped', () => {
    expect(gateSourceKind({ legacyCount: 0, byPlugin: {}, examples: [] }).level).toBe('skipped')
  })
})

describe('migrateSessionSourceKind', () => {
  it('v4 日志：改写署名、生成备份、重解码后门转 ok', () => {
    const path = writeLog('v4-legacy.jsonl.zstd', 4, [legacySource, modernSource, { ...legacySource, form: 'notice' }])
    const before = decodeSessionLogFile(path)
    const outcome = migrateSessionSourceKind('sess-v4', path, before, home, () => 1_700_000_000_000)
    expect(outcome.ok).toBe(true)
    expect(outcome.changedRows).toBe(2)
    expect(outcome.byPlugin).toEqual({ memory: 2 })
    expect(outcome.backup).toBeDefined()
    expect(existsSync(outcome.backup as string)).toBe(true)

    const after = decodeSessionLogFile(path)
    const sources = after.events.map(event => (event.data as { source?: Record<string, unknown> }).source)
    expect(sources[0]).toEqual({ kind: 'plugin:memory', form: 'recall' })
    expect(sources[1]).toEqual({ kind: 'plugin:memory', form: 'recall' })
    expect(sources[2]).toEqual({ kind: 'plugin:memory', form: 'notice' })

    const report = buildSessionReport({ sessionId: 'sess-v4', generations: undefined, log: after, dshHome: home })
    expect(report.gates.find(gate => gate.id === 'source-kind')?.level).toBe('ok')
  })

  it('v3 日志拒绝执行（防过度操作）', () => {
    const path = writeLog('v3-legacy.jsonl.zstd', 3, [legacySource])
    const log = decodeSessionLogFile(path)
    const outcome = migrateSessionSourceKind('sess-v3', path, log, home)
    expect(outcome.ok).toBe(false)
    expect(outcome.error).toContain('v3')
    // 原文件未被改写：重解码仍观测到旧署名。
    expect(readSourceKindFacts(decodeSessionLogFile(path)).legacyCount).toBe(1)
  })

  it('日志带完整性问题 → 拒绝改写', () => {
    const path = writeLog('v4-broken.jsonl.zstd', 4, [legacySource])
    const log = decodeSessionLogFile(path)
    log.issues.push({ line: 3, why: 'seq gap (expected 1, got 5)' })
    const outcome = migrateSessionSourceKind('sess-broken', path, log, home)
    expect(outcome.ok).toBe(false)
    expect(outcome.error).toContain('log-integrity')
  })

  it('没有旧署名行 → 空手而归（不写盘、不留备份）', () => {
    const path = writeLog('v4-clean.jsonl.zstd', 4, [modernSource])
    const before = readFileSync(path)
    const outcome = migrateSessionSourceKind('sess-clean', path, decodeSessionLogFile(path), home)
    expect(outcome.ok).toBe(true)
    expect(outcome.changedRows).toBe(0)
    expect(outcome.backup).toBeUndefined()
    expect(readFileSync(path).equals(before)).toBe(true)
  })

  // ── ST1（第四轮审计）：第一方生产者名跳过，交还宿主迁移 ──

  it('第一方名（改名表/同名表/role 敏感）逐行跳过并如实上报；第三方照常转换', () => {
    const firstParty = [
      { kind: 'plugin', plugin: 'goal', form: 'notice' },                        // 同名裸 kind 表
      { kind: 'plugin', plugin: 'compact', form: 'notice' },                     // 改名表 → compact-checkpoint
      { kind: 'plugin', plugin: 'tools-ptc', form: 'notice' },                   // 改名表 → ptc-mode
      { kind: 'plugin', plugin: '@deepseek-ai/dsh-system-prompt' },              // 改名表 + role 敏感分支
    ]
    const path = writeLog('v4-firstparty.jsonl.zstd', 4, [...firstParty, legacySource])
    const outcome = migrateSessionSourceKind('sess-fp', path, decodeSessionLogFile(path), home, () => 1_700_000_000_100)
    expect(outcome.ok).toBe(true)
    expect(outcome.changedRows).toBe(1)
    expect(outcome.byPlugin).toEqual({ memory: 1 })
    expect(outcome.skippedFirstParty).toEqual({
      goal: 1,
      compact: 1,
      'tools-ptc': 1,
      '@deepseek-ai/dsh-system-prompt': 1,
    })
    // 跳过行保持原字节：宿主迁移前不出现宿主永不产出的 kind。
    const after = decodeSessionLogFile(path)
    const sources = after.events.map(event => (event.data as { source?: Record<string, unknown> }).source)
    expect(sources[0]).toEqual({ kind: 'plugin', plugin: 'goal', form: 'notice' })
    expect(sources[3]).toEqual({ kind: 'plugin', plugin: '@deepseek-ai/dsh-system-prompt' })
    expect(sources[4]).toEqual({ kind: 'plugin:memory', form: 'recall' })
  })

  it('只有第一方旧行 → changedRows 0、不写盘，skippedFirstParty 完整上报', () => {
    const path = writeLog('v4-fponly.jsonl.zstd', 4, [{ kind: 'plugin', plugin: 'goal', form: 'notice' }])
    const before = readFileSync(path)
    const outcome = migrateSessionSourceKind('sess-fponly', path, decodeSessionLogFile(path), home)
    expect(outcome.ok).toBe(true)
    expect(outcome.changedRows).toBe(0)
    expect(outcome.backup).toBeUndefined()
    expect(outcome.skippedFirstParty).toEqual({ goal: 1 })
    expect(readFileSync(path).equals(before)).toBe(true)
  })

  it('30 个第一方名全部被 isFirstPartyLegacyProducer 判定（表完整性对照宿主实现）', async () => {
    const renamed = Object.keys(FIRST_PARTY_RENAMED_PRODUCERS)
    const sameName = [...FIRST_PARTY_SAME_NAME_PRODUCERS]
    expect(renamed).toHaveLength(5)
    expect(sameName).toHaveLength(25)
    for (const name of [...renamed, ...sameName]) {
      expect(isFirstPartyLegacyProducer(name)).toBe(true)
    }
    // 第三方对照：宿主兜底 `plugin:${plugin}` 正是 steward 的转换目标。
    for (const name of ['memory', 'session-guard', 'dsh-pet', '@changfenhuang/dsh-genui']) {
      expect(isFirstPartyLegacyProducer(name)).toBe(false)
    }
  })

  // ── ST3（第四轮审计）：单帧重压缩产物必须可被宿主官方解码器读回 ──
  it('转换产物经宿主官方解码器（@deepseek-ai/dsh-session 0.1.7-rc.2）读回零问题', async () => {
    const { loadOfficialDecoders } = await import('../src/host/health/decode.ts')
    const decoders = await loadOfficialDecoders()
    // 官方包缺失时本测试退化为存在性说明（本地解码器路径已由其它用例覆盖）。
    if (decoders === undefined) return
    const path = writeLog('v4-official-readback.jsonl.zstd', 4, [legacySource, modernSource])
    const outcome = migrateSessionSourceKind('sess-official', path, decodeSessionLogFile(path), home, () => 1_700_000_000_200)
    expect(outcome.ok).toBe(true)
    const after = decodeSessionLogFile(path, decoders)
    expect(after.issues).toEqual([])
    expect(after.events.length).toBeGreaterThanOrEqual(2)
    // seq 连续性：宿主读回不得因重压缩产生缺口或撕裂。
    after.events.forEach((event, index) => expect(event.seq).toBe(index))
  })
})
