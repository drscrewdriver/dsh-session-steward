import { deflateSync, zstdCompressSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { decodeSessionLogBytes, decodeSeqRangesStorage, decodeRecordLocal, findOpenStep, scanZstdFrames } from '../src/host/health/decode.ts'

/** 把若干 JSONL 行合成多个 zstd 帧（模拟「头帧 + 追加帧」的物理布局）。 */
function multiFrame(lines: string[][]): Buffer {
  return Buffer.concat(lines.map(batch => zstdCompressSync(Buffer.from(`${batch.join('\n')}\n`, 'utf8'))))
}

const HEADER = JSON.stringify({ type: 'session', version: 0, id: 'session-test', createdAt: 1, cwd: 'C:/tmp' })

describe('zstd 多帧扫描', () => {
  it('识别全部完整帧', () => {
    const buffer = multiFrame([[HEADER], ['{"type":"a","seq":0}'], ['{"type":"b","seq":1}']])
    const { frames, tornStart } = scanZstdFrames(buffer)
    expect(frames).toHaveLength(3)
    expect(tornStart).toBeUndefined()
  })

  it('尾部残缺帧被识别为 tornStart', () => {
    const whole = zstdCompressSync(Buffer.from('{"type":"a","seq":0}\n', 'utf8'))
    const truncated = whole.subarray(0, Math.max(8, whole.length - 6))
    const { frames, tornStart } = scanZstdFrames(truncated)
    expect(frames).toHaveLength(0)
    expect(tornStart).toBe(0)
  })
})

describe('provenance 存储形态解码', () => {
  it('区间编码展开为递增 seq 列表', () => {
    expect(decodeSeqRangesStorage([[0, 3]], 10)).toEqual([0, 1, 2, 3])
  })

  it('直接 seq 数组原样通过', () => {
    expect(decodeSeqRangesStorage([0, 2, 4], 10)).toEqual([0, 2, 4])
  })

  it('引用自身或未来事件被拒绝', () => {
    expect(() => decodeSeqRangesStorage([9], 9)).toThrow()
    expect(() => decodeSeqRangesStorage({}, 9)).toThrow()
  })
})

describe('打包行解包', () => {
  it('text-chunks 展开为 assistant/chunk（时间按 dt 累加，成员数 = dt+1）', () => {
    const events = decodeRecordLocal({
      type: 'text-chunks',
      seq0: 5,
      time0: 100,
      data: { turn: 1, step: 2, index: 0, dt: [10, 5], texts: ['a', 'b', 'c'] },
    })
    expect(events).toHaveLength(3)
    expect(events.map(event => event.seq)).toEqual([5, 6, 7])
    expect(events.map(event => event.time)).toEqual([100, 110, 115])
    expect(events[0]?.data?.['chunk']).toMatchObject({ type: 'text-delta', text: 'a' })
  })

  it('tool-call-chunks 展开为 tool-call-delta 且携带 name', () => {
    const events = decodeRecordLocal({
      type: 'tool-call-chunks',
      seq0: 0,
      time0: 1,
      data: { turn: 1, step: 1, index: 0, id: 'call-1', name: 'read', dt: [1], args: ['{', '}'] },
    })
    expect(events[1]?.data?.['chunk']).toMatchObject({ type: 'tool-call-delta', id: 'call-1', name: 'read', argumentsDelta: '}' })
  })

  it('dt 长度与成员数不匹配时抛错（不静默吞掉）', () => {
    expect(() => decodeRecordLocal({
      type: 'reasoning-chunks',
      seq0: 0,
      time0: 1,
      data: { turn: 1, step: 1, index: 0, dt: [1, 1], texts: ['only-one'] },
    })).toThrow()
  })
})

describe('整条日志读取链路', () => {
  it('多帧 + 打包行 + provenance 端到端解码，seq 连续', () => {
    const rows = [
      [HEADER, '{"type":"permission/preset","seq":0,"time":1,"data":{"preset":"workspace-write"}}'],
      [
        '{"type":"turn/start","seq":1,"time":2,"data":{"turn":1}}',
        '{"type":"step/start","seq":2,"time":3,"data":{"turn":1,"step":1}}',
        '{"type":"user/message","seq":3,"time":4,"data":{"content":[]},"sourceEventSeqs":[[1,2]]}',
        JSON.stringify({ type: 'text-chunks', seq0: 4, time0: 5, data: { turn: 1, step: 1, index: 0, dt: [1], texts: ['hi', ' there'] } }),
      ],
      [
        '{"type":"step/end","seq":6,"time":9,"data":{"turn":1,"step":1}}',
        '{"type":"turn/end","seq":7,"time":10,"data":{"turn":1,"reason":{"kind":"interrupted"}}}',
        '{"type":"session/end-seed","seq":8,"time":11,"data":{}}',
      ],
    ]
    const read = decodeSessionLogBytes('memory', multiFrame(rows))
    expect(read.issues).toEqual([])
    expect(read.decoder).toBe('local')
    expect(read.events.map(event => event.seq)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    // provenance 已展开为递减可用的 seq 列表
    expect(read.events[3]?.sourceEventSeqs).toEqual([1, 2])
    // 打包行被展开为两个 assistant/chunk
    expect(read.events.filter(event => event.type === 'assistant/chunk')).toHaveLength(2)
    // 尾部事实：最后一轮 interrupted
    expect(read.events.at(-1)?.type).toBe('session/end-seed')
    expect(findOpenStep(read.events)).toBeUndefined()
  })

  it('seq 缺口被如实报告并截断到缺口前', () => {
    const rows = [[
      HEADER,
      '{"type":"a","seq":0,"time":1,"data":{}}',
      '{"type":"b","seq":5,"time":2,"data":{}}',
    ]]
    const read = decodeSessionLogBytes('memory', multiFrame(rows))
    expect(read.events).toHaveLength(1)
    expect(read.issues[0]?.why).toContain('seq gap')
  })

  it('撕裂尾帧可抢救时不报读取错误，只标注 tornStart', () => {
    const head = zstdCompressSync(Buffer.from(`${HEADER}\n{"type":"a","seq":0,"time":1,"data":{}}\n`, 'utf8'))
    const tail = zstdCompressSync(Buffer.from('{"type":"b","seq":1,"time":2,"data":{}}\n', 'utf8'))
    const torn = Buffer.concat([head, tail.subarray(0, tail.length - 5)])
    const read = decodeSessionLogBytes('memory', torn)
    expect(read.frames).toBe(1)
    expect(read.tornStart).toBe(head.length)
    expect(read.events).toHaveLength(1)
  })

  it('探测到开放 step（step/start 无 step/end）', () => {
    const rows = [[
      HEADER,
      '{"type":"step/start","seq":0,"time":1,"data":{"turn":1,"step":1}}',
    ]]
    const read = decodeSessionLogBytes('memory', multiFrame(rows))
    expect(read.openStep).toEqual({ turn: 1, step: 1 })
  })
})

describe('非 zstd 输入不抛错（防御性）', () => {
  it('乱码 buffer 视为无完整帧', () => {
    const { frames } = scanZstdFrames(deflateSync(Buffer.from('not zstd at all')))
    expect(frames).toHaveLength(0)
  })
})
