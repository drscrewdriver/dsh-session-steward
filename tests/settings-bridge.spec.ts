/**
 * Legacy 设置桥（宿主半）行为测试：settings-describe / settings-mutate 两个
 * 桥方法在 handleMethod 层的契约——闸旁路、校验白名单、legacy 可写、modern
 * 只读投影、宿主拒绝显式失败。
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/config.ts'
import { SWITCH_SEARCH_SETTINGS_NAMESPACE } from '../src/config.ts'
import { handleMethod, type StewardRuntime } from '../src/index.ts'
import type { BridgeState, LegacySettingsBridge } from '../src/host/settings-bridge.ts'

/** 内存版 legacy settings 服务（register 忽略 schema；get/update 走同一份文档）。 */
function fakeBridge(initial: Record<string, Record<string, unknown>> = {}): {
  face: LegacySettingsBridge
  docs: Record<string, Record<string, unknown>>
  failNext: boolean
} {
  const docs = { ...initial }
  const state = {
    face: {
      get: (ns: string) => docs[ns],
      update: async (ns: string, patch: Record<string, unknown>) => {
        if (state.failNext) {
          state.failNext = false
          throw new Error('宿主拒绝写入（模拟）')
        }
        docs[ns] = { ...docs[ns], ...patch }
      },
    } as LegacySettingsBridge,
    docs,
    failNext: false,
  }
  return state
}

function runtimeWith(bridge: BridgeState | undefined): StewardRuntime {
  return {
    config: () => ({ ...DEFAULT_CONFIG }),
    dshHome: '/tmp/does-not-matter',
    registry: () => undefined,
    projectionStateFor: () => undefined,
    attribute: (projection: string) => ({ projection, package: 'unknown' }),
    log: () => {},
    settingsBridge: bridge,
  }
}

describe('settings-describe', () => {
  it('legacy 桥：回两命名空间文档 + writable=true + revision', async () => {
    const docs = fakeBridge({ 'session-steward': { enabled: false } })
    const runtime = runtimeWith({ bridge: docs.face, revision: 7 })
    const res = await handleMethod('settings-describe', {}, runtime) as {
      ok: boolean
      writable: boolean
      revision: number
      namespaces: Record<string, Record<string, unknown>>
    }
    expect(res.ok).toBe(true)
    expect(res.writable).toBe(true)
    expect(res.revision).toBe(7)
    expect(res.namespaces['session-steward']).toMatchObject({ enabled: false, historyFiles: true })
    expect(res.namespaces['switch-search']).toMatchObject({ defaultMode: 'title', syncIntervalMs: 30_000 })
  })

  it('modern 宿主（无桥）：只读投影 + writable=false，mutate 显式拒绝', async () => {
    const runtime = runtimeWith(undefined)
    const described = await handleMethod('settings-describe', {}, runtime) as { ok: boolean; writable: boolean; namespaces: Record<string, Record<string, unknown>> }
    expect(described.ok).toBe(true)
    expect(described.writable).toBe(false)
    expect(described.namespaces['switch-search']).toMatchObject({ enabled: true, defaultMode: 'title' })
    const mutated = await handleMethod('settings-mutate', { ns: 'session-steward', fields: { enabled: false } }, runtime) as { ok: boolean; error?: string }
    expect(mutated.ok).toBe(false)
    expect(mutated.error).toContain('legacy settings 服务')
  })

  it('闸旁路：enabled/healthCheck/historyFiles 全关，describe 仍然可读', async () => {
    const docs = fakeBridge()
    const runtime = runtimeWith({ bridge: docs.face, revision: 0 })
    runtime.config = () => ({
      ...DEFAULT_CONFIG,
      enabled: false,
      healthCheck: false,
      historyFiles: false,
    })
    const res = await handleMethod('settings-describe', {}, runtime) as { ok: boolean; error?: string }
    expect(res.ok).toBe(true)
    expect(res.error).toBeUndefined()
  })
})

describe('settings-mutate', () => {
  it('合法字段：合并写入 + revision 自增 + 回权威文档', async () => {
    const docs = fakeBridge()
    const state: BridgeState = { bridge: docs.face, revision: 0 }
    const runtime = runtimeWith(state)
    const res = await handleMethod('settings-mutate', { ns: 'session-steward', fields: { enabled: false, historyFiles: false } }, runtime) as {
      ok: boolean
      revision?: number
      namespaces?: Record<string, Record<string, unknown>>
    }
    expect(res.ok).toBe(true)
    expect(res.revision).toBe(1)
    expect(docs.docs['session-steward']).toMatchObject({ enabled: false, historyFiles: false })
    expect(res.namespaces?.['session-steward']).toMatchObject({ enabled: false, healthCheck: true })
  })

  it('搜索字段数值清洗：syncIntervalMs 落在钳位内', async () => {
    const docs = fakeBridge()
    const runtime = runtimeWith({ bridge: docs.face, revision: 0 })
    const res = await handleMethod('settings-mutate', { ns: 'switch-search', fields: { syncIntervalMs: 1 } }, runtime) as {
      ok: boolean
      namespaces?: Record<string, Record<string, unknown>>
    }
    expect(res.ok).toBe(true)
    expect(docs.docs['switch-search']).toMatchObject({ syncIntervalMs: 5_000 })
  })

  it('未知命名空间 / 白名单外字段 / 类型错误 / 空 fields 一律显式拒绝', async () => {
    const docs = fakeBridge()
    const runtime = runtimeWith({ bridge: docs.face, revision: 0 })
    const cases: Array<{ payload: unknown; errorPart: string }> = [
      { payload: { ns: 'no-such-ns', fields: { enabled: true } }, errorPart: '未知设置命名空间' },
      { payload: { ns: 'session-steward', fields: { nope: true } }, errorPart: '不接受字段' },
      { payload: { ns: 'session-steward', fields: { enabled: 'yes' } }, errorPart: '期望布尔值' },
      { payload: { ns: 'session-steward', fields: {} }, errorPart: 'fields 为空' },
      { payload: { ns: 'session-steward', fields: 'not-an-object' }, errorPart: 'fields 必须是对象' },
      { payload: { ns: SWITCH_SEARCH_SETTINGS_NAMESPACE, fields: { defaultMode: 'bogus' } }, errorPart: 'defaultMode' },
    ]
    for (const { payload, errorPart } of cases) {
      const res = await handleMethod('settings-mutate', payload, runtime) as { ok: boolean; error?: string }
      expect(res.ok, JSON.stringify(payload)).toBe(false)
      expect(res.error, JSON.stringify(payload)).toContain(errorPart)
    }
  })

  it('宿主拒绝写入：显式失败且不 bump revision', async () => {
    const docs = fakeBridge()
    const state: BridgeState = { bridge: docs.face, revision: 3 }
    docs.failNext = true
    const res = await handleMethod('settings-mutate', { ns: 'session-steward', fields: { enabled: false } }, runtimeWith(state)) as { ok: boolean; error?: string }
    expect(res.ok).toBe(false)
    expect(res.error).toContain('宿主拒绝写入')
    expect(state.revision).toBe(3)
  })
})
