// @ts-nocheck — beta.5 标题修复的回归用例
/**
 * 标题的两层供给 + 文件兜底(beta.4 两个实测 bug 的回归锁):
 * - beta.4 bug 1:readTitleSnapshots 整批一坏全坏 → 标题全军覆没。
 *   修复 = 事件流基础层(extractTitleFromEvents)+ 分块逐 id 隔离的精修层。
 * - beta.4 bug 2:归档会话内容缺失。修复 = readSession 失败落文件兜底 +
 *   归档覆盖循环(listSessions 不含归档时显式补行)。
 */
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'vitest'
import { SwitchIndexEngine, SwitchWatermarkSync, extractTitleFromEvents } from '../src/index.ts'

function tempDir(label) {
  return mkdtempSync(join(tmpdir(), `switch-title-${label}-`))
}

function userMessage(seq, text) {
  return { seq, type: 'user/message', time: 1000 + seq, surfaceOp: 'append', data: { content: [{ type: 'text', text }] } }
}

test('extractTitleFromEvents: 三种历史形状 + 最后一帧胜出', () => {
  assert.equal(extractTitleFromEvents([
    { seq: 0, type: 'user/message', data: {} },
    { seq: 1, type: 'session/title', data: { title: '第一版' } },
    { seq: 2, type: 'session/title', data: { title: { title: '第二版' } } },
    { seq: 3, type: 'session/title', data: { title: { val: '第三版' } } },
  ]), '第三版')
  assert.equal(extractTitleFromEvents([{ seq: 0, type: 'session/title', data: { title: '  ' } }]), '')
  assert.equal(extractTitleFromEvents([{ seq: 0, type: 'user/message', data: {} }]), '')
})

function makeEngine() {
  const engine = new SwitchIndexEngine({ path: join(tempDir('db'), 'index.sqlite') })
  return engine
}

test('readTitleSnapshots 整批炸掉时,标题仍来自事件流基础层', async () => {
  const engine = makeEngine()
  await engine.open()
  const sync = new SwitchWatermarkSync(engine, {
    listSessions: async () => [
      { header: { id: 'a', version: 1, createdAt: 10, cwd: '/w' } },
      { header: { id: 'b', version: 1, createdAt: 11, cwd: '/w' } },
    ],
    readSession: async (id) => ({
      session: { id, version: 1, createdAt: 10, cwd: '/w' },
      events: [
        userMessage(0, `${id} 的正文`),
        { seq: 1, type: 'session/title', data: { title: `标题-${id}` } },
      ],
    }),
    // beta.4 现场:归档 id 混入批次,整批 reject。
    readTitleSnapshots: async () => { throw new Error('readTitleSnapshots exploded') },
  }, () => ({ archivedSessionIds: [] }), () => {})
  const state = await sync.poll()
  assert.equal(state.failures.length, 0)
  assert.equal(engine.getSession('a').title, '标题-a', 'title survives via the event-stream base layer')
  assert.equal(engine.getSession('b').title, '标题-b')
  engine.close()
})

test('归档会话 listSessions 不含时,覆盖循环显式补行(内容不缺)', async () => {
  const engine = makeEngine()
  await engine.open()
  const sync = new SwitchWatermarkSync(engine, {
    // 某些宿主线:归档被 listSessions 过滤。
    listSessions: async () => [{ header: { id: 'live', version: 1, createdAt: 10, cwd: '/w' } }],
    readSession: async (id) => ({
      session: { id, version: 1, createdAt: 5, cwd: '/archived' },
      events: [
        userMessage(0, '归档会话的琥珀正文'),
        { seq: 1, type: 'session/title', data: { title: '归档标题' } },
      ],
    }),
  }, () => ({ archivedSessionIds: ['arch-1'] }), () => {})
  const state = await sync.poll()
  assert.equal(state.failures.length, 0)
  const row = engine.getSession('arch-1')
  assert.ok(row !== undefined, 'archived row explicitly backfilled')
  assert.equal(row.archived, true)
  assert.equal(row.title, '归档标题', 'archived title folds from events')
  assert.equal(engine.search({ query: '琥珀', archived: 'archived' }).length, 1, 'archived content searchable')
  engine.close()
})

test('readSession 失败时文件兜底接管(索引行仍建成)', async () => {
  const engine = makeEngine()
  await engine.open()
  const sync = new SwitchWatermarkSync(engine, {
    listSessions: async () => [{ header: { id: 'arch-2', version: 7, createdAt: 9, cwd: '/w' } }],
    readSession: async () => { throw new Error('service face refuses archived reads') },
  }, () => ({ archivedSessionIds: ['arch-2'] }), () => {}, async (id) => ({
    session: { id, version: 7, createdAt: 9, cwd: '/w' },
    events: [userMessage(0, '文件兜底读到的正文'), { seq: 1, type: 'session/title', data: { title: '兜底标题' } }],
  }))
  const state = await sync.poll()
  assert.equal(state.failures.length, 0)
  const row = engine.getSession('arch-2')
  assert.ok(row !== undefined)
  assert.equal(row.version, 7, 'watermark pinned from the corpus header, not the file')
  assert.equal(row.title, '兜底标题')
  assert.equal(engine.search({ query: '兜底读到的正文', archived: 'archived' }).length, 1)
  engine.close()
})
