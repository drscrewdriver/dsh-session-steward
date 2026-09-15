/**
 * 归属：把投影 key 指回产出它的插件包。
 *
 * 做法是静态扫描 profile 的 `node_modules`：`<pkg>/lib/index.js` 里
 * `sessionProjections.register({ key: 'xxx' })`（或其定义工厂）会命中
 * `key:\s*['"](\w+)['"]` 正则；据此建立 `投影 key → 包名` 索引。
 * `@deepseek-ai/*` 视为内置（core）；扫不到时如实返回 `unknown`，禁止臆测。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { GateAttribution } from './gates.ts'

/** 一条归属记录。 */
export interface ProjectionOwner {
  key: string
  /** 包名；内置包以 `@deepseek-ai/` 前缀判定。 */
  package: string
  /** 'core' 表示内置包，'plugin' 表示第三方插件。 */
  kind: 'core' | 'plugin'
  /** 命中文件（相对 node_modules）。 */
  entry: string
}

/** 默认扫描根：profile 的 node_modules。 */
export function defaultProfileNodeModules(dshHome?: string): string {
  return join(dshHome ?? join(homedir(), '.dsh'), 'profiles', 'web', 'node_modules')
}

/** 收集候选包目录（含 @scope/pkg 一层）。 */
function candidatePackages(root: string): { name: string; dir: string }[] {
  const out: { name: string; dir: string }[] = []
  if (!existsSync(root)) return out
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
    if (entry.name.startsWith('.')) continue
    const dir = join(root, entry.name)
    if (entry.name.startsWith('@')) {
      let scoped: string[] = []
      try {
        scoped = readdirSync(dir)
      } catch { continue }
      for (const child of scoped) {
        out.push({ name: `${entry.name}/${child}`, dir: join(dir, child) })
      }
      continue
    }
    out.push({ name: entry.name, dir })
  }
  return out
}

/** 单个入口文件的最大扫描字节数（超大 bundle 直接跳过，避免无谓内存与耗时）。 */
const MAX_SCAN_BYTES = 12 << 20

/** 扫描若干候选入口文件里出现的投影 key。 */
function keysInFile(file: string): string[] {
  if (!existsSync(file)) return []
  let text: string
  try {
    if (statSync(file).size > MAX_SCAN_BYTES) return []
    text = readFileSync(file, 'utf8')
  } catch {
    return []
  }
  const keys = new Set<string>()
  const pattern = /key:\s*['"]([A-Za-z_$][\w$]*)['"]/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    const key = match[1]
    if (key !== undefined && key !== '') keys.add(key)
  }
  return [...keys]
}

/**
 * 建立投影 key → 包 的索引。
 * @param nodeModulesRoot - profile 的 node_modules 根。
 * @returns 归属记录（同一 key 多包命中时保留首个并排序稳定）。
 */
export function buildProjectionOwnerIndex(nodeModulesRoot: string): ProjectionOwner[] {
  const records: ProjectionOwner[] = []
  const seen = new Set<string>()
  for (const pack of candidatePackages(nodeModulesRoot)) {
    const lib = join(pack.dir, 'lib')
    let entries: string[] = []
    try {
      if (!statSync(lib).isDirectory()) continue
      entries = readdirSync(lib).filter(name => name.endsWith('.js'))
    } catch {
      continue
    }
    for (const name of entries) {
      const file = join(lib, name)
      for (const key of keysInFile(file)) {
        if (seen.has(key)) continue
        seen.add(key)
        records.push({
          key,
          package: pack.name,
          kind: pack.name.startsWith('@deepseek-ai/') ? 'core' : 'plugin',
          entry: `${pack.name}/lib/${name}`,
        })
      }
    }
  }
  return records.sort((left, right) => left.key.localeCompare(right.key))
}

/** 索引查询器。 */
export function createAttributor(index: readonly ProjectionOwner[]): (projection: string) => GateAttribution | undefined {
  const byKey = new Map(index.map(record => [record.key, record]))
  return (projection: string) => {
    const owner = byKey.get(projection)
    if (owner === undefined) return { projection, package: 'unknown' }
    return { projection, package: owner.package }
  }
}
