/**
 * 体检缓存契约：`HealthCache` 的成型规则 + 与 `handleMethod` 的接线。
 *
 * 这组测试锁住四条性质：
 *   1. 缓存**只在走满一遍语料后成型**——半途而废（关面板、报错）不留半份缓存冒充完整结果；
 *   2. `resume` 是**纯读**，不扫描（挂载就干重活是上一版被诟病的问题）；
 *   3. 只有「只列问题」的扫描参与缓存，`onlyProblems: false` 不污染该视图；
 *   4. 单会话体检 / 处置后的报告**就地回写**，不必为一个行重扫整个语料。
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HealthCache } from '../src/host/health/cache.ts'
import type { SessionHealthReport } from '../src/host/health/gates.ts'
import { DEFAULT_CONFIG } from '../src/config.ts'
import { handleMethod, type StewardRuntime } from '../src/index.ts'

const SESSION_COUNT = 12

/** 造一个最小报告（只有单测关心的字段）。 */
function report(sessionId: string, level: SessionHealthReport['level']): SessionHealthReport {
  return { sessionId, level, gates: [], generatedAt: 1_700_000_000_000 }
}

/** 造 N 个会话目录：只要有 `session.jsonl.zstd` 就会被 discover 到。 */
function seedSessions(home: string, count: number): string[] {
  const root = join(home, 'sessions', 'proj')
  const ids: string[] = []
  for (let index = 0; index < count; index++) {
    const id = `session-${String(index).padStart(2, '0')}`
    const dir = join(root, id)
    mkdirSync(dir, { recursive: true })
    // 内容不必是合法 zstd：本组只关心缓存的成型与回写，日志质量由 gates.spec.ts 负责。
    writeFileSync(join(dir, 'session.jsonl.zstd'), `not-zstd-${id}`, 'utf8')
    ids.push(id)
  }
  return ids
}

describe('HealthCache：成型规则', () => {
  it('未走满语料 → 不成型', () => {
    const cache = new HealthCache()
    cache.begin(10)
    expect(cache.append([report('a', 'fail')], 4)).toBe(false)
    expect(cache.read()).toBeUndefined()
  })

  it('走满语料 → 成型，total 与 generatedAt 如实记录', () => {
    const cache = new HealthCache()
    cache.begin(10)
    cache.append([report('a', 'fail')], 4)
    expect(cache.append([report('b', 'warn')], 6, () => 1234)).toBe(true)
    const ready = cache.read()
    expect(ready?.total).toBe(10)
    expect(ready?.generatedAt).toBe(1234)
    expect(ready?.findings.map(item => item.sessionId)).toEqual(['a', 'b'])
  })

  it('成型后 pending 清空：再 append 不再改动缓存', () => {
    const cache = new HealthCache()
    cache.begin(2)
    expect(cache.append([report('a', 'fail')], 2, () => 1)).toBe(true)
    expect(cache.append([report('b', 'fail')], 2, () => 2)).toBe(false)
    expect(cache.read()?.generatedAt).toBe(1)
    expect(cache.read()?.findings).toHaveLength(1)
  })

  it('空语料（total=0）→ 立即成型为空结果，而不是永远等不到', () => {
    const cache = new HealthCache()
    cache.begin(0)
    expect(cache.append([], 0, () => 7)).toBe(true)
    expect(cache.read()).toEqual({ findings: [], total: 0, generatedAt: 7 })
  })

  it('未 begin 就 append → 忽略', () => {
    const cache = new HealthCache()
    expect(cache.append([report('a', 'fail')], 5)).toBe(false)
    expect(cache.read()).toBeUndefined()
  })

  it('clear 同时丢弃成型结果与未完成的累积', () => {
    const cache = new HealthCache()
    cache.begin(2)
    cache.append([report('a', 'fail')], 2, () => 1)
    cache.begin(100)
    cache.clear()
    expect(cache.read()).toBeUndefined()
    // pending 也被丢掉：再 append 不会凭空成型
    expect(cache.append([report('x', 'fail')], 100)).toBe(false)
  })
})

describe('HealthCache：单条回写', () => {
  /** 造一份已成型、含 a/b 两行的缓存。 */
  function ready(): HealthCache {
    const cache = new HealthCache()
    cache.begin(3)
    cache.append([report('a', 'fail'), report('b', 'warn')], 3, () => 1)
    return cache
  }

  it('无缓存时回写是无副作用的 no-op', () => {
    expect(new HealthCache().patch(report('a', 'fail'))).toBe(false)
  })

  it('已有行 → 就地替换（对象身份更新）', () => {
    const cache = ready()
    const next = report('a', 'warn')
    expect(cache.patch(next)).toBe(true)
    expect(cache.read()?.findings.find(item => item.sessionId === 'a')).toBe(next)
    expect(cache.read()?.findings).toHaveLength(2)
  })

  it('新异常 → 追加', () => {
    const cache = ready()
    expect(cache.patch(report('c', 'fail'))).toBe(true)
    expect(cache.read()?.findings.map(item => item.sessionId)).toEqual(['a', 'b', 'c'])
  })

  it('转回正常 → 从列表移出（缓存视图只列非 ok）', () => {
    const cache = ready()
    expect(cache.patch(report('a', 'ok'))).toBe(true)
    expect(cache.read()?.findings.map(item => item.sessionId)).toEqual(['b'])
  })

  it('本就正常的会话 → 不改动缓存', () => {
    const cache = ready()
    expect(cache.patch(report('zzz', 'ok'))).toBe(false)
    expect(cache.read()?.findings).toHaveLength(2)
  })

  it('回写不改变 total（语料总数是扫描时的事实，不是行数）', () => {
    const cache = ready()
    cache.patch(report('c', 'fail'))
    expect(cache.read()?.total).toBe(3)
  })
})

