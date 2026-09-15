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
import type { SessionHealthReport } from './gates.ts'

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
  if (cache?.level !== 'ok') {
    lines.push(`# 投影缓存未对齐：${cache?.evidence ?? '未知'}`)
    lines.push('# 1) 先隔离陈旧记录，再重启宿主让其重折叠')
    lines.push(`#    POST /session-steward/api/session-health-repair {"sessionId":"${report.sessionId}"}`)
  }

  const cold = gate('cold-read')
  if (cold?.level === 'fail') {
    lines.push('# 会话仍处于 open step：请等待宿主结算（不要硬改日志），必要时重启宿主后重新体检')
  }

  if (lines.length === 0) {
    lines.push('# 四门全绿：无需处置')
  }
  return lines
}

/** 供 UI 提示的 DSH home 描述（不暴露绝对路径以外的敏感信息）。 */
export function describeHome(dshHome?: string): string {
  return dshHome ?? join(homedir(), '.dsh')
}
