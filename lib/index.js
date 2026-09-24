import z from "@deepseek-ai/schemastery";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import zlib from "node:zlib";
//#region src/config.ts
/** 缺省值。 */
const DEFAULT_CONFIG = {
	enabled: true,
	historyFiles: true,
	healthCheck: true
};
/** host 半身注册的设置命名空间（与 src/index.ts 保持一致）。 */
const STEWARD_SETTINGS_NAMESPACE = "session-steward";
/** host 路由前缀（与搜索索引插件的 /switch-search/api 互不干扰）。 */
const STEWARD_API_PREFIX = "/session-steward/api";
//#endregion
//#region src/host/history/archive-source.ts
/**
* 官方归档集合（archive set）的读取与清理 —— 自 dsh-session-search-toggle
* `src/host/archive-source.ts` **逐字迁入**（只依赖 node:fs/os/path），行为与迁移前等价。
*
* 读取顺序：**优先直接读规范存储文件**（workspace domain 把 `archivedSessionIds`
* 落在 `global` 段：storage-json 即 `~/.dsh/storages/workspace.json`），
* 文件缺失时才回退到进程内 `workspaceRegistry` 服务。
* 之所以不再让 registry 优先：prune 只能改文件，列表若以 registry 为准，
* 清理成功后面板不会发生任何变化。registry 仍被读取，但只用作诊断面
* （`registryIds`：指出「已出文件、仍在内存里生效」的悬挂项）。
* 每次读取独立决定来源；失败降级为「空归档集合」并通过 diagnostics 面暴露。
*
* 写入（清理）：官方后端没有 unarchive 端点，因此按 storage-json 自身的协议直接编辑
* 规范文件 —— 备份、同目录临时文件、原子改名。运行中的宿主只在启动时加载该集合，
* 调用方必须提示需要重启 DSH。
*/
/** workspace domain 的 DSH 存储中枢候选路径（json 后端）。 */
function storageFileCandidates() {
	return [join(homedir(), ".dsh", "storages", "workspace.json")];
}
/** 解析存储文件 global.archivedSessionIds；内容畸形时抛错。 */
function readStorageFile(path) {
	const ids = JSON.parse(readFileSync(path, "utf8")).global?.archivedSessionIds;
	if (!Array.isArray(ids)) throw new Error(`storage hub "${path}" holds no global.archivedSessionIds array`);
	return ids.filter((id) => typeof id === "string");
}
/** 尽力读取宿主内存里的归档集合；不可用时返回 undefined。 */
function readRegistryIds(registry) {
	if (registry === void 0) return void 0;
	try {
		const ids = registry.archivedSessionIds;
		return Array.isArray(ids) ? ids : void 0;
	} catch {
		return;
	}
}
/**
* 解析一次官方归档集合。
*
* **存储文件优先**：prune 唯一能改的就是这份文件，列表必须与「能被改的那份」
* 同源，否则清理成功后面板看起来毫无变化 —— 宿主 registry 是进程启动时的快照，
* 直接编辑文件不会回写它，于是「文件在瘦身、列表纹丝不动」。
* registry 退居为文件缺失时的兜底，同时作为诊断面（`registryIds`）返回。
* @param registry - 惰性 workspaceRegistry 面（可能缺失或抛错）。
* @param searchPaths - 可选候选路径覆盖（DSH_HOME 非默认值或测试注入时使用）。
* @returns 归档 ids、服务它的来源，以及宿主内存里的同一集合。
*/
function readArchiveSet(registry, searchPaths) {
	const registryIds = readRegistryIds(registry);
	for (const path of searchPaths ?? storageFileCandidates()) {
		if (!existsSync(path)) continue;
		try {
			return {
				ids: readStorageFile(path),
				source: "storage-file",
				...registryIds === void 0 ? {} : { registryIds }
			};
		} catch {}
	}
	if (registryIds !== void 0) return {
		ids: registryIds,
		source: "registry",
		registryIds
	};
	return {
		ids: [],
		source: "none"
	};
}
/**
* **本插件写 workspace.json 的唯一入口。**
*
* 任何「改归档集合 / 改工作区成员表」都必须走这里 —— 出现第二个写文件的实现，
* 就会重现「读的人和写的人不是同一份数据」那类问题。
*
* 协议与 storage-json 自身一致：读 → `edit(document)` 就地改 → 备份 → 同目录临时写入
* → 原子改名。`edit` 返回 `false` 表示无需写入（此时**不产生备份**）。
* @param path - 规范存储文件路径。
* @param edit - 就地修改文档；返回是否真的改了。
* @param log - 可选日志出口。
* @returns 编辑结果；失败时给出原因而非抛错。
*/
function editWorkspaceDocument(path, edit, log) {
	if (!existsSync(path)) return {
		ok: false,
		reason: `存储文件不存在：${path}`
	};
	let document;
	try {
		document = JSON.parse(readFileSync(path, "utf8"));
	} catch (err) {
		return {
			ok: false,
			reason: `无法解析 "${path}"：${String(err instanceof Error ? err.message : err)}`
		};
	}
	let changed;
	try {
		changed = edit(document);
	} catch (err) {
		return {
			ok: false,
			reason: `编辑 "${path}" 失败：${String(err instanceof Error ? err.message : err)}`
		};
	}
	if (!changed) return {
		ok: true,
		changed: false,
		file: path
	};
	const backup = `${path}.bak-${Date.now()}`;
	copyFileSync(path, backup);
	const tmp = `${path}.prune-tmp`;
	writeFileSync(tmp, `${JSON.stringify(document, null, 2)}
`, "utf8");
	renameSync(tmp, path);
	log?.(`workspace.json edited; backup=${backup}`);
	return {
		ok: true,
		changed: true,
		file: path
	};
}
/**
* 从存储中枢的 `global.archivedSessionIds` 中移除会话 id（= 取消归档状态）。
*
* 官方后端没有 unarchive 端点，因此直接编辑规范文件；运行中的宿主把集合留在内存里、
* 只在启动时重载 —— 调用方必须提示需要重启 DSH。
* @param ids - 要从归档数组中移除的会话 id。
* @param log - 可选日志出口。
* @param searchPaths - 可选候选路径覆盖（测试注入用）。
* @returns 实际移除数量与剩余数量。
*/
function pruneArchiveFile(ids, log, searchPaths) {
	const wanted = new Set(ids);
	let lastReason = "workspace storage file not found (searched ~/.dsh/storages/workspace.json)";
	for (const path of searchPaths ?? storageFileCandidates()) {
		let removed = 0;
		let remaining = 0;
		const outcome = editWorkspaceDocument(path, (document) => {
			const global = document.global;
			const current = global?.archivedSessionIds;
			if (!Array.isArray(current)) throw new Error(`storage hub "${path}" holds no global.archivedSessionIds array`);
			const kept = current.filter((id) => typeof id === "string" && !wanted.has(id));
			removed = current.length - kept.length;
			remaining = kept.length;
			if (removed === 0) return false;
			document.global = {
				...global,
				archivedSessionIds: kept
			};
			return true;
		}, log);
		if (!outcome.ok) {
			lastReason = outcome.reason;
			continue;
		}
		if (outcome.changed) log?.(`archive prune: removed ${removed} ids; remaining ${remaining}`);
		return {
			removed,
			remaining,
			file: outcome.file
		};
	}
	throw new Error(lastReason);
}
//#endregion
//#region src/host/history/purge.ts
/**
* 归档文件清理（**真删除**）—— 会话管家唯一的破坏性操作。
*
* 与「取消归档状态」（`pruneArchiveFile`）是**两件事**，刻意分开：
*
* | | 取消归档状态 | 清理归档文件 |
* |---|---|---|
* | 改什么 | 只改 `global.archivedSessionIds` | 删磁盘实体 **+** 改两处 id |
* | 会话 | 回到侧边栏 | 从世界上消失 |
* | 可逆 | 重启即生效 | 不可逆 |
*
* 「清理归档文件」必须**连带**执行「取消归档状态」：文件删了、id 还留在数组里，
* 就是一条僵尸归档 —— 侧边栏看不见它，一旦被取消归档又会冒出一个打不开的空会话。
*
* 一次清理动 4 处：
* 1. `~/.dsh/sessions/<工作区>/<会话id>/` —— 整个目录（可能含 `session.jsonl.zstd`
*    与旧格式 `session.v3.jsonl.zstd` 两份，所以必须整目录删，不能只删当前格式）
* 2. `~/.dsh/storages/session_projcache/sessions/<会话id>.json` —— 逐条投影缓存
* 3. `workspace.json` → `global.archivedSessionIds`
* 4. `workspace.json` → `tables.workspaces.*.sessionIds`
*
* 执行顺序是**先改文件、后删实体**：改文件是原子的且可整体中止（失败则一个字节都没删）；
* 反过来先删实体再改文件，中途失败会留下僵尸 id。
*/
/** 转录根目录（`<dshHome>/sessions`）。 */
function sessionsRootFor(dshHome) {
	return join(dshHome, "sessions");
}
/**
* 投影缓存（**逐条布局**）根目录。
*
* 注意另有一个 `<dshHome>/storages/session_projcache.json`（整份布局）——
* 那是布局迁移留下的**化石**，宿主早已不再写它，本插件也不碰它。
*/
function projCacheRootFor(dshHome) {
	return join(dshHome, "storages", "session_projcache", "sessions");
}
/**
* 会话 id 的目录名归一化。
*
* 归档集合里一律是 `session-<uuid>`，但子会话的目录名是不带前缀的 `<uuid>`，
* 两者必须视为同一个会话，否则清理会「找不到文件」而静默什么都没删。
*/
function dirKey(name) {
	return name.startsWith("session-") ? name.slice(8) : name;
}
/** 是不是目录（读不到就当不是）。 */
function isDir(path) {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
}
/**
* 扫一遍转录根，建立「会话 id → 目录」索引。
*
* 同一个 id 同时存在带前缀与不带前缀的目录时，**优先带 `session-` 前缀的那个**
* （归档集合里的 id 本身带前缀）。
* @param sessionsRoot - `<dshHome>/sessions`。
* @returns 归一化 id → 目录绝对路径。
*/
function indexSessionDirs(sessionsRoot) {
	const map = /* @__PURE__ */ new Map();
	if (!existsSync(sessionsRoot)) return map;
	for (const workspace of readdirSync(sessionsRoot)) {
		const wsDir = join(sessionsRoot, workspace);
		if (!isDir(wsDir)) continue;
		for (const name of readdirSync(wsDir)) {
			const entry = join(wsDir, name);
			if (!isDir(entry)) continue;
			const key = dirKey(name);
			const existing = map.get(key);
			const prefer = name.startsWith("session-") && existing !== void 0 && !basename(existing).startsWith("session-");
			if (existing === void 0 || prefer) map.set(key, entry);
		}
	}
	return map;
}
/** 递归求目录占用字节数（读不到的条目跳过，不抛错）。 */
function dirSize(dir) {
	let total = 0;
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return 0;
	}
	for (const entry of entries) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) total += dirSize(path);
		else try {
			total += statSync(path).size;
		} catch {}
	}
	return total;
}
/**
* 解析一批会话在磁盘上的实体与占用（**只读，不删任何东西**）。
*
* 列表按行显示体积就走这里 —— 体积差异极大（实测单条缓存可达 23 MB、单条转录可达
* 6 MB，也有 0 字节的），报一个总量对用户没有意义。
* @param ids - 会话 id（带不带 `session-` 前缀都接受）。
* @param dshHome - DSH 主目录。
* @returns 会话 id → 实体位置与占用。
*/
function locateSessionUsage(ids, dshHome) {
	const dirs = indexSessionDirs(sessionsRootFor(dshHome));
	const cacheRoot = projCacheRootFor(dshHome);
	const out = /* @__PURE__ */ new Map();
	for (const sessionId of ids) {
		const key = dirKey(sessionId);
		const usage = {
			sessionId,
			bytes: 0,
			cacheBytes: 0
		};
		const dir = dirs.get(key);
		if (dir !== void 0) {
			usage.dir = dir;
			usage.bytes = dirSize(dir);
		}
		for (const name of [`${sessionId}.json`, `${key}.json`]) {
			const candidate = join(cacheRoot, name);
			if (existsSync(candidate)) {
				usage.cacheFile = candidate;
				try {
					usage.cacheBytes = statSync(candidate).size;
				} catch {}
				break;
			}
		}
		out.set(sessionId, usage);
	}
	return out;
}
/**
* 断言目标是 `root` 的**直接子项**（层级也校验）。
*
* 破坏性操作不能只靠「路径拼对了」—— 拼错一层就是删掉整个 sessions 根。
* @param root - 允许的父目录。
* @param target - 待删目标。
* @param depth - 相对 root 的期望层数。
* @returns 是否安全。
*/
function isSafeChild(root, target, depth) {
	const rel = relative(resolve(root), resolve(target));
	if (rel === "" || rel.startsWith("..") || resolve(root, rel) !== resolve(target)) return false;
	return rel.split(sep).filter((part) => part !== "").length === depth;
}
/** 单次清理的最大 id 数（与 prune 一致）。 */
const MAX_PURGE_IDS = 5e3;
/**
* `session-history-purge`：**真删除**归档会话的磁盘实体，并连带取消其归档状态。
* @param payload - `{ sessionIds: string[] }`。
* @param log - 可选日志出口。
* @param options - `dshHome` 必填；`searchPaths` 可选覆盖。
* @returns 清理条数、释放字节数与逐条失败。
*/
function purgeHistory(payload, log, options) {
	const dshHome = options?.dshHome;
	if (dshHome === void 0 || dshHome === "") return {
		ok: false,
		error: "缺少 dshHome：破坏性清理拒绝在未知路径上执行"
	};
	const record = payload;
	if (!Array.isArray(record?.sessionIds) || record.sessionIds.length === 0) return {
		ok: false,
		error: "缺少 sessionIds 数组"
	};
	const ids = [...new Set(record.sessionIds.filter((id) => typeof id === "string" && id !== ""))];
	if (ids.length === 0) return {
		ok: false,
		error: "sessionIds 无有效值"
	};
	if (ids.length > 5e3) return {
		ok: false,
		error: `单次最多清理 ${MAX_PURGE_IDS} 个`
	};
	const wanted = new Set(ids);
	const usage = locateSessionUsage(ids, dshHome);
	const candidates = options?.searchPaths ?? [join(dshHome, "storages", "workspace.json")];
	let edited = false;
	let lastReason = `workspace 存储文件不存在（已试：${candidates.join("、")}）`;
	for (const path of candidates) {
		const outcome = editWorkspaceDocument(path, (document) => {
			let changed = false;
			const global = document.global;
			if (Array.isArray(global?.archivedSessionIds)) {
				const kept = global.archivedSessionIds.filter((id) => typeof id !== "string" || !wanted.has(id));
				if (kept.length !== global.archivedSessionIds.length) {
					document.global = {
						...global,
						archivedSessionIds: kept
					};
					changed = true;
				}
			}
			const tables = document.tables;
			if (tables?.workspaces !== void 0) for (const [workspaceId, workspace] of Object.entries(tables.workspaces)) {
				if (!Array.isArray(workspace?.sessionIds)) continue;
				const kept = workspace.sessionIds.filter((id) => typeof id !== "string" || !wanted.has(id));
				if (kept.length !== workspace.sessionIds.length) {
					tables.workspaces[workspaceId] = {
						...workspace,
						sessionIds: kept
					};
					changed = true;
				}
			}
			return changed;
		}, log);
		if (!outcome.ok) {
			lastReason = outcome.reason;
			continue;
		}
		edited = true;
		break;
	}
	if (!edited) return {
		ok: false,
		error: lastReason
	};
	const sessionsRoot = sessionsRootFor(dshHome);
	const cacheRoot = projCacheRootFor(dshHome);
	const failures = [];
	let purged = 0;
	let freedBytes = 0;
	for (const sessionId of ids) {
		const entry = usage.get(sessionId);
		let missing = 0;
		let entryFreed = 0;
		if (entry?.dir !== void 0) {
			if (!isSafeChild(sessionsRoot, entry.dir, 2)) {
				failures.push({
					sessionId,
					reason: `拒绝删除越界路径：${entry.dir}`
				});
				continue;
			}
			try {
				rmSync(entry.dir, {
					recursive: true,
					force: true
				});
				entryFreed += entry.bytes;
			} catch (err) {
				failures.push({
					sessionId,
					reason: `删除转录目录失败：${String(err instanceof Error ? err.message : err)}`
				});
				continue;
			}
		} else missing++;
		if (entry?.cacheFile !== void 0) {
			if (!isSafeChild(cacheRoot, entry.cacheFile, 1)) {
				failures.push({
					sessionId,
					reason: `拒绝删除越界缓存：${entry.cacheFile}`
				});
				continue;
			}
			try {
				entryFreed += entry.cacheBytes;
				rmSync(entry.cacheFile, { force: true });
			} catch (err) {
				failures.push({
					sessionId,
					reason: `删除投影缓存失败：${String(err instanceof Error ? err.message : err)}`
				});
				continue;
			}
		} else missing++;
		if (missing === 2) log?.(`purge: ${sessionId} had no on-disk entity; only the archive state was cleared`);
		purged++;
		freedBytes += entryFreed;
	}
	log?.(`archive purge: cleared ${purged} of ${ids.length}; freed ${(freedBytes / 1048576).toFixed(1)}MB; failures ${failures.length}`);
	return {
		ok: true,
		purged,
		freedBytes,
		requiresRestart: true,
		...failures.length === 0 ? {} : { failures }
	};
}
//#endregion
//#region src/host/history/archive.ts
/**
* 会话历史文件（归档）域的服务端处理。
*
* 与 dsh-session-search-toggle 的差异（**刻意且必须记入交付说明**）：
* toggle 的 `list-archived` 从它自己的独立索引里列出归档行（`engine.listArchived()`），
* 而索引已随搜索索引包离开本包。因此本包改为从**官方归档集合**列出来源真值
* （`readArchiveSet`：存储文件优先、registry 兜底），标题等元数据为尽力而为：
* 依次尝试 `sessionQuery.readTitleSnapshots` → 投影缓存记录里的 title。
* 列表与 prune **同源**（都认存储文件），否则清理成功后面板不会刷新；
* registry 与文件的差集作为 `pendingRestart` 返回，面板据此提示重启。
* 清理（prune）路径与迁移前**逐字等价**（备份 + 原子替换 + 需重启提示），
* 另加一道写后校验：读回文件确认目标 id 确实消失。
*/
/** 投影缓存记录里可能存在的标题（同目录第二来源）。 */
function titleFromProjectionCache(sessionId) {
	const path = join(homedir(), ".dsh", "storages", "session_projcache", "sessions", `${sessionId}.json`);
	if (!existsSync(path)) return "";
	try {
		const value = JSON.parse(readFileSync(path, "utf8")).record?.rows?.title?.val;
		return typeof value === "string" ? value : "";
	} catch {
		return "";
	}
}
/**
* `session-history-list`：列出官方归档集合（尽力附带标题等元数据）。
* @param getRegistry - 惰性 workspaceRegistry 面。
* @param query - 可选标题快照面。
* @param searchPaths - 可选存储文件候选路径（DSH_HOME 非默认值/测试注入）。
* @returns 归档行清单。
*/
async function listHistory(getRegistry, query, searchPaths, dshHome) {
	const read = readArchiveSet(getRegistry(), searchPaths);
	if (read.source === "none") return {
		ok: false,
		error: "workspace 存储文件与 workspaceRegistry 均不可用，无法读取归档集合"
	};
	const ids = [...read.ids];
	const titles = /* @__PURE__ */ new Map();
	let degraded;
	if (query?.readTitleSnapshots !== void 0 && ids.length > 0) try {
		const observations = await query.readTitleSnapshots(ids);
		ids.forEach((id, index) => {
			const title = observations[index]?.value?.title?.title;
			if (typeof title === "string" && title !== "") titles.set(id, title);
		});
	} catch {
		degraded = "sessionQuery 标题快照不可用，标题回退到投影缓存/空";
	}
	else if (ids.length > 0) degraded = "sessionQuery 不可用，标题回退到投影缓存/空";
	const items = ids.map((sessionId) => {
		return {
			sessionId,
			title: titles.get(sessionId) ?? titleFromProjectionCache(sessionId),
			cwd: "",
			updatedAt: 0,
			bytes: 0,
			cacheBytes: 0
		};
	});
	if (dshHome !== void 0 && dshHome !== "" && items.length > 0) try {
		const usage = locateSessionUsage(ids, dshHome);
		for (const item of items) {
			const entry = usage.get(item.sessionId);
			if (entry === void 0) continue;
			item.bytes = entry.bytes;
			item.cacheBytes = entry.cacheBytes;
		}
	} catch {}
	const fileIds = new Set(ids);
	const pendingRestart = (read.registryIds ?? []).filter((id) => !fileIds.has(id)).length;
	return {
		ok: true,
		items,
		source: read.source,
		...degraded === void 0 ? {} : { degraded },
		...pendingRestart === 0 ? {} : { pendingRestart }
	};
}
/** 按 DSH_HOME 解析存储文件候选（与 archive-source 的默认候选保持同一形状）。 */
function storagePathsFor(dshHome) {
	return [join(dshHome, "storages", "workspace.json")];
}
/** 单次清理的最大 id 数（与迁移前一致）。 */
const MAX_PRUNE_IDS = 5e3;
/**
* `session-history-prune`：从官方归档数组中批量移除会话 id。
* 行为与迁移前等价：校验入参 → 备份并原子替换存储文件 → 返回 removed/remaining，
* 并明确要求重启 DSH（宿主内存中的集合只在启动时重载）。
* @param payload - `{ sessionIds: string[] }`。
* @param log - 可选日志出口。
* @param searchPaths - 可选候选路径覆盖（测试注入用）。
*/
function pruneHistory(payload, log, searchPaths) {
	const record = payload;
	if (!Array.isArray(record?.sessionIds) || record.sessionIds.length === 0) return {
		ok: false,
		error: "缺少 sessionIds 数组"
	};
	const ids = [...new Set(record.sessionIds.filter((id) => typeof id === "string" && id !== ""))];
	if (ids.length === 0) return {
		ok: false,
		error: "sessionIds 无有效值"
	};
	if (ids.length > 5e3) return {
		ok: false,
		error: `单次最多清理 ${MAX_PRUNE_IDS} 个`
	};
	let result;
	try {
		result = pruneArchiveFile(ids, log, searchPaths);
	} catch (err) {
		return {
			ok: false,
			error: String(err instanceof Error ? err.message : err)
		};
	}
	const after = readArchiveSet(void 0, searchPaths);
	if (after.source !== "storage-file") return {
		ok: false,
		error: "写入后无法读回存储文件，无法确认清理结果"
	};
	const stillThere = new Set(after.ids);
	const leftover = ids.filter((id) => stillThere.has(id));
	if (leftover.length > 0) return {
		ok: false,
		error: `存储文件在写入后仍包含 ${leftover.length} 个目标 id，清理未生效`
	};
	log?.(`archive prune requested ${ids.length}, removed ${result.removed}, remaining ${result.remaining}`);
	return {
		ok: true,
		removed: result.removed,
		remaining: result.remaining,
		requiresRestart: true
	};
}
//#endregion
//#region src/host/health/attribution.ts
/**
* 归属：把投影 key 指回产出它的插件包。
*
* 做法是静态扫描 profile 的 `node_modules`：`<pkg>/lib/index.js` 里
* `sessionProjections.register({ key: 'xxx' })`（或其定义工厂）会命中
* `key:\s*['"](\w+)['"]` 正则；据此建立 `投影 key → 包名` 索引。
* `@deepseek-ai/*` 视为内置（core）；扫不到时如实返回 `unknown`，禁止臆测。
*/
/** 默认扫描根：profile 的 node_modules。 */
function defaultProfileNodeModules(dshHome) {
	return join(dshHome ?? join(homedir(), ".dsh"), "profiles", "web", "node_modules");
}
/** 收集候选包目录（含 @scope/pkg 一层）。 */
function candidatePackages(root) {
	const out = [];
	if (!existsSync(root)) return out;
	for (const entry of readdirSync(root, { withFileTypes: true })) {
		if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
		if (entry.name.startsWith(".")) continue;
		const dir = join(root, entry.name);
		if (entry.name.startsWith("@")) {
			let scoped = [];
			try {
				scoped = readdirSync(dir);
			} catch {
				continue;
			}
			for (const child of scoped) out.push({
				name: `${entry.name}/${child}`,
				dir: join(dir, child)
			});
			continue;
		}
		out.push({
			name: entry.name,
			dir
		});
	}
	return out;
}
/** 单个入口文件的最大扫描字节数（超大 bundle 直接跳过，避免无谓内存与耗时）。 */
const MAX_SCAN_BYTES = 12 << 20;
/** 扫描若干候选入口文件里出现的投影 key。 */
function keysInFile(file) {
	if (!existsSync(file)) return [];
	let text;
	try {
		if (statSync(file).size > MAX_SCAN_BYTES) return [];
		text = readFileSync(file, "utf8");
	} catch {
		return [];
	}
	const keys = /* @__PURE__ */ new Set();
	const pattern = /key:\s*['"]([A-Za-z_$][\w$]*)['"]/g;
	let match;
	while ((match = pattern.exec(text)) !== null) {
		const key = match[1];
		if (key !== void 0 && key !== "") keys.add(key);
	}
	return [...keys];
}
/**
* 建立投影 key → 包 的索引。
* @param nodeModulesRoot - profile 的 node_modules 根。
* @returns 归属记录（同一 key 多包命中时保留首个并排序稳定）。
*/
function buildProjectionOwnerIndex(nodeModulesRoot) {
	const records = [];
	const seen = /* @__PURE__ */ new Set();
	for (const pack of candidatePackages(nodeModulesRoot)) {
		const lib = join(pack.dir, "lib");
		let entries = [];
		try {
			if (!statSync(lib).isDirectory()) continue;
			entries = readdirSync(lib).filter((name) => name.endsWith(".js"));
		} catch {
			continue;
		}
		for (const name of entries) {
			const file = join(lib, name);
			for (const key of keysInFile(file)) {
				if (seen.has(key)) continue;
				seen.add(key);
				records.push({
					key,
					package: pack.name,
					kind: pack.name.startsWith("@deepseek-ai/") ? "core" : "plugin",
					entry: `${pack.name}/lib/${name}`
				});
			}
		}
	}
	return records.sort((left, right) => left.key.localeCompare(right.key));
}
/** 索引查询器。 */
function createAttributor(index) {
	const byKey = new Map(index.map((record) => [record.key, record]));
	return (projection) => {
		const owner = byKey.get(projection);
		if (owner === void 0) return {
			projection,
			package: "unknown"
		};
		return {
			projection,
			package: owner.package
		};
	};
}
//#endregion
//#region src/host/health/cache.ts
/** 进程内体检缓存：分批扫描过程中累积，走完一遍语料才成型。 */
var HealthCache = class {
	ready;
	pending;
	/** 读当前成型的缓存（未成型则 undefined）。 */
	read() {
		return this.ready;
	}
	/** 开始一轮分批扫描（客户端以 `offset: 0` 发起时调用）。 */
	begin(total) {
		this.pending = {
			total: Math.max(0, Math.floor(total)),
			findings: [],
			visited: 0
		};
	}
	/**
	* 追加一批扫描结果。
	*
	* 只有累积的已访问数走满语料总数才成型；语言中途断掉（关面板、报错）不会留下
	* 半份缓存冒充完整结果。
	* @param findings - 本批的非 ok 报告。
	* @param scanned - 本批**已访问**的会话数（不是命中数）。
	* @param now - 时间源（测试可控）。
	* @returns 本批追加后缓存是否刚好成型。
	*/
	append(findings, scanned, now = Date.now) {
		const pending = this.pending;
		if (pending === void 0) return false;
		pending.findings.push(...findings);
		pending.visited += Math.max(0, Math.floor(scanned));
		if (pending.visited < pending.total) return false;
		this.ready = {
			findings: pending.findings,
			total: pending.total,
			generatedAt: now()
		};
		this.pending = void 0;
		return true;
	}
	/**
	* 单条就地回写（单会话体检 / 可逆处置后调用）。
	*
	* 这是缓存的**关键收益**：处置本就重算了 `after` 报告，把它写回即可，
	* 不必为了刷新一行而重扫整个语料。
	* @param report - 重算出的单会话报告。
	* @returns 是否真的改动了缓存（无缓存时为 false）。
	*/
	patch(report) {
		const ready = this.ready;
		if (ready === void 0) return false;
		const index = ready.findings.findIndex((entry) => entry.sessionId === report.sessionId);
		if (report.level === "ok") {
			if (index < 0) return false;
			ready.findings.splice(index, 1);
			return true;
		}
		if (index >= 0) ready.findings[index] = report;
		else ready.findings.push(report);
		return true;
	}
	/** 丢弃缓存与未完成的累积。 */
	clear() {
		this.ready = void 0;
		this.pending = void 0;
	}
};
//#endregion
//#region src/host/health/decode.ts
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
/** zstd 帧魔数（0xFD2FB528 的小端读取值）。 */
const ZSTD_MAGIC = 4247762216;
/** 打包行类型（读路径必须解包）。 */
const PACKED_ROWS = /* @__PURE__ */ new Set([
	"text-chunks",
	"reasoning-chunks",
	"tool-call-chunks"
]);
/** 扫描拼接的 zstd 多帧；返回完整帧范围与撕裂尾帧起点。 */
function scanZstdFrames(buffer) {
	const frames = [];
	let offset = 0;
	while (offset < buffer.length) {
		const start = offset;
		if (buffer.length - offset < 4) return {
			frames,
			tornStart: start
		};
		if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) return {
			frames,
			tornStart: start
		};
		offset += 4;
		if (offset === buffer.length) return {
			frames,
			tornStart: start
		};
		const descriptor = buffer.readUInt8(offset);
		offset += 1;
		if ((descriptor & 24) !== 0) return {
			frames,
			tornStart: start
		};
		const contentSizeFlag = descriptor >>> 6;
		const singleSegment = (descriptor & 32) !== 0;
		const checksum = (descriptor & 4) !== 0;
		const dictionaryFlag = descriptor & 3;
		const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
		const contentSizeBytes = contentSizeFlag === 0 ? singleSegment ? 1 : 0 : 1 << contentSizeFlag;
		const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
		if (buffer.length - offset < remainingHeaderBytes) return {
			frames,
			tornStart: start
		};
		offset += remainingHeaderBytes;
		for (;;) {
			if (buffer.length - offset < 3) return {
				frames,
				tornStart: start
			};
			const blockHeader = buffer.readUIntLE(offset, 3);
			offset += 3;
			const lastBlock = (blockHeader & 1) !== 0;
			const blockType = blockHeader >>> 1 & 3;
			const blockSize = blockHeader >>> 3;
			if (blockType === 3) return {
				frames,
				tornStart: start
			};
			const payloadBytes = blockType === 1 ? 1 : blockSize;
			if (buffer.length - offset < payloadBytes) return {
				frames,
				tornStart: start
			};
			offset += payloadBytes;
			if (lastBlock) break;
		}
		if (checksum) {
			if (buffer.length - offset < 4) return {
				frames,
				tornStart: start
			};
			offset += 4;
		}
		frames.push({
			start,
			end: offset
		});
	}
	return { frames };
}
/** 存储形态的 provenance（`[[start,end],…]` 区间编码或直接 seq 数组）展开为递增 seq 列表。 */
function decodeSeqRangesStorage(value, currentSeq) {
	if (!Array.isArray(value)) throw new Error("sourceEventSeqs must be an array when present");
	const out = [];
	for (const entry of value) {
		if (typeof entry === "number") {
			out.push(entry);
			continue;
		}
		if (Array.isArray(entry) && entry.length === 2) {
			const [start, end] = entry;
			if (typeof start !== "number" || typeof end !== "number" || end < start) throw new Error("sourceEventSeqs range is malformed");
			for (let seq = start; seq <= end; seq += 1) out.push(seq);
			continue;
		}
		throw new Error("sourceEventSeqs entry is neither a seq nor a [start,end] range");
	}
	for (const seq of out) if (!Number.isSafeInteger(seq) || seq < 0 || seq >= currentSeq) throw new Error(`sourceEventSeqs must reference earlier events: ${seq} >= ${currentSeq}`);
	return out;
}
/** 本地等价实现：把一行存储记录解包为事件（打包行展开为 assistant/chunk）。 */
function decodeRecordLocal(value) {
	if (typeof value !== "object" || value === null) return [value];
	const record = value;
	const type = record["type"];
	if (typeof type !== "string" || !PACKED_ROWS.has(type)) {
		const seq = record["seq"];
		if (typeof seq === "number" && (!Number.isSafeInteger(seq) || seq < 0)) throw new Error(`session event seq ${String(seq)} is not a non-negative safe integer`);
		return [record];
	}
	const data = record["data"];
	if (data === void 0) throw new Error(`malformed ${type} storage row: data must be an object`);
	const members = type === "tool-call-chunks" ? data["args"] : data["texts"];
	if (!Array.isArray(members) || members.length === 0 || members.some((entry) => typeof entry !== "string")) throw new Error(`malformed ${type} storage row: payload must be a non-empty string array`);
	const dt = data["dt"];
	if (!Array.isArray(dt) || dt.some((gap) => !Number.isSafeInteger(gap))) throw new Error(`malformed ${type} storage row: dt must be an array of safe integers`);
	if (dt.length !== members.length - 1) throw new Error(`malformed ${type} storage row: dt length ${dt.length} does not match ${members.length} members`);
	const seq0 = record["seq0"];
	const time0 = record["time0"];
	if (typeof seq0 !== "number" || typeof time0 !== "number") throw new Error(`malformed ${type} storage row: seq0/time0 must be numbers`);
	const turn = data["turn"];
	const step = data["step"];
	const index = data["index"];
	const out = [];
	let time = time0;
	for (let k = 0; k < members.length; k += 1) {
		if (k > 0) time += dt[k - 1];
		let chunk;
		if (type === "text-chunks") chunk = {
			type: "text-delta",
			index,
			text: members[k]
		};
		else if (type === "reasoning-chunks") chunk = {
			type: "reasoning-delta",
			index,
			text: members[k]
		};
		else chunk = {
			type: "tool-call-delta",
			index,
			id: typeof data["id"] === "string" ? data["id"] : "",
			...typeof data["name"] === "string" ? { name: data["name"] } : {},
			argumentsDelta: members[k]
		};
		out.push({
			type: "assistant/chunk",
			seq: seq0 + k,
			time,
			data: {
				turn,
				step,
				chunk
			}
		});
	}
	return out;
}
/**
* 读取一个会话日志文件（zip 帧扫描 + 解包 + seq 连续性）。
* @param file - 当前代日志的绝对路径（由代次解析得出，不假定具体文件名）。
* @param bytes - 文件内容（调用方读取，便于测试注入）。
* @param decoders - 可选官方解码器（缺省用本地等价实现）。
* @returns 事件、统计与问题清单。
*/
function decodeSessionLogBytes(file, bytes, decoders) {
	const { frames, tornStart } = scanZstdFrames(bytes);
	const parts = [];
	const frameIssues = [];
	for (const frame of frames) try {
		parts.push(zlib.zstdDecompressSync(bytes.subarray(frame.start, frame.end)));
	} catch (err) {
		frameIssues.push(`frame@${frame.start}: ${String(err instanceof Error ? err.message : err)}`);
	}
	let recoveredFromTorn = 0;
	if (tornStart !== void 0) try {
		const recovered = zlib.zstdDecompressSync(bytes.subarray(tornStart), { finishFlush: zlib.constants.ZSTD_e_flush });
		recoveredFromTorn = recovered.length;
		parts.push(recovered);
	} catch {}
	const lines = Buffer.concat(parts).toString("utf8").split("\n").filter((line) => line.trim() !== "");
	const issues = frameIssues.map((why, index) => ({
		line: index + 1,
		why
	}));
	const decodeRecord = decoders?.decodeStorageRecord ?? decodeRecordLocal;
	const events = [];
	for (let index = 1; index < lines.length; index += 1) {
		const line = lines[index];
		let decoded;
		try {
			const parsed = JSON.parse(line);
			decoded = decodeRecord(parsed["sourceEventSeqs"] === void 0 ? parsed : {
				...parsed,
				sourceEventSeqs: decoders?.decodeSeqRanges !== void 0 && typeof parsed["seq"] === "number" ? decoders.decodeSeqRanges(parsed["sourceEventSeqs"], parsed["seq"]) : decodeSeqRangesStorage(parsed["sourceEventSeqs"], Number(parsed["seq"] ?? 0))
			});
		} catch (err) {
			issues.push({
				line: index + 1,
				why: `decode failed: ${String(err instanceof Error ? err.message : err)}`
			});
			break;
		}
		const rowStart = events.length;
		let gapped = false;
		for (const event of decoded) {
			if (event.seq !== events.length) {
				issues.push({
					line: index + 1,
					why: `seq gap (expected ${events.length}, got ${event.seq})`
				});
				events.length = rowStart;
				gapped = true;
				break;
			}
			events.push(event);
		}
		if (gapped) break;
	}
	const openStep = findOpenStep(events);
	let header;
	const headerLine = lines[0];
	if (headerLine !== void 0) try {
		const parsed = JSON.parse(headerLine);
		if (typeof parsed === "object" && parsed !== null) header = parsed;
	} catch {}
	return {
		events,
		frames: frames.length,
		...tornStart === void 0 ? {} : { tornStart },
		recoveredFromTorn,
		issues,
		decoder: decoders === void 0 ? "local" : "official",
		...openStep === void 0 ? {} : { openStep },
		...header === void 0 ? {} : { header }
	};
}
/** 从文件读取并解码。 */
function decodeSessionLogFile(file, decoders) {
	return decodeSessionLogBytes(file, readFileSync(file), decoders);
}
/** 尾部未收尾的 open step（有 step/start 无对应 step/end）。 */
function findOpenStep(events) {
	let open;
	for (const event of events) {
		const data = event.data;
		if (event.type === "step/start" && typeof data?.turn === "number" && typeof data?.step === "number") {
			open = {
				turn: data.turn,
				step: data.step
			};
			continue;
		}
		if (event.type === "step/end") open = void 0;
	}
	return open;
}
//#endregion
//#region src/host/health/generation.ts
/**
* 会话日志的「代次」文件名契约（对齐宿主 session 操作核心）。
*
* 一个会话目录里可以同时存在多份日志产物：
*
*     session.jsonl.zstd                          历史代 0（无版本号）
*     session.v<N>.jsonl.zstd                     当前代 N（N ≥ 1）
*     session.migration.<token>.jsonl.zstd.tmp    迁移暂存（当前代的发布源）
*
* **当前代由目录实测的最高代次决定，不硬编码 `v3`；日志名由代次推导，不硬编码
* `session.jsonl.zstd`。** 硬编码 v0 正是本插件此前「看不见任何已发布当前代的
* 会话」的病根：实测 449 个会话目录中有 61 个只留当前代，旧发现逻辑对它们一条
* 都发现不了，因而既扫不到也修不了。
*
* 宿主侧的代次发布顺序是「写暂存 → fsync → 校验 → 原子发布成当前代」，所以
* **当前代次非 0 等价于「这份日志是从 TMP 里移出来的」**；目录内仍有暂存残留
* 则是发布源仍在原地的物证。本模块据此给出处置优先级。
*
* 语法逐条对齐宿主包，改动它们必须同步这里（`tests/generation.spec.ts` 复刻了
* 宿主的全部拒绝用例，宿主放宽/收紧时该组测试会失败）：
*   - `@deepseek-ai/dsh-session-format/src/filename.ts`
*     `CANONICAL_LOG_FILENAME = /^session(?:\.v([1-9][0-9]*))?\.jsonl$/u`
*   - `@deepseek-ai/dsh-session-persistence-jsonl/src/format.ts` 的压缩后缀
*   - `@deepseek-ai/dsh-session-persistence-jsonl/src/generation.ts:725`
*     暂存名 `session.migration.${randomToken()}${suffix}.tmp`（token 为 16 位小写十六进制）
*/
/**
* 规范日志名的语法（不含压缩后缀）。
*
* 与宿主 `session-format/src/filename.ts` 逐字一致：版本 0 不带版本号，
* 后续代次必须是小写数字且无前导零；`.v0`、`.v01`、`.V1`、`session.v1.backup.jsonl`
* 都不识别为规范代次。
*/
const CANONICAL_LOG_BASENAME = /^session(?:\.v([1-9][0-9]*))?\.jsonl$/u;
/**
* 迁移暂存名的语法（对齐 `generation.ts:725` 的写入名）。
*
* token 的位数与字符集是宿主内部细节，这里只固定**形状**
* `session.migration.<hex>.jsonl[.zstd].tmp`，宿主换 token 长度时本插件不会失明。
*/
const MIGRATION_STAGING_NAME = /^session\.migration\.[0-9a-f]+\.jsonl(?:\.zstd)?\.tmp$/u;
function compressionSuffix(compression) {
	return compression === "zstd" ? ".zstd" : "";
}
/**
* 某代次的规范日志文件名。
* @param version - 非负安全整数的格式代次。
* @param compression - 物理编码（缺省 zstd）。
* @returns 该代次在会话目录内的文件名。
*/
function generationLogFilename(version, compression = "zstd") {
	if (!Number.isSafeInteger(version) || version < 0) throw new Error(`session log generation must be a non-negative safe integer, got ${String(version)}`);
	return `${version === 0 ? "session.jsonl" : `session.v${version}.jsonl`}${compressionSuffix(compression)}`;
}
/**
* 把一个规范日志名解析回代次。
*
* 与宿主 `parseGenerationLogFilename` 同语义：非规范名（临时、大写、前导零、
* `.v0`、别的压缩后缀）一律返回 undefined，**不猜**。
* @param filename - 会话目录里的一个文件名。
* @param compression - 该目录使用的物理编码（缺省 zstd）。
* @returns 其格式代次，或名字不构成规范代次时的 undefined。
*/
function parseGenerationLogFilename(filename, compression = "zstd") {
	const suffix = compressionSuffix(compression);
	if (!filename.endsWith(suffix)) return void 0;
	const match = CANONICAL_LOG_BASENAME.exec(filename.slice(0, filename.length - suffix.length));
	if (match === null) return void 0;
	if (match[1] === void 0) return 0;
	const version = Number(match[1]);
	return Number.isSafeInteger(version) ? version : void 0;
}
/**
* 两种压缩编码都试一遍，判定该名字是不是某代的规范产物。
*
* 发现路径不能假设部署里的 `compression` 配置：配置在 profile 侧，插件读不到，
* 而日志就在磁盘上。因此按名字本身分类，编码作为结果一并带回。
* @param filename - 会话目录里的一个文件名。
* @returns 代次与编码，或该名字不是规范代次时的 undefined。
*/
function classifyGenerationFilename(filename) {
	const zstd = parseGenerationLogFilename(filename, "zstd");
	if (zstd !== void 0) return {
		version: zstd,
		compression: "zstd"
	};
	const none = parseGenerationLogFilename(filename, "none");
	if (none !== void 0) return {
		version: none,
		compression: "none"
	};
}
/**
* 该文件名是否是迁移暂存（当前代的发布源）。
* @param filename - 会话目录里的一个文件名。
* @returns 是否形如 `session.migration.<token>.jsonl[.zstd].tmp`。
*/
function isMigrationStagingFilename(filename) {
	return MIGRATION_STAGING_NAME.test(filename);
}
/**
* 读取一个会话目录的代次事实（只读，不碰任何文件内容）。
* @param dir - 会话目录的绝对路径。
* @returns 规范产物（按代次升序）、当前代、历史代与暂存残留。
*/
function readSessionGenerations(dir) {
	const canonical = [];
	const staging = [];
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return {
			canonical: [],
			staging: [],
			legacyOnly: false
		};
	}
	for (const entry of entries) {
		if (!entry.isFile()) continue;
		const path = join(dir, entry.name);
		let bytes;
		let mtimeMs;
		try {
			const stat = statSync(path);
			bytes = stat.size;
			mtimeMs = stat.mtimeMs;
		} catch {
			continue;
		}
		const artifact = {
			name: entry.name,
			path,
			bytes,
			mtimeMs
		};
		const generation = classifyGenerationFilename(entry.name);
		if (generation !== void 0) {
			canonical.push({
				...artifact,
				version: generation.version,
				compression: generation.compression
			});
			continue;
		}
		if (isMigrationStagingFilename(entry.name)) staging.push(artifact);
	}
	canonical.sort((left, right) => left.version - right.version || left.mtimeMs - right.mtimeMs);
	staging.sort((left, right) => left.mtimeMs - right.mtimeMs);
	const current = canonical.at(-1);
	const legacy = canonical.find((artifact) => artifact.version === 0);
	return {
		canonical,
		staging,
		...current === void 0 ? {} : { current },
		...legacy === void 0 ? {} : { legacy },
		legacyOnly: canonical.length > 0 && current?.version === 0
	};
}
/** 目录内全部已识别产物的最新 mtime。 */
function latestArtifactMtime(facts) {
	const times = [...facts.canonical, ...facts.staging].map((artifact) => artifact.mtimeMs);
	return times.length === 0 ? void 0 : Math.max(...times);
}
/**
* 该会话的处置优先级。
*
* `high` 的判据就是「从 TMP 移出来」本身：当前代次非 0（当前代是经
* `session.migration.*.tmp` 暂存发布出来的），或目录内仍有暂存残留。
* 代次 0 的历史代是宿主按契约保留的未发布会话，旧发现逻辑读的就是它 —— 这类
* 会话既没有发布痕迹、也没有被读错，故为 `normal`。
* @param facts - 会话目录的代次事实。
* @returns 处置优先级。
*/
function sessionPriority(facts) {
	if (facts.staging.length > 0) return "high";
	return (facts.current?.version ?? 0) > 0 ? "high" : "normal";
}
//#endregion
//#region src/host/health/lossless.ts
/** 单个值是否可无损 JSON 序列化。 */
function isLossless(value) {
	return firstLosslessViolation(value) === void 0;
}
/** 判定一个普通对象是否「普通原型」（Object.prototype 或 null）。 */
function isPlainObjectPrototype(value) {
	const prototype = Object.getPrototypeOf(value);
	return prototype === null || prototype === Object.prototype;
}
/**
* 找出第一个破坏无损 JSON 的值；全部合规时返回 undefined。
* @param value - 待判定的值（通常是投影状态）。
* @param limit - 最多访问的节点数（防御超大对象）。
* @returns 首个违规点位或 undefined。
*/
function firstLosslessViolation(value, limit = 2e5) {
	const ancestors = /* @__PURE__ */ new Set();
	const stack = [{
		node: value,
		path: ""
	}];
	let visited = 0;
	while (stack.length > 0) {
		const task = stack.pop();
		if (task === void 0) break;
		if (task.leave === true) {
			ancestors.delete(task.node);
			continue;
		}
		if (visited >= limit) return {
			path: task.path,
			reason: "cycle",
			actual: `node-limit(${limit})`
		};
		visited += 1;
		const node = task.node;
		if (node === void 0) return {
			path: task.path,
			reason: "undefined",
			actual: "undefined"
		};
		if (node === null) continue;
		switch (typeof node) {
			case "boolean":
			case "string": continue;
			case "number":
				if (Number.isNaN(node)) return {
					path: task.path,
					reason: "NaN",
					actual: "NaN"
				};
				if (node === Infinity) return {
					path: task.path,
					reason: "Infinity",
					actual: "Infinity"
				};
				if (node === -Infinity) return {
					path: task.path,
					reason: "-Infinity",
					actual: "-Infinity"
				};
				if (Object.is(node, -0)) return {
					path: task.path,
					reason: "-0",
					actual: "-0"
				};
				continue;
			case "function": return {
				path: task.path,
				reason: "function",
				actual: "function"
			};
			case "symbol": return {
				path: task.path,
				reason: "symbol",
				actual: "symbol"
			};
			case "bigint": return {
				path: task.path,
				reason: "bigint",
				actual: "bigint"
			};
		}
		const object = node;
		if (ancestors.has(object)) return {
			path: task.path,
			reason: "cycle",
			actual: "object-cycle"
		};
		if (Array.isArray(object)) {
			if (!isPlainArray(object)) return {
				path: task.path,
				reason: "non-plain-prototype",
				actual: "array-subclass"
			};
			for (let index = 0; index < object.length; index += 1) if (!Object.prototype.hasOwnProperty.call(object, index)) return {
				path: `${task.path}[${index}]`,
				reason: "sparse-array-hole",
				actual: "hole"
			};
			ancestors.add(object);
			stack.push({
				node: object,
				path: task.path,
				leave: true
			});
			for (let index = object.length - 1; index >= 0; index -= 1) stack.push({
				node: object[index],
				path: `${task.path}[${index}]`
			});
			continue;
		}
		if (!isPlainObjectPrototype(object)) {
			const name = object.constructor?.name ?? "unknown";
			return {
				path: task.path,
				reason: "non-plain-prototype",
				actual: name
			};
		}
		const keys = Reflect.ownKeys(object);
		for (const key of keys) if (typeof key !== "string" || !Object.prototype.propertyIsEnumerable.call(object, key)) return {
			path: `${task.path}.${String(key)}`,
			reason: "non-enumerable-or-symbol-key",
			actual: typeof key
		};
		ancestors.add(object);
		stack.push({
			node: object,
			path: task.path,
			leave: true
		});
		for (let index = keys.length - 1; index >= 0; index -= 1) {
			const key = keys[index];
			if (key === void 0 || typeof key !== "string") continue;
			stack.push({
				node: object[key],
				path: `${task.path}.${key}`
			});
		}
	}
}
/** 数组是否为普通数组（排除子类）。 */
function isPlainArray(value) {
	const prototype = Object.getPrototypeOf(value);
	return prototype === null || prototype === Array.prototype;
}
//#endregion
//#region src/host/health/gates.ts
/**
* 五个体检 gate（每个可独立测试）与报告聚合。
*
* 统一输出形状：`{ id, level, evidence, attribution, detail }`；
* 聚合结果 `SessionHealthReport` 供「体检 → 处方 → 出院」三步流程使用。
*
* 只读：gate 不改任何会话数据；写操作只会出现在 repair（可逆、先备份）。
*/
/** 从解码事件推导尾部事实。 */
function readTailFacts(log) {
	const events = log.events;
	let lastTurnEnd;
	let lastUserIndex = -1;
	let assistantAfterLastUser = false;
	for (let index = 0; index < events.length; index += 1) {
		const event = events[index];
		if (event === void 0) continue;
		if (event.type === "user/message") {
			lastUserIndex = index;
			assistantAfterLastUser = false;
			continue;
		}
		if (event.type === "assistant/message" && index > lastUserIndex) assistantAfterLastUser = true;
		if (event.type === "turn/end") {
			const data = event.data;
			lastTurnEnd = {
				turn: typeof data?.turn === "number" ? data.turn : -1,
				reason: typeof data?.reason?.kind === "string" ? data.reason.kind : "unknown"
			};
		}
	}
	const last = events.at(-1);
	return {
		lastSeq: last?.seq ?? -1,
		lastEventType: last?.type ?? "",
		...lastTurnEnd === void 0 ? {} : { lastTurnEnd },
		...log.openStep === void 0 ? {} : { openStep: log.openStep },
		assistantAfterLastUser
	};
}
/**
* gate 0：代次事实（当前代是历史代还是已发布代、有没有暂存残留）。
*
* 存在的理由：一个会话目录里可以有多份日志产物，而**读哪一份**决定了后面所有
* 门的结论。早期版本固定读 `session.jsonl.zstd`，于是对已发布当前代的会话要么
* 读错（读历史代那份，12MB 全量回放）、要么完全发现不了。本门把这个前提显式化成
* 可判定的证据，档位判据只取「有据可依」的三条：
*   - 没有任何规范产物（只剩暂存）→ `fail`：当前代尚未发布；
*   - 有暂存残留 → `warn`：发布源仍在原地（发布完成未清，或尚未发布）；
*   - 文件名代次与 header 代次不一致 → `warn`：发布不变量被破坏。
* 历史代与当前代并存是宿主**契约要求**（已提交代次不删不改），故记 `ok` 并写进
* 证据，不抬档 —— 抬档会把 34 个完全正常的会话变成噪声。
* @param facts - 会话目录的代次事实；缺省表示无从判定。
* @param log - 已解码的日志（用于取 header.version 交叉核对）。
*/
function gateGeneration(facts, log) {
	if (facts === void 0) return {
		id: "generation",
		level: "skipped",
		evidence: "未提供代次事实，本门无从判定"
	};
	const current = facts.current;
	const headerVersion = typeof log?.header?.["version"] === "number" ? log.header["version"] : void 0;
	const detail = {
		currentVersion: current?.version,
		currentName: current?.name,
		currentCompression: current?.compression,
		canonicalVersions: facts.canonical.map((artifact) => artifact.version),
		staging: facts.staging.map((artifact) => artifact.name),
		legacyOnly: facts.legacyOnly,
		priority: sessionPriority(facts),
		...headerVersion === void 0 ? {} : { headerVersion }
	};
	if (current === void 0) return {
		id: "generation",
		level: "fail",
		evidence: `目录内没有任何规范代次产物，仅剩 ${facts.staging.length} 份迁移暂存：当前代尚未从暂存发布`,
		detail
	};
	if (facts.staging.length > 0) return {
		id: "generation",
		level: "warn",
		evidence: `当前代 v${current.version}（${current.name}）旁留有 ${facts.staging.length} 份迁移暂存残留：` + facts.staging.map((artifact) => artifact.name).join("、"),
		detail
	};
	if (headerVersion !== void 0 && headerVersion !== current.version) return {
		id: "generation",
		level: "warn",
		evidence: `文件名代次与日志头代次不一致：${current.name} 名为 v${current.version}，header.version=${headerVersion}`,
		detail
	};
	const note = facts.legacyOnly ? "；目录内只有历史代，宿主首次写访问时才发布当前代" : facts.legacy === void 0 ? "" : "；历史代 v0 按契约保留未删";
	return {
		id: "generation",
		level: "ok",
		evidence: `当前代 v${current.version}（${current.name}）${note}`,
		detail
	};
}
/** gate 1：日志完整性（可解码、seq 连续、无撕裂尾帧）。 */
function gateLogIntegrity(log) {
	if (log.issues.length > 0) {
		const first = log.issues[0];
		return {
			id: "log-integrity",
			level: "fail",
			evidence: `日志读取失败：line ${first?.line ?? "?"} ${first?.why ?? ""}（共 ${log.issues.length} 条问题）`,
			detail: {
				issues: log.issues.slice(0, 5),
				frames: log.frames,
				decoder: log.decoder
			}
		};
	}
	if (log.tornStart !== void 0) return {
		id: "log-integrity",
		level: "warn",
		evidence: `存在撕裂尾帧（offset ${log.tornStart}，抢救 ${log.recoveredFromTorn} 字节）；提交前缀已保留`,
		detail: {
			frames: log.frames,
			decodedEvents: log.events.length,
			decoder: log.decoder
		}
	};
	return {
		id: "log-integrity",
		level: "ok",
		evidence: `解码正常：${log.frames} 帧 / ${log.events.length} 事件，seq 连续，无撕裂尾帧（decoder=${log.decoder}）`,
		detail: {
			frames: log.frames,
			decodedEvents: log.events.length,
			decoder: log.decoder
		}
	};
}
/** 读取投影缓存记录并计算滞后与未结算字段。 */
function readProjectionCache(sessionId, logLastSeq, dshHome) {
	const path = join(dshHome ?? join(homedir(), ".dsh"), "storages", "session_projcache", "sessions", `${sessionId}.json`);
	if (!existsSync(path)) return {
		present: false,
		path,
		unsettled: []
	};
	let record;
	try {
		record = JSON.parse(readFileSync(path, "utf8")).record ?? {};
	} catch (err) {
		return {
			present: true,
			path,
			unsettled: [],
			error: `缓存记录不可解析：${String(err instanceof Error ? err.message : err)}`
		};
	}
	const rows = record.rows ?? {};
	const seqs = Object.values(rows).map((row) => row.seq).filter((seq) => typeof seq === "number");
	const cacheSeq = seqs.length > 0 ? Math.min(...seqs) : void 0;
	const unsettled = [];
	const sessionStats = rows["sessionStats"]?.val;
	if (sessionStats?.openStep !== void 0 && sessionStats.openStep !== null) unsettled.push(`sessionStats.openStep=${JSON.stringify(sessionStats.openStep)}`);
	const live = rows["liveTokenStats"]?.val;
	if (live?.activeStep?.active !== void 0 && live.activeStep.active !== null) unsettled.push(`liveTokenStats.activeStep.active=${JSON.stringify(live.activeStep.active)}`);
	const subagent = rows["subagentTiming"]?.val;
	if (subagent?.pendingTurnStart !== void 0) unsettled.push(`subagentTiming.pendingTurnStart=${String(subagent.pendingTurnStart)}`);
	if ((rows["turnBoundary"]?.val)?.lastStepBoundary?.kind === "start") unsettled.push("turnBoundary.lastStepBoundary.kind=start");
	return {
		present: true,
		path,
		...cacheSeq === void 0 ? {} : { cacheSeq },
		rows: Object.keys(rows).length,
		...cacheSeq === void 0 ? {} : { lag: logLastSeq - cacheSeq },
		unsettled
	};
}
/** gate 2：投影缓存水位与结算形态。 */
function gateProjectionCache(facts) {
	if (facts.error !== void 0) return {
		id: "projection-cache",
		level: "warn",
		evidence: facts.error,
		detail: { path: facts.path }
	};
	if (!facts.present) return {
		id: "projection-cache",
		level: "skipped",
		evidence: "投影缓存记录不存在，本门无从判定（宿主会在下次检查点重建；若长期不出现说明检查点写入被拒）",
		detail: { path: facts.path }
	};
	const lag = facts.lag ?? 0;
	const unsettled = facts.unsettled;
	const detail = {
		path: facts.path,
		cacheSeq: facts.cacheSeq,
		rows: facts.rows,
		lag,
		unsettled
	};
	if (lag > 0 && unsettled.length > 0) return {
		id: "projection-cache",
		level: "fail",
		evidence: `缓存落后日志 ${lag} 个事件且仍残留未结算字段：${unsettled.join("; ")}`,
		detail
	};
	if (lag > 0 || unsettled.length > 0) return {
		id: "projection-cache",
		level: "warn",
		evidence: `缓存滞后 ${lag} 个事件${unsettled.length > 0 ? `；未结算字段：${unsettled.join("; ")}` : ""}`,
		detail
	};
	return {
		id: "projection-cache",
		level: "ok",
		evidence: `缓存与日志对齐（seq ${facts.cacheSeq ?? "?"}），无未结算残留`,
		detail
	};
}
/** gate 3：投影状态的无损 JSON 判定（本次事故核心）。 */
function gateLosslessJson(projectionState, attribute) {
	if (projectionState === void 0) return {
		id: "lossless-json",
		level: "skipped",
		evidence: "拿不到热态投影状态（宿主未暴露 sessionProjections）；冷态记录经 JSON 往返必然无损，本门无从判定"
	};
	const keys = Object.keys(projectionState);
	if (keys.length === 0) return {
		id: "lossless-json",
		level: "skipped",
		evidence: "热态投影状态为空，本门无从判定"
	};
	for (const key of keys) {
		const row = projectionState[key];
		const violation = firstLosslessViolation(row !== void 0 && typeof row === "object" && "val" in row ? row.val : row);
		if (violation === void 0) continue;
		const owned = attribute?.(key);
		return {
			id: "lossless-json",
			level: "fail",
			evidence: `投影 ${key} 状态不是无损 JSON：${violation.path} 为 ${violation.actual}（${violation.reason}）`,
			attribution: {
				projection: key,
				package: owned?.package ?? "unknown",
				field: violation.path
			},
			detail: {
				projection: key,
				violation,
				rows: keys.length
			}
		};
	}
	return {
		id: "lossless-json",
		level: "ok",
		evidence: `全部 ${keys.length} 行投影状态均为无损 JSON`,
		detail: { rows: keys.length }
	};
}
/** gate 4：冷读成本与可接续性。 */
function gateColdRead(facts) {
	const detail = {
		lastSeq: facts.lastSeq,
		lastEventType: facts.lastEventType,
		lastTurnEnd: facts.lastTurnEnd,
		openStep: facts.openStep,
		assistantAfterLastUser: facts.assistantAfterLastUser
	};
	if (facts.openStep !== void 0) return {
		id: "cold-read",
		level: "fail",
		evidence: `存在未收尾的 open step（turn ${facts.openStep.turn}/step ${facts.openStep.step}），无法原地接续`,
		detail
	};
	if (facts.lastTurnEnd === void 0) return {
		id: "cold-read",
		level: "skipped",
		evidence: "日志中没有 turn/end，本门无从确认是否存在可接续的已完成轮次",
		detail
	};
	if (facts.lastTurnEnd.reason !== "completed") return {
		id: "cold-read",
		level: "warn",
		evidence: `最后一轮以 ${facts.lastTurnEnd.reason} 结束（非 completed）；可 fork 到该轮结束处`,
		detail
	};
	return {
		id: "cold-read",
		level: "ok",
		evidence: `最后一轮 completed 结束，会话可原地接续（末 seq ${facts.lastSeq}）`,
		detail
	};
}
/** 聚合全部 gate 结果为一份报告。 */
function buildSessionReport(context) {
	const log = context.log ?? (context.logPath === void 0 ? void 0 : decodeSessionLogFile(context.logPath));
	const gates = [];
	gates.push(gateGeneration(context.generations, log));
	if (log === void 0) gates.push({
		id: "log-integrity",
		level: "fail",
		evidence: "未提供日志读取结果或日志路径"
	});
	else {
		gates.push(gateLogIntegrity(log));
		const tail = readTailFacts(log);
		gates.push(gateProjectionCache(readProjectionCache(context.sessionId, tail.lastSeq, context.dshHome)));
		gates.push(gateLosslessJson(context.projectionState, context.attribute));
		gates.push(gateColdRead(tail));
	}
	const level = gates.some((gate) => gate.level === "fail") ? "fail" : gates.some((gate) => gate.level === "warn") ? "warn" : "ok";
	return {
		sessionId: context.sessionId,
		level,
		priority: context.generations === void 0 ? "normal" : sessionPriority(context.generations),
		gates,
		generatedAt: (context.now ?? Date.now)()
	};
}
//#endregion
//#region src/host/health/repair.ts
/**
* 处方（repair）：**只做三件可逆的事**，且每一件都先备份/可回退。
*
* 1. 隔离损坏的投影缓存记录（移动到 `.quarantine-<ts>`）→ 提示重启宿主重折叠；
* 2. 对含未结算 step 的会话，提示「等待宿主结算」而不是硬改（本模块不提供该动作）；
* 3. 输出可执行命令清单，交给用户手工执行。
*
* 红线：禁止改写会话日志、禁止改历史数据、禁止静默丢弃字段。
*/
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
function isActionable(level) {
	return level === "warn" || level === "fail";
}
/** 投影缓存记录路径。 */
function projectionCachePath(sessionId, dshHome) {
	return join(dshHome ?? join(homedir(), ".dsh"), "storages", "session_projcache", "sessions", `${sessionId}.json`);
}
/**
* 隔离一个会话的投影缓存记录（备份 = 移动本身，可原样搬回）。
* @param sessionId - 会话 id。
* @param dshHome - DSH home（缺省 ~/.dsh）。
* @param now - 时间源（测试可控）。
*/
function quarantineProjectionCache(sessionId, dshHome, now = Date.now) {
	const from = projectionCachePath(sessionId, dshHome);
	if (!existsSync(from)) return {
		ok: false,
		action: "quarantine-projection-cache",
		sessionId,
		from,
		error: "投影缓存记录不存在，无需隔离"
	};
	const to = `${from}.quarantine-${now()}`;
	try {
		mkdirSync(dirname(from), { recursive: true });
		copyFileSync(from, `${to}.copy`);
		renameSync(from, to);
		return {
			ok: true,
			action: "quarantine-projection-cache",
			sessionId,
			from,
			to,
			requiresRestart: true
		};
	} catch (err) {
		return {
			ok: false,
			action: "quarantine-projection-cache",
			sessionId,
			from,
			error: String(err instanceof Error ? err.message : err)
		};
	}
}
/**
* 依据体检报告给出「处方」（命令清单）。
* @param report - 体检报告。
* @param dshHome - DSH home（用于生成路径提示）。
* @returns 可复制执行的命令与人读说明。
*/
function prescribe(report, dshHome) {
	const lines = [];
	const gate = (id) => report.gates.find((entry) => entry.id === id);
	const generation = gate("generation");
	if (generation?.level === "fail" || generation?.level === "warn") {
		lines.push(`# 代次异常：${generation.evidence}`);
		const currentVersion = generation.detail?.["currentVersion"];
		lines.push(typeof currentVersion === "number" ? `# 当前代 v${currentVersion}：本插件不改会话日志，暂存残留的发布/隔离需用会话代次工具处理` : "# 目录内只有迁移暂存、还没有规范产物：需先用会话代次工具发布当前代，或重启宿主触发发布");
		if (report.priority === "high") lines.push("# 该会话优先级为 high（当前代由暂存发布而来），建议先处置它");
	}
	const lossless = gate("lossless-json");
	if (lossless?.level === "fail") {
		const pkg = lossless.attribution?.package ?? "unknown";
		const field = lossless.attribution?.field ?? "?";
		const projection = lossless.attribution?.projection ?? "?";
		lines.push(`# 病根：投影 ${projection} 的 ${field} 不是无损 JSON（归属：${pkg}）`);
		if (pkg !== "unknown" && pkg !== "core") {
			lines.push(`# 1) 停用或升级产出方插件（消除 undefined 产出）：${pkg}`);
			lines.push(`dsh plugin --profile web remove ${pkg}`);
		} else if (pkg === "core") lines.push("# 1) 产出方是内置包，请升级 DSH 本体后在 issue 中附上体检报告");
		else lines.push("# 1) 归属未知：请人工核对宿主日志里 \"not lossless JSON\" 前的投影 key");
		lines.push("# 2) 隔离陈旧投影缓存记录（可逆，会提示重启宿主重折叠）");
		lines.push(`#    POST /session-steward/api/session-health-repair {"sessionId":"${report.sessionId}"}`);
		lines.push("# 3) 重启宿主后重跑体检，确认 lossless-json 转 ok");
		return lines;
	}
	const cache = gate("projection-cache");
	if (isActionable(cache?.level)) {
		lines.push(`# 投影缓存异常：${cache?.evidence ?? "未知"}`);
		lines.push("# 1) 先隔离陈旧记录，再重启宿主让其重折叠");
		lines.push(`#    POST /session-steward/api/session-health-repair {"sessionId":"${report.sessionId}"}`);
	}
	if (gate("cold-read")?.level === "fail") lines.push("# 会话仍处于 open step：请等待宿主结算（不要硬改日志），必要时重启宿主后重新体检");
	if (lines.length === 0) {
		const unjudged = report.gates.filter((entry) => entry.level === "skipped");
		lines.push(unjudged.length === 0 ? "# 全部检查通过：无需处置" : `# 无可处置项（${unjudged.length} 门无从判定，非异常）：${unjudged.map((entry) => entry.id).join(" / ")}`);
	}
	return lines;
}
/** 残留门的可读归因：区分「本插件有能力处置」与「按红线只能等 / 交给别的工具」。 */
function residualNote(residual) {
	if (residual.some((entry) => entry.id === "generation")) return "其中 generation 来自会话目录的代次产物（暂存残留或当前代尚未发布），本插件不改会话日志，需用会话代次工具处置。";
	return "这类异常来自会话日志或宿主运行态，本插件不改会话日志，请等待宿主结算后重新体检。";
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
function assessRepair(input) {
	const { before, after, repair } = input;
	const residual = after.gates.filter((entry) => entry.level === "warn" || entry.level === "fail").map((entry) => ({
		id: entry.id,
		level: entry.level
	}));
	const residualIds = residual.map((entry) => entry.id).join(" / ");
	if (before.level === "ok") return {
		verdict: "nothing-to-do",
		explanation: "全部检查通过，无需处置",
		residual: []
	};
	if (repair.ok) return residual.length === 0 ? {
		verdict: "repaired",
		explanation: "处置生效：已隔离投影缓存记录，体检结果已恢复",
		residual: []
	} : {
		verdict: "repaired-with-residual",
		explanation: `已隔离投影缓存记录；但仍有与该缓存无关的异常：${residualIds}。${residualNote(residual)}`,
		residual
	};
	if (!isActionable(before.gates.find((entry) => entry.id === "projection-cache")?.level)) return {
		verdict: "not-applicable",
		explanation: residualIds === "" ? "当前异常无可逆处置项" : `当前异常无可逆处置项（投影缓存无可隔离记录）；异常来自 ${residualIds}，${residualNote(residual)}`,
		residual
	};
	return {
		verdict: "failed",
		explanation: `处置失败：${repair.error ?? "未知原因"}`,
		residual
	};
}
//#endregion
//#region src/host/health/scan.ts
/**
* 批量体检：枚举会话日志、跑门、给出汇总（供 `session-health-scan` 使用）。
*
* 只读；不激活任何 Agent，也不写任何会话数据。为控制成本，默认限制单次扫描的
* 会话数与并发度，并支持 `limit` / `since` 过滤。
*
* **发现按代次而不是按固定文件名。** 一个会话目录的当前日志名由目录实测的最高
* 代次决定（见 `generation.ts`）：历史代是 `session.jsonl.zstd`，已发布的当前代
* 是 `session.v<N>.jsonl.zstd`。早期版本在这里写死 `session.jsonl.zstd`，于是
* 61 个只留当前代的会话**一条都发现不了** —— 既扫不到，`findSessionLog` 也返回
* undefined，连 `session-health-repair` 都会先报「未找到会话日志」。
*/
/** 会话根目录（`<dshHome>/sessions/<project>/<sessionId>/`）。 */
function sessionsRoot(dshHome) {
	return join(dshHome ?? join(homedir(), ".dsh"), "sessions");
}
/**
* 语料枚举上限。
*
* 这是防御无界遍历的**边界**，不是策略：早期版本写 200，实测语料 449 个会话时
* 它静默截掉了一半（体检进度分母恒为 200，末 249 个会话永远扫不到）。
*/
const DISCOVERY_LIMIT = 1e5;
/**
* 枚举全部会话（按 mtime 倒序），带可选上限。
*
* 「是会话目录」的判据是**目录里有规范代次产物或迁移暂存**，不要求任何具体文件名。
* @param dshHome - DSH home（缺省 ~/.dsh）。
* @param limit - 返回上限（缺省 `DISCOVERY_LIMIT`）。
*/
function discoverSessions(dshHome, limit = DISCOVERY_LIMIT) {
	const root = sessionsRoot(dshHome);
	const out = [];
	if (!existsSync(root)) return out;
	const stack = [root];
	while (stack.length > 0) {
		const dir = stack.pop();
		if (dir === void 0) continue;
		let entries;
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const path = join(dir, entry.name);
			const generations = readSessionGenerations(path);
			if (generations.canonical.length === 0 && generations.staging.length === 0) {
				stack.push(path);
				continue;
			}
			const current = generations.current;
			out.push({
				sessionId: entry.name,
				dir: path,
				...current === void 0 ? {} : { logPath: current.path },
				generations,
				priority: sessionPriority(generations),
				updatedAt: latestArtifactMtime(generations) ?? 0,
				bytes: current?.bytes ?? 0
			});
		}
	}
	out.sort((left, right) => right.updatedAt - left.updatedAt);
	return out.slice(0, Math.max(1, limit));
}
/**
* 语料总数：只做目录枚举，**不跑体检**。
*
* 用于判断缓存是否已过期——枚举很便宜，而重扫要解 zstd、跑门。
* 正因为两者代价差着量级，「对账」才不构成缓存失效策略本身。
* @param dshHome - DSH home（缺省 ~/.dsh）。
*/
function countCorpus(dshHome) {
	return discoverSessions(dshHome, DISCOVERY_LIMIT).length;
}
/** 按 id 定位一个会话（跨工程目录查找）。 */
function findSession(sessionId, dshHome) {
	return discoverSessions(dshHome, DISCOVERY_LIMIT).find((session) => session.sessionId === sessionId);
}
/**
* 定位一个会话的**当前代**日志路径（跨工程目录查找）。
*
* 返回 undefined 有两种含义，调用方必须区分：会话不存在，或会话存在但尚未发布
* 当前代（只有迁移暂存）。需要区分时用 `findSession`。
* @param sessionId - 会话 id。
* @param dshHome - DSH home（缺省 ~/.dsh）。
*/
function findSessionLog(sessionId, dshHome) {
	return findSession(sessionId, dshHome)?.logPath;
}
/** 未显式传 limit 时的单批会话数。 */
const DEFAULT_BATCH_LIMIT = 50;
/**
* 批量体检（支持分批）。
*
* 语料先整体列出（按 mtime 倒序，≤ DISCOVERY_LIMIT），再按 `[offset, offset+limit)`
* 切片扫描。这样客户端可以用小批次连续调用、自己累计真实进度，而宿主保持无状态
* ——不必把同步循环改成异步，也不必新增进度轮询端点。
*
* 批内**命中顺序**按处置优先级排（`high` 在前，稳定排序）。分批切片仍按 mtime，
* 所以 offset/total 的算术不受影响：只有同一批里的呈现顺序变了。
* @param options - dshHome / 批大小 / 批起点 / 是否只返回非 ok / 归属查询 / 热态状态提供者。
*/
function scanSessions(options) {
	const discovered = discoverSessions(options.dshHome, DISCOVERY_LIMIT);
	if (discovered.length === 0) return {
		ok: false,
		scanned: 0,
		total: 0,
		offset: 0,
		findings: [],
		error: "未发现任何会话日志（检查 DSH home 与 sessions 目录）"
	};
	const offset = Math.max(0, Math.floor(options.offset ?? 0));
	const limit = Math.max(1, Math.floor(options.limit ?? DEFAULT_BATCH_LIMIT));
	const batch = discovered.slice(offset, offset + limit);
	const findings = [];
	for (const session of batch) {
		const projectionState = options.projectionStateFor?.(session.sessionId);
		const report = buildSessionReport({
			sessionId: session.sessionId,
			...options.dshHome === void 0 ? {} : { dshHome: options.dshHome },
			...session.logPath === void 0 ? {} : { logPath: session.logPath },
			generations: session.generations,
			...projectionState === void 0 ? {} : { projectionState },
			...options.attribute === void 0 ? {} : { attribute: options.attribute },
			...options.now === void 0 ? {} : { now: options.now }
		});
		if (options.onlyProblems === true && report.level === "ok") continue;
		findings.push(report);
	}
	findings.sort((left, right) => left.priority === right.priority ? 0 : left.priority === "high" ? -1 : 1);
	return {
		ok: true,
		scanned: batch.length,
		total: discovered.length,
		offset,
		findings,
		...options.onlyProblems === true ? { filtered: true } : {}
	};
}
//#endregion
//#region src/index.ts
/** 本插件声明的宿主服务（与 toggle 相同的注入面）。 */
const inject = ["webServer", "webRuntime"];
/** Resolve one possibly-volatile field: a live ref on 0.1.7+, a plain value otherwise. */
function readVolatileValue(value) {
	if (value !== null && typeof value === "object" && typeof value.get === "function") return value.get();
	return value;
}
/** 运行时配置 schema（与 src/config.ts 的形状保持一致）。0.1.7：volatile 字段即设置表单。 */
const Config = z.object({
	enabled: z.boolean().default(true).volatile(),
	historyFiles: z.boolean().default(true).volatile(),
	healthCheck: z.boolean().default(true).volatile()
});
/** 单次请求体的上限（防御无界读取）。 */
const MAX_BODY_BYTES = 16 << 20;
/** 归一化 Host authority，无法解析时为 undefined。 */
function parseAuthority(authority) {
	try {
		return new URL(`http://${authority}`);
	} catch {
		return;
	}
}
/** 主机名是否本机回环。 */
function isLoopbackHostname(hostname) {
	if (hostname === "localhost" || hostname === "[::1]") return true;
	const parts = hostname.split(".");
	return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
/** Host 是否命中 trustedHosts（精确或省略端口）。 */
function isTrustedAuthority(hostUrl, trustedHosts) {
	return trustedHosts.some((entry) => {
		const entryUrl = parseAuthority(entry);
		if (entryUrl === void 0) return false;
		return (entryUrl.port === "" ? entryUrl.hostname : entryUrl.host) === hostUrl.host;
	});
}
/** 浏览器可信围栏（与 /api 网关行为一致）：DNS 重绑定/跨站防御，不是鉴权。 */
function isTrustedApiRequest(req, trustedHosts) {
	const host = req.headers.host;
	if (host === void 0) return false;
	const hostUrl = parseAuthority(host);
	if (hostUrl === void 0) return false;
	if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false;
	const fetchSite = req.headers["sec-fetch-site"];
	if (typeof fetchSite === "string" && fetchSite === "cross-site") return false;
	const origin = req.headers.origin;
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === hostUrl.host;
	} catch {
		return false;
	}
}
/** 读原始请求体（有界）。 */
async function readRawBody(req) {
	const chunks = [];
	let total = 0;
	for await (const chunk of req) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		total += buffer.length;
		if (total > MAX_BODY_BYTES) throw new Error("request body too large");
		chunks.push(buffer);
	}
	return Buffer.concat(chunks).toString("utf8");
}
/** 读 JSON 请求体（空体视为 {}）。 */
async function readJsonBody(req) {
	const text = await readRawBody(req);
	if (text.trim() === "") return {};
	try {
		return JSON.parse(text);
	} catch {
		throw new Error("request body is not JSON");
	}
}
/** 写 JSON 响应。 */
function writeJson(res, status, body) {
	const text = JSON.stringify(body);
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(text);
}
/** 会话 id 形状校验（拒绝任意字符串进入路径拼接）。 */
function asSessionId(value) {
	if (typeof value !== "string") return void 0;
	const trimmed = value.trim();
	if (trimmed === "" || trimmed.length > 200) return void 0;
	if (!/^[A-Za-z0-9._:-]+$/.test(trimmed)) return void 0;
	return trimmed;
}
/** 单会话体检的最大扫描上限。 */
const MAX_SCAN_LIMIT = 200;
/**
* 支持的路由方法（按子域分组；用于对外声明与测试断言）。
*
* `session-history-prune` 与 `session-history-purge` 是**两件事**，不可合并：
* prune = 取消归档状态（可逆，会话回到侧边栏）；purge = 清理归档文件（不可逆，真删实体）。
*/
const HISTORY_METHODS = [
	"session-history-list",
	"session-history-prune",
	"session-history-purge"
];
const HEALTH_METHODS = [
	"session-health-status",
	"session-health-scan",
	"session-health-session",
	"session-health-repair"
];
/** 依据开关判定某方法是否启用。 */
function methodEnabled(method, config) {
	if (HISTORY_METHODS.includes(method)) return config.historyFiles !== false;
	if (HEALTH_METHODS.includes(method)) return config.healthCheck !== false;
	return false;
}
/**
* 处理一次 API 调用（导出以便单测直接驱动，不需要起 HTTP）。
* @param method - 路由方法名。
* @param payload - 已解析的请求体。
* @param runtime - 运行时依赖。
*/
async function handleMethod(method, payload, runtime) {
	const config = runtime.config();
	if (![...HISTORY_METHODS, ...HEALTH_METHODS].includes(method)) return {
		ok: false,
		error: `未知的 session-steward API 方法 "${method}"`
	};
	if (!methodEnabled(method, config)) return {
		ok: false,
		error: `子域已关闭（${HISTORY_METHODS.includes(method) ? "historyFiles" : "healthCheck"}=false）：${method} 未注册`
	};
	if (method === "session-history-list") return await listHistory(runtime.registry, void 0, storagePathsFor(runtime.dshHome), runtime.dshHome);
	if (method === "session-history-prune") return pruneHistory(payload, runtime.log, storagePathsFor(runtime.dshHome));
	if (method === "session-history-purge") return purgeHistory(payload, runtime.log, {
		dshHome: runtime.dshHome,
		searchPaths: storagePathsFor(runtime.dshHome)
	});
	if (method === "session-health-status") return {
		ok: true,
		namespace: STEWARD_SETTINGS_NAMESPACE,
		prefix: STEWARD_API_PREFIX,
		switches: {
			enabled: config.enabled,
			historyFiles: config.historyFiles,
			healthCheck: config.healthCheck
		},
		historyMethods: [...HISTORY_METHODS],
		healthMethods: [...HEALTH_METHODS],
		home: runtime.dshHome
	};
	if (method === "session-health-scan") {
		const request = payload ?? {};
		const onlyProblems = request.onlyProblems !== false;
		if (request.resume === true) {
			const cached = runtime.cache?.read();
			if (cached === void 0) return {
				ok: true,
				cached: false,
				scanned: 0,
				total: countCorpus(runtime.dshHome),
				offset: 0,
				findings: []
			};
			return {
				ok: true,
				cached: true,
				scanned: 0,
				total: cached.total,
				offset: 0,
				findings: cached.findings,
				generatedAt: cached.generatedAt,
				currentTotal: countCorpus(runtime.dshHome)
			};
		}
		const limit = typeof request.limit === "number" && Number.isFinite(request.limit) ? Math.max(1, Math.min(MAX_SCAN_LIMIT, Math.floor(request.limit))) : 30;
		const offset = typeof request.offset === "number" && Number.isFinite(request.offset) && request.offset > 0 ? Math.floor(request.offset) : 0;
		const result = scanSessions({
			dshHome: runtime.dshHome,
			limit,
			offset,
			onlyProblems,
			attribute: runtime.attribute,
			projectionStateFor: runtime.projectionStateFor
		});
		if (result.ok && onlyProblems) {
			if (offset === 0) runtime.cache?.begin(result.total);
			runtime.cache?.append(result.findings, result.scanned);
		}
		return result;
	}
	const sessionId = asSessionId((payload ?? {}).sessionId);
	if (sessionId === void 0) return {
		ok: false,
		error: "缺少合法的 sessionId"
	};
	const session = findSession(sessionId, runtime.dshHome);
	if (session === void 0) return {
		ok: false,
		error: `未找到会话日志：${sessionId}`
	};
	const projectionState = runtime.projectionStateFor(sessionId);
	const reportFor = () => buildSessionReport({
		sessionId,
		dshHome: runtime.dshHome,
		...session.logPath === void 0 ? {} : { logPath: session.logPath },
		generations: session.generations,
		...projectionState === void 0 ? {} : { projectionState },
		attribute: runtime.attribute
	});
	if (method === "session-health-session") {
		const report = reportFor();
		runtime.cache?.patch(report);
		return {
			ok: true,
			report,
			prescriptions: prescribe(report, runtime.dshHome)
		};
	}
	const before = reportFor();
	if (before.level === "ok") {
		runtime.cache?.patch(before);
		const clean = assessRepair({
			before,
			after: before,
			repair: {
				ok: false,
				action: "quarantine-projection-cache",
				sessionId,
				from: ""
			}
		});
		return {
			ok: true,
			changed: false,
			before,
			after: before,
			repair: null,
			verdict: clean.verdict,
			explanation: clean.explanation,
			residual: clean.residual,
			prescriptions: ["# 全部检查通过：无需处置"]
		};
	}
	const repair = quarantineProjectionCache(sessionId, runtime.dshHome);
	const after = reportFor();
	const assessment = assessRepair({
		before,
		after,
		repair
	});
	runtime.cache?.patch(after);
	runtime.log(`health repair ${sessionId}: verdict=${assessment.verdict} quarantine=${repair.ok ? "ok" : repair.error ?? "skipped"} before=${before.level} after=${after.level}`);
	return {
		ok: true,
		changed: repair.ok,
		repair,
		before,
		after,
		verdict: assessment.verdict,
		explanation: assessment.explanation,
		residual: assessment.residual,
		prescriptions: prescribe(after, runtime.dshHome)
	};
}
/**
* 插件主体：装配运行时、挂载 fenced 路由。
* @param ctx - host 插件上下文（webServer / webRuntime / 可选 sessionQuery、sessions、sessionProjections）。
* @param config - 组合条目（0.1.7：`.volatile()` 字段为 live ref）。
*/
function apply(ctx, config = {}) {
	const current = () => ({
		enabled: readVolatileValue(config.enabled) ?? DEFAULT_CONFIG.enabled,
		historyFiles: readVolatileValue(config.historyFiles) ?? DEFAULT_CONFIG.historyFiles,
		healthCheck: readVolatileValue(config.healthCheck) ?? DEFAULT_CONFIG.healthCheck
	});
	const log = (message) => {
		try {
			ctx.logger?.info?.(`[session-steward] ${message}`);
		} catch {}
	};
	const homeEnv = process.env["DSH_HOME"];
	const resolvedHome = homeEnv !== void 0 && homeEnv !== "" ? homeEnv : join(homedir(), ".dsh");
	const webServer = ctx.webServer;
	const webRuntime = ctx.webRuntime;
	if (webServer === void 0 || webRuntime === void 0) {
		log("webServer / webRuntime 不可用：不注册路由");
		return;
	}
	let ownerIndex;
	const attributor = (projection) => {
		try {
			ownerIndex ??= buildProjectionOwnerIndex(defaultProfileNodeModules(resolvedHome));
		} catch (err) {
			log(`attribution index build failed: ${String(err instanceof Error ? err.message : err)}`);
			ownerIndex = [];
		}
		return createAttributor(ownerIndex)(projection);
	};
	const projectionStateFor = (sessionId) => {
		try {
			const sessions = ctx.get("sessions");
			const projections = ctx.get("sessionProjections");
			if (sessions?.get === void 0 || projections?.checkpoint === void 0) return void 0;
			const session = sessions.get(sessionId);
			if (session === void 0 || session === null) return void 0;
			return projections.checkpoint(session);
		} catch (err) {
			log(`projection checkpoint unavailable for ${sessionId}: ${String(err instanceof Error ? err.message : err)}`);
			return;
		}
	};
	const registry = () => ctx.get("workspaceRegistry");
	const runtime = {
		config: () => current(),
		dshHome: resolvedHome,
		registry,
		projectionStateFor,
		attribute: attributor,
		log,
		cache: new HealthCache()
	};
	if (current().enabled === false) {
		log("enabled=false：不注册任何路由");
		return;
	}
	ctx.effect(() => webServer.register({
		kind: "prefix",
		path: STEWARD_API_PREFIX,
		handler: async (req, res) => {
			if (!isTrustedApiRequest(req, webRuntime.trustedHosts)) {
				writeJson(res, 403, {
					ok: false,
					error: "forbidden"
				});
				return;
			}
			if (req.method !== "POST") {
				writeJson(res, 405, {
					ok: false,
					error: "method not allowed"
				});
				return;
			}
			const pathname = new URL(req.url ?? "/", "http://dsh.internal").pathname;
			const prefix = `${STEWARD_API_PREFIX}/`;
			const method = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : void 0;
			if (method === void 0 || method === "" || method.includes("/")) {
				writeJson(res, 404, {
					ok: false,
					error: `unknown session-steward API method`
				});
				return;
			}
			try {
				writeJson(res, 200, await handleMethod(method, await readJsonBody(req), runtime));
			} catch (err) {
				writeJson(res, 400, {
					ok: false,
					error: err instanceof Error ? err.message : String(err)
				});
			}
		}
	}), "dsh-session-steward: /session-steward/api route");
}
//#endregion
export { Config, DEFAULT_CONFIG, HEALTH_METHODS, HISTORY_METHODS, HealthCache, STEWARD_API_PREFIX, STEWARD_SETTINGS_NAMESPACE, apply, assessRepair, buildProjectionOwnerIndex, buildSessionReport, classifyGenerationFilename, countCorpus, createAttributor, decodeSessionLogBytes, decodeSessionLogFile, dirSize, discoverSessions, editWorkspaceDocument, findSession, findSessionLog, firstLosslessViolation, gateColdRead, gateGeneration, gateLogIntegrity, gateLosslessJson, gateProjectionCache, generationLogFilename, handleMethod, indexSessionDirs, inject, isLossless, isMigrationStagingFilename, isSafeChild, latestArtifactMtime, listHistory, locateSessionUsage, methodEnabled, parseGenerationLogFilename, prescribe, projCacheRootFor, pruneArchiveFile, pruneHistory, purgeHistory, quarantineProjectionCache, readArchiveSet, readProjectionCache, readSessionGenerations, readTailFacts, scanSessions, scanZstdFrames, sessionPriority, sessionsRootFor };
