#!/usr/bin/env node
/**
 * 两块样式表都没有孤儿选择器，且设置绑定各有单一 owner。
 *
 * Why this test exists
 * --------------------
 * Two silent-rot classes, both found by hand in this repo and neither reachable
 * by a GUI check:
 *
 * 1. **Orphan CSS.** When the archived-sessions viewer moved between packages,
 *    its selectors stayed behind and kept shipping in every bundle. A
 *    stylesheet full of classes for a panel that no longer exists reads as
 *    "this plugin still owns that panel".
 * 2. **A switch wired to nothing.** `enabled` was declared, defaulted and
 *    exposed as a toggle, but the sidebar entry registered unconditionally, so
 *    the switch controlled nothing. The fix is that the entry and the settings
 *    card read *the same* bound scope — one binding, two consumers.
 *
 * 合并包（dsh-session-steward ⊕ 原 dsh-search-index）后有两块样式表，各自独立
 * owner、类名前缀不相交：
 * - 搜索面板：`src/client/search/panel.tsx` 的 `const CSS = \`...\``（dsws_*）；
 * - 管家面板/设置卡：`src/client/index.ts` 的 `style.textContent = \`...\``（dss_*）。
 *
 * What it proves: no stylesheet class is unreferenced, and each subdomain's
 * entry/card share one scope binding.
 * What it does NOT prove: that the entries actually disappear when switched off
 * — that is a React render path, and stays a GUI check.
 *
 * Usage: node tests/client-styles.test.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CLIENT_DIR = join(HERE, '..', 'src', 'client')

const files = (function walk(dir, prefix = '') {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) out.push(...walk(join(dir, entry.name), rel))
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) out.push(rel)
  }
  return out
})(CLIENT_DIR)
const sources = new Map(files.map(f => [f, readFileSync(join(CLIENT_DIR, f), 'utf8')]))

/** ------------------------------------------------------ one owner per stylesheet */

/** Extract `marker`…closing backtick from one source; assert exactly one owner. */
function extractStylesheet(source, file, marker, prefix) {
  const declarations = source.split(marker).length - 1
  assert.equal(declarations, 1, `${file}: the ${prefix} stylesheet must have exactly one owner; found ${declarations}`)
  const start = source.indexOf(marker)
  const end = source.indexOf('`', start + marker.length)
  return source.slice(start + marker.length, end)
}

const PANEL_FILE = 'search/panel.tsx'
const INDEX_FILE = 'index.ts'
assert.ok(sources.has(PANEL_FILE), `${PANEL_FILE} must exist`)
assert.ok(sources.has(INDEX_FILE), `${INDEX_FILE} must exist`)

const searchCss = extractStylesheet(sources.get(PANEL_FILE), PANEL_FILE, 'const CSS = `', 'search panel')
const stewardCss = extractStylesheet(sources.get(INDEX_FILE), INDEX_FILE, 'style.textContent = `', 'steward panel')

const classes = new Set()
for (const m of searchCss.matchAll(/\.(dsws_[A-Za-z0-9_]+)/g)) classes.add(m[1])
for (const m of stewardCss.matchAll(/\.(dss_[A-Za-z0-9_]+)/g)) classes.add(m[1])
assert.ok(classes.size > 40, `both stylesheets should define the panels' classes; found ${classes.size}`)

/** --------------------------------------------------------- no orphan classes */

// Code = every client source, with both stylesheet literals removed so a class
// cannot satisfy the check by matching its own rule.
const code = [...sources.values()].join('\n').replace(searchCss, '').replace(stewardCss, '')

// 模板串动态拼出的类名（如 `dss_level_${level}`、`dss_verdict_${verdict}`）在
// 源码里没有字面全名 —— 收集动态词干，类名命中词干前缀即视为被引用。
const dynamicStems = new Set()
for (const m of code.matchAll(/([a-z0-9_]+)_\$\{/g)) dynamicStems.add(m[1])

const orphans = []
for (const name of [...classes].sort()) {
  const hits = (code.match(new RegExp(`${name}(?![A-Za-z0-9_])`, 'g')) ?? []).length
  if (hits > 0) continue
  const covered = [...dynamicStems].some(stem => name === stem || name.startsWith(`${stem}_`) || name.startsWith(`${stem}-`))
  if (!covered) orphans.push(name)
}

assert.deepEqual(
  orphans,
  [],
  `every stylesheet class must be referenced from code; orphaned: ${orphans.join(', ')}`,
)

/** ------------------------------------------- the settings bindings have owners */

// Merged package: TWO subdomain cards, each entry/card pair reads ONE binding.
// The legacy fallback binds both namespaces (`session-steward` + `switch-search`);
// on 0.1.7 configForms keys both by the single profile entry id.
const indexSource = sources.get(INDEX_FILE)
// 命名空间以常量注入（STEWARD_SETTINGS_NAMESPACE / SWITCH_SEARCH_SETTINGS_NAMESPACE），
// 按常量名断言而不是字面量。
const legacyBinds = indexSource.match(/\.bind<[^>]+>\(\{ namespace: (STEWARD|SWITCH)_/g) ?? []
assert.equal(
  legacyBinds.length,
  2,
  `both subdomains must have exactly one legacy namespace bind each; found ${legacyBinds.length}: ${JSON.stringify(legacyBinds)}`,
)
assert.ok(indexSource.includes('{ namespace: STEWARD_SETTINGS_NAMESPACE }'), 'the steward subdomain must bind session-steward')
assert.ok(indexSource.includes('{ namespace: SWITCH_SEARCH_SETTINGS_NAMESPACE }'), 'the search subdomain must bind switch-search')
assert.equal(
  (indexSource.match(/configForms\?\.get/g) ?? []).length,
  2,
  'configForms must be resolved once per subdomain scope (bound + searchBound)',
)

// And the entries must actually consult the bindings, rather than only receiving them.
assert.ok(
  /snapshot\?\.value\?\.\[?['"]?enabled/.test(code) || /value\['enabled'\]/.test(code),
  'the sidebar entries must read `enabled` from the shared bindings',
)

console.log(`client-styles: ok (${classes.size} classes, 0 orphans, 2 scoped bindings)`)
