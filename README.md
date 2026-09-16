# dsh-session-steward（会话管家 / Session Steward）

DSH Web 插件：**会话历史文件 + 会话健康检查**。它只做两件事，且都不碰会话数据本身：

- **养老院（会话历史文件）**：浏览官方归档集合、批量清理（备份 + 原子替换，需重启宿主生效）。

> **清理语义与两条硬约束**（照做，否则清理会白做）：
> 1. **列表与清理同源** —— 两边都认存储文件 `~/.dsh/storages/workspace.json` 的
>    `global.archivedSessionIds`。宿主内存里的 `workspaceRegistry` 是启动快照，
>    清理写不到它，只作为「已出文件、仍生效」的诊断面（`pendingRestart`）。
> 2. **清理后立刻重启 DSH** —— 存储层是全量重写、内存为准：宿主退出前**任何**归档或
>    工作区改动都会把旧集合整份写回，本次清理归零。
>
> 清理 = 从归档数组移除（会话重新回到侧边栏），**不是删除会话数据**。
- **体检（健康检查 / 会话医生）**：四门体检 → 处方（命令清单）→ 出院（可逆处置 + before/after 对照）。

> 命名边界：**本插件不提供搜索与索引**。搜索/独立索引属于另一片（`dsh-search-index`），
> 两侧互不出现对方的子域字眼，也不互相解释对方字段。

## 安装

```bash
dsh plugin --profile web add dsh-session-steward
# 或本地开发目录
dsh plugin --profile web add "link:E:/test/rewrite-agently/mine-dsh-plugins/dsh-session-steward"
```

安装后**必须重启宿主进程**（仅刷新页面无效）。

## 路由契约

前缀 `/session-steward/api`，方法名一律 `session-*`（**不得**与搜索索引的 `index-*` 混用）；
未识别的方法返回显式错误，绝不静默。

| 方法 | 子域 | 作用 |
|---|---|---|
| `session-history-list` | history | 列出归档集合（存储文件优先；含来源、降级与 `pendingRestart` 标注） |
| `session-history-prune` | history | 从归档数组批量移除 id（自动备份，需重启） |
| `session-health-status` | health | 开关状态与方法表（面板轮询用） |
| `session-health-scan` | health | 批量体检（默认只返回非 ok 的会话） |
| `session-health-session` | health | 单会话四门报告 + 处方 |
| `session-health-repair` | health | 可逆处置（隔离投影缓存记录）+ before/after |

设置命名空间：`session-steward`；侧边栏入口 id：`dsh-session-steward`。

## 两个开关（feature gate）

| 开关 | 字段 | 关闭效果 |
|---|---|---|
| 会话历史文件 | `historyFiles`（默认 true） | 不注册 `session-history-*`，不渲染「养老院」页签 |
| 健康检查 | `healthCheck`（默认 true） | 不注册 `session-health-*`，不渲染「体检」页签 |

关闭时对应方法返回 `{ ok: false, error: '子域已关闭（…=false）：<method> 未注册' }`，**不留空壳**。

## 四门体检

| gate | 判据 | level |
|---|---|---|
| `log-integrity` | zstd 多帧扫描 → provenance 展开 → 打包行解包；seq 连续、无撕裂尾帧 | 有读取问题 `fail`；仅撕裂尾帧 `warn` |
| `projection-cache` | `~/.dsh/storages/session_projcache/sessions/<id>.json` 的 `minSeq` 与日志末 seq 的 lag + 未结算字段（openStep / activeStep.active / pendingTurnStart / turnBoundary=start） | 滞后且未结算 `fail`；任一 `warn` |
| `lossless-json` | 热态 `sessionProjections.checkpoint(session)` 逐行判定无损 JSON（undefined / 非有限数 / -0 / 稀疏洞 / 非普通原型 / 函数·Symbol·BigInt / 环） | 命中 `fail`，并给出投影 key → 归属包 |
| `cold-read` | 最后 `turn/end` 的原因、是否存在未收尾 open step、最后 user 消息之后是否还有 assistant 输出 | open step `fail`；interrupted/无 turn/end `warn` |

**处方**只给三件可逆的事：① 隔离损坏的投影缓存记录（先备份）② 含未结算 step 时提示等待宿主结算 ③ 输出可执行命令清单。
**禁止**：改写会话日志、改历史数据、静默丢弃字段。

## 与 `dsh-search-index` 的唯一契约

归档文件格式（`~/.dsh/storages/workspace.json` 的 `global.archivedSessionIds`）：
**本插件写、搜索索引只读**。格式说明见
`dsh-docs-deliverables/dsh-归档文件格式契约-20260914.md`。

## 开发

```bash
pnpm install
pnpm typecheck     # tsc -b --pretty false
pnpm test          # vitest run
pnpm build         # tsc -b && tsdown → lib/index.js + lib/client.js
```

## 许可

MIT
