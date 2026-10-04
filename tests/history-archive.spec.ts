import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { archiveHistory } from '../src/host/history/archive.ts'
import { handleMethod, type StewardRuntime } from '../src/index.ts'

/** 造一个只含 workspace 存储文件的临时 DSH home。 */
function seedHome(home: string, archived: string[]): void {
  const dir = join(home, 'storages')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'workspace.json'), JSON.stringify({
    unit: { name: 'workspace', version: 2 },
    global: { initialized: true, workspaceIds: [], archivedSessionIds: archived },
    tables: { workspaces: {} },
  }, null, 2) + '\n', 'utf8')
}

describe('session-history-archive（批量归档写侧）', () => {
  let home = ''
  let paths: string[]
  beforeAll(() => {
    home = join(tmpdir(), `steward-archive-${Math.random().toString(36).slice(2)}`)
    mkdirSync(home, { recursive: true })
    seedHome(home, ['session-a'])
    paths = [join(home, 'storages', 'workspace.json')]
  })
  afterAll(() => { rmSync(home, { recursive: true, force: true }) })

  it('把新 id 追加进归档集合,已在集合中的 id 不重复', () => {
    const result = archiveHistory({ sessionIds: ['session-b', 'session-a', 'session-b'] }, undefined, paths)
    expect(result.ok).toBe(true)
    expect(result.added).toBe(1)
    expect(result.total).toBe(2)
    expect(result.requiresRestart).toBe(true)
  })

  it('写入后读回校验:目标 id 必须真的进了集合', () => {
    const again = archiveHistory({ sessionIds: ['session-b'] }, undefined, paths)
    expect(again.ok).toBe(true)
    expect(again.added).toBe(0)
  })

  it('空数组/非数组/无效值都显式失败', () => {
    expect(archiveHistory({}, undefined, paths).ok).toBe(false)
    expect(archiveHistory({ sessionIds: [] }, undefined, paths).ok).toBe(false)
    expect(archiveHistory({ sessionIds: [''] }, undefined, paths).ok).toBe(false)
    expect(archiveHistory({ sessionIds: [42] }, undefined, paths).ok).toBe(false)
  })

  it('存储文件不存在时显式失败,绝不静默', () => {
    const result = archiveHistory({ sessionIds: ['session-x'] }, undefined, [join(home, 'nope', 'workspace.json')])
    expect(result.ok).toBe(false)
    expect(result.error).toContain('不存在')
  })
})

/** 内存路径的运行时:registry 带官方双方法,档案集合内存真值。 */
function memoryRuntime(archived: string[]): { runtime: StewardRuntime; indexOps: string[] } {
  const set = [...archived]
  const indexOps: string[] = []
  const runtime: StewardRuntime = {
    config: () => ({ enabled: true, historyFiles: true, healthCheck: true, search: true }),
    dshHome: join(tmpdir(), 'memory-rt'),
    registry: () => ({
      get archivedSessionIds() { return set },
      archiveSession: async (id: string) => { if (!set.includes(id)) set.push(id) },
      unarchiveSession: async (id: string) => { const i = set.indexOf(id); if (i >= 0) set.splice(i, 1) },
    }),
    projectionStateFor: () => undefined,
    attribute: () => undefined,
    log: () => {},
    index: {
      onArchive: (ids) => { indexOps.push(`archive:${ids.length}`) },
      onUnarchive: (ids) => { indexOps.push(`unarchive:${ids.length}`) },
      onPurged: (ids) => { indexOps.push(`purge:${ids.length}`) },
    },
  }
  return { runtime, indexOps }
}

describe('内存路径（官方 registry API,免重启）', () => {
  it('归档走 archiveSession,requiresRestart=false 且索引联动', async () => {
    const { runtime, indexOps } = memoryRuntime(['session-a'])
    const res = await handleMethod('session-history-archive', { sessionIds: ['session-b', 'session-a'] }, runtime) as { ok: boolean; added?: number; total?: number; requiresRestart?: boolean }
    expect(res.ok).toBe(true)
    expect(res.added).toBe(1)
    expect(res.total).toBe(2)
    expect(res.requiresRestart).toBe(false)
    expect(indexOps).toContain('archive:2')
  })

  it('取消归档走 unarchiveSession,失败按会话隔离', async () => {
    const { runtime, indexOps } = memoryRuntime(['session-a', 'session-b'])
    runtime.registry = () => ({
      get archivedSessionIds() { return ['session-a'] },
      archiveSession: async () => {},
      unarchiveSession: async (id: string) => { if (id === 'session-b') throw new Error('boom') },
    })
    const res = await handleMethod('session-history-prune', { sessionIds: ['session-a', 'session-b'] }, runtime) as { ok: boolean; removed?: number; remaining?: number; requiresRestart?: boolean; failures?: { sessionId: string; reason: string }[] }
    expect(res.ok).toBe(true)
    expect(res.removed).toBe(1)
    expect(res.remaining).toBe(1)
    expect(res.requiresRestart).toBe(false)
    expect(res.failures).toEqual([{ sessionId: 'session-b', reason: 'boom' }])
    expect(indexOps).toContain('unarchive:1')
  })

  it('registry 无官方方法时降级文件路径(requiresRestart=true)', async () => {
    const home = join(tmpdir(), 'steward-archive-filepath-fallback')
    mkdirSync(home, { recursive: true })
    seedHome(home, ['session-a'])
    const runtime: StewardRuntime = {
      config: () => ({ enabled: true, historyFiles: true, healthCheck: true, search: true }),
      dshHome: home,
      registry: () => ({ archivedSessionIds: ['session-a'] }),
      projectionStateFor: () => undefined,
      attribute: () => undefined,
      log: () => {},
    }
    const res = await handleMethod('session-history-prune', { sessionIds: ['session-a'] }, runtime) as { ok: boolean; requiresRestart?: boolean }
    expect(res.ok).toBe(true)
    expect(res.requiresRestart).toBe(true)
    rmSync(home, { recursive: true, force: true })
  })
})
