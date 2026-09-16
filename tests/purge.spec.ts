/**
 * 归档文件清理（session-history-purge）回归。
 *
 * 这是本插件唯一的**破坏性**操作，所以覆盖必须具体到「哪四处被动了、哪些没被动」：
 * 1. 转录目录 2. 逐条投影缓存 3. 归档数组 4. 工作区成员表。
 * 只断言「返回 ok」是不够的 —— 那正是上一版 prune 的问题：报告成功、列表没变。
 */
import { describe, expect, it } from 'vitest'
import { mkdirSync, existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  dirKey,
  dirSize,
  indexSessionDirs,
  isSafeChild,
  locateSessionUsage,
  projCacheRootFor,
  purgeHistory,
  sessionsRootFor,
} from '../src/host/history/purge.ts'
import { listHistory } from '../src/host/history/archive.ts'

/** 造一个最小 DSH 主目录：workspace.json + 转录目录 + 投影缓存。 */
function fixture(): { home: string; store: string } {
  const home = mkdtempSync(join(tmpdir(), 'steward-purge-'))
  const store = join(home, 'storages', 'workspace.json')
  mkdirSync(join(home, 'storages', 'session_projcache', 'sessions'), { recursive: true })
  mkdirSync(join(home, 'sessions', '--E-test-demo--'), { recursive: true })
  writeFileSync(store, `${JSON.stringify({
    unit: { name: 'workspace', version: 2 },
    global: { archivedSessionIds: ['session-drop-a', 'session-keep-b'] },
    tables: {
      workspaces: {
        ws1: { path: 'E:\\test\\demo', sessionIds: ['session-drop-a', 'session-keep-b', 'session-live-c'] },
        ws2: { path: 'E:\\test\\other', sessionIds: ['session-drop-a'] },
      },
    },
  }, null, 2)}\n`, 'utf8')
  return { home, store }
}

/** 给某会话铺一份磁盘实体：转录目录（含旧格式副本）+ 投影缓存。 */
function layFiles(home: string, id: string, transcriptBytes: number, cacheBytes: number): { dir: string; cache: string } {
  const dir = join(sessionsRootFor(home), '--E-test-demo--', id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'session.jsonl.zstd'), Buffer.alloc(transcriptBytes, 1))
  writeFileSync(join(dir, 'session.v3.jsonl.zstd'), Buffer.alloc(16, 2))
  const cache = join(projCacheRootFor(home), `${id}.json`)
  writeFileSync(cache, Buffer.alloc(cacheBytes, 3))
  return { dir, cache }
}

/** 读回存储文件的归档集合与成员表。 */
function readStore(store: string): {
  archived: string[]
  ws: Record<string, { sessionIds: string[] }>
} {
  const doc = JSON.parse(readFileSync(store, 'utf8')) as {
    global: { archivedSessionIds: string[] }
    tables: { workspaces: Record<string, { sessionIds: string[] }> }
  }
  return { archived: doc.global.archivedSessionIds, ws: doc.tables.workspaces }
}

describe('dirKey / isSafeChild：破坏性操作的路径护栏', () => {
  it('session- 前缀归一化，带与不带前缀视为同一个会话', () => {
    expect(dirKey('session-abc')).toBe('abc')
    expect(dirKey('abc')).toBe('abc')
    expect(dirKey('session-session-x')).toBe('session-x')
  })

  it('只接受 root 的指定层数子项，越界一律拒绝', () => {
    const root = join('C:', 'x', 'sessions')
    expect(isSafeChild(root, join(root, 'ws', 'sid'), 2)).toBe(true)
    expect(isSafeChild(root, join(root, 'sid'), 2)).toBe(false)      // 层数不对
    expect(isSafeChild(root, root, 2)).toBe(false)                    // root 本身
    expect(isSafeChild(root, join(root, '..', 'other'), 2)).toBe(false) // 逃逸
    expect(isSafeChild(root, join(root, 'ws', 'sid', 'deep'), 2)).toBe(false)
  })
})

describe('locateSessionUsage：按行的磁盘占用', () => {
  it('找到转录目录与投影缓存，并给出各自体积', () => {
    const { home } = fixture()
    const { dir } = layFiles(home, 'session-drop-a', 4096, 1024)
    const usage = locateSessionUsage(['session-drop-a'], home).get('session-drop-a')
    expect(usage?.dir).toBe(dir)
    // 两个转录文件合计：4096 + 16
    expect(usage?.bytes).toBe(4112)
    expect(usage?.cacheBytes).toBe(1024)
  })

  it('磁盘上没有实体的会话如实返回 0，而不是编一个数', () => {
    const { home } = fixture()
    const usage = locateSessionUsage(['session-ghost'], home).get('session-ghost')
    expect(usage?.dir).toBeUndefined()
    expect(usage?.bytes).toBe(0)
    expect(usage?.cacheBytes).toBe(0)
  })

  it('目录名不带 session- 前缀时也能定位（子会话的目录名形态）', () => {
    const { home } = fixture()
    const dir = join(sessionsRootFor(home), '--E-test-demo--', 'bare-uuid')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'session.jsonl.zstd'), Buffer.alloc(8, 1))
    expect(indexSessionDirs(sessionsRootFor(home)).get('bare-uuid')).toBe(dir)
    expect(locateSessionUsage(['session-bare-uuid'], home).get('session-bare-uuid')?.dir).toBe(dir)
  })

  it('同 id 同时存在带/不带前缀的目录时，优先带前缀的', () => {
    const { home } = fixture()
    const prefixed = join(sessionsRootFor(home), '--E-test-demo--', 'session-dup')
    const bare = join(sessionsRootFor(home), '--E-test-demo--', 'dup')
    mkdirSync(prefixed, { recursive: true })
    mkdirSync(bare, { recursive: true })
    expect(indexSessionDirs(sessionsRootFor(home)).get('dup')).toBe(prefixed)
  })

  it('dirSize 递归累计', () => {
    const { home } = fixture()
    const { dir } = layFiles(home, 'session-drop-a', 100, 0)
    expect(dirSize(dir)).toBe(116)
  })
})

