# Changelog

## 0.1.7

### Features

- `tracking-domains get <id>` reads one tracking domain, including its certificate eligibility reason.
- `suppression check <value>...` checks named addresses or domains and shows value, suppressed and reason. `--data-file` sends a `{ "values": [...] }` body unchanged.
- `companies import --data-file <file>` imports a `{ "companies": [...] }` body and reports created, duplicate and error counts plus the rows not created. `--idempotency-key` is passed through; none is invented.
- `email-auth verify --domain <d> [--dkim-selector <s>]` runs the email-auth verification.
- `connectors create cal-com --event-type <id> | --booking-url <url>` creates a Cal.com connector with the key from `FIRSTSALES_CAL_COM_API_KEY`. A key passed as a flag is refused, and `--dry-run` shows `apiKey` as `[REDACTED]`.

## 0.1.6

### Features

- `campaigns workflow get <campaign>` reads a campaign workflow (the same request as `campaigns workflow`).
- `campaigns workflow update <campaign> --include-list <id> --sender <id>` sets a campaign's include lists and sender Email Connectors with one PATCH. Both flags repeat. `--dry-run` previews the request.
- `blocked-domains list|add|remove` manages workspace Blocked Domains. Add `--campaign <id>` to manage one campaign's Blocked Domains. `add` takes domains as arguments or a `{ "domains": [...] }` body through `--data`/`--data-file`, and passes `--idempotency-key` through unchanged.

### Fixes

- A path value of `.` or `..` (for example `--domain ..`) is now rejected. URL parsing used to collapse it and send the request to a different route.

## 0.1.5

### Fixes

- `firstsales api <METHOD> <path> --dry-run` no longer sends the request. It prints the method, URL, headers and body and exits without any network call.
- Dry-run output for every command now includes the request headers. The API key is redacted to its public `fs-key-` prefix (or `[redacted]` / `[missing]`), so the full key never prints.

## 0.1.4

### Fixes

- Runtime update notices and HTTP User-Agent headers now read one version exported from package metadata, preventing installed-version drift.
- The generated publish contract now carries the complete query, request-body, capability, and OpenAPI specialization metadata used for Product MCP parity.

## 0.1.3

### Highlights

- 128 commands covering the promoted Developer API, including connector updates,
  Knowledge Base source ingestion, and Copilot session/message primitives.
- Tenant context is required consistently for organization/workspace routes and
  is rejected before network I/O when missing.
- Release artifacts expose the complete command registry and publish contract for
  docs and backend parity checks.

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
