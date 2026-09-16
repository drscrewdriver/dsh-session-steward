/**
 * 分批扫描契约：`scanSessions` 的 offset/total 语义。
 *
 * 体检面板（client/health-panel.tsx）按小批次连续调用、自己累计进度，
 * 宿主保持无状态。这组测试锁住客户端依赖的那三条性质：
 *   1. `total` 在每批都是同一个值（进度分母稳定）；
 *   2. `scanned` 是本批已访问数，与 offset 相加得到真实进度；
 *   3. 各批之间不重不漏，走完即覆盖全部语料。
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanSessions } from '../src/host/health/scan.ts'

const SESSION_COUNT = 12

/** 造 N 个会话目录：只要有 `session.jsonl.zstd` 就会被 discover 到。 */
function seedSessions(home: string, count: number): string[] {
  const root = join(home, 'sessions', 'proj')
  const ids: string[] = []
  for (let index = 0; index < count; index++) {
    const id = `session-${String(index).padStart(2, '0')}`
    const dir = join(root, id)
    mkdirSync(dir, { recursive: true })
    // 内容不必是合法 zstd：本组只校验分批算术，日志质量由 gates.spec.ts 负责。
    writeFileSync(join(dir, 'session.jsonl.zstd'), `not-zstd-${id}`, 'utf8')
    ids.push(id)
  }
  return ids
}

describe('体检扫描分批', () => {
  let home = ''
  let seeded: string[] = []

  beforeAll(() => {
    home = mkdtempSync(join(tmpdir(), 'steward-scan-'))
    seeded = seedSessions(home, SESSION_COUNT)
  })
  afterAll(() => { rmSync(home, { recursive: true, force: true }) })

  it('首批报告稳定的 total，scanned 等于批大小', () => {
    const first = scanSessions({ dshHome: home, limit: 5, offset: 0, onlyProblems: false })
    expect(first.ok).toBe(true)
    expect(first.total).toBe(SESSION_COUNT)
    expect(first.offset).toBe(0)
    expect(first.scanned).toBe(5)
  })

  it('total 不随 offset 变化（进度分母稳定）', () => {
    const totals = [0, 5, 10].map(offset =>
      scanSessions({ dshHome: home, limit: 5, offset, onlyProblems: false }).total)
    expect(totals).toEqual([SESSION_COUNT, SESSION_COUNT, SESSION_COUNT])
  })

  it('末批不足一整批时 scanned 为余数，且不越界', () => {
    const last = scanSessions({ dshHome: home, limit: 5, offset: 10, onlyProblems: false })
    expect(last.scanned).toBe(2)
    const beyond = scanSessions({ dshHome: home, limit: 5, offset: 99, onlyProblems: false })
    expect(beyond.scanned).toBe(0)
    expect(beyond.total).toBe(SESSION_COUNT)
  })

  it('各批不重不漏，走完覆盖全部语料', () => {
    const seen: string[] = []
    let offset = 0
    for (;;) {
      const batch = scanSessions({ dshHome: home, limit: 5, offset, onlyProblems: false })
      seen.push(...batch.findings.map(report => report.sessionId))
      offset += batch.scanned ?? 0
      if ((batch.scanned ?? 0) === 0 || offset >= batch.total) break
    }
    expect(seen).toHaveLength(SESSION_COUNT)
    expect(new Set(seen).size).toBe(SESSION_COUNT)
    expect([...seen].sort()).toEqual([...seeded].sort())
  })

  it('onlyProblems 不改变 scanned（进度按已访问数计，不按命中数计）', () => {
    // 命中数会因过滤而少于已访问数；进度必须走 scanned，否则进度条会走不满。
    const all = scanSessions({ dshHome: home, limit: 5, offset: 0, onlyProblems: false })
    const problems = scanSessions({ dshHome: home, limit: 5, offset: 0, onlyProblems: true })
    expect(problems.scanned).toBe(all.scanned)
    expect(problems.findings.length).toBeLessThanOrEqual(all.findings.length)
  })

  it('负 offset 归零，非法 limit 回退默认批大小', () => {
    const negative = scanSessions({ dshHome: home, limit: 5, offset: -10, onlyProblems: false })
    expect(negative.offset).toBe(0)
    expect(negative.scanned).toBe(5)
    const defaulted = scanSessions({ dshHome: home, onlyProblems: false })
    expect(defaulted.scanned).toBe(SESSION_COUNT)
  })

  it('空语料 → ok=false 且 total 为 0', () => {
    const empty = mkdtempSync(join(tmpdir(), 'steward-empty-'))
    try {
      const result = scanSessions({ dshHome: empty, limit: 5, offset: 0 })
      expect(result.ok).toBe(false)
      expect(result.total).toBe(0)
      expect(result.scanned).toBe(0)
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }
  })
})
