import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildProjectionOwnerIndex, createAttributor } from '../src/host/health/attribution.ts'

/** 造一个假 profile node_modules：两个第三方包 + 一个内置包 + 一个 scope 包。 */
function seedFakeNodeModules(root: string): void {
  const write = (pkg: string, file: string, body: string): void => {
    const dir = join(root, pkg, 'lib')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, file), body, 'utf8')
  }
  write('dsh-live-token-stats', 'index.js',
    'ctx.inject(["sessionProjections"], (c) => { c.sessionProjections.register({ key: "liveTokenStats", init, apply }) })')
  write('dsh-context', 'index.js',
    'ctx.sessionProjections.register(createContextTimelineDefinition(config))\nctx.sessionProjections.register(createContextHeadersDefinition(owner))')
  write('@deepseek-ai/dsh-session-stats', 'index.js',
    'ctx.sessionProjections.register({ key: "sessionStats", init, apply })')
  write('@scope/other-plugin', 'index.js', 'ctx.sessionProjections.register({ key: "customThing" })')
  // 没有 lib/ 的包应被安全跳过
  mkdirSync(join(root, 'broken-pkg'), { recursive: true })
}

describe('投影归属索引', () => {
  let root = ''
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'steward-attr-'))
    seedFakeNodeModules(root)
  })
  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('把投影 key 映射到包名，并区分 core / plugin', () => {
    const index = buildProjectionOwnerIndex(root)
    const byKey = new Map(index.map(record => [record.key, record]))
    // liveTokenStats 只出现在第三方包的 register 字面量里
    expect(byKey.get('liveTokenStats')?.package).toBe('dsh-live-token-stats')
    expect(byKey.get('liveTokenStats')?.kind).toBe('plugin')
    // 内置包归 core
    expect(byKey.get('sessionStats')?.package).toBe('@deepseek-ai/dsh-session-stats')
    expect(byKey.get('sessionStats')?.kind).toBe('core')
    // scope 包名保留 @scope/pkg 形状
    const scoped = index.find(record => record.package === '@scope/other-plugin')
    expect(scoped?.key).toBe('customThing')
    expect(scoped?.kind).toBe('plugin')
  })

  it('归属查询：命中返回包名，未命中如实返回 unknown', () => {
    const attribute = createAttributor(buildProjectionOwnerIndex(root))
    expect(attribute('liveTokenStats')?.package).toBe('dsh-live-token-stats')
    expect(attribute('neverSeenKey')?.package).toBe('unknown')
  })

  it('不存在的 node_modules 根返回空索引（不抛错）', () => {
    expect(buildProjectionOwnerIndex(join(root, 'does-not-exist'))).toEqual([])
  })
})
