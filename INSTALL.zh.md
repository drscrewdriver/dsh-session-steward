# 安装指南（官方 DSH CLI）

本指南只使用官方 `dsh plugin` 命令。该命令会把依赖装入 profile 并同步 `dsh.profile.bundles`。请勿改用裸 `npm install`、在 profile 里直接 `pnpm add`，或手工编辑 profile 清单。

- [English installation guide](./INSTALL.md)
- [中文安装指南](./INSTALL.zh.md)
- [日本語インストールガイド](./INSTALL.ja.md)
- [한국어 설치 안내](./INSTALL.ko.md)
- [中文 README](./README.md)
- [English README](./README.en.md)
- [日本語 README](./README.ja.md)
- [한국어 README](./README.ko.md)
- [Changelog](./CHANGELOG.md)
- [日本語 changelog](./CHANGELOG.ja.md)
- [한국어 changelog](./CHANGELOG.ko.md)

本指南中的占位符：

- `<profile>`：要改动的 DSH profile，通常是 `web`；
- `dsh-session-steward`：npm 包名，同时也是运行时插件 ID。

> **支持的 DSH 范围：`>=0.1.0-rc.6 <0.2.0-0`。**
>
> 该范围同时写在 `package.json` 与 `dsh.plugin.json` 的 `engines.dsh` 中，也与本插件为其 `@deepseek-ai/dsh-client-ui-slots` 依赖已经声明的 `^0.1.0-rc.6` 下界一致。安装前先用 `dsh --version` 确认当前版本。

## 0. 前置条件与 profile 探查

```bash
echo "DSH_HOME=${DSH_HOME:-$HOME/.dsh}"
dsh --version
ls "${DSH_HOME:-$HOME/.dsh}/profiles"
```

请使用正在运行的 DSH 进程所使用的那个 profile。`web` 很常见，但以实际生效的 `--profile` 参数为准。

## 1. 官方安装

```bash
dsh plugin --profile <profile> add dsh-session-steward -w
```

（当 profile 是 pnpm workspace 根时，如 `web`，`-w` 是必需的。）

显式安装指定版本：

```bash
dsh plugin --profile <profile> add dsh-session-steward@0.1.0-alpha.5 -w
```

官方 CLI 会自动更新 profile 依赖、锁文件与 `dsh.profile.bundles`。不要手工添加 YAML 行。

### 供应链冷却期

DSH 运行时使用 pnpm 11，其 `minimumReleaseAge` 策略可能拦截刚发布的版本并报 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`。把该版本加入 `~/.dsh/profiles/<profile>/pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude`：

```yaml
minimumReleaseAgeExclude:
  - dsh-session-steward@0.1.0-alpha.5
```

## 2. 重启宿主

**安装或升级后必须重启 DSH。** 仅刷新浏览器页面无效：宿主半身在启动时注册 `/session-steward/api` 路由与设置命名空间，且归档来源需要在宿主重启后才会反映清理结果。

## 3. 升级

```bash
dsh plugin --profile <profile> update dsh-session-steward -w
```

升级后重启 DSH。

## 4. 本地路径 / `link:` 注册（备选）

用于开发或离线安装，可从本地检出注册：

```bash
#    ~/.dsh/profiles/<profile>/package.json dependencies:
#      "dsh-session-steward": "link:<absolute path to dsh-session-steward>"
#    ~/.dsh/profiles/<profile>/cordis.patch.yml:
#      - insert:
#          - id: dsh-session-steward
#            name: dsh-session-steward
cd ~/.dsh/profiles/<profile> && pnpm install && dsh web
```

或用官方 CLI 直接指定本地路径（无需联网）：

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-session-steward -w
```

从源码检出构建时用以下脚本：

```bash
pnpm install
pnpm typecheck     # tsc -b --pretty false
pnpm test          # vitest run
pnpm build         # tsc -b && tsdown → lib/index.js + lib/index.d.ts + lib/client.js
```

`lib/` 不入库，因此源码检出必须先构建才能按路径注册。发布时由 `prepublishOnly` 钩子自动构建。

## 5. 校验安装

检查依赖与已安装版本：

```bash
grep -n "dsh-session-steward" \
  "${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/package.json"
node -p "require('${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/node_modules/dsh-session-steward/package.json').version"
```

检查官方装配：

```bash
dsh --profile <profile> --dump-default-config
```

其中必须包含：

```yaml
- id: dsh-session-steward
  name: dsh-session-steward
```

## 6. 验证插件

重启后，侧边栏入口 `dsh-session-steward` 可用，设置区使用 `session-steward` 命名空间。请确认：

1. 两个开关均开启时，**养老院**与**体检**两个页签都会渲染。
2. 关闭 `historyFiles` 后「养老院」页签消失，且所有 `session-history-*` 调用返回显式的 disabled 错误。
3. 关闭 `healthCheck` 后「体检」页签消失，且所有 `session-health-*` 调用返回显式的 disabled 错误。
4. 对 `/session-steward/api` 调用未识别的方法时返回显式错误，而不是静默成功。

关闭的子域返回 `{ ok: false, error: '子域已关闭（…=false）：<method> 未注册' }` —— 本插件不留空壳。

## 7. 故障排查

| 现象 | 处理 |
| --- | --- |
| 找不到 `dsh` | 安装或启用官方 DSH CLI。 |
| `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | 把该版本加入该 profile 的 `pnpm-workspace.yaml` 中的 `minimumReleaseAgeExclude`。 |
| 安装后页签或路由缺失 | 重启宿主进程——刷新页面不会重新注册路由。 |
| 归档集合的改动不可见 | 重启宿主；归档来源在启动时读取。 |
| `session-history-*` 返回 disabled 错误 | `historyFiles` 开关已关闭，在插件设置中重新开启。 |
| `session-health-*` 返回 disabled 错误 | `healthCheck` 开关已关闭，在插件设置中重新开启。 |
| 升级后客户端包陈旧 | 强制刷新浏览器（Ctrl+Shift+R）。 |

## 8. 卸载

```bash
dsh plugin --profile <profile> remove dsh-session-steward
```

卸载后重启 DSH。

## 卸载不会撤销已执行的处置

本插件从不改写会话日志、不修改历史数据、不静默丢弃字段。它唯一看起来不可逆的动作——隔离损坏的投影缓存记录——会先复制备份，并把隔离目录留在磁盘上供你恢复。因此卸载插件不会撤销你主动请求过的隔离；如需还原状态请手工恢复。

## 许可

MIT
