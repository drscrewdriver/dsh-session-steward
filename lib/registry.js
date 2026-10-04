import { a as isSafeChild, c as projCacheRootFor, n as dirKey, s as locateSessionUsage, u as sessionsRootFor } from "./purge-ChQ-mgLu.js";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { WorkspaceRegistry } from "@deepseek-ai/dsh-workspace";
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
