# Changelog

## 0.1.2

### Fixes

- `copilot ask` now reads the session id from the wrapped create-session response (`{ session: { id } }`). Previously it read a flat `{ id }`, so the id was `undefined`, the follow-up message POSTed to `/sessions/undefined/messages`, and the CLI crashed on the 404 HTML with `Unexpected token '<'`. Non-interactive copilot prompts now work end to end.

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
- `copilot ask` now routes HTTP errors through the same exit-code mapping as the rest of the CLI (401/403 → `3`, 404 → `4`, 429 → `5`); a poll timeout is `1` (runtime), not `4`.
- `copilot ask --auto-approve` is best-effort: it audits and asks the server to decide, and exits `1` (instead of polling to timeout) if an approval is still pending after the audit.
- Uncaught errors (network failures, bad `--data-file`, malformed JSON body) now print a clean one-line message and exit `1` instead of a raw stack trace. Pass `--debug` for the full stack.
- `--all` pagination bounds 429 retries; repeated rate limiting now exits `5` instead of looping forever.
- User-Agent header now reports the installed CLI version instead of a hardcoded `0.1.0`.
