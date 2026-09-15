/**
 * 无损 JSON 判定 —— 本次事故的核心 gate 判据。
 *
 * 判定口径与宿主 `@deepseek-ai/dsh-util-values` 的 `isJsonValue` 一致：
 * 普通（或 null）原型的对象、可枚举的字符串键、有限数（含拒绝 -0）、非稀疏数组、
 * 无环；undefined / NaN / ±Infinity / 函数 / Symbol / BigInt 一律视为不可无损序列化。
 *
 * 通过宿主 `assertJsonArgs` / 投影缓存写入的数据都会先过这道口径，所以投影**状态**
 * 一旦含上述值，`api-session/added` 推送与检查点写入都会失败（症状错位的根因）。
 */

/** 首个违规点位。 */
export interface LosslessViolation {
  /** 到违规值的属性路径，例如 `.activeStep.lastSettled.actualTokens`。 */
  path: string
  /** 违规原因的可读描述。 */
  reason:
    | 'undefined'
    | 'NaN'
    | 'Infinity'
    | '-Infinity'
    | '-0'
    | 'function'
    | 'symbol'
    | 'bigint'
    | 'sparse-array-hole'
    | 'non-plain-prototype'
    | 'non-enumerable-or-symbol-key'
    | 'cycle'
  /** 违规处的实际类型（便于人工核对）。 */
  actual: string
}

/** 单个值是否可无损 JSON 序列化。 */
export function isLossless(value: unknown): boolean {
  return firstLosslessViolation(value) === undefined
}

/** 判定一个普通对象是否「普通原型」（Object.prototype 或 null）。 */
function isPlainObjectPrototype(value: object): boolean {
  const prototype = Object.getPrototypeOf(value) as object | null
  return prototype === null || prototype === Object.prototype
}

/**
 * 找出第一个破坏无损 JSON 的值；全部合规时返回 undefined。
 * @param value - 待判定的值（通常是投影状态）。
 * @param limit - 最多访问的节点数（防御超大对象）。
 * @returns 首个违规点位或 undefined。
 */
export function firstLosslessViolation(value: unknown, limit = 200_000): LosslessViolation | undefined {
  const ancestors = new Set<object>()
  const stack: { node: unknown; path: string; leave?: boolean }[] = [{ node: value, path: '' }]
  let visited = 0
  while (stack.length > 0) {
    const task = stack.pop()
    if (task === undefined) break
    if (task.leave === true) {
      ancestors.delete(task.node as object)
      continue
    }
    if (visited >= limit) return { path: task.path, reason: 'cycle', actual: `node-limit(${limit})` }
    visited += 1
    const node = task.node
    if (node === undefined) return { path: task.path, reason: 'undefined', actual: 'undefined' }
    if (node === null) continue
    switch (typeof node) {
      case 'boolean':
      case 'string':
        continue
      case 'number':
        if (Number.isNaN(node)) return { path: task.path, reason: 'NaN', actual: 'NaN' }
        if (node === Infinity) return { path: task.path, reason: 'Infinity', actual: 'Infinity' }
        if (node === -Infinity) return { path: task.path, reason: '-Infinity', actual: '-Infinity' }
        if (Object.is(node, -0)) return { path: task.path, reason: '-0', actual: '-0' }
        continue
      case 'function':
        return { path: task.path, reason: 'function', actual: 'function' }
      case 'symbol':
        return { path: task.path, reason: 'symbol', actual: 'symbol' }
      case 'bigint':
        return { path: task.path, reason: 'bigint', actual: 'bigint' }
      default:
        break
    }
    const object = node as object
    if (ancestors.has(object)) return { path: task.path, reason: 'cycle', actual: 'object-cycle' }
    if (Array.isArray(object)) {
      if (!isPlainArray(object)) return { path: task.path, reason: 'non-plain-prototype', actual: 'array-subclass' }
      // 先按升序找出最低位的洞（报告口径确定），再倒序入栈以获得左→右的访问顺序。
      for (let index = 0; index < object.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(object, index)) {
          return { path: `${task.path}[${index}]`, reason: 'sparse-array-hole', actual: 'hole' }
        }
      }
      ancestors.add(object)
      stack.push({ node: object, path: task.path, leave: true })
      for (let index = object.length - 1; index >= 0; index -= 1) {
        stack.push({ node: object[index], path: `${task.path}[${index}]` })
      }
      continue
    }
    if (!isPlainObjectPrototype(object)) {
      const name = (object as { constructor?: { name?: string } }).constructor?.name ?? 'unknown'
      return { path: task.path, reason: 'non-plain-prototype', actual: name }
    }
    const keys = Reflect.ownKeys(object)
    for (const key of keys) {
      if (typeof key !== 'string' || !Object.prototype.propertyIsEnumerable.call(object, key)) {
        return { path: `${task.path}.${String(key)}`, reason: 'non-enumerable-or-symbol-key', actual: typeof key }
      }
    }
    ancestors.add(object)
    stack.push({ node: object, path: task.path, leave: true })
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index]
      if (key === undefined || typeof key !== 'string') continue
      stack.push({ node: (object as Record<string, unknown>)[key], path: `${task.path}.${key}` })
    }
  }
  return undefined
}

/** 数组是否为普通数组（排除子类）。 */
function isPlainArray(value: readonly unknown[]): boolean {
  const prototype = Object.getPrototypeOf(value) as object | null
  return prototype === null || prototype === Array.prototype
}
