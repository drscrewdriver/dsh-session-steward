import { copyFileSync, existsSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";
import zlib from "node:zlib";
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
/**
* 把会话 id 加入存储中枢的 `global.archivedSessionIds`（= 归档,prune 的逆操作）。
*
* 与 prune 同一写入口与协议（备份 + 临时文件 + 原子改名）；已在集合中的 id
* 不重复追加。运行中的宿主把集合留在内存里、只在启动时重载 —— 调用方必须
* 提示需要重启 DSH。
* @param ids - 要加入归档数组的会话 id。
* @param log - 可选日志出口。
* @param searchPaths - 可选候选路径覆盖（测试注入用）。
* @returns 实际新增数量与操作后的集合总数。
*/
function archiveArchiveFile(ids, log, searchPaths) {
	new Set(ids);
	let lastReason = "workspace storage file not found (searched ~/.dsh/storages/workspace.json)";
	for (const path of searchPaths ?? storageFileCandidates()) {
		let added = 0;
		let total = 0;
		const outcome = editWorkspaceDocument(path, (document) => {
			const global = document.global;
			const current = global?.archivedSessionIds;
			if (!Array.isArray(current)) throw new Error(`storage hub "${path}" holds no global.archivedSessionIds array`);
			const existing = new Set(current.filter((id) => typeof id === "string"));
			const fresh = ids.filter((id) => !existing.has(id));
			if (fresh.length === 0) {
				added = 0;
				total = existing.size;
				return false;
			}
			document.global = {
				...global,
				archivedSessionIds: [...current, ...fresh]
			};
			added = fresh.length;
			total = existing.size + fresh.length;
			return true;
		}, log);
		if (!outcome.ok) {
			lastReason = outcome.reason;
			continue;
		}
		if (outcome.changed) log?.(`archive: added ${added} ids; total ${total}`);
		return {
			added,
			total,
			file: outcome.file
		};
	}
	throw new Error(lastReason);
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
//#region src/host/health/source-kind.ts
/**
* 插件署名格式（source kind）体检门与转换。
*
* ## 背景：会话格式 v4 的署名要求
*
* 宿主 0.1.7-rc.1 起（会话格式 v4）废弃裸 `source: { kind: 'plugin', plugin: '<name>' }`
* 的署名方式，要求每条插件写入的消息使用生产者自有 kind（`plugin:<name>`）。
* 校验失败时**整轮失败**（SessionFormatError），不是丢一条消息。
* 修复模式（与已适配的 aegis、dsh-better-sidebar 一致）：
*   `{ kind: 'plugin', plugin: '<name>' }` → `{ kind: 'plugin:<name>' }`（删除 plugin 字段）。
*
* ## 版本依赖表（各格式代次依赖的宿主固定版本与处置策略）
*
* | 格式代次 | 宿主版本线          | 旧署名行是否合法 | 处置策略                                   |
* |---|---|---|---|
* | v1       | 未考证（早期线）     | 合法             | 不动（leave-asis）                          |
* | v2       | 未考证               | 合法             | 不动                                        |
* | v3       | 0.1.6 时代（待考证） | 合法             | 不动：宿主 v3→v4 迁移负责，插件越权改写属过度操作 |
* | v4       | ≥ 0.1.7-rc.1（已实锤）| **拒绝**（SessionFormatError） | 检测 + 可选转换（本模块） |
*
* 判定依据是**日志 header 的 version 字段**（`decode.ts` 已解析为 `SessionLogRead.header`），
* 不猜文件名、不猜宿主安装版本：同一份磁盘语料可能混有多条版本线的产物，
* 每份日志按它自己的 header 代次走对应的策略线。
*
* ## 红线（与 repair.ts 的红线关系）
*
* repair.ts 的红线是「禁止改写会话日志」。本模块的转换是**经用户显式触发的唯一例外**：
* 只改 `source.kind` / `source.plugin` 两个署名字段，其余字节原样保留；改前整文件备份；
* 日志完整性不合格（撕裂尾帧 / 解码失败 / seq 缺口）或代次不在 v4 线时**拒绝执行**。
* 这三道闸缺一不可，否则就退化成「静默改历史数据」。
*/
/** v4 线起点的宿主版本（会话格式 v4 引入 producer-owned source kind）。 */
const V4_HOST_MIN = "0.1.7-rc.1";
/** 从解码后的日志提取旧署名事实（只读）。 */
function readSourceKindFacts(log) {
	const byPlugin = {};
	const examples = [];
	for (const event of log.events) {
		const source = event.data?.source;
		if (source === void 0 || typeof source !== "object" || source.kind !== "plugin" || typeof source.plugin !== "string" || source.plugin === "") continue;
		byPlugin[source.plugin] = (byPlugin[source.plugin] ?? 0) + 1;
		if (examples.length < 5) examples.push({
			seq: event.seq,
			plugin: source.plugin
		});
	}
	const headerVersion = typeof log.header?.["version"] === "number" ? log.header["version"] : void 0;
	return {
		legacyCount: Object.values(byPlugin).reduce((sum, n) => sum + n, 0),
		byPlugin,
		examples,
		...headerVersion === void 0 ? {} : { headerVersion }
	};
}
/**
* gate 5：插件署名格式（v4 线要求 producer-owned kind）。
*
* 档位判据（有据才抬档）：
* - header.version ≥ 4 且观测到旧署名行 → `warn`：v4 校验拒绝这种署名；存量行让
*   未适配插件的读回判断（`kind === 'plugin' && plugin === name`）失配，转换可消除；
* - header.version < 4 → `ok`：v3 及更早线旧行合法，宿主迁移负责，**不动**（防过度操作）；
* - header.version 无从读取 → `skipped`：无从判定该走哪条版本线。
* @param facts - 旧署名事实；undefined 表示未提供（无日志）。
*/
function gateSourceKind(facts) {
	if (facts === void 0) return {
		id: "source-kind",
		level: "skipped",
		evidence: "未提供日志读取结果，本门无从判定"
	};
	const version = facts.headerVersion;
	const plugins = Object.entries(facts.byPlugin);
	const detail = {
		headerVersion: version,
		legacyCount: facts.legacyCount,
		byPlugin: facts.byPlugin,
		examples: facts.examples,
		v4HostMin: V4_HOST_MIN
	};
	if (version === void 0) return {
		id: "source-kind",
		level: "skipped",
		evidence: "日志 header 无 version 字段，无从判定格式代次线",
		detail
	};
	if (version < 4) return {
		id: "source-kind",
		level: "ok",
		evidence: `格式代次 v${version}（v4 之前的版本线）：旧署名行合法，宿主 v3→v4 迁移负责，不做转换` + (plugins.length > 0 ? `（观测到 ${plugins.reduce((s, [, n]) => s + n, 0)} 行旧署名，按策略不动）` : ""),
		detail
	};
	if (plugins.length === 0) return {
		id: "source-kind",
		level: "ok",
		evidence: `格式代次 v${version}：全部插件署名均为 producer-owned kind（plugin:<name>）`,
		detail
	};
	const summary = plugins.map(([name, count]) => `${name}×${count}`).join("、");
	return {
		id: "source-kind",
		level: "warn",
		evidence: `格式代次 v${version} 但存在 ${facts.legacyCount} 行旧署名（${summary}）：宿主 v4 拒绝该形态，未适配插件读回判断也会失配；可执行署名转换`,
		detail
	};
}
/**
* 从旧署名对象构造新署名：`{ kind: 'plugin', plugin: name, …rest }` → `{ kind: 'plugin:name', …rest }`。
* 非 legacy（缺 plugin 字段 / kind 不符）返回 undefined，调用方跳过该行。
*
* ⚠️ 只对**第三方**生产者名成立（第四轮审计 ST1）：宿主 `producerKind`
* （dsh-session-format-v3-to-v4@0.1.7-rc.2 lib/index.js:88-96）对第一方名走改名表
* 或同名裸 kind，本函数无条件加前缀会对那 30 个名字写出宿主永不产出的 kind。
* 第一方名由 `FIRST_PARTY_RENAMED_PRODUCERS` / `FIRST_PARTY_SAME_NAME_PRODUCERS`
* 判定，`migrateSessionSourceKind` 命中即跳过并如实上报（宿主迁移职权，不代转换）。
*/
function migrateLegacySource(source) {
	if (typeof source !== "object" || source === null) return void 0;
	const record = source;
	if (record["kind"] !== "plugin" || typeof record["plugin"] !== "string" || record["plugin"] === "") return void 0;
	const { plugin, ...rest } = record;
	return {
		...rest,
		kind: `plugin:${plugin}`
	};
}
/**
* 宿主 v3→v4 迁移会**改名**的第一方生产者（出处：dsh-session-format-v3-to-v4@
* 0.1.7-rc.2 lib/index.js:51-57 `RENAMED_PRODUCERS`，逐字照录）。
*/
const FIRST_PARTY_RENAMED_PRODUCERS = Object.freeze({
	"compact": "compact-checkpoint",
	"tools-code-mode": "ptc-mode",
	"tools-ptc": "ptc-mode",
	"dsh-compaction-basic": "compact-basic",
	"@deepseek-ai/dsh-system-prompt": "runtime-context"
});
/**
* 宿主迁移后**保留同名裸 kind** 的第一方生产者（出处：同上 lib/index.js:59-84
* `RELEASED_SAME_NAME_PRODUCERS`，逐字照录；注释明言限第一方）。
* 注：`@deepseek-ai/dsh-system-prompt` 还有 role 敏感分支（role=system →
* `system-prompt`），steward 无 role 上下文、结构性不可复刻——这正是第一方名
* 一律跳过、交还宿主迁移的核心理由之一。
*/
const FIRST_PARTY_SAME_NAME_PRODUCERS = /* @__PURE__ */ new Set([
	"agent-instructions",
	"session-reference",
	"team-message",
	"goal",
	"skill-invocation",
	"skill-catalog",
	"coordinator",
	"subagent-report",
	"subagent-settled",
	"webhook",
	"agent-message",
	"model-selection",
	"plan-mode",
	"time-context",
	"tmux-context",
	"user-approval",
	"repeat-tool-reminder",
	"tool-cordis",
	"cordis-host-runner",
	"tool-goal",
	"tool-jobs",
	"hooks-codex",
	"hooks-claude-code",
	"schedule",
	"dsh-session-title-llm"
]);
/** 是否第一方生产者名（宿主迁移职权，steward 不代转换——防归因静默损坏）。 */
function isFirstPartyLegacyProducer(plugin) {
	return Object.hasOwn(FIRST_PARTY_RENAMED_PRODUCERS, plugin) || FIRST_PARTY_SAME_NAME_PRODUCERS.has(plugin);
}
/**
* 转换一个会话日志里的旧署名行（v4 线专用；先备份，只动署名字段）。
*
* 执行闸（任一不满足即拒绝，不写盘）：
* 1. 日志可整体解码且无完整性问题（撕裂尾帧 / 解码失败 / seq 缺口）；
* 2. header.version ≥ 4（v3 及更早的旧行按契约由宿主迁移，不动）；
* 3. 确有旧署名行（没有则空手而归，不做无谓重压缩）。
* @param sessionId - 会话 id（用于结果标注）。
* @param logPath - 当前代日志路径（必须 .zstd 结尾）。
* @param log - 已解码的日志（复用体检结果，闸 1/2 在其上判定）。
* @param dshHome - DSH home（备份不依赖它，参数保留与其它处置一致的面）。
* @param now - 时间源（备份后缀，测试可控）。
*/
function migrateSessionSourceKind(sessionId, logPath, log, dshHome, now = Date.now) {
	const failure = (error) => ({
		ok: false,
		sessionId,
		path: logPath,
		error
	});
	if (!logPath.endsWith(".zstd")) return failure(`非 zstd 产物，拒绝处理：${logPath}`);
	if (log.issues.length > 0) return failure(`日志存在 ${log.issues.length} 条完整性问题，拒绝改写（先解决 log-integrity 门）`);
	if (log.tornStart !== void 0) return failure("存在撕裂尾帧，拒绝改写（先让宿主完成提交或处置 log-integrity 门）");
	const headerVersion = typeof log.header?.["version"] === "number" ? log.header["version"] : void 0;
	if (headerVersion === void 0) return failure("日志 header 无 version 字段，无法确认格式代次线，拒绝改写");
	if (headerVersion < 4) return failure(`格式代次 v${headerVersion}：旧署名在该版本线合法，宿主迁移负责，不做转换（防过度操作）`);
	let original;
	try {
		original = readPlaintext(logPath);
	} catch (err) {
		return failure(`读取日志失败：${String(err instanceof Error ? err.message : err)}`);
	}
	const lines = original.split("\n");
	let changedRows = 0;
	const byPlugin = {};
	const skippedFirstParty = {};
	const rewritten = lines.map((line, index) => {
		if (index === 0 || line.trim() === "") return line;
		let parsed;
		try {
			parsed = JSON.parse(line);
		} catch {
			return line;
		}
		if (typeof parsed !== "object" || parsed === null) return line;
		const record = parsed;
		const data = record["data"];
		if (data === void 0 || typeof data !== "object") return line;
		const legacy = data["source"];
		if (legacy === void 0 || typeof legacy !== "object" || legacy["kind"] !== "plugin" || typeof legacy["plugin"] !== "string" || legacy["plugin"] === "") return line;
		const plugin = legacy["plugin"];
		if (isFirstPartyLegacyProducer(plugin)) {
			skippedFirstParty[plugin] = (skippedFirstParty[plugin] ?? 0) + 1;
			return line;
		}
		const migrated = migrateLegacySource(legacy);
		if (migrated === void 0) return line;
		data["source"] = migrated;
		changedRows += 1;
		byPlugin[plugin] = (byPlugin[plugin] ?? 0) + 1;
		return JSON.stringify(record);
	});
	if (changedRows === 0) return {
		ok: true,
		sessionId,
		path: logPath,
		changedRows: 0,
		byPlugin: {},
		...Object.values(skippedFirstParty).reduce((sum, n) => sum + n, 0) > 0 ? { skippedFirstParty } : {}
	};
	const backup = `${logPath}.pre-sourcemigrate-${now()}`;
	try {
		copyFileSync(logPath, backup);
		const compressed = zlib.zstdCompressSync(Buffer.from(rewritten.join("\n"), "utf8"));
		const tmp = `${logPath}.sourcemigrate-tmp`;
		writeFileSync(tmp, compressed);
		renameSync(tmp, logPath);
		return {
			ok: true,
			sessionId,
			path: logPath,
			backup,
			changedRows,
			byPlugin,
			...Object.keys(skippedFirstParty).length > 0 ? { skippedFirstParty } : {}
		};
	} catch (err) {
		return failure(`转换落盘失败（原文件未动，备份${existsSync(backup) ? "已生成" : "未生成"}）：${String(err instanceof Error ? err.message : err)}`);
	}
}
/** 读出整份 zstd 日志的明文；失败时抛出（调用方拒绝改写并如实上报）。 */
function readPlaintext(logPath) {
	const bytes = readFileSync(logPath);
	const { frames, tornStart } = scanZstdFrames(bytes);
	if (tornStart !== void 0) throw new Error("存在撕裂尾帧，拒绝改写");
	const parts = [];
	for (const frame of frames) parts.push(zlib.zstdDecompressSync(bytes.subarray(frame.start, frame.end)));
	return Buffer.concat(parts).toString("utf8");
}
/** 备份文件的后缀约定（purge/清理工具可据此识别并一并处置）。 */
const SOURCE_MIGRATE_BACKUP_SUFFIX = ".pre-sourcemigrate-";
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
/** 是否署名转换备份文件（`*.pre-sourcemigrate-<ts>`）。 */
function isSourceMigrateBackupName(name) {
	return name.includes(SOURCE_MIGRATE_BACKUP_SUFFIX);
}
/**
* 列出一个转录目录里的署名转换备份（只扫顶层：备份与日志同目录落盘）。
* @returns 备份绝对路径与合计字节数；目录不存在时为空。
*/
function backupFilesIn(dir) {
	const files = [];
	let bytes = 0;
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return {
			files,
			bytes
		};
	}
	for (const entry of entries) {
		if (!entry.isFile() || !isSourceMigrateBackupName(entry.name)) continue;
		const path = join(dir, entry.name);
		files.push(path);
		try {
			bytes += statSync(path).size;
		} catch {}
	}
	return {
		files,
		bytes
	};
}
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
			backupBytes: 0,
			backupCount: 0,
			cacheBytes: 0
		};
		const dir = dirs.get(key);
		if (dir !== void 0) {
			usage.dir = dir;
			usage.bytes = dirSize(dir);
			const backups = backupFilesIn(dir);
			usage.backupBytes = backups.bytes;
			usage.backupCount = backups.files.length;
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
	let backupsRemoved = 0;
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
			backupsRemoved += entry.backupCount;
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
	log?.(`archive purge: cleared ${purged} of ${ids.length}; freed ${(freedBytes / 1048576).toFixed(1)}MB; backups ${backupsRemoved}; failures ${failures.length}`);
	return {
		ok: true,
		purged,
		freedBytes,
		backupsRemoved,
		requiresRestart: true,
		...failures.length === 0 ? {} : { failures }
	};
}
//#endregion
export { readArchiveSet as C, pruneArchiveFile as S, decodeSessionLogBytes as _, isSafeChild as a, archiveArchiveFile as b, projCacheRootFor as c, SOURCE_MIGRATE_BACKUP_SUFFIX as d, V4_HOST_MIN as f, readSourceKindFacts as g, migrateSessionSourceKind as h, indexSessionDirs as i, purgeHistory as l, migrateLegacySource as m, dirKey as n, isSourceMigrateBackupName as o, gateSourceKind as p, dirSize as r, locateSessionUsage as s, backupFilesIn as t, sessionsRootFor as u, decodeSessionLogFile as v, editWorkspaceDocument as x, scanZstdFrames as y };
