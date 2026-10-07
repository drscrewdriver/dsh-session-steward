/**
 * Legacy 设置桥 scope（客户端半）行为测试：describe 懒触发（subscribe 才发
 * fetch）、就绪快照合并、乐观 set + 权威修正、失败回滚、describe 失败降级
 * unavailable、无订阅者裸读不 fetch。
 *
 * 模块级单例共享仓 → 每个用例 vi.resetModules() + 动态 import 取全新状态；
 * fetch 用 vi.stubGlobal 打桩。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type BridgeModule = typeof import('../src/client/bridge-scope.ts')

async function freshBridge(): Promise<BridgeModule> {
  vi.resetModules()
  return await import('../src/client/bridge-scope.ts')
}

/** fetch 桩：按调用序出牌（settings-describe / settings-mutate …）。 */
function stubFetch(responses: Array<{ body: unknown; ok?: boolean }>): { calls: Array<{ url: string; body: unknown }> } {
  const calls: Array<{ url: string; body: unknown }> = []
  let i = 0
  vi.stubGlobal('fetch', async (url: string, init?: { body?: string }) => {
    calls.push({ url, body: init?.body === undefined ? undefined : JSON.parse(init.body) })
    const scripted = responses[Math.min(i, responses.length - 1)]
    i += 1
    return {
      ok: scripted.ok !== false,
      json: async () => scripted.body,
    } as Response
  })
  return { calls }
}

beforeEach(() => {
  vi.stubGlobal('AbortController', AbortController)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('bridge scope（客户端半）', () => {
  it('subscribe 触发 describe → ready 快照含两命名空间权威值', async () => {
    const bridge = await freshBridge()
    stubFetch([{
      body: {
        ok: true,
        writable: true,
        revision: 4,
        namespaces: {
          'session-steward': { enabled: false, historyFiles: true, healthCheck: true, search: true },
          'switch-search': { enabled: true, defaultMode: 'content', autoSync: true, syncIntervalMs: 30_000, archiveKeep: 2, indexDir: '' },
        },
      },
    }])
    const scope = bridge.stewardBridgeScope()
    expect(scope.getSnapshot().status).toBe('loading')
    await new Promise<void>((resolve) => {
      const unsubscribe = scope.subscribe(() => {
        unsubscribe()
        resolve()
      })
    })
    const snap = scope.getSnapshot()
    expect(snap.status).toBe('ready')
    expect(snap.writable).toBe(true)
    expect(snap.revision).toBe(4)
    expect(snap.value?.enabled).toBe(false)
  })

  it('set：乐观回显 → mutate 权威修正（revision 推进）', async () => {
    const bridge = await freshBridge()
    const { calls } = stubFetch([
      {
        body: {
          ok: true,
          writable: true,
          revision: 1,
          namespaces: {
            'session-steward': { enabled: true, historyFiles: true, healthCheck: true, search: true },
            'switch-search': {},
          },
        },
      },
      {
        body: {
          ok: true,
          revision: 2,
          namespaces: {
            'session-steward': { enabled: false, historyFiles: true, healthCheck: true, search: true },
            'switch-search': {},
          },
        },
      },
    ])
    const scope = bridge.stewardBridgeScope()
    await new Promise<void>((resolve) => {
      const unsubscribe = scope.subscribe(() => {
        unsubscribe()
        resolve()
      })
    })
    expect(scope.getSnapshot().value?.enabled).toBe(true)
    await scope.set('enabled', false)
    expect(calls[1]?.url).toBe('/session-steward/api/settings-mutate')
    expect(calls[1]?.body).toMatchObject({ ns: 'session-steward', fields: { enabled: false } })
    expect(scope.getSnapshot().value?.enabled).toBe(false)
    expect(scope.getSnapshot().revision).toBe(2)
  })

  it('set 失败：回滚乐观值并抛错', async () => {
    const bridge = await freshBridge()
    stubFetch([
      {
        body: {
          ok: true,
          writable: true,
          revision: 1,
          namespaces: {
            'session-steward': { enabled: true, historyFiles: true, healthCheck: true, search: true },
            'switch-search': {},
          },
        },
      },
      { body: { ok: false, error: '宿主拒绝写入（模拟）' } },
    ])
    const scope = bridge.stewardBridgeScope()
    await new Promise<void>((resolve) => {
      const unsubscribe = scope.subscribe(() => {
        unsubscribe()
        resolve()
      })
    })
    await expect(scope.set('enabled', false)).rejects.toThrow('宿主拒绝写入')
    expect(scope.getSnapshot().value?.enabled).toBe(true)
  })

  it('describe 失败：unavailable 降级 + 不可写', async () => {
    const bridge = await freshBridge()
    stubFetch([{ body: { ok: false, error: 'forbidden' } }])
    const scope = bridge.searchBridgeScope()
    await new Promise<void>((resolve) => {
      const unsubscribe = scope.subscribe(() => {
        unsubscribe()
        resolve()
      })
    })
    const snap = scope.getSnapshot()
    expect(snap.status).toBe('unavailable')
    expect(snap.writable).toBe(false)
    await expect(scope.set('defaultMode', 'content')).rejects.toThrow('不可写')
  })

  it('裸读（无 subscribe）不触发 fetch', async () => {
    const bridge = await freshBridge()
    const { calls } = stubFetch([{ body: { ok: true, writable: true, revision: 0, namespaces: {} } }])
    const scope = bridge.stewardBridgeScope()
    expect(scope.getSnapshot().status).toBe('loading')
    expect(calls).toHaveLength(0)
  })

  it('两个视图共享一次 describe（单 fetch 供双卡）', async () => {
    const bridge = await freshBridge()
    const { calls } = stubFetch([{
      body: {
        ok: true,
        writable: true,
        revision: 9,
        namespaces: {
          'session-steward': { enabled: true, historyFiles: true, healthCheck: true, search: true },
          'switch-search': { enabled: true, defaultMode: 'title', autoSync: true, syncIntervalMs: 30_000, archiveKeep: 2, indexDir: '' },
        },
      },
    }])
    const steward = bridge.stewardBridgeScope()
    const search = bridge.searchBridgeScope()
    await new Promise<void>((resolve) => {
      const unsubscribeSteward = steward.subscribe(() => {
        unsubscribeSteward()
        resolve()
      })
    })
    const unsubscribeSearch = search.subscribe(() => {})
    unsubscribeSearch()
    expect(calls.filter((c) => c.url.endsWith('settings-describe'))).toHaveLength(1)
    expect(search.getSnapshot().status).toBe('ready')
    expect(search.getSnapshot().value?.defaultMode).toBe('title')
  })
})
