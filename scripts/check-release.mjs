// SPDX-License-Identifier: MIT
/**
 * 发布防漏守卫(beta.10 事故的永久防线)。
 *
 * beta.10 事故:tsdown 双入口共享模块拆出 chunk 文件,files 白名单漏收 →
 * tarball 缺 chunk → 安装后两个宿主入口全部 import 失败 → patch 又禁用了
 * 官方 workspace 行 → 消费方五连 pending → 侧栏空。
 *
 * 本守卫三道断言,任何一道失败即退出 1:
 * 1. tarball 清单:lib/index.js、lib/registry.js、lib/client.js 必须在;
 *    且 lib 下不得出现 entry 之外的 chunk 形态文件(index/registry/client/
 *    *.d.ts 之外的 .js)。
 * 2. 入口自包含:从仓库 lib/ 直接动态 import 两个宿主入口 + client 存在性
 *    ——相对导入缺文件在这里就会炸(与安装后的解析等价,依赖由 devDeps 提供)。
 * 3. 静态相对导入扫描:lib/*.js 里 `from './x'` 指向的文件必须存在。
 */
import { spawnSync } from 'node:child_process'
import { readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const LIB = join(ROOT, 'lib')

const failures = []
const fail = (message) => failures.push(message)

/** ── 1. tarball 清单 ── */
const pack = spawnSync('npm', ['pack', '--dry-run', '--json'], { cwd: ROOT, encoding: 'utf8', shell: true })
if (pack.status !== 0) {
  fail(`npm pack --dry-run 失败: ${String(pack.stderr).slice(0, 300)}`)
} else {
  let names = []
  try {
    // prepack（320ce31 起 = npm run build）的 tsdown 日志会混进 stdout，且 npm
    // pack --json 是 pretty JSON（'[' 与 '{' 之间有换行），首个 '[' 可能属于日志
    // 文本——用 /\\[\\s*\\{/ 定位数组真起点。
    const out = String(pack.stdout)
    const arrayStart = out.match(/\[\s*\{/)
    const start = arrayStart ? arrayStart.index : -1
    const end = out.lastIndexOf(']')
    if (start < 0 || end <= start) throw new Error('stdout 中没有 JSON 段')
    const parsed = JSON.parse(out.slice(start, end + 1))
    names = (parsed[0]?.files ?? []).map(entry => entry.path)
  } catch (err) {
    fail(`pack 清单解析失败: ${String(err)}`)
  }
  for (const required of ['lib/index.js', 'lib/client.js', 'cordis.patch.yml', 'dsh.plugin.json']) {
    // npm pack 清单的路径前缀随版本带/不带 package/,用后缀匹配。
    const found = names.some(name => name === required || name.endsWith(`/${required}`))
    if (!found) fail(`tarball 缺少 ${required}`)
  }
  const jsInLib = names.filter(name => /^package\/lib\/[^/]+\.js$/.test(name))
  const allowed = new Set(['package/lib/index.js', 'package/lib/client.js'])
  for (const name of jsInLib) {
    if (!allowed.has(name)) fail(`tarball 出现 entry 之外的 lib JS(疑似 chunk): ${name}`)
  }
}

/** ── 2. 入口自包含 ── */
if (!existsSync(LIB)) {
  fail('lib/ 不存在:请先 npm run build')
} else {
  for (const entry of ['index.js']) {
    try {
      await import(pathToFileURL(join(LIB, entry)).href)
    } catch (err) {
      fail(`lib/${entry} 导入失败(疑似缺 chunk/相对导入): ${String(err instanceof Error ? err.message : err).slice(0, 200)}`)
    }
  }
  if (!existsSync(join(LIB, 'client.js'))) fail('lib/client.js 不存在')
}

/** ── 3. 静态相对导入扫描 ── */
function listJs(dir) {
  return readdirSync(dir)
    .filter(name => name.endsWith('.js'))
    .map(name => join(dir, name))
}
const RELATIVE = /from\s+(['"])(\.[^'"]+)\1/g
for (const file of listJs(LIB)) {
  const source = await import('node:fs').then(fs => fs.readFileSync(file, 'utf8'))
  for (const match of source.matchAll(RELATIVE)) {
    const target = resolve(dirname(file), match[2])
    const candidates = [target, `${target}.js`, join(target, 'index.js')]
    if (!candidates.some(path => existsSync(path) && statSync(path).isFile())) {
      fail(`${file} 的相对导入 "${match[2]}" 指向不存在的文件`)
    }
  }
}

if (failures.length > 0) {
  console.error(`check-release: ${failures.length} 处发布阻断`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}
console.log('check-release: tarball 清单 / 入口自包含 / 相对导入 三道断言全部通过')
