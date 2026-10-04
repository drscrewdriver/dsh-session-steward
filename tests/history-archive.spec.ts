import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { archiveHistory } from '../src/host/history/archive.ts'

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
    home = join(tmpdir(), 'steward-archive-')
    rmSync(home, { recursive: true, force: true })
    home = mkdtemp()
    seedHome(home, ['session-a'])
    paths = [join(home, 'storages', 'workspace.json')]
  })
  function mkdtemp(): string {
    const dir = join(tmpdir(), `steward-archive-${Math.random().toString(36).slice(2)}`)
    mkdirSync(dir, { recursive: true })
    return dir
  }
  afterAll(() => { rmSync(home, { recursive: true, force: true }) })

  it('把新 id 追加进归档集合,已在集合中的 id 不重复', () => {
    const result = archiveHistory({ sessionIds: ['session-b', 'session-a', 'session-b'] }, undefined, paths)
    expect(result.ok).toBe(true)
    expect(result.added).toBe(1)
    expect(result.total).toBe(2)
    expect(result.requiresRestart).toBe(true)
  })

  it('写入后读回校验:目标 id 必须真的进了集合', () => {
    // 直接再跑一次:全为已存在 → added=0、changed=false,仍是 ok。
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
