# dsh-session-steward 0.4.8 交付 / 验证 / 回退手册（dsh-0.1.7 线）

> 面向：**在目标机上执行部署的用户**（Agent 本机不可达：web profile 宿主为 0.1.5 线、
> steward 0.3.2，无 source-kind 门）。
> 前置条件：宿主 ≥ **0.1.7-rc.1** 且 < 0.1.8-0（engines 约束）；0.4.8 = 0.4.7 的
> source-kind 门/转换 + ST1（第一方名跳过）+ R2（purge 识别备份）。
> 发布注意：**npm 上 0.4.7 已存在且不含 ST1**，必须发 0.4.8，不可同版本重发。

## 1. 发布（源机执行）

```powershell
cd dsh-session-steward
npm run build          # lib 产物须含 source-kind 模块（本次已验证：lib/index.js 内含 pre-sourcemigrate 逻辑）
npm publish --tag dsh-0.1.7
```

发布后自检（任一失败则不要安装）：

```powershell
npm view dsh-session-steward@0.4.8 dist-tags --json   # dsh-0.1.7 → 0.4.8
```

## 2. 安装与重启（目标机执行）

```powershell
# 宿主插件安装入口（web profile）安装/升级 dsh-session-steward 至 0.4.8，然后：
#   完全退出 DSH → 重新启动 web profile（宿主内存 registry 只在启动时重载）
```

安装后验证：

```powershell
$dshHome = "$env:USERPROFILE\.dsh"
Get-ChildItem "$dshHome\node_modules\dsh-session-steward\package.json" |
  ForEach-Object { (Get-Content $_.FullName -Raw | ConvertFrom-Json).version }   # 期望 0.4.8
Select-String -Path "$dshHome\node_modules\dsh-session-steward\lib\index.js" -Pattern "pre-sourcemigrate" -Quiet  # 期望 True
```

## 3. 功能验证（面板操作）

1. 打开侧边栏「🧭 会话管家」→ 体检，对存量会话**扫描**：
   - 第 6 门 `source-kind`：对 v4 语料里含旧署名（`kind:'plugin'` + `plugin` 字段）的会话报 **warn**；
     v3 及更早的会话记 ok（不动），无 header.version 记 skipped。
   - warn 证据里若出现 `skipped` 相关字样属正常——第一方名（compact、memory 等 30 个）
     **不会被转换**，面板会如实标注 `skippedFirstParty`。
2. 对任一 warn 会话点「**转换旧署名**」：
   - 成功提示备份路径：`<会话目录>/session*.jsonl.zstd.pre-sourcemigrate-<ts>`；
   - 失败则给出原因（撕裂尾帧 / header.version < 4 / 完整性问题——三道闸拒绝，原文件未动）。
3. **重扫**同一会话：source-kind 门应转 **ok**（若该会话还有第一方旧行，则仍 warn 且
   `byPlugin` 里只剩第一方名——那是宿主迁移职权，steward 不代转，属预期）。

## 4. purge 备份识别验证（本次新增 R2）

- 养老院列表：含备份的会话行 `backupBytes` > 0（是 `bytes` 的子集，单列展示）。
- 清理该会话：返回 `backupsRemoved ≥ 1`；未选中的会话连备份一起原样保留。

## 5. 回退演练（可逆性验证，建议至少做一次）

```powershell
# 1) 选一个刚转换过的会话目录（面板转换成功提示里有路径）：
$dir = "<会话目录>"    # 例：~\.dsh\sessions\<工作区>\<会话id>
$backup = Get-ChildItem $dir -Filter "*.pre-sourcemigrate-*" | Sort-Object LastWriteTime -Descend | Select-Object -First 1
$log    = Get-ChildItem $dir -Filter "session*.jsonl.zstd" | Where-Object Name -NotLike "*pre-sourcemigrate*" | Select-Object -First 1

# 2) 原样搬回：备份覆盖现行日志（先留一份现行态以防万一）
Copy-Item $log.FullName "$($log.FullName).rollback-keep"
Copy-Item $backup.FullName $log.FullName -Force

# 3) 重启 DSH → 打开该会话：应可正常读取（无 SessionFormatError）。
#    确认回退成功后可删除 .rollback-keep。
```

回退语义：备份是改写前**整文件**的逐字节副本，搬回即完全还原；这也验证了
「转换是可逆例外」的红线设计。

## 6. 已知边界（不要报告为 bug）

- 第一方名旧行不被转换（ST1 设计如此，宿主 v3→v4 迁移负责）；
- genui 的历史行不代转换（读回判断失配由 genui 自负，CHANGELOG 已声明）；
- 转换后的单帧重压缩对宿主**帧级追加**语义的影响，待 0.1.7 真机观察（D 组转交项）：
  若发现该会话后续写入异常，用第 5 节回退即可。
