/**
 * 发现路径的代次适配（回归：本插件曾完全看不见已发布当前代的会话）。
 *
 * 实测形态：449 个会话目录里 61 个只有 `session.v3.jsonl.zstd`。旧
 * `discoverSessions` 在会话目录里固定找 `session.jsonl.zstd`，找不到就把目录继续
 * 当普通目录下钻 —— 结果是这些会话既不在 `total` 里，也进不了
 * `session-health-session` / `session-health-repair`（两者都先要 `findSessionLog`，
 * 它对这批会话返回 undefined，接口直接回「未找到会话日志」）。
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  countCorpus,
  discoverSessions,
  findSession,
  findSessionLog,
  scanSessions,
} from '../src/index.ts'

/** 造一个会话目录，写入给定的文件名（内容不必是合法 zstd）。 */
function seed(home: string, id: string, files: string[]): string {
  const dir = join(home, 'sessions', 'proj', id)
  mkdirSync(dir, { recursive: true })
  for (const file of files) writeFileSync(join(dir, file), `not-zstd-${id}-${file}`, 'utf8')
  return dir
}

describe('发现：按代次而不是按固定文件名', () => {
  let home = ''
  beforeAll(() => { home = mkdtempSync(join(tmpdir(), 'steward-gen-scan-')) })
  afterAll(() => { rmSync(home, { recursive: true, force: true }) })

  it('只有当前代的会话能被发现（旧逻辑对它一条都返回不了）', () => {
    seed(home, 'session-v3only', ['session.v3.jsonl.zstd'])
    const found = discoverSessions(home).find(session => session.sessionId === 'session-v3only')
    expect(found).toBeDefined()
    expect(found?.logPath).toBe(join(home, 'sessions', 'proj', 'session-v3only', 'session.v3.jsonl.zstd'))
    expect(found?.generations.current?.version).toBe(3)
    expect(found?.priority).toBe('high')
  })

  it('历史代与当前代并存 → 读当前代，不读历史代那份', () => {
    const dir = seed(home, 'session-both', ['session.jsonl.zstd', 'session.v3.jsonl.zstd'])
    const found = findSession('session-both', home)
    expect(found?.logPath).toBe(join(dir, 'session.v3.jsonl.zstd'))
    expect(found?.generations.canonical.map(artifact => artifact.version)).toEqual([0, 3])
    expect(found?.priority).toBe('high')
  })

  it('按 id 能定位到当前代 → 该会话可被单会话体检与处置（回归：曾回「未找到会话日志」）', () => {
    expect(findSessionLog('session-v3only', home))
      .toBe(join(home, 'sessions', 'proj', 'session-v3only', 'session.v3.jsonl.zstd'))
  })

  it('只有迁移暂存 → 仍是会话，但没有可读产物', () => {
    seed(home, 'session-stranded', ['session.migration.deadbeef.jsonl.zstd.tmp'])
    const found = findSession('session-stranded', home)
    expect(found).toBeDefined()
    expect(found?.logPath).toBeUndefined()
    expect(findSessionLog('session-stranded', home)).toBeUndefined()
    expect(found?.priority).toBe('high')
  })

  it('只有历史代 → 优先级 normal（旧逻辑读的就是它，没读错也没读漏）', () => {
    seed(home, 'session-v0only', ['session.jsonl.zstd'])
    expect(findSession('session-v0only', home)?.priority).toBe('normal')
  })

  it('不是会话的目录不会被当成会话', () => {
    mkdirSync(join(home, 'sessions', 'proj', 'not-a-session'), { recursive: true })
    writeFileSync(join(home, 'sessions', 'proj', 'not-a-session', 'metadata.json'), '{}', 'utf8')
    expect(discoverSessions(home).some(session => session.sessionId === 'not-a-session')).toBe(false)
  })
})

describe('语料计数与批内排序', () => {
  const COUNT = 205
  let home = ''
  beforeAll(() => {
    home = mkdtempSync(join(tmpdir(), 'steward-gen-corpus-'))
    // 回归：DISCOVERY_LIMIT 曾是 200，实测语料 449 时进度分母恒为 200，末段会话永远扫不到。
    for (let index = 0; index < COUNT; index++) {
      seed(home, `session-corpus-${String(index).padStart(3, '0')}`, ['session.v3.jsonl.zstd'])
    }
  })
  afterAll(() => { rmSync(home, { recursive: true, force: true }) })

  it('语料超过旧的 200 上限时不再被静默截断', () => {
    expect(countCorpus(home)).toBe(COUNT)
    expect(scanSessions({ dshHome: home, limit: 1, offset: 0 }).total).toBe(COUNT)
  })

  it('批内命中按处置优先级排（high 在前），分批算术不受影响', () => {
    const batch = scanSessions({ dshHome: home, limit: COUNT, offset: 0, onlyProblems: false })
    expect(batch.scanned).toBe(COUNT)
    const priorities = batch.findings.map(report => report.priority)
    // 这批全是 v3 → 全 high；排序不改变命中数，也不打乱同优先级的相对顺序。
    expect(new Set(priorities)).toEqual(new Set(['high']))
  })

  it('混有历史代会话时，high 全部排在 normal 之前', () => {
    const mixed = mkdtempSync(join(tmpdir(), 'steward-gen-mixed-'))
    try {
      seed(mixed, 'session-old-1', ['session.jsonl.zstd'])
      seed(mixed, 'session-old-2', ['session.jsonl.zstd'])
      seed(mixed, 'session-new-1', ['session.v3.jsonl.zstd'])
      seed(mixed, 'session-new-2', ['session.v3.jsonl.zstd'])
      const batch = scanSessions({ dshHome: mixed, limit: 10, offset: 0, onlyProblems: false })
      const priorities = batch.findings.map(report => report.priority)
      expect(priorities).toEqual(['high', 'high', 'normal', 'normal'])
    } finally {
      rmSync(mixed, { recursive: true, force: true })
    }
  })
})
