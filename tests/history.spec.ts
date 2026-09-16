/**
 * 会话历史文件（归档）域回归：清理的写入语义与入参校验。
 *
 * 这组用例是从 dsh-session-search-toggle 迁过来的：那条 prune 用例随
 * `pruneArchiveFile` 一起离开搜索索引包（该包不再拥有归档集合的写能力），
 * 覆盖必须跟着**实现**走，否则同一段逻辑会在两个包之间出现「谁都没测」的空档。
 */
import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listHistory } from '../src/host/history/archive.ts'
import { pruneHistory } from '../src/host/history/archive.ts'

/** 建一个临时 workspace 存储文件，返回路径与内容读取器。 */
function tempStore(ids: readonly string[]): { dir: string; file: string } {
  const dir = mkdtempSync(join(tmpdir(), 'steward-history-'))
  const file = join(dir, 'workspace.json')
  writeFileSync(file, `${JSON.stringify({
    unit: { name: 'workspace', version: 1 },
    global: { archivedSessionIds: [...ids] },
    tables: {},
  }, null, 2)}\n`, 'utf8')
  return { dir, file }
}

describe('session-history-prune：删除归档 id（备份 + 原子替换）', () => {
  it('移除命中的 id，保留其余，并留下备份、不留临时残留', () => {
    const { dir, file } = tempStore(['s-keep-1', 's-drop-1', 's-keep-2', 's-drop-2'])
    const result = pruneHistory({ sessionIds: ['s-drop-1', 's-drop-2', 's-unknown'] }, undefined, [file])
    expect(result.ok).toBe(true)
    expect(result.removed).toBe(2)
    expect(result.remaining).toBe(2)
    expect(result.requiresRestart).toBe(true)

    const doc = JSON.parse(readFileSync(file, 'utf8')) as { global: { archivedSessionIds: string[] } }
    expect(doc.global.archivedSessionIds).toEqual(['s-keep-1', 's-keep-2'])
    const names = readdirSync(dir)
    expect(names.some((name) => name.startsWith('workspace.json.bak-'))).toBe(true)
    expect(names.some((name) => name.includes('.prune-tmp'))).toBe(false)
  })

  it('只给未知 id 时不写文件、不产生备份', () => {
    const { dir, file } = tempStore(['s-keep-1', 's-keep-2'])
    const result = pruneHistory({ sessionIds: ['s-unknown'] }, undefined, [file])
    expect(result.removed).toBe(0)
    expect(result.remaining).toBe(2)
    expect(readdirSync(dir).some((name) => name.startsWith('workspace.json.bak-'))).toBe(false)
  })

  it('入参校验：缺数组 / 无有效值 / 超上限一律显式报错', () => {
    const { file } = tempStore(['s-1'])
    expect(pruneHistory({}, undefined, [file]).ok).toBe(false)
    expect(pruneHistory({ sessionIds: [] }, undefined, [file]).ok).toBe(false)
    expect(pruneHistory({ sessionIds: ['', 42, null] }, undefined, [file]).ok).toBe(false)
    const tooMany = Array.from({ length: 5001 }, (_v, i) => `s-${i}`)
    expect(pruneHistory({ sessionIds: tooMany }, undefined, [file]).ok).toBe(false)
  })

  it('重复 id 按集合清理，只留一份备份', () => {
    const { file } = tempStore(['s-a', 's-a', 's-b'])
    const result = pruneHistory({ sessionIds: ['s-a'] }, undefined, [file])
    expect(result.removed).toBe(2)
    const doc = JSON.parse(readFileSync(file, 'utf8')) as { global: { archivedSessionIds: string[] } }
    expect(doc.global.archivedSessionIds).toEqual(['s-b'])
  })
})

describe('session-history-list：归档集合真值 + 元数据降级标注', () => {
  it('从存储文件读出集合，来源标注为 storage-file', async () => {
    const { file } = tempStore(['s-a', 's-b'])
    const result = await listHistory(() => undefined, undefined, [file])
    expect(result.ok).toBe(true)
    expect(result.source).toBe('storage-file')
    expect(result.items?.map((row) => row.sessionId)).toEqual(['s-a', 's-b'])
    // 没有 sessionQuery 时必须**显式**标注降级，而不是假装标题正常
    expect(result.degraded).toBeTruthy()
  })

  it('存储文件优先于 registry（否则清理成功后面板不会刷新）', async () => {
    const { file } = tempStore(['s-file'])
    const result = await listHistory(() => ({ archivedSessionIds: ['s-file', 's-pruned'] }), undefined, [file])
    expect(result.source).toBe('storage-file')
    expect(result.items?.map((row) => row.sessionId)).toEqual(['s-file'])
    // registry 里多出来的那条 = 已出文件、仍在宿主内存生效 → 必须如实标注待重启
    expect(result.pendingRestart).toBe(1)
  })

  it('回归：prune 后 list 立刻少一条（读的人与写的人同源）', async () => {
    const { file } = tempStore(['s-a', 's-b'])
    // 宿主内存仍是启动时的快照：两条都在
    const registry = () => ({ archivedSessionIds: ['s-a', 's-b'] })
    const before = await listHistory(registry, undefined, [file])
    expect(before.items?.map((row) => row.sessionId)).toEqual(['s-a', 's-b'])
    expect(before.pendingRestart).toBeUndefined()

    expect(pruneHistory({ sessionIds: ['s-b'] }, undefined, [file]).ok).toBe(true)

    const after = await listHistory(registry, undefined, [file])
    expect(after.items?.map((row) => row.sessionId)).toEqual(['s-a'])
    expect(after.pendingRestart).toBe(1)
  })

  it('prune 写后校验：读不回存储文件时如实报错，而不是假报成功', () => {
    const missing = join(tmpdir(), 'steward-history-missing', 'workspace.json')
    expect(existsSync(missing)).toBe(false)
    const result = pruneHistory({ sessionIds: ['s-a'] }, undefined, [missing])
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('两处都不可用时显式失败，不返回空列表冒充成功', async () => {
    const missing = join(tmpdir(), 'steward-history-missing', 'workspace.json')
    expect(existsSync(missing)).toBe(false)
    const result = await listHistory(() => undefined, undefined, [missing])
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('标题来自 sessionQuery 快照时优先使用，且不再标注降级', async () => {
    const { file } = tempStore(['s-a'])
    const result = await listHistory(() => undefined, {
      readTitleSnapshots: async () => [{ status: 'fulfilled', value: { title: { title: '出院小结' } } }],
    }, [file])
    expect(result.items?.[0]?.title).toBe('出院小结')
    expect(result.degraded).toBeUndefined()
  })
})
