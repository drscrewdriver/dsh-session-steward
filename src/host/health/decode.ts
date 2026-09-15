/**
 * 会话日志读取链路（`log-integrity` gate 与 `lossless-json` gate 的共同底座）。
 *
 * 链路与 `_tools/dsh-session-invariant-repro.mjs` 的 `decodeSessionLog` 一致：
 *   zstd 多帧扫描（撕裂尾帧用 ZSTD_e_flush 抢救）→ 逐行 JSON.parse
 *   → provenance 展开（storage 形态的 seq ranges）→ `decodeStorageRecord` 解包
 *   （`text-chunks` / `reasoning-chunks` / `tool-call-chunks` 展开回 `assistant/chunk`）
 *   → seq 连续性校验（提交区出现缺口即停止并按 prefix 语义处理）。
 *
 * 解码器优先使用宿主真实的 `@deepseek-ai/dsh-session`（运行时按需软加载，零硬依赖）；
 * 不可用时使用本文件内的等价实现（同格式：dt 为**时间**增量、成员数 = dt.length + 1；
 * provenance 存储形态为 `[[start,end],…]` 区间编码）。二者的差异会被显式记入
 * `decoder` 字段，禁止静默回退。
 */
import { readFileSync } from 'node:fs'
import zlib from 'node:zlib'

/** zstd 帧魔数（0xFD2FB528 的小端读取值）。 */
const ZSTD_MAGIC = 4247762216

/** 打包行类型（读路径必须解包）。 */
const PACKED_ROWS = new Set(['text-chunks', 'reasoning-chunks', 'tool-call-chunks'])

/** 一次读取的统计与问题清单。 */
export interface SessionLogRead {
  events: DecodedEvent[]
  /** 完整帧数。 */
  frames: number
  /** 撕裂尾帧起始偏移（无撕裂为 undefined）。 */
  tornStart?: number
  /** 从撕裂尾帧抢救出的明文字节数。 */
  recoveredFromTorn: number
  /** 读取问题（解码失败/seq 缺口），按遇到顺序。 */
  issues: { line: number; why: string }[]
  /** 实际使用的解码器来源。 */
  decoder: 'official' | 'local'
  /** 尾部是否仍有未收尾的 open step。 */
  openStep?: { turn: number; step: number }
}

/** 解码后的事件（结构子集）。 */
export interface DecodedEvent {
  type: string
  seq: number
  time: number
  data?: Record<string, unknown>
  surfaceOp?: 'append' | { op: 'replace'; start: number; end: number }
  sourceEventSeqs?: number[]
}

/** 扫描拼接的 zstd 多帧；返回完整帧范围与撕裂尾帧起点。 */
export function scanZstdFrames(buffer: Buffer): {
  frames: { start: number; end: number }[]
  tornStart?: number
} {
  const frames: { start: number; end: number }[] = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) return { frames, tornStart: start }
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) return { frames, tornStart: start }
    offset += 4
    if (offset === buffer.length) return { frames, tornStart: start }
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    if ((descriptor & 24) !== 0) return { frames, tornStart: start }
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 32) !== 0
    const checksum = (descriptor & 4) !== 0
    const dictionaryFlag = descriptor & 3
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag
    const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    if (buffer.length - offset < remainingHeaderBytes) return { frames, tornStart: start }
    offset += remainingHeaderBytes
    for (;;) {
      if (buffer.length - offset < 3) return { frames, tornStart: start }
      const blockHeader = buffer.readUIntLE(offset, 3)
      offset += 3
      const lastBlock = (blockHeader & 1) !== 0
      const blockType = (blockHeader >>> 1) & 3
      const blockSize = blockHeader >>> 3
      if (blockType === 3) return { frames, tornStart: start }
      const payloadBytes = blockType === 1 ? 1 : blockSize
      if (buffer.length - offset < payloadBytes) return { frames, tornStart: start }
      offset += payloadBytes
      if (lastBlock) break
    }
    if (checksum) {
      if (buffer.length - offset < 4) return { frames, tornStart: start }
      offset += 4
    }
    frames.push({ start, end: offset })
  }
  return { frames }
}

