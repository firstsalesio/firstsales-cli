# Changelog

## 0.1.1

### Highlights

- ~122 commands covering deals, pipelines, companies, activities, contacts (overview + merge), copilot (including non-interactive `copilot ask`), inbox extras, campaign leads, learning (read-only), alerts, warmup, email-auth, sequences, teams, usage, and dashboard.
- New platform layer:
  - `--output json|table|tsv` (and `--json` alias) for machine- or human-friendly output.
  - `--page`/`--limit`/`--all` for pagination, including auto-pagination across all pages.
  - Auth profiles: `--profile`, `auth login`, `auth status`, `auth logout`.
  - `api <METHOD> <path>` escape hatch for any `/api/v1` route not yet wrapped by a dedicated command.
  - Shell completions: `completion bash|zsh|fish`.
  - Background update notice when a newer version is published to npm.

### Breaking Changes

- **Exit codes redefined.** v0.1.0 scripts that check exit codes must migrate:
  - `0` ok
  - `1` runtime error
  - `2` usage error
  - `3` auth error
  - `4` not found
  - `5` rate limited

### Notes

- Destructive commands still require `--confirm`.
- `contacts merge` and `companies merge` print an undo hint (`mergeChangelogId`) to stderr after a successful merge.
