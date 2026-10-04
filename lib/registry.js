import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import { WorkspaceRegistry } from "@deepseek-ai/dsh-workspace";
Object.freeze({
	"compact": "compact-checkpoint",
	"tools-code-mode": "ptc-mode",
	"tools-ptc": "ptc-mode",
	"dsh-compaction-basic": "compact-basic",
	"@deepseek-ai/dsh-system-prompt": "runtime-context"
});
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
//#endregion
//#region src/host/registry/archive-registry.ts
/**
* 替换官方 workspace 注册表的管家子类(P1 服务替换,AM 架构轻量版)。
*
* cordis.patch.yml 禁用官方 `workspace` 行并插入本类(`dsh-session-steward/registry`):
* - 归档/取消归档/记账完全继承官方行为(setState 自带持久化,免重启);
* - 覆写 sessionKnown / indexHeader 挂**墓碑**:本进程已物理删除的会话不被
*   stale `persistence.list()` 重新编入索引、不被重新写回归档集合;
* - 冷复用探针:其他进程以同 id 重建且日志身份不同(createdAt/cwd)的新会话
*   撤墓碑放行,避免误挡;
* - `deleteSession`:全痕删除七步 —— 实时 flush/detach → 等投影写尾 → 删缓存
*   文件 → subagent 后代级联(fork 不级联)→ 清 spill → 删转录目录(越界防护)
*   → 记账清理(归档集合 + 工作区成员表)+ 父类内存索引遗忘。物理成功才提交
*   记账,失败保留现场可重试。
*
* 已知边界:官方投影缓存服务无 delete API,缓存行走"等写尾 + 删文件"直删
* (官方缓存 fail-soft 自愈兜底);whenIdle 只覆盖本类感知的在途写。
*
* 类型策略(AM 同款):官方把 sessionKnown/indexHeader/requireState 等声明为
* TS private,子类用结构化镜像接口松化基类构造器 —— 运行时成员逐一存在
* (0.1.7/0.2.0 实证),逐段 try/catch 容忍老线形状漂移。
*/
const TOMBSTONE_LIMIT = 4096;
const StewardWorkspaceRegistry = class extends WorkspaceRegistry {
	static inject = ["storageDomain", "sessionPersistence"];
	/** 本进程已物理删除的会话墓碑(FIFO 上限淘汰,宁多挡不错放)。 */
	deletedSessionIds = /* @__PURE__ */ new Set();
	deletedSessionOrder = [];
	/** 被删生命周期的日志身份:冷复用探针区分"同 id 新会话"与 stale list()。 */
	deletedIdentities = /* @__PURE__ */ new Map();
	/** 转录/缓存文件定位根(apply 装配时注入;缺失时文件删除跳过并记日志)。 */
	dshHome = "";
	log(message) {
		try {
			this.ctx.logger?.info?.(`[session-steward] ${message}`);
		} catch {}
	}
	/** ── 墓碑层:覆写父类的已知性判定与头部索引 ── */
	async sessionKnown(id) {
		const sessions = this.ctx.get("sessions");
		if (sessions?.get?.(id) !== void 0 && sessions.get(id) !== null) {
			this.clearTombstone(id);
			return true;
		}
		if (this.deletedSessionIds.has(id)) return await this.coldReuseKnown(id);
		return await super.sessionKnown(id);
	}
	/** 冷复用探针:同 id 重建且日志身份不同 → 撤墓碑重新编入;身份不可考则保守维持未知。 */
	async coldReuseKnown(id) {
		const deleted = this.deletedIdentities.get(id);
		if (deleted === void 0) return false;
		const header = (await this.allStoredHeaders()).find((item) => item.id === id);
		if (header === void 0) return false;
		if (header.createdAt === deleted.createdAt && header.cwd === deleted.cwd) return false;
		this.clearTombstone(id);
		try {
			await this.indexHeader(header);
		} catch {}
		return true;
	}
	async indexHeader(header) {
		if (header.id !== void 0 && this.deletedSessionIds.has(header.id)) return;
		await super.indexHeader(header);
	}
	clearTombstone(sessionId) {
		this.deletedSessionIds.delete(sessionId);
		this.deletedIdentities.delete(sessionId);
		const idx = this.deletedSessionOrder.indexOf(sessionId);
		if (idx >= 0) this.deletedSessionOrder.splice(idx, 1);
	}
	/** ── 全痕删除 ── */
	/** 逐会话入口:任何一步失败都返回 ok:false + error,记账保留现场可重试。 */
	async deleteSession(sessionId) {
		try {
			return await this.deleteCore(sessionId);
		} catch (err) {
			const message = String(err instanceof Error ? err.message : err);
			this.log(`delete ${sessionId} failed: ${message}`);
			return {
				ok: false,
				error: message
			};
		}
	}
	async deleteCore(sessionId, descendantHeaders) {
		if (!await this.sessionKnown(sessionId)) {
			await this.forgetBookkeeping(sessionId);
			this.log(`delete ${sessionId}: unknown session, residual bookkeeping cleared`);
			return {
				ok: true,
				skipped: true
			};
		}
		const sessions = this.ctx.get("sessions");
		const live = sessions?.get?.(sessionId);
		const deletedHeader = this.headers?.get(sessionId) ?? live?.header;
		if (live !== void 0) {
			await sessions.flush(live);
			const entry = sessions.liveEntryFor(live);
			sessions.detachEntered(entry);
		}
		await this.ctx.get("sessionProjectionCache")?.whenIdle?.();
		this.deleteProjectionCacheFile(sessionId);
		await this.deleteDescendants(sessionId, descendantHeaders);
		await this.cleanSpill(sessionId);
		this.removeTranscriptDirectory(sessionId);
		await this.forgetBookkeeping(sessionId);
		this.forgetIndexedSession(sessionId);
		if (deletedHeader !== void 0) this.deletedIdentities.set(sessionId, {
			createdAt: deletedHeader.createdAt,
			cwd: deletedHeader.cwd
		});
		try {
			this.ctx.emit?.("api-session/removed", sessionId);
		} catch {}
		return { ok: true };
	}
	/** subagent 后代级联:live 列表优先,stored headers 兜底;fork(parentSession 有值但 origin 非 subagent)不级联。 */
	async deleteDescendants(sessionId, storedHeaders) {
		try {
			const descendants = [];
			const sessions = this.ctx.get("sessions");
			const listed = typeof sessions?.list === "function" ? sessions.list() : [];
			for (const session of listed) {
				const header = session?.header;
				if (header?.parentSession === sessionId && header.origin === "subagent" && typeof session.id === "string") descendants.push(session.id);
			}
			if (descendants.length === 0) {
				const headers = storedHeaders ?? await this.allStoredHeaders();
				for (const header of headers) if (header.parentSession === sessionId && header.origin === "subagent" && typeof header.id === "string") descendants.push(header.id);
			}
			for (const child of descendants) {
				if (child === sessionId) continue;
				await this.deleteCore(child, storedHeaders);
			}
			if (descendants.length > 0) this.log(`delete ${sessionId}: cascaded ${descendants.length} subagent descendant(s)`);
		} catch (err) {
			this.log(`descendant cascade for ${sessionId} failed: ${String(err instanceof Error ? err.message : err)}`);
		}
	}
	/** 父类 listStoredHeaders(0.1.5+)→ sessionPersistence.list 兜底 → 空数组。 */
	async allStoredHeaders() {
		try {
			const listed = await this.listStoredHeaders?.();
			if (Array.isArray(listed)) return listed;
		} catch {}
		try {
			const listed = await this.ctx.get("sessionPersistence")?.list?.();
			if (Array.isArray(listed)) return listed;
		} catch {}
		return [];
	}
	/** spill 目录直删(sessionDir(root, sessionId) — spill-local 包自己的签名)。 */
	async cleanSpill(sessionId) {
		try {
			const spill = this.ctx.get("spillStore");
			if (spill === void 0 || typeof spill.root !== "string") return;
			const mod = await import("@deepseek-ai/dsh-spill-local");
			if (typeof mod.sessionDir !== "function") return;
			rmSync(mod.sessionDir(spill.root, sessionId), {
				recursive: true,
				force: true
			});
		} catch (err) {
			this.log(`spill cleanup for ${sessionId} failed: ${String(err instanceof Error ? err.message : err)}`);
		}
	}
	/** 转录目录删除:文件扫描定位(与文件路径同一套越界防护)。 */
	removeTranscriptDirectory(sessionId) {
		if (this.dshHome === "") {
			this.log(`transcript deletion for ${sessionId} skipped: dshHome not wired`);
			return;
		}
		const entry = locateSessionUsage([sessionId], this.dshHome).get(sessionId);
		if (entry?.dir === void 0) return;
		if (!isSafeChild(sessionsRootFor(this.dshHome), entry.dir, 2)) {
			this.log(`refusing out-of-root transcript path: ${entry.dir}`);
			return;
		}
		rmSync(entry.dir, {
			recursive: true,
			force: true
		});
	}
	/** 缓存文件直删:双候选文件名(带/不带 session- 前缀,与 purge.ts 同纪律)。 */
	deleteProjectionCacheFile(sessionId) {
		if (this.dshHome === "") return;
		const cacheRoot = projCacheRootFor(this.dshHome);
		for (const name of [`${sessionId}.json`, `${dirKey(sessionId)}.json`]) {
			const candidate = join(cacheRoot, name);
			if (!isSafeChild(cacheRoot, candidate, 1)) continue;
			try {
				rmSync(candidate, { force: true });
			} catch {}
		}
	}
	/** 记账清理:归档集合(setState)+ 工作区成员表(requireTable)。逐段容错。 */
	async forgetBookkeeping(sessionId) {
		try {
			const state = this.requireState?.();
			if (state?.archivedSessionIds !== void 0 && this.setState !== void 0 && Array.isArray(state.archivedSessionIds) && state.archivedSessionIds.includes(sessionId)) await this.setState({
				...state,
				archivedSessionIds: state.archivedSessionIds.filter((id) => id !== sessionId)
			});
		} catch (err) {
			this.log(`archive-set bookkeeping cleanup for ${sessionId} failed: ${String(err instanceof Error ? err.message : err)}`);
		}
		try {
			const table = this.requireTable?.();
			const workspaceIds = (this.requireState?.())?.workspaceIds;
			if (table?.update === void 0 || !Array.isArray(workspaceIds)) return;
			for (const workspaceId of workspaceIds) {
				const record = table.get?.(workspaceId);
				if (record === void 0 || !Array.isArray(record.sessionIds) || !record.sessionIds.includes(sessionId)) continue;
				const next = await table.update(workspaceId, (current) => ({
					...current,
					sessionIds: current.sessionIds.filter((id) => id !== sessionId)
				}));
				const entity = this.entities?.get(workspaceId);
				if (entity !== void 0) entity.record = next;
			}
		} catch (err) {
			this.log(`workspace bookkeeping cleanup for ${sessionId} failed: ${String(err instanceof Error ? err.message : err)}`);
		}
	}
	/** 父类内存索引遗忘 + 墓碑登记(FIFO 上限淘汰)。 */
	forgetIndexedSession(sessionId) {
		if (!this.deletedSessionIds.has(sessionId)) {
			this.deletedSessionIds.add(sessionId);
			this.deletedSessionOrder.push(sessionId);
		}
		while (this.deletedSessionOrder.length > TOMBSTONE_LIMIT) {
			const oldest = this.deletedSessionOrder.shift();
			if (oldest !== void 0 && oldest !== sessionId) {
				this.deletedSessionIds.delete(oldest);
				this.deletedIdentities.delete(oldest);
			}
		}
		try {
			this.headers?.delete(sessionId);
		} catch {}
		try {
			this.sessionPaths?.delete?.(sessionId);
		} catch {}
		try {
			this.invalidSessionPaths?.delete?.(sessionId);
		} catch {}
	}
};
//#endregion
export { StewardWorkspaceRegistry };
