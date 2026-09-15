# dsh-session-steward (Session Steward)

A DSH web plugin for **session history files** and **session health checks**. It never touches session data itself.

- **Records Room (history files)** — browse the official archive set and prune ids in bulk
  (backup + atomic replace; a DSH restart is required for the host to reload it).
- **Checkup (health)** — four gates → prescription (command list) → discharge (reversible repair with a
  before/after comparison).

> Naming boundary: **this package ships no search or index features**. Search/indexing belongs to
> `dsh-search-index`; neither side mentions or re-interprets the other's fields.

## Install

```bash
dsh plugin --profile web add dsh-session-steward
```

Restart the host process afterwards (refreshing the page is not enough).

## Routes

Prefix `/session-steward/api`; every method name is `session-*` (never `index-*`), and an unrecognized
method returns an explicit error instead of failing silently.

| Method | Domain | Purpose |
|---|---|---|
| `session-history-list` | history | list the official archive set (with source and degradation notes) |
| `session-history-prune` | history | bulk-remove ids from the archive array (auto backup, restart required) |
| `session-health-status` | health | switch state and method table (panel polling) |
| `session-health-scan` | health | batch checkup (defaults to non-ok sessions only) |
| `session-health-session` | health | one session's four-gate report plus prescription |
| `session-health-repair` | health | reversible repair (quarantine the projection-cache record) with before/after |

Settings namespace `session-steward`; sidebar entry id `dsh-session-steward`.

## Switches (feature gates)

| Switch | Field | When off |
|---|---|---|
| Session history files | `historyFiles` (default true) | `session-history-*` is not registered and the Records Room tab is not rendered |
| Health check | `healthCheck` (default true) | `session-health-*` is not registered and the Checkup tab is not rendered |

Closed domains return `{ ok: false, error: '子域已关闭（…=false）：<method> 未注册' }` — no empty shells.

## Contract with `dsh-search-index`

The archive file format (`global.archivedSessionIds` of `~/.dsh/storages/workspace.json`):
**this plugin writes, the search-index plugin reads only**. See
`dsh-docs-deliverables/dsh-归档文件格式契约-20260914.md`.

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## License

MIT
