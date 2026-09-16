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
			"history.delete": "删除选中 ({n})",
			"history.deleting": "删除中…",
			"history.editingHint": "编辑模式：勾选要清理的会话，按「删除选中」从官方归档数组移除（自动备份，需重启 DSH 生效）。",
			"history.restartHint": "已从归档数组移除 {removed} 个 id（剩余 {remaining}）。请重启 DSH 使官方侧生效。",
			"history.source.registry": "来源：宿主归档注册表",
			"history.source.storage-file": "来源：存储文件",
			"history.source.none": "两处都读不到归档集合",
			"history.confirm": "确认从归档数组中移除 {n} 个会话 id？\n\n{summary}\n\n将写入存储文件（自动备份），需要重启 DSH 后官方侧生效。此操作不可撤销。",
			"health.scan": "开始体检",
			"health.scanning": "体检中…",
			"health.progress": "{done}/{total} · 已用 {sec}s",
			"health.empty": "未发现异常会话。",
			"health.clean": "四门全绿。",
			"health.level.ok": "正常",
			"health.level.warn": "注意",
			"health.level.skipped": "未检查",
			"health.level.fail": "异常",
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
			"history.delete": "Delete selected ({n})",
			"history.deleting": "Deleting…",
			"history.editingHint": "Edit mode: tick sessions to clean, then remove them from the official archive array (backed up; a DSH restart is required).",
			"history.restartHint": "Removed {removed} id(s) from the archive array ({remaining} left). Restart DSH to apply.",
			"history.source.registry": "Source: host archive registry",
			"history.source.storage-file": "Source: storage file",
			"history.source.none": "The archive set is unreadable from both sources",
			"history.confirm": "Remove {n} session id(s) from the archive array?\n\n{summary}\n\nThis writes the storage file (auto backup) and needs a DSH restart. It cannot be undone.",
			"health.scan": "Run checkup",
			"health.scanning": "Running…",
			"health.progress": "{done}/{total} · {sec}s elapsed",
			"health.empty": "No problem session found.",
			"health.clean": "All four gates are green.",
			"health.level.ok": "ok",
			"health.level.warn": "warn",
			"health.level.skipped": "Not checked",
			"health.level.fail": "fail",
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
		//#region src/client/card.tsx
		/**
		* 设置卡（插件配置行）：两个开关 —— 会话历史文件 / 健康检查。
		*
		* 与 dsh-session-search-toggle 的 card 同范式：`Row`（标题+说明+控件）+ `Toggle`，
		* 读写走 settingsScope 的显式 `set`（用户在控件上的直接操作，非隐式提交）。
		*/
		/** 一行设置项。 */
		function Row(props) {
			return (0, react.createElement)("div", { className: "dss_setRow" }, [(0, react.createElement)("div", {
				key: "text",
				className: "dss_setText"
			}, [(0, react.createElement)("span", {
				key: "t",
				className: "dss_setTitle"
			}, props.title), props.desc !== void 0 && (0, react.createElement)("span", {
				key: "d",
				className: "dss_setDesc"
			}, props.desc)]), (0, react.createElement)("div", { key: "ctl" }, props.control)]);
		}
		/** 一个布尔开关（原生 checkbox 语义，样式由本插件 CSS 提供）。 */
		function Toggle(props) {
			return (0, react.createElement)("label", { className: `dss_toggle${props.checked ? " dss_toggleOn" : ""}` }, [(0, react.createElement)("input", {
				key: "i",
				type: "checkbox",
				checked: props.checked,
				disabled: props.disabled === true,
				onChange: (event) => {
					props.onChange(event.target.checked);
				}
			}), (0, react.createElement)("span", {
				key: "s",
				className: "dss_toggleTrack"
			}, (0, react.createElement)("span", { className: "dss_toggleKnob" }))]);
		}
		/** 插件设置卡主体。 */
		function StewardSettingsCard({ t, scope }) {
			const snapshot = (0, react.useSyncExternalStore)((listener) => scope.subscribe(listener), () => scope.getSnapshot());
			const value = snapshot.value ?? {};
			const writable = snapshot.writable;
			if (snapshot.status === "unavailable") return (0, react.createElement)("div", { className: "dss_setRow" }, (0, react.createElement)("span", { className: "dss_setTitle" }, translate(t, "card.unavailable")));
			const rows = [
				(0, react.createElement)(Row, {
					key: "enabled",
					title: translate(t, "card.enabled"),
					desc: translate(t, "card.enabled.desc"),
					control: (0, react.createElement)(Toggle, {
						checked: value.enabled ?? DEFAULT_CONFIG.enabled,
						disabled: !writable,
						onChange: (checked) => {
							scope.set("enabled", checked);
						}
					})
				}),
				(0, react.createElement)(Row, {
					key: "history",
					title: translate(t, "card.history"),
					desc: translate(t, "card.history.desc"),
					control: (0, react.createElement)(Toggle, {
						checked: value.historyFiles ?? DEFAULT_CONFIG.historyFiles,
						disabled: !writable,
						onChange: (checked) => {
							scope.set("historyFiles", checked);
						}
					})
				}),
				(0, react.createElement)(Row, {
					key: "health",
					title: translate(t, "card.health"),
					desc: translate(t, "card.health.desc"),
					control: (0, react.createElement)(Toggle, {
						checked: value.healthCheck ?? DEFAULT_CONFIG.healthCheck,
						disabled: !writable,
						onChange: (checked) => {
							scope.set("healthCheck", checked);
						}
					})
				})
			];
			if (!writable) rows.push((0, react.createElement)("div", {
				key: "ro",
				className: "dss_setDesc"
			}, translate(t, "card.readonly")));
			return (0, react.createElement)("div", { className: "dss_setBody" }, rows);
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
		* **迁入**并适配到本包的方法名（`session-history-list` / `session-history-prune`）。
		*
		* 行为与迁移前一致（含「显式编辑模式才允许清理」的门禁与 JS confirm）：
		* 行不可导航（归档会话已离开活跃系统）；清理写存储文件（自动备份）并需要重启 DSH。
		* 差异：列表来源改为官方归档集合真值，因此额外显示来源与降级提示。
		*/
		/** 养老院面板。 */
		function HistoryPanel({ t, onClose }) {
			const [items, setItems] = (0, react.useState)(null);
			const [source, setSource] = (0, react.useState)("");
			const [degraded, setDegraded] = (0, react.useState)("");
			const [error, setError] = (0, react.useState)(null);
			const [attempt, setAttempt] = (0, react.useState)(0);
			const [selected, setSelected] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [pruning, setPruning] = (0, react.useState)(false);
			const [note, setNote] = (0, react.useState)(null);
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
			};
			const toggleAll = () => {
				setSelected((prev) => prev.size === (items?.length ?? 0) ? /* @__PURE__ */ new Set() : new Set((items ?? []).map((item) => item.sessionId)));
			};
			/** JS confirm 门禁，然后提交清理。 */
			const pruneSelected = () => {
				const ids = [...selected];
				if (ids.length === 0) return;
				const summary = ids.length <= 5 ? ids.map((id) => `${id.slice(0, 22)}…`).join("\n") : `${ids.slice(0, 4).map((id) => `${id.slice(0, 22)}…`).join("\n")}\n… 共 ${ids.length} 个`;
				if (!(typeof window !== "undefined" && typeof window.confirm === "function" ? window.confirm(translate(t, "history.confirm", {
					n: ids.length,
					summary
				})) : false)) return;
				setPruning(true);
				setNote(null);
				callHostAny("session-history-prune", { sessionIds: ids }, 6e4).then((res) => {
					if (res.ok === true) {
						setNote(translate(t, "history.restartHint", {
							removed: res.removed ?? ids.length,
							remaining: res.remaining ?? "?"
						}));
						setSelected(/* @__PURE__ */ new Set());
						setAttempt((n) => n + 1);
					} else setNote(res.error ?? "清理失败");
				}).catch((err) => setNote(`清理失败：${String(err instanceof Error ? err.message : err)}`)).finally(() => setPruning(false));
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
				}, [(0, react.createElement)("button", {
					key: "all",
					type: "button",
					className: "dss_actBtn",
					onClick: toggleAll
				}, allSelected ? translate(t, "history.unselectAll") : translate(t, "history.selectAll")), (0, react.createElement)("button", {
					key: "prune",
					type: "button",
					className: "dss_actBtn dss_dangerBtn",
					disabled: pruning || selected.size === 0,
					onClick: pruneSelected
				}, pruning ? translate(t, "history.deleting") : translate(t, "history.delete", { n: selected.size }))]));
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
				editing && (0, react.createElement)("div", {
					key: "hint",
					className: "dss_status"
				}, translate(t, "history.editingHint")),
				degraded !== "" && (0, react.createElement)("div", {
					key: "degraded",
					className: "dss_status dss_warnText"
				}, degraded),
				source !== "" && (0, react.createElement)("div", {
					key: "source",
					className: "dss_metaLine"
				}, translate(t, source === "registry" ? "history.source.registry" : source === "storage-file" ? "history.source.storage-file" : "history.source.none")),
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
		* 体检面板：体检（四门）→ 处方（命令清单）→ 出院（可逆处置 + before/after 对照）。
		*
		* 三态流转完全由 host 侧报告驱动，客户端只做展示与触发；重型动作都在 host，
		* 渲染周期内不发同步重活。
		*/
		const GATE_LABEL = {
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
		/** 侧边栏脚部入口（照抄 toggle 的 footer 组件形态）。 */
		function StewardFooter(props) {
			return (0, react.createElement)("button", {
				type: "button",
				className: "dss_footerEntry",
				title: props.title ?? "会话管家",
				"aria-label": props.title ?? "会话管家",
				onClick: props.onClick
			}, (0, react.createElement)("span", {
				className: "dss_footerIcon",
				"aria-hidden": true
			}, "🧭"));
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
.dss_entryWrap{display:inline-flex;align-items:center}
.dss_footerEntry{width:28px;height:28px;border:none;background:transparent;cursor:pointer;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary)}
.dss_footerEntry:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dss_footerIcon{font-size:15px;line-height:1}
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
@media (prefers-reduced-motion:reduce){.dss_spinner{animation:none}.dss_progressIndeterminate{animation:none;width:100%;opacity:.5}}
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
.dss_setBody{display:flex;flex-direction:column;gap:2px}
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
		* @param ctx - 客户端上下文（slots、可选 locale / settingsScope）。
		*/
		function apply(ctx) {
			ctx.effect(() => injectStyles(), "dsh-session-steward: stylesheet");
			const locale = ctx.get("locale");
			if (locale !== void 0 && typeof locale.register === "function") ctx.effect(() => locale.register(NS, {
				zh,
				en
			}), "dsh-session-steward: dictionaries");
			const bound = ctx.get("settingsScope")?.bind({ namespace: STEWARD_SETTINGS_NAMESPACE });
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
			slots.inject("settings.plugin.item", () => slots.register({
				name: "settings.plugin.item",
				id: STEWARD_SETTINGS_NAMESPACE,
				key: STEWARD_SETTINGS_NAMESPACE,
				locale: locale !== void 0 ? NS : void 0,
				inject: () => ({ scope: bound ?? {
					getSnapshot: () => ({
						status: "ready",
						value: DEFAULT_CONFIG,
						revision: void 0,
						writable: false
					}),
					subscribe: () => () => {},
					set: async () => {}
				} })
			}, StewardSettingsCard), "dsh-session-steward: plugin settings card");
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
			if (!(config.enabled !== false && (historyFiles || healthCheck))) return (0, react.createElement)("span", { className: "dss_entryWrap" });
			return (0, react.createElement)("span", { className: "dss_entryWrap" }, [(0, react.createElement)(StewardFooter, {
				key: "btn",
				title: translate(void 0, "panel.title"),
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
