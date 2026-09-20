/**
 * 会话管家的中英文案。
 *
 * 硬约束：本文件**不得出现「搜索」二字** —— 搜索/索引属 dsh-search-index 那一片。
 * 文案走 `translate(t, key, params)`，字典由官方 locale 服务注册（缺失时回退内置 zh）。
 */

/** 全部文案 key。 */
export type LocaleKey = keyof typeof zh

/** 简体中文（内置回退字典）。 */
export const zh = {
  'card.title': '会话管家',
  'card.desc': '历史文件 · 健康检查',
  'card.enabled': '启用会话管家',
  'card.enabled.desc': '关闭后不注册任何接口，侧边栏入口整体消失。',
  'card.history': '会话历史文件',
  'card.history.desc': '归档浏览与清理（养老院）。关闭后不注册历史接口、不渲染该页签。',
  'card.health': '健康检查',
  'card.health.desc': '体检 → 处方 → 出院。关闭后不注册体检接口、不渲染该页签。',
  'card.readonly': '当前会话无法修改设置（只读挂载）。',
  'card.unavailable': '设置服务不可用，无法读取配置。',

  'panel.title': '会话管家',
  'panel.tab.history': '养老院',
  'panel.tab.health': '体检',
  'panel.close': '关闭',
  'panel.untitled': '（无标题）',

  'history.loading': '正在读取归档列表…',
  'history.empty': '归档集合为空。',
  'history.edit': '编辑',
  'history.done': '完成',
  'history.selectAll': '全选',
  'history.unselectAll': '取消全选',
  // 两个操作刻意用两个词，不可互换：
  // 「取消归档状态」= 只改归档数组（可逆）；「清理归档文件」= 真删磁盘实体（不可逆）。
  'history.unarchive': '取消归档状态 ({n})',
  'history.unarchiving': '取消归档中…',
  'history.purge': '清理归档文件 ({n}) · 释放 {size}',
  'history.purging': '清理中…',
  'history.editingHint': '编辑模式：勾选会话后二选一 ——「取消归档状态」只把它从官方归档数组移除（可逆，重启后回到侧边栏）；「清理归档文件」真删磁盘上的转录与投影缓存（不可逆）。',
  'history.restartHint': '已从归档数组移除 {removed} 个 id（剩余 {remaining}）。请**立刻重启 DSH**：宿主退出前任何归档或工作区改动都会把整份内存快照写回文件，这次操作会被还原。',
  'history.pendingRestart': '宿主内存里仍有 {n} 个归档未失效：列表已按存储文件显示（这些已不在），但它们对应的会话在重启 DSH 前仍被侧边栏隐藏。',
  'history.count': '共 {n} 条 · 占 {size}',
  'history.size': '转录 {t} · 缓存 {c}',
  'history.sizeUnknown': '磁盘上无实体',
  'history.source.registry': '来源：宿主归档注册表',
  'history.source.storage-file': '来源：存储文件',
  'history.source.none': '两处都读不到归档集合',
  'history.confirmUnarchive': '确认取消这 {n} 个会话的归档状态？\n\n{summary}\n\n只改归档数组（自动备份），磁盘文件不动。重启 DSH 后这些会话回到原工作区。',
  'history.confirmPurge': '确认清理这 {n} 个归档会话的磁盘文件？\n\n{summary}\n\n合计释放约 {size}。\n将删除：转录目录（含旧格式副本）、逐条投影缓存，并从归档数组与工作区成员表中移除。\n\n**此操作不可逆，会话将无法恢复。**',
  'history.purgeResult': '已清理 {purged} 个归档会话，释放 {size}。请重启 DSH 使其彻底消失。',
  'history.purgePartial': '已清理 {purged} 个，释放 {size}；{failed} 个失败（见下方明细）。',
  'history.purgeFailures': '失败明细',

  'health.scan': '开始体检',
  'health.scanning': '体检中…',
  // 分批扫描的进度读数：done/total + 已用秒数（total 由宿主报告的总数给出）
  'health.progress': '{done}/{total} · 已用 {sec}s',
  'health.empty': '未发现异常会话。',
  'health.clean': '全部检查通过。',
  'health.level.ok': '正常',
  'health.level.warn': '注意',
  // 中性档：本门无从判定（如冷态会话无热态投影），不参与 warn 聚合
  'health.level.skipped': '未检查',
  'health.level.fail': '异常',
  // 处置优先级：当前代是从迁移暂存（TMP）发布出来的会话，排在最前
  'health.priority.high': '优先',
  'health.gate.generation': '代次产物',
  'health.gate.log-integrity': '日志完整性',
  'health.gate.projection-cache': '投影缓存',
  'health.gate.lossless-json': '无损 JSON',
  'health.gate.cold-read': '可接续性',
  'health.attribution': '归属',
  'health.field': '字段',
  'health.unknownOwner': '归属未知',
  'health.phase.checkup': '① 体检',
  'health.phase.prescribe': '② 处方',
  'health.phase.discharge': '③ 出院',
  'health.repair': '执行可逆处置',
  'health.repairing': '处置中…',
  'health.before': '处置前',
  'health.after': '处置后',
  'health.quarantined': '已隔离投影缓存记录（重启 DSH 后重折叠）',
  'health.commands': '可执行命令',
  'health.copy': '复制',
  'health.copied': '已复制',
  'health.detail': '查看详情',
  'health.back': '返回列表',

  // 缓存：体检结果在宿主进程内留一份，关面板重开零延迟。
  // 生成时间必须显式露出——旧结果不能冒充刚扫的。
  'health.cache.hint': '结果来自缓存 · {ago}',
  'health.cache.refresh': '刷新',
  'health.cache.corpusChanged': '语料已变化（{was} → {now}），建议刷新',
  'health.ago.justNow': '刚刚',
  'health.ago.minutes': '{n} 分钟前',
  'health.ago.hours': '{n} 小时前',
  'health.ago.days': '{n} 天前',
} as const