/** 存储形态的 provenance（`[[start,end],…]` 区间编码或直接 seq 数组）展开为递增 seq 列表。 */
export function decodeSeqRangesStorage(value: unknown, currentSeq: number): number[] {
  if (!Array.isArray(value)) throw new Error('sourceEventSeqs must be an array when present')
  const out: number[] = []
  for (const entry of value) {
    if (typeof entry === 'number') {
      out.push(entry)
      continue
    }
    if (Array.isArray(entry) && entry.length === 2) {
      const [start, end] = entry as [unknown, unknown]
      if (typeof start !== 'number' || typeof end !== 'number' || end < start) {
        throw new Error('sourceEventSeqs range is malformed')
      }
      for (let seq = start; seq <= end; seq += 1) out.push(seq)
      continue
    }
    throw new Error('sourceEventSeqs entry is neither a seq nor a [start,end] range')
  }
  for (const seq of out) {
    if (!Number.isSafeInteger(seq) || seq < 0 || seq >= currentSeq) {
      throw new Error(`sourceEventSeqs must reference earlier events: ${seq} >= ${currentSeq}`)
    }
  }
  return out
}

/** 官方解码器面（软加载所得）。 */
export interface OfficialDecoders {
  decodeStorageRecord(value: unknown): DecodedEvent[]
  decodeSeqRanges(value: unknown, seq: number): number[]
}

/**
 * 按需软加载宿主的官方解码器；不可用（未安装/版本不符）时返回 undefined。
 * 插件不 value-import 官方包，这里只做运行时可选加载。
 */
export async function loadOfficialDecoders(): Promise<OfficialDecoders | undefined> {
  try {
    const mod = await import(/* @vite-ignore */ '@deepseek-ai/dsh-session') as unknown as {
      decodeStorageRecord?: (value: unknown) => DecodedEvent[]
      decodeSeqRanges?: (value: unknown, seq: number) => number[]
    }
    if (typeof mod.decodeStorageRecord !== 'function' || typeof mod.decodeSeqRanges !== 'function') return undefined
    return {
      decodeStorageRecord: mod.decodeStorageRecord,
      decodeSeqRanges: mod.decodeSeqRanges,
    }
  } catch {
    return undefined
  }
}

/** 本地等价实现：把一行存储记录解包为事件（打包行展开为 assistant/chunk）。 */
export function decodeRecordLocal(value: unknown): DecodedEvent[] {
  if (typeof value !== 'object' || value === null) return [value as DecodedEvent]
  const record = value as Record<string, unknown>
  const type = record['type']
  if (typeof type !== 'string' || !PACKED_ROWS.has(type)) {
    const seq = record['seq']
    if (typeof seq === 'number' && (!Number.isSafeInteger(seq) || seq < 0)) {
      throw new Error(`session event seq ${String(seq)} is not a non-negative safe integer`)
    }
    return [record as unknown as DecodedEvent]
  }
  const data = record['data'] as Record<string, unknown> | undefined
  if (data === undefined) throw new Error(`malformed ${type} storage row: data must be an object`)
  const members = type === 'tool-call-chunks' ? data['args'] : data['texts']
  if (!Array.isArray(members) || members.length === 0 || members.some(entry => typeof entry !== 'string')) {
    throw new Error(`malformed ${type} storage row: payload must be a non-empty string array`)
  }
  const dt = data['dt']
  if (!Array.isArray(dt) || dt.some(gap => !Number.isSafeInteger(gap))) {
    throw new Error(`malformed ${type} storage row: dt must be an array of safe integers`)
  }
  if (dt.length !== members.length - 1) {
    throw new Error(`malformed ${type} storage row: dt length ${dt.length} does not match ${members.length} members`)
  }
  const seq0 = record['seq0']
  const time0 = record['time0']
  if (typeof seq0 !== 'number' || typeof time0 !== 'number') {
    throw new Error(`malformed ${type} storage row: seq0/time0 must be numbers`)
  }
  const turn = data['turn']
  const step = data['step']
  const index = data['index']
  const out: DecodedEvent[] = []
  let time = time0
  for (let k = 0; k < members.length; k += 1) {
    if (k > 0) time += dt[k - 1] as number
    let chunk: Record<string, unknown>
    if (type === 'text-chunks') chunk = { type: 'text-delta', index, text: members[k] }
    else if (type === 'reasoning-chunks') chunk = { type: 'reasoning-delta', index, text: members[k] }
    else {
      chunk = {
        type: 'tool-call-delta',
        index,
        id: typeof data['id'] === 'string' ? data['id'] : '',
        ...(typeof data['name'] === 'string' ? { name: data['name'] } : {}),
        argumentsDelta: members[k],
      }
    }
    out.push({
      type: 'assistant/chunk',
      seq: seq0 + k,
      time,
      data: { turn, step, chunk },
    })
  }
  return out
}

