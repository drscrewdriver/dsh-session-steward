import { describe, expect, it } from 'vitest'
import { firstLosslessViolation, isLossless } from '../src/host/health/lossless.ts'

describe('无损 JSON 判定', () => {
  it('接受普通 JSON 结构', () => {
    expect(isLossless({ a: 1, b: 'x', c: [1, 2, null, true], d: { e: {} } })).toBe(true)
    expect(isLossless(null)).toBe(true)
    expect(isLossless(0)).toBe(true)
    expect(isLossless('')).toBe(true)
    expect(isLossless(Object.create(null) as unknown)).toBe(true)
  })

  it('拒绝值为 undefined 的键（本次事故形态）', () => {
    const state = { activeStep: { lastSettled: { actualTokens: undefined as unknown as number } } }
    const violation = firstLosslessViolation(state)
    expect(violation?.path).toBe('.activeStep.lastSettled.actualTokens')
    expect(violation?.reason).toBe('undefined')
  })

  it('拒绝顶层 undefined', () => {
    expect(firstLosslessViolation(undefined)?.reason).toBe('undefined')
  })

  it('拒绝非有限数与 -0', () => {
    expect(firstLosslessViolation({ v: Number.NaN })?.reason).toBe('NaN')
    expect(firstLosslessViolation({ v: Number.POSITIVE_INFINITY })?.reason).toBe('Infinity')
    expect(firstLosslessViolation({ v: Number.NEGATIVE_INFINITY })?.reason).toBe('-Infinity')
    expect(firstLosslessViolation({ v: -0 })?.reason).toBe('-0')
  })

  it('拒绝稀疏数组洞', () => {
    const sparse: unknown[] = []
    sparse[2] = 'x'
    const violation = firstLosslessViolation({ list: sparse })
    expect(violation?.reason).toBe('sparse-array-hole')
    expect(violation?.path).toBe('.list[0]')
  })

  it('拒绝非普通原型（Date / Map / class 实例）', () => {
    expect(firstLosslessViolation({ at: new Date(0) })?.reason).toBe('non-plain-prototype')
    expect(firstLosslessViolation({ m: new Map() })?.reason).toBe('non-plain-prototype')
    class Box { public v = 1 }
    expect(firstLosslessViolation({ b: new Box() })?.reason).toBe('non-plain-prototype')
  })

  it('拒绝函数 / Symbol / BigInt', () => {
    expect(firstLosslessViolation({ f: () => 1 })?.reason).toBe('function')
    expect(firstLosslessViolation({ s: Symbol('s') })?.reason).toBe('symbol')
    expect(firstLosslessViolation({ b: BigInt(1) })?.reason).toBe('bigint')
  })

  it('拒绝循环引用', () => {
    const node: Record<string, unknown> = { name: 'loop' }
    node['self'] = node
    expect(firstLosslessViolation({ node })?.reason).toBe('cycle')
  })

  it('深层合规结构返回 undefined', () => {
    expect(firstLosslessViolation({ a: { b: [{ c: 1 }, { d: '2' }] } })).toBeUndefined()
  })
})
