# Changelog

## 0.1.0-alpha.0

首个 alpha 版本：会话管家（历史文件 + 健康检查）。

### 新增

- **会话历史文件（病案室）**：从 `dsh-session-search-toggle` 迁入官方归档集合的读取与清理实现，
  行为与迁移前等价（备份 + 同目录临时写 + 原子替换；显式编辑模式才允许清理）。
  差异：列表来源改为**官方归档集合真值**（registry 优先、存储文件回退），因为独立索引已随搜索索引包离开；
  标题等元数据为尽力而为（`sessionQuery` 标题快照 → 投影缓存 title → 空）。
- **健康检查（体检 → 处方 → 出院）**：四个可独立测试的 gate
  （`log-integrity` / `projection-cache` / `lossless-json` / `cold-read`），
  统一输出 `{ id, level, evidence, attribution, detail }`；聚合为 `SessionHealthReport`。
- **归属索引**：静态扫描 profile 的 `node_modules/<pkg>/lib/*.js`，建立「投影 key → 包名」，
  把失败 gate 指回具体插件与字段路径；扫不到时如实标 `unknown`。
- **可逆处方**：隔离损坏的投影缓存记录（先复制备份，再移动到 `.quarantine-<ts>`）+ 命令清单。
  **禁止**改写会话日志、改历史数据、静默丢弃字段。
- **两个 feature gate**：`historyFiles` / `healthCheck`，关闭时对应子域整域不注册（显式 disabled 错误），
  客户端也不渲染对应页签。
- **路由**：`/session-steward/api/*`，方法名一律 `session-*`，与搜索索引的 `/switch-search/api` 的 `index-*` 完全隔离。

### 已知限制

- `lossless-json` gate 依赖宿主暴露 `sessionProjections`（热态）才能给出确定判定；
  拿不到时如实降级为 `warn`，不臆测。
- 健康扫描默认只列最近 30 个非健康会话（`limit` 上限 200），不做全库遍历的默认行为。
- 客户端面板为最小实现（列表 + 详情 + 三步按钮），未做虚拟滚动与批量操作。