/**
 * 读取一个会话日志文件（zip 帧扫描 + 解包 + seq 连续性）。
 * @param file - `session.jsonl.zstd` 绝对路径。
 * @param bytes - 文件内容（调用方读取，便于测试注入）。
 * @param decoders - 可选官方解码器（缺省用本地等价实现）。
 * @returns 事件、统计与问题清单。
 */
export function decodeSessionLogBytes(
  file: string,
  bytes: Buffer,
  decoders?: OfficialDecoders,
): SessionLogRead {
  const { frames, tornStart } = scanZstdFrames(bytes)
  const parts: Buffer[] = []
  const frameIssues: string[] = []
  for (const frame of frames) {
    try {
      parts.push(zlib.zstdDecompressSync(bytes.subarray(frame.start, frame.end)))
    } catch (err) {
      frameIssues.push(`frame@${frame.start}: ${String(err instanceof Error ? err.message : err)}`)
    }
  }
  let recoveredFromTorn = 0
  if (tornStart !== undefined) {
    try {
      const recovered = zlib.zstdDecompressSync(bytes.subarray(tornStart), {
        finishFlush: zlib.constants.ZSTD_e_flush,
      })
      recoveredFromTorn = recovered.length
      parts.push(recovered)
    } catch { /* 撕裂帧完全不可抢救 */ }
  }
  const text = Buffer.concat(parts).toString('utf8')
  const lines = text.split('\n').filter(line => line.trim() !== '')
  const issues: { line: number; why: string }[] = frameIssues.map((why, index) => ({ line: index + 1, why }))
  const decodeRecord = decoders?.decodeStorageRecord ?? decodeRecordLocal
  const events: DecodedEvent[] = []
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index] as string
    let decoded: DecodedEvent[]
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>
      const withProvenance = parsed['sourceEventSeqs'] === undefined
        ? parsed
        : {
            ...parsed,
            sourceEventSeqs: decoders?.decodeSeqRanges !== undefined && typeof parsed['seq'] === 'number'
              ? decoders.decodeSeqRanges(parsed['sourceEventSeqs'], parsed['seq'])
              : decodeSeqRangesStorage(parsed['sourceEventSeqs'], Number(parsed['seq'] ?? 0)),
          }
      decoded = decodeRecord(withProvenance)
    } catch (err) {
      issues.push({ line: index + 1, why: `decode failed: ${String(err instanceof Error ? err.message : err)}` })
      break
    }
    const rowStart = events.length
    let gapped = false
    for (const event of decoded) {
      if (event.seq !== events.length) {
        issues.push({ line: index + 1, why: `seq gap (expected ${events.length}, got ${event.seq})` })
        events.length = rowStart
        gapped = true
        break
      }
      events.push(event)
    }
    if (gapped) break
  }
  const openStep = findOpenStep(events)
  return {
    events,
    frames: frames.length,
    ...(tornStart === undefined ? {} : { tornStart }),
    recoveredFromTorn,
    issues,
    decoder: decoders === undefined ? 'local' : 'official',
    ...(openStep === undefined ? {} : { openStep }),
  }
}

/** 从文件读取并解码。 */
export function decodeSessionLogFile(file: string, decoders?: OfficialDecoders): SessionLogRead {
  return decodeSessionLogBytes(file, readFileSync(file), decoders)
}

/** 尾部未收尾的 open step（有 step/start 无对应 step/end）。 */
export function findOpenStep(events: readonly DecodedEvent[]): { turn: number; step: number } | undefined {
  let open: { turn: number; step: number } | undefined
  for (const event of events) {
    const data = event.data as { turn?: unknown; step?: unknown } | undefined
    if (event.type === 'step/start' && typeof data?.turn === 'number' && typeof data?.step === 'number') {
      open = { turn: data.turn, step: data.step }
      continue
    }
    if (event.type === 'step/end') open = undefined
  }
  return open
}