describe('purgeHistory：真删四处，且只删选中的', () => {
  it('转录目录 + 投影缓存 + 归档数组 + 工作区成员表 全部清理', () => {
    const { home, store } = fixture()
    const drop = layFiles(home, 'session-drop-a', 2048, 512)
    const keep = layFiles(home, 'session-keep-b', 64, 32)

    const result = purgeHistory({ sessionIds: ['session-drop-a'] }, undefined, { dshHome: home, searchPaths: [store] })

    expect(result.ok).toBe(true)
    expect(result.purged).toBe(1)
    expect(result.freedBytes).toBe(2048 + 16 + 512)
    expect(result.requiresRestart).toBe(true)
    expect(result.failures).toBeUndefined()

    // ① 转录目录整个没了（含旧格式副本）
    expect(existsSync(drop.dir)).toBe(false)
    // ② 投影缓存没了
    expect(existsSync(drop.cache)).toBe(false)
    // ③ 归档数组只去掉了目标
    // ④ 成员表在两个工作区里都去掉了目标，其余成员原样
    const after = readStore(store)
    expect(after.archived).toEqual(['session-keep-b'])
    expect(after.ws.ws1?.sessionIds).toEqual(['session-keep-b', 'session-live-c'])
    expect(after.ws.ws2?.sessionIds).toEqual([])

    // 未选中的会话一个字节都没动
    expect(existsSync(keep.dir)).toBe(true)
    expect(existsSync(keep.cache)).toBe(true)
  })

  it('留下 workspace.json 备份', () => {
    const { home, store } = fixture()
    layFiles(home, 'session-drop-a', 8, 0)
    purgeHistory({ sessionIds: ['session-drop-a'] }, undefined, { dshHome: home, searchPaths: [store] })
    const backups = readdirSync(join(home, 'storages')).filter((name) => name.startsWith('workspace.json.bak-'))
    expect(backups.length).toBe(1)
  })

  it('磁盘上本就没有实体：仍清掉状态并算成功（幂等重放）', () => {
    const { home, store } = fixture()
    const result = purgeHistory({ sessionIds: ['session-drop-a'] }, undefined, { dshHome: home, searchPaths: [store] })
    expect(result.ok).toBe(true)
    expect(result.purged).toBe(1)
    expect(result.freedBytes).toBe(0)
    expect(readStore(store).archived).toEqual(['session-keep-b'])
  })

  it('缺 dshHome 时拒绝执行 —— 破坏性操作不接受猜测的路径', () => {
    const { store } = fixture()
    const result = purgeHistory({ sessionIds: ['session-drop-a'] }, undefined, { searchPaths: [store] })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('dshHome')
  })

  it('入参校验与 prune 同规格', () => {
    const { home, store } = fixture()
    const options = { dshHome: home, searchPaths: [store] }
    expect(purgeHistory({}, undefined, options).ok).toBe(false)
    expect(purgeHistory({ sessionIds: [] }, undefined, options).ok).toBe(false)
    expect(purgeHistory({ sessionIds: ['', 42, null] }, undefined, options).ok).toBe(false)
    const tooMany = Array.from({ length: 5001 }, (_v, i) => `s-${i}`)
    expect(purgeHistory({ sessionIds: tooMany }, undefined, options).ok).toBe(false)
  })

  it('存储文件不可用时整体中止：**一个文件都不删**', () => {
    const { home } = fixture()
    const drop = layFiles(home, 'session-drop-a', 128, 64)
    const missing = join(home, 'storages', 'nope.json')
    const result = purgeHistory({ sessionIds: ['session-drop-a'] }, undefined, { dshHome: home, searchPaths: [missing] })
    expect(result.ok).toBe(false)
    expect(existsSync(drop.dir)).toBe(true)
    expect(existsSync(drop.cache)).toBe(true)
  })
})

describe('listHistory：按行体积接到列表上', () => {
  it('给了 dshHome 就按行算体积；不给就保持 0', async () => {
    const { home, store } = fixture()
    layFiles(home, 'session-drop-a', 300, 100)
    layFiles(home, 'session-keep-b', 5, 0)

    const withHome = await listHistory(() => undefined, undefined, [store], home)
    const rows = withHome.items ?? []
    const drop = rows.find((row) => row.sessionId === 'session-drop-a')
    const keep = rows.find((row) => row.sessionId === 'session-keep-b')
    expect(drop?.bytes).toBe(316)
    expect(drop?.cacheBytes).toBe(100)
    expect(keep?.bytes).toBe(21)

    const withoutHome = await listHistory(() => undefined, undefined, [store])
    expect((withoutHome.items ?? []).every((row) => row.bytes === 0 && row.cacheBytes === 0)).toBe(true)
  })
})
