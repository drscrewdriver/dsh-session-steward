/**
 * 交付前预验（只读）：用 built 产物在**真实 DSH home** 上跑一遍健康检查与历史文件读取。
 *
 * 不调用任何写操作（不会触发 session-health-repair / session-history-prune）。
 * 用法：node scripts/preflight.mjs [sessionId]
 */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG, handleMethod, buildProjectionOwnerIndex } from '../lib/index.js'

/** 与 host 侧 defaultProfileNodeModules 相同的解析（预验脚本自持，避免依赖未导出的内部符号）。 */
const defaultProfileNodeModules = (dshHome) => join(dshHome, 'profiles', 'web', 'node_modules')

const home = process.env['DSH_HOME'] ?? join(homedir(), '.dsh')
const sessionId = process.argv[2] ?? 'session-2eda06da-8cc4-4462-a218-63b5cde56b83'

const ownerIndex = buildProjectionOwnerIndex(defaultProfileNodeModules(home))
const byKey = new Map(ownerIndex.map(record => [record.key, record]))

const runtime = {
  config: () => DEFAULT_CONFIG,
  dshHome: home,
  registry: () => undefined,
  // 预验脚本没有宿主进程内存里的 Session，因此热态投影状态不可用 → lossless gate 如实降级为 warn。
  projectionStateFor: () => undefined,
  attribute: (projection) => {
    const owner = byKey.get(projection)
    return owner === undefined ? { projection, package: 'unknown' } : { projection, package: owner.package }
  },
  log: () => {},
}

const status = await handleMethod('session-health-status', {}, runtime)
const history = await handleMethod('session-history-list', {}, runtime)
const scan = await handleMethod('session-health-scan', { limit: 5, onlyProblems: true }, runtime)
const detail = await handleMethod('session-health-session', { sessionId }, runtime)

const brief = (report) => report === undefined ? null : {
  sessionId: report.sessionId,
  level: report.level,
  gates: report.gates.map(gate => ({
    id: gate.id,
    level: gate.level,
    evidence: gate.evidence,
    ...(gate.attribution === undefined ? {} : { attribution: gate.attribution }),
  })),
}

console.log(JSON.stringify({
  home,
  estimatedKeysInOwnerIndex: ownerIndex.length,
  sampleOwners: ['liveTokenStats', 'contextTimeline', 'sessionStats', 'taskDagAgentMetrics']
    .map(key => ({ key, owner: byKey.get(key)?.package ?? 'unknown' })),
  status: { ok: status.ok, switches: status.switches },
  history: { ok: history.ok, source: history.source, count: history.items?.length ?? 0, degraded: history.degraded },
  scan: { ok: scan.ok, scanned: scan.scanned, findings: scan.findings?.length ?? 0, levels: scan.findings?.map(f => `${f.sessionId.slice(8, 16)}:${f.level}`) },
  detail: brief(detail.report),
  prescriptions: detail.prescriptions,
}, null, 2))
