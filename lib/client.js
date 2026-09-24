window.__ModuleLoader__.load({
	id: "dsh-session-steward",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom = require("react-dom");
		//#region src/config.ts
		/** 缺省值。 */
		const DEFAULT_CONFIG = {
			enabled: true,
			historyFiles: true,
			healthCheck: true
		};
		/** host 半身注册的设置命名空间（与 src/index.ts 保持一致）。 */
		const STEWARD_SETTINGS_NAMESPACE = "session-steward";
		/** 侧边栏入口 id（客户端注册 id）。 */
		const STEWARD_ENTRY_ID = "dsh-session-steward";
		//#endregion
		//#region src/client/locales.ts
		/** 简体中文（内置回退字典）。 */
		const zh = {
			"card.title": "会话管家",
			"card.desc": "历史文件 · 健康检查",
			"card.enabled": "启用会话管家",
			"card.enabled.desc": "关闭后不注册任何接口，侧边栏入口整体消失。",
			"card.history": "会话历史文件",
			"card.history.desc": "归档浏览与清理（养老院）。关闭后不注册历史接口、不渲染该页签。",
			"card.health": "健康检查",
			"card.health.desc": "体检 → 处方 → 出院。关闭后不注册体检接口、不渲染该页签。",
			"card.readonly": "当前会话无法修改设置（只读挂载）。",
			"card.unavailable": "设置服务不可用，无法读取配置。",
			"panel.title": "会话管家",
			"panel.tab.history": "养老院",
			"panel.tab.health": "体检",
			"panel.close": "关闭",
			"panel.untitled": "（无标题）",
			"history.loading": "正在读取归档列表…",
			"history.empty": "归档集合为空。",
			"history.edit": "编辑",
			"history.done": "完成",
			"history.selectAll": "全选",
			"history.unselectAll": "取消全选",
			"history.unarchive": "取消归档状态 ({n})",
			"history.unarchiving": "取消归档中…",
			"history.purge": "清理归档文件 ({n}) · 释放 {size}",
			"history.purging": "清理中…",
			"history.editingHint": "编辑模式：勾选会话后二选一 ——「取消归档状态」只把它从官方归档数组移除（可逆，重启后回到侧边栏）；「清理归档文件」真删磁盘上的转录与投影缓存（不可逆）。",
			"history.restartHint": "已从归档数组移除 {removed} 个 id（剩余 {remaining}）。请**立刻重启 DSH**：宿主退出前任何归档或工作区改动都会把整份内存快照写回文件，这次操作会被还原。",
			"history.pendingRestart": "宿主内存里仍有 {n} 个归档未失效：列表已按存储文件显示（这些已不在），但它们对应的会话在重启 DSH 前仍被侧边栏隐藏。",
			"history.count": "共 {n} 条 · 占 {size}",
			"history.size": "转录 {t} · 缓存 {c}",
			"history.sizeUnknown": "磁盘上无实体",
			"history.source.registry": "来源：宿主归档注册表",
			"history.source.storage-file": "来源：存储文件",
			"history.source.none": "两处都读不到归档集合",
			"history.confirmUnarchive": "确认取消这 {n} 个会话的归档状态？\n\n{summary}\n\n只改归档数组（自动备份），磁盘文件不动。重启 DSH 后这些会话回到原工作区。",
			"history.confirmPurge": "确认清理这 {n} 个归档会话的磁盘文件？\n\n{summary}\n\n合计释放约 {size}。\n将删除：转录目录（含旧格式副本）、逐条投影缓存，并从归档数组与工作区成员表中移除。\n\n**此操作不可逆，会话将无法恢复。**",
			"history.purgeResult": "已清理 {purged} 个归档会话，释放 {size}。请重启 DSH 使其彻底消失。",
			"history.purgePartial": "已清理 {purged} 个，释放 {size}；{failed} 个失败（见下方明细）。",
			"history.purgeFailures": "失败明细",
			"health.scan": "开始体检",
			"health.scanning": "体检中…",
			"health.progress": "{done}/{total} · 已用 {sec}s",
			"health.empty": "未发现异常会话。",
			"health.clean": "全部检查通过。",
			"health.level.ok": "正常",
			"health.level.warn": "注意",
			"health.level.skipped": "未检查",
			"health.level.fail": "异常",
			"health.priority.high": "优先",
			"health.gate.generation": "代次产物",
			"health.gate.log-integrity": "日志完整性",
			"health.gate.projection-cache": "投影缓存",
			"health.gate.lossless-json": "无损 JSON",
			"health.gate.cold-read": "可接续性",
			"health.attribution": "归属",
			"health.field": "字段",
			"health.unknownOwner": "归属未知",
			"health.phase.checkup": "① 体检",
			"health.phase.prescribe": "② 处方",
			"health.phase.discharge": "③ 出院",
			"health.repair": "执行可逆处置",
			"health.repairing": "处置中…",
			"health.before": "处置前",
			"health.after": "处置后",
			"health.quarantined": "已隔离投影缓存记录（重启 DSH 后重折叠）",
			"health.commands": "可执行命令",
			"health.copy": "复制",
			"health.copied": "已复制",
			"health.detail": "查看详情",
			"health.back": "返回列表",
			"health.cache.hint": "结果来自缓存 · {ago}",
			"health.cache.refresh": "刷新",
			"health.cache.corpusChanged": "语料已变化（{was} → {now}），建议刷新",
			"health.ago.justNow": "刚刚",
			"health.ago.minutes": "{n} 分钟前",
			"health.ago.hours": "{n} 小时前",
			"health.ago.days": "{n} 天前"
		};
		/** English dictionary (same keys). */
		const en = {
			"card.title": "Session Steward",
			"card.desc": "History files · Health check",
			"card.enabled": "Enable Session Steward",
			"card.enabled.desc": "When off, no API is registered and the sidebar entry disappears.",
			"card.history": "Session history files",
			"card.history.desc": "Archive browsing and cleanup (Retirement Home). When off, history routes and the tab are gone.",
			"card.health": "Health check",
			"card.health.desc": "Checkup → Prescription → Discharge. When off, health routes and the tab are gone.",
			"card.readonly": "This session cannot edit settings (read-only mount).",
			"card.unavailable": "Settings service unavailable; configuration cannot be read.",
			"panel.title": "Session Steward",
			"panel.tab.history": "Retirement Home",
			"panel.tab.health": "Checkup",
			"panel.close": "Close",
			"panel.untitled": "(untitled)",
			"history.loading": "Loading archived sessions…",
			"history.empty": "The archive set is empty.",
			"history.edit": "Edit",
			"history.done": "Done",
			"history.selectAll": "Select all",
			"history.unselectAll": "Clear selection",
			"history.unarchive": "Unarchive state ({n})",
			"history.unarchiving": "Unarchiving…",
			"history.purge": "Purge archive files ({n}) · free {size}",
			"history.purging": "Purging…",
			"history.editingHint": "Edit mode: tick sessions, then pick one — \"Unarchive state\" only removes them from the official archive array (reversible; they return to the sidebar after a restart); \"Purge archive files\" really deletes the transcript and projection cache from disk (irreversible).",
			"history.restartHint": "Removed {removed} id(s) from the archive array ({remaining} left). **Restart DSH now**: until the host exits, any archive or workspace change rewrites the whole in-memory snapshot back to the file and undoes this.",
			"history.pendingRestart": "{n} archived id(s) are still live in host memory: the list follows the storage file (they are already gone), but their sessions stay hidden from the sidebar until DSH restarts.",
			"history.count": "{n} total · {size} on disk",
			"history.size": "transcript {t} · cache {c}",
			"history.sizeUnknown": "no on-disk entity",
			"history.source.registry": "Source: host archive registry",
			"history.source.storage-file": "Source: storage file",
			"history.source.none": "The archive set is unreadable from both sources",
			"history.confirmUnarchive": "Unarchive these {n} session(s)?\n\n{summary}\n\nOnly the archive array is edited (auto backup); nothing on disk is touched. After a DSH restart these sessions return to their workspaces.",
			"history.confirmPurge": "Purge the on-disk files of these {n} archived session(s)?\n\n{summary}\n\nAbout {size} will be freed.\nThis deletes: the transcript directory (including older-format copies) and the per-session projection cache, and removes them from the archive array and the workspace membership tables.\n\n**This cannot be undone — the sessions will be unrecoverable.**",
			"history.purgeResult": "Purged {purged} archived session(s), freed {size}. Restart DSH to make them disappear completely.",
			"history.purgePartial": "Purged {purged}, freed {size}; {failed} failed (see details below).",
			"history.purgeFailures": "Failure details",
			"health.scan": "Run checkup",
			"health.scanning": "Running…",
			"health.progress": "{done}/{total} · {sec}s elapsed",
			"health.empty": "No problem session found.",
			"health.clean": "All checks passed.",
			"health.level.ok": "ok",
			"health.level.warn": "warn",
			"health.level.skipped": "Not checked",
			"health.level.fail": "fail",
			"health.priority.high": "Priority",
			"health.gate.generation": "Generation artifact",
			"health.gate.log-integrity": "Log integrity",
			"health.gate.projection-cache": "Projection cache",
			"health.gate.lossless-json": "Lossless JSON",
			"health.gate.cold-read": "Continuability",
			"health.attribution": "Owner",
			"health.field": "Field",
			"health.unknownOwner": "owner unknown",
			"health.phase.checkup": "1) Checkup",
			"health.phase.prescribe": "2) Prescription",
			"health.phase.discharge": "3) Discharge",
			"health.repair": "Apply reversible repair",
			"health.repairing": "Repairing…",
			"health.before": "Before",
			"health.after": "After",
			"health.quarantined": "Projection cache quarantined (refolds after a DSH restart)",
			"health.commands": "Commands",
			"health.copy": "Copy",
			"health.copied": "Copied",
			"health.detail": "Details",
			"health.back": "Back",
			"health.cache.hint": "Cached result · {ago}",
			"health.cache.refresh": "Refresh",
			"health.cache.corpusChanged": "Corpus changed ({was} → {now}); refresh recommended",
			"health.ago.justNow": "just now",
			"health.ago.minutes": "{n} min ago",
			"health.ago.hours": "{n} h ago",
			"health.ago.days": "{n} d ago"
		};
		/** 字典查找（缺 key 时回退到内置 zh，再回退 key 本身）。 */
		function translate(t, key, params) {
			if (t !== void 0) try {
				return t(key, params);
			} catch {}
			return format(zh[key] ?? key, params);
		}
		/** 极简 `{name}` 替换。 */
		function format(template, params) {
			if (params === void 0) return template;
			return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ""));
		}
		//#endregion
		//#region src/client/host-api.ts
		/**
		* 客户端 host 调用助手：一切经 fenced `/session-steward/api/<method>` 路由，
		* 不 value-import 任何官方包（与 dsh-session-search-toggle 的 host-api.ts 同范式，
		* 仅把路由前缀换成会话管家自己的）。
		*/
		/** 单次 host 调用超时（导入类大响应可单独放宽）。 */
		const FETCH_TIMEOUT = 2e4;
		/** POST 一个 JSON body，返回整条记录。 */
		function callHostAny(method, body, timeout = FETCH_TIMEOUT) {
			const controller = typeof AbortController === "undefined" ? void 0 : new AbortController();
			const timer = typeof setTimeout === "function" ? setTimeout(() => {
				controller?.abort();
			}, timeout) : void 0;
			return fetch(`/session-steward/api/${method}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
				signal: controller?.signal
			}).then((res) => res.ok ? res.json() : Promise.reject(/* @__PURE__ */ new Error(`HTTP ${res.status}`))).catch((err) => ({
				ok: false,
				error: err instanceof DOMException && err.name === "AbortError" ? "请求超时" : String(err instanceof Error ? err.message : err)
			})).finally(() => {
				if (timer !== void 0) clearTimeout(timer);
			});
		}
		//#endregion
		//#region src/client/history-panel.tsx
		/**
		* 养老院（会话历史文件）面板 —— 自 dsh-session-search-toggle `src/client/archive-panel.tsx`
		* **迁入**并适配到本包的方法名。
		*
		* 与迁移前的关键差异（**两个操作刻意分开，不可互换**）：
		*
		* | 操作 | 路由 | 改什么 | 可逆 |
		* |---|---|---|---|
		* | 取消归档状态 | `session-history-prune` | 只改归档数组 | ✅ 重启后会话回到侧边栏 |
		* | 清理归档文件 | `session-history-purge` | **真删**转录目录 + 投影缓存 + 两处 id | ❌ 不可逆 |
		*
		* 「删除」一词在本面板**不存在** —— 旧文案承诺「删除」却只改了个数组，
		* 是导致「点了确认没反应」那类误判的一部分。
		* 体积**按行**显示（实测单条可从 0 到 23 MB，报一个总量没有意义），按钮上给所选小计。
		*/
		/** 人类可读体积。 */
		function fmtSize(bytes) {
			if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
			const units = [
				"B",
				"KB",
				"MB",
				"GB",
				"TB"
			];
			let value = bytes;
			let unit = 0;
			while (value >= 1024 && unit < units.length - 1) {
				value /= 1024;
				unit++;
			}
			return `${unit === 0 || value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
		}
		/** 养老院面板。 */
		function HistoryPanel({ t, onClose }) {
			const [items, setItems] = (0, react.useState)(null);
			const [source, setSource] = (0, react.useState)("");
			const [degraded, setDegraded] = (0, react.useState)("");
			const [pendingRestart, setPendingRestart] = (0, react.useState)(0);
			const [error, setError] = (0, react.useState)(null);
			const [attempt, setAttempt] = (0, react.useState)(0);
			const [selected, setSelected] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [busy, setBusy] = (0, react.useState)(null);
			const [note, setNote] = (0, react.useState)(null);
			/** 清理失败明细（逐条）；空数组表示无失败。 */
			const [failures, setFailures] = (0, react.useState)([]);
			const [editing, setEditing] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				let cancelled = false;
				setError(null);
				callHostAny("session-history-list", {}).then((res) => {
					if (cancelled) return;
					if (res.ok === true && Array.isArray(res.items)) {
						setItems(res.items);
						setSource(typeof res.source === "string" ? res.source : "");
						setDegraded(typeof res.degraded === "string" ? res.degraded : "");
						setPendingRestart(typeof res.pendingRestart === "number" ? res.pendingRestart : 0);
					} else setError(res.error ?? "读取归档列表失败");
				});
				return () => {
					cancelled = true;
				};
			}, [attempt]);
			(0, react.useEffect)(() => {
				const onKey = (event) => {
					if (event.key === "Escape") onClose();
				};
				document.addEventListener("keydown", onKey);
				return () => {
					document.removeEventListener("keydown", onKey);
				};
			}, [onClose]);
			const toggleRow = (sessionId) => {
				setSelected((prev) => {
					const next = new Set(prev);
					if (next.has(sessionId)) next.delete(sessionId);
					else next.add(sessionId);
					return next;
				});
			};
			/** 进出编辑模式；离开时清空选择。 */
			const toggleEditing = () => {
				setEditing((prev) => !prev);
				setSelected(/* @__PURE__ */ new Set());
				setNote(null);
				setFailures([]);
			};
			const toggleAll = () => {
				setSelected((prev) => prev.size === (items?.length ?? 0) ? /* @__PURE__ */ new Set() : new Set((items ?? []).map((item) => item.sessionId)));
			};
			const selectedRows = (items ?? []).filter((item) => selected.has(item.sessionId));
			const selectedBytes = selectedRows.reduce((sum, item) => sum + item.bytes + item.cacheBytes, 0);
			const totalBytes = (items ?? []).reduce((sum, item) => sum + item.bytes + item.cacheBytes, 0);
			/** 确认弹窗里的逐条摘要（清理时带体积，取消归档时不带）。 */
			const summarise = (rows, withSize) => {
				const lines = rows.slice(0, 5).map((row) => {
					const label = row.title || translate(t, "panel.untitled");
					const size = fmtSize(row.bytes + row.cacheBytes);
					return withSize ? `· ${label} — ${size}` : `· ${label}`;
				});
				if (rows.length > 5) lines.push(`… 共 ${rows.length} 个`);
				return lines.join("\n");
			};
			const confirm = (message) => typeof window !== "undefined" && typeof window.confirm === "function" ? window.confirm(message) : false;
			/** 提交一次操作：确认 → 调用 → 刷新列表（列表以存储文件为准，因此立刻可见变化）。 */
			const run = (kind, method, confirmText) => {
				const rows = selectedRows;
				if (rows.length === 0) return;
				if (!confirm(confirmText)) return;
				setBusy(kind);
				setNote(null);
				setFailures([]);
				callHostAny(method, { sessionIds: rows.map((row) => row.sessionId) }, 6e4).then((res) => {
					if (res.ok === true) {
						if (kind === "unarchive") setNote(translate(t, "history.restartHint", {
							removed: res.removed ?? rows.length,
							remaining: res.remaining ?? "?"
						}));
						else {
							const freed = fmtSize(res.freedBytes ?? 0);
							const failed = res.failures?.length ?? 0;
							setNote(failed === 0 ? translate(t, "history.purgeResult", {
								purged: res.purged ?? rows.length,
								size: freed
							}) : translate(t, "history.purgePartial", {
								purged: res.purged ?? rows.length,
								size: freed,
								failed
							}));
							setFailures(res.failures ?? []);
						}
						setSelected(/* @__PURE__ */ new Set());
						setAttempt((n) => n + 1);
					} else setNote(res.error ?? "操作失败");
				}).catch((err) => setNote(`操作失败：${String(err instanceof Error ? err.message : err)}`)).finally(() => setBusy(null));
			};
			const unarchiveSelected = () => {
				run("unarchive", "session-history-prune", translate(t, "history.confirmUnarchive", {
					n: selectedRows.length,
					summary: summarise(selectedRows, false)
				}));
			};
			const purgeSelected = () => {
				run("purge", "session-history-purge", translate(t, "history.confirmPurge", {
					n: selectedRows.length,
					summary: summarise(selectedRows, true),
					size: fmtSize(selectedBytes)
				}));
			};
			const children = [];
			if (error !== null) children.push((0, react.createElement)("div", {
				key: "err",
				className: "dss_error"
			}, [(0, react.createElement)("div", { key: "msg" }, error === "请求超时" ? "读取归档列表超时：Host 可能正忙，稍后重试。" : error), (0, react.createElement)("button", {
				key: "retry",
				type: "button",
				className: "dss_actBtn",
				style: { marginTop: "6px" },
				onClick: () => {
					setAttempt((n) => n + 1);
				}
			}, "重试")]));
			else if (items === null) children.push((0, react.createElement)("div", {
				key: "loading",
				className: "dss_status"
			}, translate(t, "history.loading")));
			else if (items.length === 0) children.push((0, react.createElement)("div", {
				key: "empty",
				className: "dss_empty"
			}, translate(t, "history.empty")));
			else {
				const allSelected = selected.size === items.length;
				if (editing) children.push((0, react.createElement)("div", {
					key: "manage",
					className: "dss_btnRow",
					style: { padding: "4px 10px 0" }
				}, [
					(0, react.createElement)("button", {
						key: "all",
						type: "button",
						className: "dss_actBtn",
						onClick: toggleAll
					}, allSelected ? translate(t, "history.unselectAll") : translate(t, "history.selectAll")),
					(0, react.createElement)("button", {
						key: "unarchive",
						type: "button",
						className: "dss_actBtn",
						disabled: busy !== null || selected.size === 0,
						onClick: unarchiveSelected
					}, busy === "unarchive" ? translate(t, "history.unarchiving") : translate(t, "history.unarchive", { n: selected.size })),
					(0, react.createElement)("button", {
						key: "purge",
						type: "button",
						className: "dss_actBtn dss_dangerBtn",
						disabled: busy !== null || selected.size === 0,
						onClick: purgeSelected
					}, busy === "purge" ? translate(t, "history.purging") : translate(t, "history.purge", {
						n: selected.size,
						size: fmtSize(selectedBytes)
					}))
				]));
				children.push((0, react.createElement)("ul", {
					key: "list",
					className: "dss_list",
					role: "list",
					"aria-label": translate(t, "history.source.registry")
				}, items.map((item) => (0, react.createElement)("li", {
					key: item.sessionId,
					className: "dss_row"
				}, [
					editing && (0, react.createElement)("label", {
						key: "sel",
						className: "dss_check"
					}, [(0, react.createElement)("input", {
						type: "checkbox",
						checked: selected.has(item.sessionId),
						onChange: () => {
							toggleRow(item.sessionId);
						}
					})]),
					(0, react.createElement)("span", {
						key: "t",
						className: "dss_rowTitle"
					}, [(0, react.createElement)("span", {
						key: "x",
						className: "dss_titleText"
					}, item.title || translate(t, "panel.untitled")), item.updatedAt > 0 && (0, react.createElement)("span", {
						key: "tag",
						className: "dss_tag"
					}, fmtTime(item.updatedAt))]),
					(0, react.createElement)("span", {
						key: "size",
						className: "dss_meta dss_size"
					}, item.bytes + item.cacheBytes > 0 ? translate(t, "history.size", {
						t: fmtSize(item.bytes),
						c: fmtSize(item.cacheBytes)
					}) : translate(t, "history.sizeUnknown")),
					item.cwd !== "" && (0, react.createElement)("span", {
						key: "c",
						className: "dss_meta"
					}, item.cwd),
					(0, react.createElement)("span", {
						key: "id",
						className: "dss_meta dss_uuid"
					}, item.sessionId)
				]))));
			}
			return (0, react.createElement)("div", { className: "dss_tabBody" }, [
				note !== null && (0, react.createElement)("div", {
					key: "note",
					className: "dss_status"
				}, note),
				failures.length > 0 && (0, react.createElement)("div", {
					key: "fail",
					className: "dss_status dss_error"
				}, [(0, react.createElement)("div", { key: "h" }, translate(t, "history.purgeFailures")), ...failures.slice(0, 10).map((failure, index) => (0, react.createElement)("div", {
					key: `f${index}`,
					className: "dss_meta"
				}, `${failure.sessionId.slice(0, 22)}… — ${failure.reason}`))]),
				editing && (0, react.createElement)("div", {
					key: "hint",
					className: "dss_status"
				}, translate(t, "history.editingHint")),
				degraded !== "" && (0, react.createElement)("div", {
					key: "degraded",
					className: "dss_status dss_warnText"
				}, degraded),
				pendingRestart > 0 && (0, react.createElement)("div", {
					key: "pending",
					className: "dss_status dss_warnText"
				}, translate(t, "history.pendingRestart", { n: pendingRestart })),
				source !== "" && (0, react.createElement)("div", {
					key: "source",
					className: "dss_metaLine"
				}, translate(t, source === "registry" ? "history.source.registry" : source === "storage-file" ? "history.source.storage-file" : "history.source.none")),
				items !== null && error === null && (0, react.createElement)("div", {
					key: "count",
					className: "dss_metaLine"
				}, translate(t, "history.count", {
					n: items.length,
					size: fmtSize(totalBytes)
				})),
				(0, react.createElement)("div", {
					key: "headBtns",
					className: "dss_btnRow"
				}, [(0, react.createElement)("button", {
					key: "edit",
					type: "button",
					className: `dss_actBtn${editing ? " dss_editActive" : ""}`,
					onClick: toggleEditing
				}, editing ? translate(t, "history.done") : translate(t, "history.edit"))]),
				...children
			]);
		}
		/** 时间格式化（与迁移前一致）。 */
		function fmtTime(ms) {
			if (!ms || typeof ms !== "number") return "";
			try {
				const date = new Date(ms);
				const now = /* @__PURE__ */ new Date();
				const pad = (n) => String(n).padStart(2, "0");
				const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
				const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
				if (sameDay) return time;
				return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${time}`;
			} catch {
				return "";
			}
		}
		//#endregion
		//#region src/client/health-panel.tsx
		/**
		* 体检面板：体检（五门）→ 处方（命令清单）→ 出院（可逆处置 + before/after 对照）。
		*
		* 三态流转完全由 host 侧报告驱动，客户端只做展示与触发；重型动作都在 host，
		* 渲染周期内不发同步重活。
		*/
		const GATE_LABEL = {
			"generation": "health.gate.generation",
			"log-integrity": "health.gate.log-integrity",
			"projection-cache": "health.gate.projection-cache",
			"lossless-json": "health.gate.lossless-json",
			"cold-read": "health.gate.cold-read"
		};
		const LEVEL_LABEL = {
			ok: "health.level.ok",
			warn: "health.level.warn",
			skipped: "health.level.skipped",
			fail: "health.level.fail"
		};
		/**
		* 单批扫描的会话数。
		*
		* 宿主侧 `scanSessions` 是同步循环，一次批太大就长时间占住事件循环、界面全无反馈。
		* 小批次连续调用把控制权交回客户端：每批之间有真实的进度与计时，且宿主无需持有
		* 跨请求状态（见 host/health/scan.ts 的 offset 语义）。
		*/
		const SCAN_BATCH = 5;
		/**
		* 把缓存生成时刻折成一个粗粒度的相对时间 key。
		*
		* 不引第三方 i18n/时间库：四档粒度足够表达「这是刚才的 / 是昨天的」，
		* 而这正是用户判断「要不要刷新」所需的全部信息。
		*/
		function relativeAgo(generatedAt, now) {
			const seconds = Math.max(0, Math.round((now - generatedAt) / 1e3));
			if (seconds < 60) return {
				key: "health.ago.justNow",
				n: 0
			};
			const minutes = Math.floor(seconds / 60);
			if (minutes < 60) return {
				key: "health.ago.minutes",
				n: minutes
			};
			const hours = Math.floor(minutes / 60);
			if (hours < 24) return {
				key: "health.ago.hours",
				n: hours
			};
			return {
				key: "health.ago.days",
				n: Math.floor(hours / 24)
			};
		}
		/** 体检面板。 */
		function HealthPanel({ t, onClose }) {
			const [scanning, setScanning] = (0, react.useState)(false);
			const [findings, setFindings] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [detail, setDetail] = (0, react.useState)(null);
			const [repairing, setRepairing] = (0, react.useState)(false);
			const [discharge, setDischarge] = (0, react.useState)(null);
			const [copied, setCopied] = (0, react.useState)(null);
			/** 分批扫描进度：done = 已访问会话数，total = 语料总数（0 表示尚未拿到分母）。 */
			const [progress, setProgress] = (0, react.useState)(null);
			const [startedAt, setStartedAt] = (0, react.useState)(0);
			const [elapsedMs, setElapsedMs] = (0, react.useState)(0);
			/** 缓存命中时的元信息；非 null 即「当前列表来自缓存」，必须露出生成时间。 */
			const [cacheInfo, setCacheInfo] = (0, react.useState)(null);
			/** 相对时间的走字刻度：缓存提示里的「N 分钟前」需要自己更新。 */
			const [, setClockTick] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				const onKey = (event) => {
					if (event.key === "Escape") onClose();
				};
				document.addEventListener("keydown", onKey);
				return () => {
					document.removeEventListener("keydown", onKey);
				};
			}, [onClose]);
			(0, react.useEffect)(() => {
				callHostAny("session-health-scan", { resume: true }, 3e4).then((res) => {
					if (res.ok === true && res.cached === true) {
						setFindings(res.findings ?? []);
						setCacheInfo({
							generatedAt: res.generatedAt ?? 0,
							total: res.total ?? 0,
							currentTotal: res.currentTotal ?? res.total ?? 0
						});
					}
				});
			}, []);
			(0, react.useEffect)(() => {
				if (cacheInfo === null) return;
				const timer = setInterval(() => {
					setClockTick((tick) => tick + 1);
				}, 3e4);
				return () => {
					clearInterval(timer);
				};
			}, [cacheInfo]);
			(0, react.useEffect)(() => {
				if (!scanning || startedAt === 0) return;
				const timer = setInterval(() => {
					setElapsedMs(Date.now() - startedAt);
				}, 100);
				return () => {
					clearInterval(timer);
				};
			}, [scanning, startedAt]);
			const runScan = (options) => {
				const forceRefresh = options?.forceRefresh === true;
				setScanning(true);
				setError(null);
				setDetail(null);
				setDischarge(null);
				setFindings(null);
				setCacheInfo(null);
				setProgress({
					done: 0,
					total: 0
				});
				setStartedAt(Date.now());
				setElapsedMs(0);
				(async () => {
					const collected = [];
					let offset = 0;
					try {
						for (;;) {
							const res = await callHostAny("session-health-scan", {
								limit: SCAN_BATCH,
								offset,
								onlyProblems: true,
								...offset === 0 && !forceRefresh ? { resume: true } : {}
							}, 12e4);
							if (res.ok !== true) {
								setError(res.error ?? "体检失败");
								return;
							}
							if (res.cached === true) {
								setFindings(res.findings ?? []);
								setCacheInfo({
									generatedAt: res.generatedAt ?? 0,
									total: res.total ?? 0,
									currentTotal: res.currentTotal ?? res.total ?? 0
								});
								setProgress(null);
								return;
							}
							const total = res.total ?? 0;
							const scanned = res.scanned ?? 0;
							collected.push(...res.findings ?? []);
							offset += scanned;
							setProgress({
								done: offset,
								total
							});
							if (scanned === 0 || offset >= total) break;
						}
						setFindings(collected);
					} catch (err) {
						setError(String(err instanceof Error ? err.message : err));
					} finally {
						setScanning(false);
					}
				})();
			};
			/**
			* 把单会话的最新报告同步进列表。
			*
			* 宿主侧缓存已就地回写（见 index.ts 的 `cache?.patch`），客户端列表必须同步，
			* 否则退回列表时会看到已被处置的行还挂着旧档位。
			*/
			const reconcileRow = (next) => {
				setFindings((prev) => {
					if (prev === null) return prev;
					const index = prev.findIndex((item) => item.sessionId === next.sessionId);
					if (next.level === "ok") return index < 0 ? prev : prev.filter((item) => item.sessionId !== next.sessionId);
					return index < 0 ? [...prev, next] : prev.map((item) => item.sessionId === next.sessionId ? next : item);
				});
			};
			const openDetail = (sessionId) => {
				setError(null);
				setDischarge(null);
				callHostAny("session-health-session", { sessionId }, 12e4).then((res) => {
					if (res.ok === true) {
						setDetail(res);
						if (res.report !== void 0) reconcileRow(res.report);
					} else setError(res.error ?? "读取体检详情失败");
				}).catch((err) => setError(String(err instanceof Error ? err.message : err)));
			};
			const runRepair = (sessionId) => {
				setRepairing(true);
				setError(null);
				callHostAny("session-health-repair", { sessionId }, 12e4).then((res) => {
					if (res.ok === true) {
						setDischarge(res);
						if (res.after !== void 0) {
							setDetail({
								ok: true,
								report: res.after,
								prescriptions: res.prescriptions
							});
							reconcileRow(res.after);
						}
					} else setError(res.error ?? "处置失败");
				}).catch((err) => setError(String(err instanceof Error ? err.message : err))).finally(() => setRepairing(false));
			};
			const copy = (text) => {
				try {
					navigator.clipboard?.writeText(text);
					setCopied(text);
				} catch {}
			};
			const report = detail?.report ?? discharge?.after;
			const lines = [];
			lines.push((0, react.createElement)("div", {
				key: "phase1",
				className: "dss_phaseRow"
			}, [(0, react.createElement)("span", {
				key: "l",
				className: "dss_phase"
			}, translate(t, "health.phase.checkup")), (0, react.createElement)("button", {
				key: "scan",
				type: "button",
				className: "dss_actBtn",
				disabled: scanning,
				onClick: runScan
			}, scanning ? translate(t, "health.scanning") : translate(t, "health.scan"))]));
			if (scanning && progress !== null) {
				const total = progress.total;
				const pct = total > 0 ? Math.min(100, Math.round(progress.done / total * 100)) : 0;
				lines.push((0, react.createElement)("div", {
					key: "progress",
					className: "dss_progressRow"
				}, [(0, react.createElement)("div", {
					key: "track",
					className: "dss_progressTrack"
				}, (0, react.createElement)("div", {
					key: "fill",
					className: total > 0 ? "dss_progressFill" : "dss_progressFill dss_progressIndeterminate",
					...total > 0 ? { style: { width: `${pct}%` } } : {}
				})), (0, react.createElement)("span", {
					key: "read",
					className: "dss_meta"
				}, translate(t, "health.progress", {
					done: progress.done,
					total: total > 0 ? total : "?",
					sec: (elapsedMs / 1e3).toFixed(1)
				}))]));
			}
			if (cacheInfo !== null && !scanning && detail === null && discharge === null) {
				const ago = relativeAgo(cacheInfo.generatedAt, Date.now());
				lines.push((0, react.createElement)("div", {
					key: "cache",
					className: "dss_cacheRow"
				}, [
					(0, react.createElement)("span", {
						key: "h",
						className: "dss_meta"
					}, translate(t, "health.cache.hint", { ago: translate(t, ago.key, { n: ago.n }) })),
					cacheInfo.currentTotal !== cacheInfo.total && (0, react.createElement)("span", {
						key: "chg",
						className: "dss_why"
					}, translate(t, "health.cache.corpusChanged", {
						was: cacheInfo.total,
						now: cacheInfo.currentTotal
					})),
					(0, react.createElement)("button", {
						key: "r",
						type: "button",
						className: "dss_actBtn",
						onClick: () => {
							runScan({ forceRefresh: true });
						}
					}, translate(t, "health.cache.refresh"))
				]));
			}
			if (error !== null) lines.push((0, react.createElement)("div", {
				key: "err",
				className: "dss_error"
			}, error));
			if (detail !== null || discharge !== null) lines.push((0, react.createElement)("div", {
				key: "back",
				className: "dss_btnRow"
			}, [(0, react.createElement)("button", {
				key: "b",
				type: "button",
				className: "dss_actBtn",
				onClick: () => {
					setDetail(null);
					setDischarge(null);
				}
			}, translate(t, "health.back"))]));
			if (report !== void 0) lines.push((0, react.createElement)("div", {
				key: "gates",
				className: "dss_gateList"
			}, report.gates.map((gate) => (0, react.createElement)("div", {
				key: gate.id,
				className: `dss_gate dss_gate_${gate.level}`
			}, [
				(0, react.createElement)("span", {
					key: "n",
					className: "dss_gateName"
				}, translate(t, GATE_LABEL[gate.id])),
				(0, react.createElement)("span", {
					key: "lv",
					className: `dss_levelPill dss_level_${gate.level}`
				}, translate(t, LEVEL_LABEL[gate.level])),
				(0, react.createElement)("span", {
					key: "ev",
					className: "dss_gateEvidence"
				}, gate.evidence),
				gate.attribution !== void 0 && (0, react.createElement)("span", {
					key: "at",
					className: "dss_meta"
				}, `${translate(t, "health.attribution")}: ${gate.attribution.package ?? "unknown"}${gate.attribution.projection !== void 0 ? ` · ${gate.attribution.projection}` : ""}${gate.attribution.field !== void 0 ? ` · ${translate(t, "health.field")} ${gate.attribution.field}` : ""}`)
			]))));
			else if (findings !== null) {
				if (findings.length === 0) lines.push((0, react.createElement)("div", {
					key: "clean",
					className: "dss_empty"
				}, translate(t, "health.empty")));
				else lines.push((0, react.createElement)("ul", {
					key: "list",
					className: "dss_list",
					role: "list"
				}, findings.map((item) => {
					const reasons = item.gates.filter((gate) => gate.level !== "ok").map((gate) => `${translate(t, GATE_LABEL[gate.id])}·${translate(t, LEVEL_LABEL[gate.level])}`).join(" · ");
					return (0, react.createElement)("li", {
						key: item.sessionId,
						className: "dss_row"
					}, [
						(0, react.createElement)("span", {
							key: "lv",
							className: `dss_levelPill dss_level_${item.level}`
						}, translate(t, LEVEL_LABEL[item.level])),
						item.priority === "high" && (0, react.createElement)("span", {
							key: "p",
							className: "dss_meta"
						}, translate(t, "health.priority.high")),
						(0, react.createElement)("span", {
							key: "id",
							className: "dss_meta dss_uuid"
						}, item.sessionId),
						reasons !== "" && (0, react.createElement)("span", {
							key: "why",
							className: "dss_why"
						}, reasons),
						(0, react.createElement)("button", {
							key: "d",
							type: "button",
							className: "dss_actBtn",
							onClick: () => {
								openDetail(item.sessionId);
							}
						}, translate(t, "health.detail"))
					]);
				})));
			}
			if (report !== void 0) {
				lines.push((0, react.createElement)("div", {
					key: "phase2",
					className: "dss_phaseRow"
				}, [(0, react.createElement)("span", {
					key: "l",
					className: "dss_phase"
				}, translate(t, "health.phase.prescribe")), (0, react.createElement)("button", {
					key: "repair",
					type: "button",
					className: "dss_actBtn",
					disabled: repairing || report.level === "ok",
					onClick: () => {
						runRepair(report.sessionId);
					}
				}, [repairing ? (0, react.createElement)("span", {
					key: "sp",
					className: "dss_spinner",
					"aria-hidden": "true"
				}) : null, (0, react.createElement)("span", { key: "tx" }, repairing ? translate(t, "health.repairing") : translate(t, "health.repair"))])]));
				const prescriptions = detail?.prescriptions ?? discharge?.prescriptions ?? [];
				if (prescriptions.length > 0) lines.push((0, react.createElement)("div", {
					key: "cmds",
					className: "dss_cmdBlock"
				}, [(0, react.createElement)("div", {
					key: "h",
					className: "dss_meta"
				}, translate(t, "health.commands")), ...prescriptions.map((line, index) => (0, react.createElement)("div", {
					key: `c${index}`,
					className: "dss_cmdLine"
				}, [(0, react.createElement)("code", {
					key: "code",
					className: "dss_cmd"
				}, line), (0, react.createElement)("button", {
					key: "cp",
					type: "button",
					className: "dss_actBtn",
					onClick: () => {
						copy(line);
					}
				}, copied === line ? translate(t, "health.copied") : translate(t, "health.copy"))]))]));
			}
			if (discharge !== null) {
				lines.push((0, react.createElement)("div", {
					key: "phase3",
					className: "dss_phaseRow"
				}, [
					(0, react.createElement)("span", {
						key: "l",
						className: "dss_phase"
					}, translate(t, "health.phase.discharge")),
					(0, react.createElement)("span", {
						key: "b",
						className: `dss_levelPill dss_level_${discharge.before?.level ?? "warn"}`
					}, `${translate(t, "health.before")}: ${translate(t, LEVEL_LABEL[discharge.before?.level ?? "warn"])}`),
					(0, react.createElement)("span", {
						key: "a",
						className: `dss_levelPill dss_level_${discharge.after?.level ?? "warn"}`
					}, `${translate(t, "health.after")}: ${translate(t, LEVEL_LABEL[discharge.after?.level ?? "warn"])}`)
				]));
				if (discharge.explanation !== void 0 && discharge.explanation !== "") lines.push((0, react.createElement)("div", {
					key: "verdict",
					className: `dss_verdict dss_verdict_${discharge.verdict ?? "failed"}`
				}, discharge.explanation));
				if (discharge.repair?.ok === true) lines.push((0, react.createElement)("div", {
					key: "repairNote",
					className: "dss_status"
				}, `${translate(t, "health.quarantined")} → ${discharge.repair.to ?? ""}`));
				else if (discharge.repair?.error !== void 0) lines.push((0, react.createElement)("div", {
					key: "repairErr",
					className: "dss_status"
				}, discharge.repair.error));
			}
			return (0, react.createElement)("div", { className: "dss_tabBody" }, lines);
		}
		//#endregion
		//#region src/client/panel.tsx
		/**
		* 会话管家面板壳：一个侧边栏入口，两个页签（养老院 / 体检）。
		*
		* 页签可见性由开关决定：`historyFiles=false` 时「养老院」消失，`healthCheck=false`
		* 时「体检」消失；两者都关时进入面板直接显示空壳提示（客户端也会隐藏入口）。
		*/
		/** 页签 id（导出供测试断言）。 */
		const TAB_HISTORY = "dss-tab-history";
		const TAB_HEALTH = "dss-tab-health";
		/** 会话管家对话框。 */
		function StewardPanel({ t, historyFiles, healthCheck, onClose }) {
			const [tab, setTab] = (0, react.useState)(historyFiles ? "history" : "health");
			(0, react.useEffect)(() => {
				if (tab === "history" && !historyFiles && healthCheck) setTab("health");
				if (tab === "health" && !healthCheck && historyFiles) setTab("history");
			}, [
				tab,
				historyFiles,
				healthCheck
			]);
			(0, react.useEffect)(() => {
				const onKey = (event) => {
					if (event.key === "Escape") onClose();
				};
				document.addEventListener("keydown", onKey);
				return () => {
					document.removeEventListener("keydown", onKey);
				};
			}, [onClose]);
			const tabs = [];
			if (historyFiles) tabs.push((0, react.createElement)("button", {
				key: TAB_HISTORY,
				id: TAB_HISTORY,
				type: "button",
				className: `dss_tab${tab === "history" ? " dss_tabActive" : ""}`,
				"aria-selected": tab === "history",
				onClick: () => {
					setTab("history");
				}
			}, translate(t, "panel.tab.history")));
			if (healthCheck) tabs.push((0, react.createElement)("button", {
				key: TAB_HEALTH,
				id: TAB_HEALTH,
				type: "button",
				className: `dss_tab${tab === "health" ? " dss_tabActive" : ""}`,
				"aria-selected": tab === "health",
				onClick: () => {
					setTab("health");
				}
			}, translate(t, "panel.tab.health")));
			const body = tab === "history" && historyFiles ? (0, react.createElement)(HistoryPanel, {
				t,
				onClose
			}) : tab === "health" && healthCheck ? (0, react.createElement)(HealthPanel, {
				t,
				onClose
			}) : (0, react.createElement)("div", { className: "dss_empty" }, translate(t, "card.enabled.desc"));
			return (0, react_dom.createPortal)((0, react.createElement)("div", { key: "steward-root" }, [(0, react.createElement)("div", {
				key: "backdrop",
				className: "dss_backdrop",
				onClick: onClose
			}), (0, react.createElement)("div", {
				key: "panel",
				className: "dss_panel",
				role: "dialog",
				"aria-label": translate(t, "panel.title")
			}, [(0, react.createElement)("div", {
				key: "head",
				className: "dss_dialogHead"
			}, [
				(0, react.createElement)("span", {
					key: "title",
					className: "dss_dialogTitle"
				}, translate(t, "panel.title")),
				(0, react.createElement)("span", {
					key: "tabs",
					className: "dss_tabRow"
				}, tabs),
				(0, react.createElement)("button", {
					key: "close",
					type: "button",
					className: "dss_actBtn",
					onClick: onClose
				}, translate(t, "panel.close"))
			]), body])]), document.body);
		}
		/** 侧边栏脚部入口：宽栏带文案成行控件，收起轨道退化为 36x36 图标钮。 */
		function StewardFooter(props) {
			const wide = props.wide === true;
			return (0, react.createElement)("button", {
				type: "button",
				className: wide ? "dss_footerEntry" : "dss_footerEntry dss_footerEntryRail",
				title: props.title,
				"aria-label": props.title,
				onClick: props.onClick
			}, [(0, react.createElement)("span", {
				key: "icon",
				className: "dss_footerIcon",
				"aria-hidden": true
			}, "🧭"), wide && props.label !== void 0 ? (0, react.createElement)("span", {
				key: "label",
				className: "dss_footerLabel"
			}, props.label) : null]);
		}
		//#endregion
		//#region src/client/index.ts
		/** 字典命名空间（locale.register 用）。 */
		const NS = "dsh-session-steward";
		/** 客户端插件声明的注入面。 */
		const inject = ["slots"];
		/** 注入样式（幂等）。 */
		function injectStyles() {
			const id = "dsh-session-steward-styles";
			if (typeof document === "undefined") return () => {};
			if (document.getElementById(id) !== null) return () => {};
			const style = document.createElement("style");
			style.id = id;
			style.textContent = `
.dss_entryWrap{flex:0 1 auto;display:inline-flex;align-items:center;min-width:0}
.dss_entryWrapWide{margin-left:6px}
.dss_footerEntry{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:4px;height:42px;padding:0 10px 0 8px;border:none;border-radius:12px;background:transparent;cursor:pointer;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:14px;line-height:22px;white-space:nowrap;overflow:hidden;transition:background-color 160ms ease-out,color 160ms ease-out}
.dss_footerEntry:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dss_footerEntryRail{width:28px;height:28px;padding:0;gap:0;border-radius:50%}
.dss_footerIcon{flex:none;font-size:15px;line-height:1}
.dss_footerLabel{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dss_backdrop{position:fixed;inset:0;background:rgba(15,20,30,.42);z-index:1000}
.dss_panel{position:fixed;z-index:1001;left:50%;top:8vh;transform:translateX(-50%);width:min(760px,92vw);max-height:78vh;overflow:auto;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:14px;box-shadow:0 18px 48px rgba(0,0,0,.18);padding:10px 14px 14px}
.dss_dialogHead{display:flex;align-items:center;gap:10px;min-height:34px}
.dss_dialogTitle{font-weight:600;color:var(--dsw-alias-label-primary,#111827);flex:1 1 auto;min-width:0}
.dss_tabRow{display:inline-flex;gap:4px}
.dss_tab{border:1px solid var(--dsw-alias-border-l2,#e5e7eb);background:transparent;border-radius:8px;padding:3px 10px;cursor:pointer;font-size:12px;color:var(--dsw-alias-label-secondary,#6b7280)}
.dss_tabActive{background:var(--dsw-alias-interactive-bg-active,rgba(63,99,216,.12));color:var(--dsw-alias-label-primary,#111827)}
.dss_tabBody{display:flex;flex-direction:column;gap:8px;padding-top:8px}
.dss_actBtn{border:1px solid var(--dsw-alias-border-l2,#e5e7eb);background:transparent;border-radius:8px;padding:4px 10px;cursor:pointer;font-size:12px;color:var(--dsw-alias-label-primary,#111827)}
.dss_actBtn:disabled{opacity:.5;cursor:default}
.dss_dangerBtn{border-color:var(--dsw-alias-state-error-primary,#dc2626);color:var(--dsw-alias-state-error-primary,#dc2626)}
.dss_editActive{background:var(--dsw-alias-interactive-bg-active,rgba(63,99,216,.12))}
.dss_btnRow{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.dss_list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
.dss_row{display:flex;gap:8px;align-items:center;padding:5px 8px;border-radius:8px;border:1px solid transparent}
.dss_row:hover{border-color:var(--dsw-alias-border-l2,#e5e7eb)}
.dss_rowTitle{display:flex;gap:6px;align-items:center;flex:1 1 auto;min-width:0}
.dss_titleText{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dss_tag{font-size:11px;color:var(--dsw-alias-label-tertiary,#9ca3af)}
.dss_meta{font-size:11px;color:var(--dsw-alias-label-tertiary,#9ca3af)}
.dss_metaLine{font-size:11px;color:var(--dsw-alias-label-tertiary,#9ca3af)}
.dss_uuid{font-family:var(--ds-font-family-code,monospace)}
/* 按行的磁盘占用：右对齐、不参与标题压缩，方便纵向比对「哪条最占地方」。 */
.dss_size{flex:none;font-variant-numeric:tabular-nums;white-space:nowrap}
.dss_check{display:inline-flex;align-items:center}
.dss_status{font-size:12px;color:var(--dsw-alias-label-secondary,#6b7280)}
.dss_warnText{color:var(--dsw-alias-state-warning-primary,#d97706)}
.dss_error{font-size:12px;color:var(--dsw-alias-state-error-primary,#dc2626)}
.dss_empty{font-size:12px;color:var(--dsw-alias-label-tertiary,#9ca3af);padding:10px 2px}
.dss_gateList{display:flex;flex-direction:column;gap:6px}
.dss_gate{display:flex;flex-wrap:wrap;gap:6px;align-items:baseline;border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:10px;padding:6px 10px}
.dss_gateName{font-weight:600;font-size:12px}
.dss_gateEvidence{font-size:12px;color:var(--dsw-alias-label-secondary,#6b7280);flex:1 1 100%}
.dss_levelPill{font-size:11px;border-radius:999px;padding:1px 8px;border:1px solid transparent}
.dss_level_ok{background:rgba(22,163,74,.12);color:#15803d}
.dss_level_warn{background:rgba(217,119,6,.14);color:#b45309}
.dss_level_fail{background:rgba(220,38,38,.14);color:#b91c1c}
.dss_level_skipped{background:rgba(107,114,128,.14);color:#4b5563}
.dss_progressRow{display:flex;align-items:center;gap:8px;margin-top:2px}
.dss_progressTrack{flex:1;height:6px;border-radius:999px;background:var(--dsw-alias-bg-layer-1,#eef0f3);overflow:hidden}
.dss_progressFill{height:100%;border-radius:999px;background:var(--dsw-alias-state-business-primary,#3d5be0);transition:width .2s ease}
.dss_progressIndeterminate{width:35%;animation:dssSlide 1.1s ease-in-out infinite}
.dss_why{font-size:12px;color:var(--dsw-alias-label-secondary,#6b7280);flex:1;min-width:0}
.dss_cacheRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px}
.dss_spinner{width:11px;height:11px;margin-right:6px;border-radius:50%;display:inline-block;vertical-align:-1px;border:2px solid currentColor;border-top-color:transparent;animation:dssSpin .7s linear infinite}
@keyframes dssSpin{to{transform:rotate(360deg)}}
@keyframes dssSlide{0%{margin-left:-35%}100%{margin-left:100%}}
@media (prefers-reduced-motion:reduce){.dss_spinner{animation:none}.dss_progressIndeterminate{animation:none;width:100%;opacity:.5}.dss_setChev{transition:none}.dss_setCard{transition:none}}
.dss_verdict{font-size:12px;line-height:18px;border-radius:8px;padding:6px 10px;margin-top:6px;border:1px solid transparent}
.dss_verdict_repaired{background:rgba(22,163,74,.10);color:#15803d;border-color:rgba(22,163,74,.28)}
.dss_verdict_repaired-with-residual{background:rgba(217,119,6,.10);color:#b45309;border-color:rgba(217,119,6,.28)}
.dss_verdict_nothing-to-do{background:rgba(107,114,128,.10);color:#4b5563;border-color:rgba(107,114,128,.28)}
.dss_verdict_not-applicable{background:rgba(107,114,128,.10);color:#4b5563;border-color:rgba(107,114,128,.28)}
.dss_verdict_failed{background:rgba(220,38,38,.10);color:#b91c1c;border-color:rgba(220,38,38,.28)}
.dss_phaseRow{display:flex;gap:8px;align-items:center}
.dss_phase{font-weight:600;font-size:12px}
.dss_cmdBlock{display:flex;flex-direction:column;gap:4px;border:1px dashed var(--dsw-alias-border-l2,#e5e7eb);border-radius:10px;padding:6px 8px}
.dss_cmdLine{display:flex;gap:6px;align-items:center}
.dss_cmd{flex:1 1 auto;font-family:var(--ds-font-family-code,monospace);font-size:11px;white-space:pre-wrap;word-break:break-all}
.dss_setCard{border:1px solid var(--dsw-alias-border-l2,#e5e7eb);background:var(--dsw-alias-bg-layer-3,rgba(127,127,127,.05));border-radius:12px;transition:border-color .16s,background .16s}
.dss_setHead{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:none;border:0;border-radius:12px;display:flex;align-items:center;gap:12px;padding:14px 16px}
.dss_setHeadText{display:flex;flex-direction:column;gap:2px;flex:1 1 0%;min-width:0}
.dss_setCardTitle{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary,#111827)}
.dss_setCardDesc{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary,#9ca3af)}
.dss_setChev{color:var(--dsw-alias-label-tertiary,#9ca3af);flex:0 0 auto;transition:transform .16s}
.dss_setCardOpen .dss_setChev{transform:rotate(180deg)}
.dss_setBody{display:flex;flex-direction:column;gap:2px;padding:0 16px 12px}
.dss_setRow{display:flex;align-items:center;gap:10px;padding:6px 0}
.dss_setText{display:flex;flex-direction:column;flex:1 1 auto;min-width:0}
.dss_setTitle{font-size:13px;color:var(--dsw-alias-label-primary,#111827)}
.dss_setDesc{font-size:12px;color:var(--dsw-alias-label-tertiary,#9ca3af)}
.dss_toggle{display:inline-flex;align-items:center;cursor:pointer;position:relative}
.dss_toggle input{position:absolute;opacity:0;width:0;height:0}
.dss_toggleTrack{width:34px;height:18px;border-radius:999px;background:var(--dsw-alias-border-l2,#d1d5db);position:relative;transition:background .15s ease}
.dss_toggleKnob{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left .15s ease}
.dss_toggleOn .dss_toggleTrack{background:var(--dsw-alias-button-primary-fill,#3f63d8)}
.dss_toggleOn .dss_toggleKnob{left:18px}
`;
			document.head.appendChild(style);
			return () => {
				style.remove();
			};
		}
		/**
		* 客户端插件主体。
		* @param ctx - 客户端上下文（slots、可选 locale / configForms）。
		*/
		function apply(ctx) {
			ctx.effect(() => injectStyles(), "dsh-session-steward: stylesheet");
			const locale = ctx.get("locale");
			if (locale !== void 0 && typeof locale.register === "function") ctx.effect(() => locale.register(NS, {
				zh,
				en
			}), "dsh-session-steward: dictionaries");
			const configForms = ctx.get("configForms");
			const legacySettings = ctx.get("settingsScope");
			const bound = configForms?.get("dsh-session-steward") ?? legacySettings?.bind({ namespace: "session-steward" });
			const slots = ctx.get("slots");
			if (slots === void 0) return;
			slots.inject("sidebar.footer.action", () => slots.register({
				name: "sidebar.footer.action",
				id: STEWARD_ENTRY_ID,
				order: 12
			}, (props) => (0, react.createElement)(StewardEntry, {
				...props,
				scope: bound
			})), "dsh-session-steward: sidebar footer entry");
		}
		/** 入口按钮：持有面板开关；两个页签的可见性来自配置快照。 */
		function StewardEntry(props) {
			const [open, setOpen] = (0, react.useState)(false);
			const snapshot = (0, react.useSyncExternalStore)((listener) => props.scope !== void 0 ? props.scope.subscribe(listener) : () => {}, () => props.scope !== void 0 ? props.scope.getSnapshot() : { value: DEFAULT_CONFIG });
			const config = {
				...DEFAULT_CONFIG,
				...snapshot.value ?? {}
			};
			const historyFiles = config.historyFiles !== false;
			const healthCheck = config.healthCheck !== false;
			const visible = config.enabled !== false && (historyFiles || healthCheck);
			const wide = props.wide === true;
			const label = translate(void 0, "panel.title");
			if (!visible) return (0, react.createElement)("span", { className: "dss_entryWrap" });
			return (0, react.createElement)("span", { className: wide ? "dss_entryWrap dss_entryWrapWide" : "dss_entryWrap" }, [(0, react.createElement)(StewardFooter, {
				key: "btn",
				title: label,
				label,
				wide,
				onClick: () => {
					setOpen(!open);
				}
			}), open ? (0, react.createElement)(StewardPanel, {
				key: "panel",
				historyFiles,
				healthCheck,
				onClose: () => {
					setOpen(false);
				}
			}) : null]);
		}
		//#endregion
		exports.NS = NS;
		exports.STEWARD_ENTRY_ID = STEWARD_ENTRY_ID;
		exports.STEWARD_SETTINGS_NAMESPACE = STEWARD_SETTINGS_NAMESPACE;
		exports.StewardEntry = StewardEntry;
		exports.TAB_HEALTH = TAB_HEALTH;
		exports.TAB_HISTORY = TAB_HISTORY;
		exports.apply = apply;
		exports.inject = inject;
		exports.translate = translate;
		return module.exports;
	}
});
