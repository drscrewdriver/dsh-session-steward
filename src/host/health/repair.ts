/**
 * 处方（repair）：**只做三件可逆的事**，且每一件都先备份/可回退。
 *
 * 1. 隔离损坏的投影缓存记录（移动到 `.quarantine-<ts>`）→ 提示重启宿主重折叠；
 * 2. 对含未结算 step 的会话，提示「等待宿主结算」而不是硬改（本模块不提供该动作）；
 * 3. 输出可执行命令清单，交给用户手工执行。
 *
 * 红线：禁止改写会话日志、禁止改历史数据、禁止静默丢弃字段。
 */
import { copyFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { GateLevel, SessionHealthReport } from './gates.ts'

/**
 * 该门是否构成「可处置的异常」。
 *
 * 判定标准与 gates.ts 的 GateLevel 文档一致：
 *   `warn` / `fail` = **观测到了**异常现象（有据）→ 可开处方；
 *   `skipped`       = 无从观测/无从判定（无据）→ 不开方。
 *
 * 早期版本用 `level !== 'ok'` 判断，把 `skipped` 也算成异常，导致对着
 * 「本门无从判定」的证据输出「投影缓存未对齐」，并建议隔离一条不存在的记录。
 */
function isActionable(level: GateLevel | undefined): boolean {
  return level === 'warn' || level === 'fail'
}

/** 可逆处置的结果。 */
export interface RepairOutcome {
  ok: boolean
  action: 'quarantine-projection-cache'
  sessionId: string
  /** 原路径。 */
  from: string
  /** 隔离后的路径（即备份）。 */
  to?: string
  /** 需要用户执行的动作说明。 */
  requiresRestart?: boolean
  error?: string
}

/** 投影缓存记录路径。 */
export function projectionCachePath(sessionId: string, dshHome?: string): string {
  return join(dshHome ?? join(homedir(), '.dsh'), 'storages', 'session_projcache', 'sessions', `${sessionId}.json`)
}

/**
 * 隔离一个会话的投影缓存记录（备份 = 移动本身，可原样搬回）。
 * @param sessionId - 会话 id。
 * @param dshHome - DSH home（缺省 ~/.dsh）。
 * @param now - 时间源（测试可控）。
 */
export function quarantineProjectionCache(
  sessionId: string,
  dshHome?: string,
  now: () => number = Date.now,
): RepairOutcome {
  const from = projectionCachePath(sessionId, dshHome)
  if (!existsSync(from)) {
    return { ok: false, action: 'quarantine-projection-cache', sessionId, from, error: '投影缓存记录不存在，无需隔离' }
  }
  const to = `${from}.quarantine-${now()}`
  try {
    mkdirSync(dirname(from), { recursive: true })
    // 先复制一份，再移动，确保任何中断下都留有可回退副本。
    copyFileSync(from, `${to}.copy`)
    renameSync(from, to)
    return {
      ok: true,
      action: 'quarantine-projection-cache',
      sessionId,
      from,
      to,
      requiresRestart: true,
    }
  } catch (err) {
    return {
      ok: false,
      action: 'quarantine-projection-cache',
      sessionId,
      from,
      error: String(err instanceof Error ? err.message : err),
    }
  }
}

/**
 * 依据体检报告给出「处方」（命令清单）。
 * @param report - 体检报告。
 * @param dshHome - DSH home（用于生成路径提示）。
 * @returns 可复制执行的命令与人读说明。
 */
export function prescribe(report: SessionHealthReport, dshHome?: string): string[] {
  const lines: string[] = []
  const gate = (id: SessionHealthReport['gates'][number]['id']): SessionHealthReport['gates'][number] | undefined =>
    report.gates.find(entry => entry.id === id)

  const generation = gate('generation')
  if (generation?.level === 'fail' || generation?.level === 'warn') {
    lines.push(`# 代次异常：${generation.evidence}`)
    // 处方文本只讲判据，不写死具体代次：当前代由目录实测得出（detail.currentVersion）。
    // 写死 `v3` 正是本插件此前「版本适配落后」的形态。
    const currentVersion = generation.detail?.['currentVersion']
    lines.push(typeof currentVersion === 'number'
      ? `# 当前代 v${currentVersion}：本插件不改会话日志，暂存残留的发布/隔离需用会话代次工具处理`
      : '# 目录内只有迁移暂存、还没有规范产物：需先用会话代次工具发布当前代，或重启宿主触发发布')
    if (report.priority === 'high') {
      lines.push('# 该会话优先级为 high（当前代由暂存发布而来），建议先处置它')
    }
  }

  const lossless = gate('lossless-json')
  if (lossless?.level === 'fail') {
    const pkg = lossless.attribution?.package ?? 'unknown'
    const field = lossless.attribution?.field ?? '?'
    const projection = lossless.attribution?.projection ?? '?'
    lines.push(`# 病根：投影 ${projection} 的 ${field} 不是无损 JSON（归属：${pkg}）`)
    if (pkg !== 'unknown' && pkg !== 'core') {
      lines.push(`# 1) 停用或升级产出方插件（消除 undefined 产出）：${pkg}`)
      lines.push(`dsh plugin --profile web remove ${pkg}`)
    } else if (pkg === 'core') {
      lines.push('# 1) 产出方是内置包，请升级 DSH 本体后在 issue 中附上体检报告')
    } else {
      lines.push('# 1) 归属未知：请人工核对宿主日志里 "not lossless JSON" 前的投影 key')
    }
    lines.push('# 2) 隔离陈旧投影缓存记录（可逆，会提示重启宿主重折叠）')
    lines.push(`#    POST /session-steward/api/session-health-repair {"sessionId":"${report.sessionId}"}`)
    lines.push('# 3) 重启宿主后重跑体检，确认 lossless-json 转 ok')
    return lines
  }

  const cache = gate('projection-cache')
  if (isActionable(cache?.level)) {
    lines.push(`# 投影缓存异常：${cache?.evidence ?? '未知'}`)
    lines.push('# 1) 先隔离陈旧记录，再重启宿主让其重折叠')
    lines.push(`#    POST /session-steward/api/session-health-repair {"sessionId":"${report.sessionId}"}`)
  }

  const cold = gate('cold-read')
  if (cold?.level === 'fail') {
    lines.push('# 会话仍处于 open step：请等待宿主结算（不要硬改日志），必要时重启宿主后重新体检')
  }

  if (lines.length === 0) {
    // 「无从判定」不是「全绿」：把 skipped 的门如实列出，避免用户以为都检查过了。
    const unjudged = report.gates.filter(entry => entry.level === 'skipped')
    lines.push(unjudged.length === 0
      ? '# 全部检查通过：无需处置'
      : `# 无可处置项（${unjudged.length} 门无从判定，非异常）：${unjudged.map(entry => entry.id).join(' / ')}`)
  }
  return lines
}

/** 供 UI 提示的 DSH home 描述（不暴露绝对路径以外的敏感信息）。 */
export function describeHome(dshHome?: string): string {
  return dshHome ?? join(homedir(), '.dsh')
}

/** 处置结果的定性分类。 */
export type RepairVerdict =
  /** 全部检查通过，没有要做的事。 */
  | 'nothing-to-do'
  /** 处置生效且异常已消除。 */
  | 'repaired'
  /** 处置生效，但仍有与投影缓存无关的异常（如会话日志的 open step）。 */
  | 'repaired-with-residual'
  /** 没有任何可逆处置项能命中当前异常。 */
  | 'not-applicable'
  /** 处置本身执行失败。 */
  | 'failed'

/** 处置结果的判定。 */
export interface RepairAssessment {
  verdict: RepairVerdict
  /** 人读说明：直接展示给用户，解释「为什么处置后还是异常/已恢复」。 */
  explanation: string
  /** 处置后仍未解决的门（可处置档位）。 */
  residual: { id: string; level: GateLevel }[]
}

/** 残留门的可读归因：区分「本插件有能力处置」与「按红线只能等 / 交给别的工具」。 */
function residualNote(residual: { id: string }[]): string {
  if (residual.some(entry => entry.id === 'generation')) {
    return '其中 generation 来自会话目录的代次产物（暂存残留或当前代尚未发布），' +
      '本插件不改会话日志，需用会话代次工具处置。'
  }
  return '这类异常来自会话日志或宿主运行态，本插件不改会话日志，请等待宿主结算后重新体检。'
}

/**
 * 判定一次处置的结果，并给出人读说明。
 *
 * 存在的理由：处置**只**隔离投影缓存记录，而会话的异常可能来自别处
 * （最典型是 `cold-read` 的 open step——插件红线不改会话日志，这类异常
 * 本就不该由处置修复）。旧版 UI 只显示 `处置前/处置后` 两个档位，
 * 两者都是「异常」时用户无法判断是处置失败还是处置与病灶无关。
 *
 * @param input - 处置前后的报告与处置执行结果。
 */
export function assessRepair(input: {
  before: SessionHealthReport
  after: SessionHealthReport
  repair: RepairOutcome
}): RepairAssessment {
  const { before, after, repair } = input
  const residual = after.gates
    .filter(entry => entry.level === 'warn' || entry.level === 'fail')
    .map(entry => ({ id: entry.id, level: entry.level }))
  const residualIds = residual.map(entry => entry.id).join(' / ')

  if (before.level === 'ok') {
    return { verdict: 'nothing-to-do', explanation: '全部检查通过，无需处置', residual: [] }
  }

  if (repair.ok) {
    return residual.length === 0
      ? { verdict: 'repaired', explanation: '处置生效：已隔离投影缓存记录，体检结果已恢复', residual: [] }
      : {
          verdict: 'repaired-with-residual',
          explanation: `已隔离投影缓存记录；但仍有与该缓存无关的异常：${residualIds}。${residualNote(residual)}`,
          residual,
        }
  }

  // 处置未能执行：先判断当前异常里到底有没有可处置项。
  const cacheGate = before.gates.find(entry => entry.id === 'projection-cache')
  if (!isActionable(cacheGate?.level)) {
    return {
      verdict: 'not-applicable',
      explanation: residualIds === ''
        ? '当前异常无可逆处置项'
        : `当前异常无可逆处置项（投影缓存无可隔离记录）；异常来自 ${residualIds}，${residualNote(residual)}`,
      residual,
    }
  }
  return { verdict: 'failed', explanation: `处置失败：${repair.error ?? '未知原因'}`, residual }
}
