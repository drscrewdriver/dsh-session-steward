# Installation Guide (Official DSH CLI)

This guide uses only the official DSH `dsh plugin` command. That command installs the dependency into a profile and synchronizes `dsh.profile.bundles`. Do not replace it with plain `npm install`, a direct `pnpm add` in the profile, or manual edits to the profile manifest.

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

The placeholders in this guide are:

- `<profile>`: the DSH profile to modify, usually `web`;
- `dsh-session-steward`: the npm package and runtime plugin ID.

> **Supported DSH range: `>=0.1.0-rc.6 <0.2.0-0`.**
>
> This is the range declared in `engines.dsh` of both `package.json` and `dsh.plugin.json`, and it matches the `^0.1.0-rc.6` floor this plugin already declares for its own `@deepseek-ai/dsh-client-ui-slots` dependency. Check the running version with `dsh --version` before installing.

## 0. Prerequisites and profile discovery

```bash
echo "DSH_HOME=${DSH_HOME:-$HOME/.dsh}"
dsh --version
ls "${DSH_HOME:-$HOME/.dsh}/profiles"
```

Use the profile named by your running DSH process. `web` is common, but the active `--profile` argument is authoritative.

## 1. Official installation

```bash
dsh plugin --profile <profile> add dsh-session-steward -w
```

(the `-w` flag is required when the profile is a pnpm workspace root, as `web` is.)

Install a specific version explicitly:

```bash
dsh plugin --profile <profile> add dsh-session-steward@0.1.0-alpha.5 -w
```

The official CLI updates the profile dependency, the lockfile, and `dsh.profile.bundles` automatically. Do not add a manual YAML row.

### Supply-chain cooling period

The DSH runtime uses pnpm 11, whose `minimumReleaseAge` policy may block a freshly published version with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`. Add the version to `minimumReleaseAgeExclude` in `~/.dsh/profiles/<profile>/pnpm-workspace.yaml`:

```yaml
minimumReleaseAgeExclude:
  - dsh-session-steward@0.1.0-alpha.5
```

## 2. Restart the host

**A DSH restart is required after installing or upgrading.** Refreshing the browser page is not enough: the host half registers the `/session-steward/api` routes and the settings namespace at startup, and the host must reload the archive source before it reflects a prune.

## 3. Upgrade

```bash
dsh plugin --profile <profile> update dsh-session-steward -w
```

Restart DSH afterwards.

## 4. Local-path / `link:` registration (alternative)

For development or offline installs, register the plugin from a local checkout:

```bash
#    ~/.dsh/profiles/<profile>/package.json dependencies:
#      "dsh-session-steward": "link:<absolute path to dsh-session-steward>"
#    ~/.dsh/profiles/<profile>/cordis.patch.yml:
#      - insert:
#          - id: dsh-session-steward
#            name: dsh-session-steward
cd ~/.dsh/profiles/<profile> && pnpm install && dsh web
```

Or use the official CLI with a local path (no network needed):

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-session-steward -w
```

Building from a source checkout uses these scripts:

```bash
pnpm install
pnpm typecheck     # tsc -b --pretty false
pnpm test          # vitest run
pnpm build         # tsc -b && tsdown → lib/index.js + lib/index.d.ts + lib/client.js
```

`lib/` is not committed, so a source checkout must be built before it can be registered by path. Publishing builds it automatically through the `prepublishOnly` hook.

## 5. Verify installation

Check the dependency and the installed version:

```bash
grep -n "dsh-session-steward" \
  "${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/package.json"
node -p "require('${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/node_modules/dsh-session-steward/package.json').version"
```

Check the official composition:

```bash
dsh --profile <profile> --dump-default-config
```

It must contain:

```yaml
- id: dsh-session-steward
  name: dsh-session-steward
```

## 6. Verify the plugin

After the restart, the sidebar entry `dsh-session-steward` is available and the settings section uses the `session-steward` namespace. Confirm:

1. Both tabs render — **Retirement Home** and **Checkup** — while both feature gates are on.
2. Turning `historyFiles` off removes the Retirement Home tab and makes every `session-history-*` call return an explicit disabled error.
3. Turning `healthCheck` off removes the Checkup tab and makes every `session-health-*` call return an explicit disabled error.
4. An unrecognized method on `/session-steward/api` returns an explicit error rather than succeeding silently.

Closed domains return `{ ok: false, error: '子域已关闭（…=false）：<method> 未注册' }` — the plugin does not leave empty shells behind.

## 7. Troubleshooting

| Symptom | Action |
| --- | --- |
| `dsh` is not found | Install or enable the official DSH CLI. |
| `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | Add the version to `minimumReleaseAgeExclude` in the profile's `pnpm-workspace.yaml`. |
| Tabs or routes missing after install | Restart the host process — a page refresh does not re-register routes. |
| Changes to the archive set are not visible | Restart the host; the archive source is read at startup. |
| `session-history-*` returns a disabled error | The `historyFiles` gate is off. Re-enable it in the plugin settings. |
| `session-health-*` returns a disabled error | The `healthCheck` gate is off. Re-enable it in the plugin settings. |
| Stale client bundle after an upgrade | Hard-refresh the browser (Ctrl+Shift+R). |

## 8. Remove

```bash
dsh plugin --profile <profile> remove dsh-session-steward
```

Restart DSH afterwards.

## Removal does not undo repairs

The plugin never rewrites session logs, history data, or silently drops fields. The only irreversible-looking action it takes — quarantining a damaged projection-cache record — copies a backup first, and the quarantine directory is left on disk for you to restore from. Removing the plugin therefore leaves any quarantine you asked for in place; restore it manually if you want the state back.

## License

MIT