/** English dictionary (same keys). */
export const en: Record<LocaleKey, string> = {
  'card.title': 'Session Steward',
  'card.desc': 'History files · Health check',
  'card.enabled': 'Enable Session Steward',
  'card.enabled.desc': 'When off, no API is registered and the sidebar entry disappears.',
  'card.history': 'Session history files',
  'card.history.desc': 'Archive browsing and cleanup (Retirement Home). When off, history routes and the tab are gone.',
  'card.health': 'Health check',
  'card.health.desc': 'Checkup → Prescription → Discharge. When off, health routes and the tab are gone.',
  'card.readonly': 'This session cannot edit settings (read-only mount).',
  'card.unavailable': 'Settings service unavailable; configuration cannot be read.',

  'panel.title': 'Session Steward',
  'panel.tab.history': 'Retirement Home',
  'panel.tab.health': 'Checkup',
  'panel.close': 'Close',
  'panel.untitled': '(untitled)',

  'history.loading': 'Loading archived sessions…',
  'history.empty': 'The archive set is empty.',
  'history.edit': 'Edit',
  'history.done': 'Done',
  'history.selectAll': 'Select all',
  'history.unselectAll': 'Clear selection',
  // Two deliberately distinct verbs — never interchangeable:
  // "unarchive state" edits only the archive array (reversible); "purge archive files" really deletes (irreversible).
  'history.unarchive': 'Unarchive state ({n})',
  'history.unarchiving': 'Unarchiving…',
  'history.purge': 'Purge archive files ({n}) · free {size}',
  'history.purging': 'Purging…',
  'history.editingHint': 'Edit mode: tick sessions, then pick one — "Unarchive state" only removes them from the official archive array (reversible; they return to the sidebar after a restart); "Purge archive files" really deletes the transcript and projection cache from disk (irreversible).',
  'history.restartHint': 'Removed {removed} id(s) from the archive array ({remaining} left). **Restart DSH now**: until the host exits, any archive or workspace change rewrites the whole in-memory snapshot back to the file and undoes this.',
  'history.pendingRestart': '{n} archived id(s) are still live in host memory: the list follows the storage file (they are already gone), but their sessions stay hidden from the sidebar until DSH restarts.',
  'history.count': '{n} total · {size} on disk',
  'history.size': 'transcript {t} · cache {c}',
  'history.sizeUnknown': 'no on-disk entity',
  'history.source.registry': 'Source: host archive registry',
  'history.source.storage-file': 'Source: storage file',
  'history.source.none': 'The archive set is unreadable from both sources',
  'history.confirmUnarchive': 'Unarchive these {n} session(s)?\n\n{summary}\n\nOnly the archive array is edited (auto backup); nothing on disk is touched. After a DSH restart these sessions return to their workspaces.',
  'history.confirmPurge': 'Purge the on-disk files of these {n} archived session(s)?\n\n{summary}\n\nAbout {size} will be freed.\nThis deletes: the transcript directory (including older-format copies) and the per-session projection cache, and removes them from the archive array and the workspace membership tables.\n\n**This cannot be undone — the sessions will be unrecoverable.**',
  'history.purgeResult': 'Purged {purged} archived session(s), freed {size}. Restart DSH to make them disappear completely.',
  'history.purgePartial': 'Purged {purged}, freed {size}; {failed} failed (see details below).',
  'history.purgeFailures': 'Failure details',

  'health.scan': 'Run checkup',
  'health.scanning': 'Running…',
  'health.progress': '{done}/{total} · {sec}s elapsed',
  'health.empty': 'No problem session found.',
  'health.clean': 'All checks passed.',
  'health.level.ok': 'ok',
  'health.level.warn': 'warn',
  'health.level.skipped': 'Not checked',
  'health.level.fail': 'fail',
  'health.priority.high': 'Priority',
  'health.gate.generation': 'Generation artifact',
  'health.gate.log-integrity': 'Log integrity',
  'health.gate.projection-cache': 'Projection cache',
  'health.gate.lossless-json': 'Lossless JSON',
  'health.gate.cold-read': 'Continuability',
  'health.attribution': 'Owner',
  'health.field': 'Field',
  'health.unknownOwner': 'owner unknown',
  'health.phase.checkup': '1) Checkup',
  'health.phase.prescribe': '2) Prescription',
  'health.phase.discharge': '3) Discharge',
  'health.repair': 'Apply reversible repair',
  'health.repairing': 'Repairing…',
  'health.before': 'Before',
  'health.after': 'After',
  'health.quarantined': 'Projection cache quarantined (refolds after a DSH restart)',
  'health.commands': 'Commands',
  'health.copy': 'Copy',
  'health.copied': 'Copied',
  'health.detail': 'Details',
  'health.back': 'Back',

  'health.cache.hint': 'Cached result · {ago}',
  'health.cache.refresh': 'Refresh',
  'health.cache.corpusChanged': 'Corpus changed ({was} → {now}); refresh recommended',
  'health.ago.justNow': 'just now',
  'health.ago.minutes': '{n} min ago',
  'health.ago.hours': '{n} h ago',
  'health.ago.days': '{n} d ago',
}

/** 字典查找（缺 key 时回退到内置 zh，再回退 key 本身）。 */
export function translate(
  t: ((key: LocaleKey, params?: Record<string, unknown>) => string) | undefined,
  key: LocaleKey,
  params?: Record<string, unknown>,
): string {
  if (t !== undefined) {
    try {
      return t(key, params)
    } catch { /* 宿主字典异常时回退 */ }
  }
  return format(zh[key] ?? key, params)
}

/** 极简 `{name}` 替换。 */
function format(template: string, params?: Record<string, unknown>): string {
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ''))
}
