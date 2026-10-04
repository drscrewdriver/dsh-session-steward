// @ts-nocheck — 移植自 node:test 的 mjs 用例，保持无类型原样
/**
 * Archive semantics of the independent index (schema v5+, R1 合表复用).
 *
 * What it proves:
 * - setArchived is a pure flag flip: docs and FTS survive BOTH directions;
 *   archived sessions stay searchable through the `archived` domain filter.
 * - Un-archiving does NOT reset the version — the content never left, no
 *   re-ingest happens (the whole point of 归档/恢复零重灌).
 * - A rebuild copies archived sessions WITH content (readSession on archived
 *   sessions is replay-validate, never activates) and flips flags at the end.
 * - Snapshots export active AND archived (flag rides the record); a round
 *   trip preserves the flag.
 *
 * Usage: pnpm vitest run tests/index-archive.spec.ts
 */
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'vitest'
import { SwitchIndexEngine, rebuildIndex, exportSnapshot, parseSnapshot, recoverIndex, DEFAULT_INDEX_LAYOUT } from '../src/index.ts'

function tempDir(label) {
  return mkdtempSync(join(tmpdir(), `switch-archive-${label}-`))
}

function userMessage(seq, text) {
  return { seq, type: 'user/message', time: 1000 + seq, surfaceOp: 'append', data: { content: [{ type: 'text', text }] } }
}

function ingestOne(engine, sessionId, text, version = 1) {
  engine.upsertSession({
    sessionId, version, title: `t-${sessionId}`, cwd: '/w', updatedAt: 10,
    events: [userMessage(0, text)],
  })
}

test('archive: flag flip keeps docs — archived stays searchable in its domain', async () => {
  const engine = new SwitchIndexEngine({ path: join(tempDir('soft'), 'index.sqlite') })
  await engine.open()
  ingestOne(engine, 'a', '琥珀色的内容一')
  ingestOne(engine, 'b', '琥珀色的内容二')
  assert.equal(engine.countSessions(), 2)

  engine.setArchived(new Set(['a']))
  // 合表语义:countSessions 是全语料;归档只是检索域成员资格变化。
  assert.equal(engine.countSessions(), 2, 'the corpus keeps every session')
  assert.equal(engine.countArchived(), 1)
  assert.equal(engine.search({ query: '琥珀', archived: 'active' }).length, 1, 'active domain excludes archived')
  assert.equal(engine.search({ query: '琥珀', archived: 'archived' }).map(h => h.sessionId).join(), 'a', 'archived domain searchable with docs kept')
  assert.equal(engine.search({ query: '琥珀' }).length, 2, "default domain is 'all'")
  assert.equal(engine.listIndexedSessions().length, 2, 'title corpus includes archived rows')
  assert.equal(engine.listIndexedSessions().find(s => s.sessionId === 'a').archived, true)

  const archived = engine.listArchived()
  assert.deepEqual(archived.map(s => s.sessionId), ['a'])
  assert.equal(archived[0].title, 't-a', 'header/title cache survives the flip')
  assert.equal(archived[0].archived, true)
  engine.close()
})

test('archive: un-archive is a pure flip — no version reset, no re-ingest', async () => {
  const engine = new SwitchIndexEngine({ path: join(tempDir('un'), 'index.sqlite') })
  await engine.open()
  ingestOne(engine, 'a', '琥珀内容')
  engine.setArchived(new Set(['a']))
  engine.setArchived(new Set())
  const row = engine.getSession('a')
  assert.equal(row.archived, false)
  assert.equal(row.version, 1, 'version untouched — the next pass will NOT re-read')
  assert.equal(engine.search({ query: '琥珀', archived: 'active' }).length, 1, 'searchable immediately without re-ingest')
  engine.close()
})

test('archive: setArchivedOne flips one row (steward linkage face)', async () => {
  const engine = new SwitchIndexEngine({ path: join(tempDir('one'), 'index.sqlite') })
  await engine.open()
  ingestOne(engine, 'a', '琥珀内容')
  engine.setArchivedOne('a', true)
  assert.equal(engine.getSession('a').archived, true)
  assert.equal(engine.search({ query: '琥珀', archived: 'archived' }).length, 1)
  engine.setArchivedOne('a', false)
  assert.equal(engine.getSession('a').archived, false)
  engine.setArchivedOne('missing-row', true) // no-op on unknown ids
  assert.equal(engine.countArchived(), 0)
  engine.close()
})