describe('handleMethod：缓存接线', () => {
  let home = ''
  let runtime: StewardRuntime
  beforeAll(() => {
    home = mkdtempSync(join(tmpdir(), 'steward-cache-'))
    seedSessions(home, SESSION_COUNT)
    runtime = {
      config: () => DEFAULT_CONFIG,
      dshHome: home,
      registry: () => undefined,
      projectionStateFor: () => undefined,
      attribute: (projection: string) => ({ projection, package: 'unknown' }),
      log: () => {},
      cache: new HealthCache(),
    }
  })
  afterAll(() => { rmSync(home, { recursive: true, force: true }) })

  /** 走一遍完整的分批扫描（模拟面板的小批次循环）。 */
  async function fullScan(rt: StewardRuntime, batch = 5): Promise<string[]> {
    const seen: string[] = []
    let offset = 0
    for (;;) {
      const res = await handleMethod('session-health-scan', { limit: batch, offset, onlyProblems: true }, rt) as {
        ok: boolean; scanned: number; total: number; findings: { sessionId: string }[]
      }
      seen.push(...res.findings.map(item => item.sessionId))
      offset += res.scanned
      if (res.scanned === 0 || offset >= res.total) break
    }
    return seen
  }

  it('resume 无缓存 → 如实回 cached:false，且**不扫描**', async () => {
    const fresh: StewardRuntime = { ...runtime, cache: new HealthCache() }
    const res = await handleMethod('session-health-scan', { resume: true }, fresh) as {
      ok: boolean; cached: boolean; scanned: number; total: number; findings: unknown[]
    }
    expect(res.ok).toBe(true)
    expect(res.cached).toBe(false)
    // 不扫描是这条契约的重点：挂载只探缓存，绝不偷偷干重活。
    expect(res.scanned).toBe(0)
    expect(res.findings).toEqual([])
    // 但要把语料总数捎回去，面板才知道有多少待体检。
    expect(res.total).toBe(SESSION_COUNT)
    expect(fresh.cache?.read()).toBeUndefined()
  })

  it('分批扫描走满后 resume 命中，findings 与扫出的一致', async () => {
    const rt: StewardRuntime = { ...runtime, cache: new HealthCache() }
    const seen = await fullScan(rt)
    expect(rt.cache?.read()).toBeDefined()
    const res = await handleMethod('session-health-scan', { resume: true }, rt) as {
      ok: boolean; cached: boolean; scanned: number; total: number; generatedAt: number
      currentTotal: number; findings: { sessionId: string }[]
    }
    expect(res.cached).toBe(true)
    expect(res.scanned).toBe(0)
    expect(res.total).toBe(SESSION_COUNT)
    expect(res.currentTotal).toBe(SESSION_COUNT)
    expect(res.generatedAt).toBeGreaterThan(0)
    expect(res.findings.map(item => item.sessionId)).toEqual(seen)
  })

  it('扫描中途被打断 → 缓存不成型（不留半份结果）', async () => {
    const rt: StewardRuntime = { ...runtime, cache: new HealthCache() }
    await handleMethod('session-health-scan', { limit: 5, offset: 0, onlyProblems: true }, rt)
    expect(rt.cache?.read()).toBeUndefined()
    const res = await handleMethod('session-health-scan', { resume: true }, rt) as { cached: boolean }
    expect(res.cached).toBe(false)
  })

  it('onlyProblems=false 的扫描不参与缓存', async () => {
    const rt: StewardRuntime = { ...runtime, cache: new HealthCache() }
    await handleMethod('session-health-scan', { limit: 50, offset: 0, onlyProblems: false }, rt)
    expect(rt.cache?.read()).toBeUndefined()
  })

  it('单会话体检就地回写缓存（对象身份即新报告）', async () => {
    const rt: StewardRuntime = { ...runtime, cache: new HealthCache() }
    const seen = await fullScan(rt)
    expect(seen.length).toBeGreaterThan(0)
    const target = seen[0] ?? ''
    const res = await handleMethod('session-health-session', { sessionId: target }, rt) as {
      ok: boolean; report: SessionHealthReport
    }
    expect(res.ok).toBe(true)
    const cached = rt.cache?.read()?.findings.find(item => item.sessionId === target)
    // 身份相等证明回写用的就是本次重算的报告，而不是旧对象。
    expect(cached).toBe(res.report)
  })

  it('可逆处置后就地回写 after（不必重扫整个语料）', async () => {
    const rt: StewardRuntime = { ...runtime, cache: new HealthCache() }
    const seen = await fullScan(rt)
    expect(seen.length).toBeGreaterThan(0)
    const target = seen[0] ?? ''
    const res = await handleMethod('session-health-repair', { sessionId: target }, rt) as {
      ok: boolean; after: SessionHealthReport
    }
    expect(res.ok).toBe(true)
    const cached = rt.cache?.read()?.findings.find(item => item.sessionId === target)
    expect(cached).toBe(res.after)
  })

  it('缺 cache 的运行时仍然可用（可选字段不改变判定结果）', async () => {
    const bare: StewardRuntime = {
      config: () => DEFAULT_CONFIG,
      dshHome: home,
      registry: () => undefined,
      projectionStateFor: () => undefined,
      attribute: (projection: string) => ({ projection, package: 'unknown' }),
      log: () => {},
    }
    const res = await handleMethod('session-health-scan', { limit: 5, offset: 0 }, bare) as { ok: boolean }
    expect(res.ok).toBe(true)
    const probe = await handleMethod('session-health-scan', { resume: true }, bare) as { cached: boolean }
    expect(probe.cached).toBe(false)
  })
})
