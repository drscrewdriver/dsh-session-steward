import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/config.ts'
import { HEALTH_METHODS, HISTORY_METHODS, handleMethod, methodEnabled, type StewardRuntime } from '../src/index.ts'
import { listHistory, pruneHistory } from '../src/host/history/archive.ts'

/** 造一个只含 workspace 存储文件的临时 DSH home。 */
function seedHome(home: string, archived: string[]): string {
  const dir = join(home, 'storages')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, 'workspace.json')
  writeFileSync(file, JSON.stringify({
    unit: { name: 'workspace', version: 2 },
    global: { initialized: true, workspaceIds: [], archivedSessionIds: archived },
    tables: { workspaces: {} },
  }, null, 2) + '\n', 'utf8')
  return file
}

describe('API 方法表与 feature gate', () => {
  it('方法名一律 session-* 且与 index-* 无交集', () => {
    const all = [...HISTORY_METHODS, ...HEALTH_METHODS]
    for (const method of all) expect(method.startsWith('session-')).toBe(true)
    for (const method of all) expect(method.startsWith('index-')).toBe(false)
    expect(all).toContain('session-health-status')
    expect(all).toContain('session-health-scan')
    expect(all).toContain('session-history-list')
    expect(all).toContain('session-history-prune')
  })

  it('开关关闭时对应子域方法判定为未启用', () => {
    const off = { ...DEFAULT_CONFIG, healthCheck: false }
    expect(methodEnabled('session-health-scan', off)).toBe(false)
    expect(methodEnabled('session-history-list', off)).toBe(true)
    const offHistory = { ...DEFAULT_CONFIG, historyFiles: false }
    expect(methodEnabled('session-history-prune', offHistory)).toBe(false)
    expect(methodEnabled('session-health-status', offHistory)).toBe(true)
  })
})

describe('handleMethod：未识别与已关闭都必须显式失败', () => {
  let home = ''
  let runtime: StewardRuntime
  beforeAll(() => {
    home = mkdtempSync(join(tmpdir(), 'steward-route-'))
    seedHome(home, ['session-a', 'session-b', 'session-c'])
    runtime = {
      config: () => DEFAULT_CONFIG,
      dshHome: home,
      registry: () => undefined,
      projectionStateFor: () => undefined,
      attribute: (projection: string) => ({ projection, package: 'unknown' }),
      log: () => {},
    }
  })
  afterAll(() => { rmSync(home, { recursive: true, force: true }) })

  it('未知方法返回显式错误', async () => {
    const result = await handleMethod('does-not-exist', {}, runtime) as { ok: boolean; error?: string }
    expect(result.ok).toBe(false)
    expect(result.error).toContain('未知的 session-steward API 方法')
  })

  it('子域关闭时返回显式 disabled，而不是空结果', async () => {
    const closed: StewardRuntime = { ...runtime, config: () => ({ ...DEFAULT_CONFIG, healthCheck: false }) }
    const result = await handleMethod('session-health-scan', {}, closed) as { ok: boolean; error?: string }
    expect(result.ok).toBe(false)
    expect(result.error).toContain('healthCheck=false')
  })

  it('status 方法列出两个子域的方法名（便于前端与测试断言）', async () => {
    const result = await handleMethod('session-health-status', {}, runtime) as {
      ok: boolean
      switches: { historyFiles: boolean; healthCheck: boolean }
      historyMethods: string[]
      healthMethods: string[]
    }
    expect(result.ok).toBe(true)
    expect(result.switches).toEqual({ enabled: true, historyFiles: true, healthCheck: true })
    expect(result.historyMethods).toEqual([...HISTORY_METHODS])
    expect(result.healthMethods).toEqual([...HEALTH_METHODS])
  })

  it('history-list 从官方归档集合读出条目（来源 storage-file）', async () => {
    const result = await handleMethod('session-history-list', {}, runtime) as {
      ok: boolean
      items?: { sessionId: string }[]
      source?: string
    }
    expect(result.ok).toBe(true)
    expect(result.source).toBe('storage-file')
    expect(result.items?.map(item => item.sessionId)).toEqual(['session-a', 'session-b', 'session-c'])
  })

  it('history-prune 缺参/超限/正常三种入参都被显式处理', async () => {
    const missing = await handleMethod('session-history-prune', {}, runtime) as { ok: boolean; error?: string }
    expect(missing.ok).toBe(false)

    const tooMany = await handleMethod('session-history-prune', {
      sessionIds: Array.from({ length: 5001 }, (_, index) => `s-${index}`),
    }, runtime) as { ok: boolean; error?: string }
    expect(tooMany.ok).toBe(false)
    expect(tooMany.error).toContain('最多清理')
  })

  it('health-session 缺 sessionId 时显式报错；未知会话也给明确错误', async () => {
    const missing = await handleMethod('session-health-session', {}, runtime) as { ok: boolean; error?: string }
    expect(missing.ok).toBe(false)
    expect(missing.error).toContain('sessionId')

    const unknown = await handleMethod('session-health-session', { sessionId: 'session-nope' }, runtime) as { ok: boolean; error?: string }
    expect(unknown.ok).toBe(false)
    expect(unknown.error).toContain('未找到会话日志')
  })

  it('sessionId 形状非法（路径穿越/超长）被拒绝', async () => {
    const evil = await handleMethod('session-health-session', { sessionId: '../../etc/passwd' }, runtime) as { ok: boolean; error?: string }
    expect(evil.ok).toBe(false)
    expect(evil.error).toContain('sessionId')
  })
})

describe('历史文件域（纯函数）', () => {
  let home = ''
  beforeAll(() => { home = mkdtempSync(join(tmpdir(), 'steward-hist-')) })
  afterAll(() => { rmSync(home, { recursive: true, force: true }) })

  it('prune 会备份并原子替换存储文件，返回 removed/remaining', () => {
    const file = seedHome(home, ['a', 'b', 'c'])
    const result = pruneHistory({ sessionIds: ['b'] }, undefined, [file])
    expect(result.ok).toBe(true)
    expect(result.removed).toBe(1)
    expect(result.remaining).toBe(2)
    expect(result.requiresRestart).toBe(true)
  })

  it('存储文件缺失时 list 返回显式错误', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'steward-hist-empty-'))
    const result = await listHistory(() => undefined, undefined, [join(empty, 'storages', 'workspace.json')])
    expect(result.ok).toBe(false)
    expect(result.error).toContain('无法读取归档集合')
    rmSync(empty, { recursive: true, force: true })
  })
})