test('archive: rebuild ingests archived content too, then flips flags', async () => {
  const dir = tempDir('rebuild')
  const layout = { ...DEFAULT_INDEX_LAYOUT, dir }
  const engine = new SwitchIndexEngine({ path: join(layout.dir, layout.active) })
  await engine.open()
  let archivedRead = 0
  const sessionQuery = {
    listSessions: async () => [
      { header: { id: 'live', version: 1, createdAt: 1, cwd: '/w' } },
      { header: { id: 'gone', version: 2, createdAt: 2, cwd: '/w' } },
    ],
    readSession: async (id) => {
      if (id === 'gone') archivedRead += 1
      return { session: { id, version: 1, createdAt: 1, cwd: '/w' }, events: [userMessage(0, `${id} 的正文内容`)] }
    },
  }
  const state = await rebuildIndex(
    engine, layout, sessionQuery, 2, undefined,
    () => ({ archivedSessionIds: ['gone'] }),
  )
  assert.equal(state.state, 'idle')
  assert.equal(archivedRead, 1, 'archived sessions are read like any other')
  assert.equal(engine.search({ query: 'gone', archived: 'archived' }).length, 1, 'archived content searchable in its domain')
  assert.equal(engine.search({ query: 'live', archived: 'active' }).length, 1)
  assert.equal(engine.listArchived().map(s => s.sessionId).join(), 'gone')
  assert.ok(engine.exportSessionDocs('gone').length > 0, 'rebuild copied docs for the archived session')
  engine.close()
})

test('archive: snapshots carry archived sessions with their flag', async () => {
  const engine = new SwitchIndexEngine({ path: join(tempDir('snap'), 'index.sqlite') })
  await engine.open()
  ingestOne(engine, 'a', '琥珀一')
  ingestOne(engine, 'b', '琥珀二')
  engine.setArchived(new Set(['a']))
  const text = exportSnapshot(engine)
  const parsed = parseSnapshot(text)
  assert.deepEqual(parsed.records.map(r => r.sessionId).sort(), ['a', 'b'], 'export includes archived sessions')
  assert.equal(parsed.records.find(r => r.sessionId === 'a').archived, true, 'flag rides the record')
  assert.equal(parsed.records.find(r => r.sessionId === 'b').archived, false)

  // Round-trip: import restores the flag (importSessionDocs writes it).
  const restored = new SwitchIndexEngine({ path: join(tempDir('snap2'), 'index.sqlite') })
  await restored.open()
  for (const record of parsed.records) {
    restored.importSessionDocs({ ...record, docs: record.docs })
  }
  assert.equal(restored.countArchived(), 1)
  assert.equal(restored.search({ query: '琥珀一', archived: 'archived' }).length, 1)
  restored.close()
  engine.close()
})

test('recovery: stale shadow is discarded when the active index survives', async () => {
  const dir = tempDir('recover-stale')
  const layout = { ...DEFAULT_INDEX_LAYOUT, dir }
  writeFileSync(join(dir, layout.active), 'active')
  writeFileSync(join(dir, layout.building), 'half-built')
  writeFileSync(`${join(dir, layout.building)}-wal`, 'wal')

  const actions = await recoverIndex(layout)
  assert.equal(actions.length, 1)
  assert.match(actions[0], /stale shadow/)
  assert.ok(existsSync(join(dir, layout.active)), 'active untouched')
  assert.ok(!existsSync(join(dir, layout.building)), 'shadow discarded')
  assert.ok(!existsSync(`${join(dir, layout.building)}-wal`), 'shadow wal discarded')
})

test('recovery: crash during the swap window rolls back to the newest archive', async () => {
  const dir = tempDir('recover-swap')
  const layout = { ...DEFAULT_INDEX_LAYOUT, dir }
  // Active already renamed away; newest archive holds the pre-rebuild index.
  writeFileSync(join(dir, `${layout.archivePrefix}111.sqlite`), 'old')
  writeFileSync(join(dir, `${layout.archivePrefix}222.sqlite`), 'newest')
  writeFileSync(join(dir, layout.building), 'half-built')

  const actions = await recoverIndex(layout)
  assert.equal(actions.length, 1)
  assert.match(actions[0], /restored/)
  assert.ok(existsSync(join(dir, layout.active)), 'archive promoted to active')
  assert.equal(readFileSync(join(dir, layout.active), 'utf8'), 'newest', 'newest archive wins')
  assert.ok(!existsSync(join(dir, layout.building)), 'shadow discarded')
})
