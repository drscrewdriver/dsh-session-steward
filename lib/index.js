import z from "@deepseek-ai/schemastery";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
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
* 读取顺序：优先进程内 `workspaceRegistry` 服务（UI 过滤所用的同一事实）；
* 回退直接读规范存储文件（workspace domain 把 `archivedSessionIds` 落在
* `global` 段：storage-json 即 `~/.dsh/storages/workspace.json`）。
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
/**
* 解析一次官方归档集合。
* @param registry - 惰性 workspaceRegistry 面（可能缺失或抛错）。
* @param searchPaths - 可选候选路径覆盖（DSH_HOME 非默认值或测试注入时使用）。
* @returns 归档 ids 以及服务它的来源。
*/
function readArchiveSet(registry, searchPaths) {
	if (registry !== void 0) try {
		const ids = registry.archivedSessionIds;
		if (Array.isArray(ids)) return {
			ids,
			source: "registry"
		};
	} catch {}
	for (const path of searchPaths ?? storageFileCandidates()) {
		if (!existsSync(path)) continue;
		try {
			return {
				ids: readStorageFile(path),
				source: "storage-file"
			};
		} catch {}
	}
	return {
		ids: [],
		source: "none"
	};
}
/**
* 从存储中枢的 global.archivedSessionIds 中移除会话 id。
*
* 官方后端没有 unarchive 端点，因此直接编辑规范文件，遵循 storage-json 自身的协议：
* 备份、同目录临时写入、改名。运行中的宿主把集合留在内存里、只在启动时重载 ——
* 调用方必须提示需要重启 DSH。
* @param ids - 要从归档数组中移除的会话 id。
* @param log - 可选日志出口。
* @param searchPaths - 可选候选路径覆盖（测试注入用）。
* @returns 实际移除数量与剩余数量。
*/
function pruneArchiveFile(ids, log, searchPaths) {
	const wanted = new Set(ids);
	for (const path of searchPaths ?? storageFileCandidates()) {
		if (!existsSync(path)) continue;
		let document;
		try {
			document = JSON.parse(readFileSync(path, "utf8"));
		} catch (err) {
			log?.(`archive prune: cannot parse "${path}": ${String(err instanceof Error ? err.message : err)}`);
			continue;
		}
		const current = document.global?.archivedSessionIds;
		if (!Array.isArray(current)) {
			log?.(`archive prune: "${path}" holds no global.archivedSessionIds array`);
			continue;
		}
		const kept = current.filter((id) => typeof id === "string" && !wanted.has(id));
		const removed = current.length - kept.length;
		if (removed === 0) return {
			removed: 0,
			remaining: current.length,
			file: path
		};
		const backup = `${path}.bak-${Date.now()}`;
		copyFileSync(path, backup);
		const next = {
			...document,
			global: {
				...document.global,
				archivedSessionIds: kept
			}
		};
		const tmp = `${path}.prune-tmp`;
		writeFileSync(tmp, `${JSON.stringify(next, null, 2)}
`, "utf8");
		renameSync(tmp, path);
		log?.(`archive prune: removed ${removed} of ${current.length} ids; backup=${backup}`);
		return {
			removed,
			remaining: kept.length,
			file: path
		};
	}
	throw new Error("workspace storage file not found (searched ~/.dsh/storages/workspace.json)");
}
//#endregion
//#region src/host/history/archive.ts
/**
* 会话历史文件（归档）域的服务端处理。
*
* 与 dsh-session-search-toggle 的差异（**刻意且必须记入交付说明**）：
* toggle 的 `list-archived` 从它自己的独立索引里列出归档行（`engine.listArchived()`），
* 而索引已随搜索索引包离开本包。因此本包改为从**官方归档集合**列出来源真值
* （`readArchiveSet`：registry 优先、存储文件回退），标题等元数据为尽力而为：
* 依次尝试 `sessionQuery.readTitleSnapshots` → 投影缓存记录里的 title。
* 清理（prune）路径与迁移前**逐字等价**（备份 + 原子替换 + 需重启提示）。
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
async function listHistory(getRegistry, query, searchPaths) {
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
	return {
		ok: true,
		items: ids.map((sessionId) => {
			return {
				sessionId,
				title: titles.get(sessionId) ?? titleFromProjectionCache(sessionId),
				cwd: "",
				updatedAt: 0
			};
		}),
		source: read.source,
		...degraded === void 0 ? {} : { degraded }
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
* @param file - `session.jsonl.zstd` 绝对路径。
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
	return {
		events,
		frames: frames.length,
		...tornStart === void 0 ? {} : { tornStart },
		recoveredFromTorn,
		issues,
		decoder: decoders === void 0 ? "local" : "official",
		...openStep === void 0 ? {} : { openStep }
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
* 四个体检 gate（每个可独立测试）与报告聚合。
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
		level: "warn",
		evidence: "投影缓存记录不存在（宿主会在下次检查点重建；若长期不出现说明检查点写入被拒）",
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
		level: "warn",
		evidence: "拿不到热态投影状态（宿主未暴露 sessionProjections）；冷态记录经 JSON 往返必然无损，无法判定"
	};
	const keys = Object.keys(projectionState);
	if (keys.length === 0) return {
		id: "lossless-json",
		level: "warn",
		evidence: "热态投影状态为空，无可判定行"
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
		level: "warn",
		evidence: "日志中没有 turn/end，无法确认存在可接续的已完成轮次",
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
/** 聚合四门结果为一份报告。 */
function buildSessionReport(context) {
	const log = context.log ?? (context.logPath === void 0 ? void 0 : decodeSessionLogFile(context.logPath));
	const gates = [];
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
	if (cache?.level !== "ok") {
		lines.push(`# 投影缓存未对齐：${cache?.evidence ?? "未知"}`);
		lines.push("# 1) 先隔离陈旧记录，再重启宿主让其重折叠");
		lines.push(`#    POST /session-steward/api/session-health-repair {"sessionId":"${report.sessionId}"}`);
	}
	if (gate("cold-read")?.level === "fail") lines.push("# 会话仍处于 open step：请等待宿主结算（不要硬改日志），必要时重启宿主后重新体检");
	if (lines.length === 0) lines.push("# 四门全绿：无需处置");
	return lines;
}
//#endregion
//#region src/host/health/scan.ts
/**
* 批量体检：枚举会话日志、跑四门、给出汇总（供 `session-health-scan` 使用）。
*
* 只读；不激活任何 Agent，也不写任何会话数据。为控制成本，默认限制单次扫描的
* 会话数与并发度，并支持 `limit` / `since` 过滤。
*/
/** 会话根目录（`<dshHome>/sessions/<project>/<sessionId>/session.jsonl.zstd`）。 */
function sessionsRoot(dshHome) {
	return join(dshHome ?? join(homedir(), ".dsh"), "sessions");
}
/** 枚举全部会话日志（按 mtime 倒序），带可选上限。 */
function discoverSessions(dshHome, limit = 200) {
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
			const path = join(dir, entry.name);
			if (entry.isDirectory()) {
				const candidate = join(path, "session.jsonl.zstd");
				if (existsSync(candidate)) {
					let stats;
					try {
						const stat = statSync(candidate);
						stats = {
							mtimeMs: stat.mtimeMs,
							size: stat.size
						};
					} catch {
						continue;
					}
					out.push({
						sessionId: entry.name,
						logPath: candidate,
						updatedAt: stats.mtimeMs,
						bytes: stats.size
					});
					continue;
				}
				stack.push(path);
			}
		}
	}
	out.sort((left, right) => right.updatedAt - left.updatedAt);
	return out.slice(0, Math.max(1, limit));
}
/** 定位一个会话的日志路径（跨工程目录查找）。 */
function findSessionLog(sessionId, dshHome) {
	return discoverSessions(dshHome, 1e5).find((session) => session.sessionId === sessionId)?.logPath;
}
/**
* 批量体检。
* @param options - dshHome / 扫描上限 / 是否只返回非 ok / 归属查询 / 热态状态提供者。
*/
function scanSessions(options) {
	const discovered = discoverSessions(options.dshHome, options.limit ?? 50);
	if (discovered.length === 0) return {
		ok: false,
		scanned: 0,
		findings: [],
		error: "未发现任何会话日志（检查 DSH home 与 sessions 目录）"
	};
	const findings = [];
	for (const session of discovered) {
		const projectionState = options.projectionStateFor?.(session.sessionId);
		const report = buildSessionReport({
			sessionId: session.sessionId,
			...options.dshHome === void 0 ? {} : { dshHome: options.dshHome },
			logPath: session.logPath,
			...projectionState === void 0 ? {} : { projectionState },
			...options.attribute === void 0 ? {} : { attribute: options.attribute },
			...options.now === void 0 ? {} : { now: options.now }
		});
		if (options.onlyProblems === true && report.level === "ok") continue;
		findings.push(report);
	}
	return {
		ok: true,
		scanned: discovered.length,
		findings,
		...options.onlyProblems === true ? { filtered: true } : {}
	};
}
//#endregion
//#region src/index.ts
/** 本插件声明的宿主服务（与 toggle 相同的注入面）。 */
const inject = ["webServer", "webRuntime"];
/** 运行时配置 schema（与 src/config.ts 的形状保持一致）。 */
const Config = z.object({
	enabled: z.boolean().default(true),
	historyFiles: z.boolean().default(true),
	healthCheck: z.boolean().default(true)
});
/**
* 官方 `installSettingsSection` 的内联等价：通过 settings 服务注册命名空间、
* 以组合入口作为 `base` 层、并保持运行时来源实时（与 toggle / thinking-levels 同范式）。
*/
function installSettingsSection(ctx, ns, schema, entry, hooks) {
	ctx.inject(["settings"], (sctx) => {
		const scope = sctx.settings.register(ns, schema, { base: entry });
		hooks.setSource(() => scope.get());
		hooks.onChange();
		sctx.effect(() => () => {
			hooks.setSource(() => entry);
			hooks.onChange();
		});
		scope.watch(() => hooks.onChange());
	});
}
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
/** 支持的路由方法（按子域分组；用于对外声明与测试断言）。 */
const HISTORY_METHODS = ["session-history-list", "session-history-prune"];
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
	if (method === "session-history-list") return await listHistory(runtime.registry, void 0, storagePathsFor(runtime.dshHome));
	if (method === "session-history-prune") return pruneHistory(payload, runtime.log, storagePathsFor(runtime.dshHome));
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
		const limit = typeof request.limit === "number" && Number.isFinite(request.limit) ? Math.max(1, Math.min(MAX_SCAN_LIMIT, Math.floor(request.limit))) : 30;
		return scanSessions({
			dshHome: runtime.dshHome,
			limit,
			onlyProblems: request.onlyProblems !== false,
			attribute: runtime.attribute,
			projectionStateFor: runtime.projectionStateFor
		});
	}
	const sessionId = asSessionId((payload ?? {}).sessionId);
	if (sessionId === void 0) return {
		ok: false,
		error: "缺少合法的 sessionId"
	};
	const logPath = findSessionLog(sessionId, runtime.dshHome);
	if (logPath === void 0) return {
		ok: false,
		error: `未找到会话日志：${sessionId}`
	};
	const projectionState = runtime.projectionStateFor(sessionId);
	const reportFor = () => buildSessionReport({
		sessionId,
		dshHome: runtime.dshHome,
		logPath,
		...projectionState === void 0 ? {} : { projectionState },
		attribute: runtime.attribute
	});
	if (method === "session-health-session") {
		const report = reportFor();
		return {
			ok: true,
			report,
			prescriptions: prescribe(report, runtime.dshHome)
		};
	}
	const before = reportFor();
	if (before.level === "ok") return {
		ok: true,
		changed: false,
		before,
		after: before,
		repair: null,
		prescriptions: ["# 四门全绿：无需处置"]
	};
	const repair = quarantineProjectionCache(sessionId, runtime.dshHome);
	const after = reportFor();
	runtime.log(`health repair ${sessionId}: quarantine=${repair.ok ? "ok" : repair.error ?? "skipped"} before=${before.level} after=${after.level}`);
	return {
		ok: true,
		changed: repair.ok,
		repair,
		before,
		after,
		prescriptions: prescribe(after, runtime.dshHome)
	};
}
/**
* 插件主体：注册设置命名空间、装配运行时、挂载 fenced 路由。
* @param ctx - host 插件上下文（webServer / webRuntime / 可选 settings、sessionQuery、sessions、sessionProjections）。
*/
function apply(ctx) {
	let current = () => DEFAULT_CONFIG;
	installSettingsSection(ctx, STEWARD_SETTINGS_NAMESPACE, Config, DEFAULT_CONFIG, {
		setSource: (source) => {
			current = () => ({
				...DEFAULT_CONFIG,
				...source()
			});
		},
		onChange: () => {}
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
		log
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
export { DEFAULT_CONFIG, HEALTH_METHODS, HISTORY_METHODS, STEWARD_API_PREFIX, STEWARD_SETTINGS_NAMESPACE, apply, buildProjectionOwnerIndex, buildSessionReport, createAttributor, decodeSessionLogBytes, decodeSessionLogFile, discoverSessions, findSessionLog, firstLosslessViolation, gateColdRead, gateLogIntegrity, gateLosslessJson, gateProjectionCache, handleMethod, inject, isLossless, listHistory, methodEnabled, prescribe, pruneArchiveFile, pruneHistory, quarantineProjectionCache, readArchiveSet, readProjectionCache, readTailFacts, scanSessions, scanZstdFrames };
