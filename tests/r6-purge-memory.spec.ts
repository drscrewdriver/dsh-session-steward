import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { listFavorites, setFavoriteState } from '../src/host/history/favorites.ts'
import { SwitchIndexEngine } from '../src/host/index/engine.ts'
import { handleMethod, type StewardRuntime } from '../src/index.ts'

function userMessage(seq: number, text: string) {
  return { seq, type: 'user/message', time: 1000 + seq, surfaceOp: 'append', data: { content: [{ type: 'text', text }] } }
}

const cleanups: string[] = []
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true })
})

describe('收藏域（JSON 文件,原子写）', () => {
  it('set → list 往返;取消收藏移除;畸形文件按空集合重建', () => {
    const home = mkdtempSync(join(tmpdir(), 'fav-'))
    cleanups.push(home)
    const paths = [join(home, 'storages', 'session-steward-favorites.json')]
    expect(listFavorites(paths)).toEqual([])
    expect(setFavoriteState('a', true, paths).ok).toBe(true)
    expect(setFavoriteState('b', true, paths).ok).toBe(true)
    expect(listFavorites(paths)).toEqual(['a', 'b'])
    expect(setFavoriteState('a', false, paths).total).toBe(1)
    expect(listFavorites(paths)).toEqual(['b'])
    // 畸形文件:按空集合重建而不是报错(收藏只是标记)。
    writeFileSyncBad(paths[0])
    expect(setFavoriteState('c', true, paths).ok).toBe(true)
    expect(listFavorites(paths)).toEqual(['c'])
  })
})

import { writeFileSync } from 'node:fs'
function writeFileSyncBad(path: string): void {
  writeFileSync(path, '{not json', 'utf8')
}

describe('日期筛选（engine SQL 半开区间）', () => {
  it('from/to 边界:含起点、排他终点', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'date-'))
    cleanups.push(dir)
    const engine = new SwitchIndexEngine({ path: join(dir, 'index.sqlite') })
    await engine.open()
    // updatedAt: a=1000, b=2000, c=3000
    engine.upsertSession({ sessionId: 'a', version: 1, updatedAt: 1000, events: [userMessage(0, '甲关键词')] })
    engine.upsertSession({ sessionId: 'b', version: 1, updatedAt: 2000, events: [userMessage(0, '甲关键词')] })
    engine.upsertSession({ sessionId: 'c', version: 1, updatedAt: 3000, events: [userMessage(0, '甲关键词')] })
    expect(engine.search({ query: '甲', from: 1000, to: 3000 }).map(h => h.sessionId).sort()).toEqual(['a', 'b'])
    expect(engine.search({ query: '甲', from: 2000 }).map(h => h.sessionId).sort()).toEqual(['b', 'c'])
    expect(engine.search({ query: '甲' }).length).toBe(3)
    engine.close()
  })
})

describe('purge 内存路径（registry.deleteSession,免重启）', () => {
  it('逐 id 调 deleteSession,requiresRestart=false,索引联动只含成功 id', async () => {
    const deleted: string[] = []
    const runtime: StewardRuntime = {
      config: () => ({ enabled: true, historyFiles: true, healthCheck: true, search: true }),
      dshHome: join(tmpdir(), 'purge-mem'),
      registry: () => ({
        archivedSessionIds: [],
        deleteSession: async (id: string) => {
          if (id === 'bad') return { ok: false, error: '模拟失败' }
          deleted.push(id)
          return { ok: true }
        },
      }),
      projectionStateFor: () => undefined,
      attribute: () => undefined,
      log: () => {},
      index: { onArchive: () => {}, onUnarchive: () => {}, onPurged: (ids) => { deleted.push(`index:${ids.length}`) } },
    }
    const res = await handleMethod('session-history-purge', { sessionIds: ['good-1', 'bad', 'good-2'] }, runtime) as { ok: boolean; purged?: number; requiresRestart?: boolean; failures?: { sessionId: string; reason: string }[] }
    expect(res.ok).toBe(true)
    expect(res.purged).toBe(2)
    expect(res.requiresRestart).toBe(false)
    expect(res.failures).toEqual([{ sessionId: 'bad', reason: '模拟失败' }])
    expect(deleted).toContain('good-1')
    expect(deleted).toContain('good-2')
    expect(deleted).toContain('index:2')
  })
})
