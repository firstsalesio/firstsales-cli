<div align="center">

# firstsales-cli

**Control FirstSales from Codex, Claude Code, Gemini, Claude.ai, CI, scripts, and your terminal.**

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/firstsalesio/firstsales-cli/releases/tag/v0.1.0)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![CLI](https://img.shields.io/badge/binary-firstsales-C94310)](#quick-start)
[![Developer API](https://img.shields.io/badge/API-%2Fapi%2Fv1-C94310)](https://github.com/firstsalesio/docs)
[![License](https://img.shields.io/badge/license-UNLICENSED-lightgrey)](package.json)

<br>

*"Inspect first. Mutate deliberately. Verify after every action."*

**A thin, JSON-first CLI over the FirstSales Developer API. 78 commands. No runtime dependencies. Built for agent-safe automation.**

[Why](#why-this-exists) · [How It Works](#how-it-works) · [Quick Start](#quick-start) · [Commands](#complete-command-reference) · [Use Cases](#use-cases) · [Safety](#safety-model)

</div>

---

```text
       AUTH              INSPECT              MUTATE              VERIFY
 ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
 │ API Key      │    │ whoami       │    │ campaigns    │    │ re-read      │
 │ Base URL     │──▶ │ list/get     │──▶ │ contacts     │──▶ │ logs         │
 │ org/ws       │    │ analytics    │    │ inbox        │    │ status       │
 └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
 firstsales          firstsales          firstsales          firstsales
 whoami              campaigns list      contacts create     campaigns get
 doctor              contacts get        inbox reply         api-keys list

        SAFE BY DEFAULT
 ┌───────────────────────────────────────────────────────────────────────┐
 │ JSON output · explicit scopes · idempotency keys · dry-run previews   │
 │ destructive --confirm · stable exit codes · no raw/hashed key output  │
 └───────────────────────────────────────────────────────────────────────┘
```

---

## Why This Exists

FirstSales can be managed from the web app, but AI coding agents and internal automation need a stable interface that does not depend on app-private routes.

`firstsales-cli` is the terminal and agent surface for the FirstSales Developer API:

- **Codex / Claude Code:** inspect state, update campaigns, import contacts, approve drafts, and verify results from a shell.
- **Gemini / CI:** parse stable JSON and react to predictable exit codes.
- **Claude.ai / no-shell contexts:** use the same API contract from the docs and copyable cURL workflows.
- **Operators:** run repeatable campaign, inbox, connector, billing, team, and API-key workflows.

The CLI is intentionally boring. It does not contain business logic. It maps commands to `/api/v1` endpoints and lets the API enforce auth, scopes, tenant isolation, rate limits, idempotency, and redaction.

---

## How It Works

```text
COMMAND FLOW:
  1. Load config from flags, env, or profile.
  2. Resolve base URL and Developer API key.
  3. Build the public /api/v1 request.
  4. Add JSON body, idempotency key, org, workspace, and path params.
  5. Refuse destructive commands unless --confirm is present.
  6. Send the request with Authorization: Bearer <key>.
  7. Print compact JSON by default or pretty JSON with --pretty.
  8. Exit with a stable code for scripts and agents.
```

### Design Rules

| Rule | What it means |
| --- | --- |
| Thin client | The CLI calls the Developer API. It does not duplicate FirstSales business logic. |
| JSON-first | Output defaults to machine-readable JSON for agents and scripts. |
| Read before write | Agents should use `whoami`, `list`, and `get` before mutations. |
| Explicit destructive actions | `DELETE` commands require `--confirm`. |
| Retry-safe writes | Use `--idempotency-key` for imports, approvals, lifecycle actions, and other retryable writes. |
| No secret output | Raw API keys, hashed keys, provider tokens, SMTP passwords, and connector secrets are not printed. |
| Stable public contract | Only `/api/v1` endpoints are supported. App-private routes are intentionally ignored. |

---

## Quick Start

### Install

```bash
npm install -g firstsales-cli
```

Source release:

```text
https://github.com/firstsalesio/firstsales-cli/releases/tag/v0.1.0
```

### Configure

Use environment variables for agents and CI:

```bash
export FIRSTSALES_API_KEY="<YOUR_FIRSTSALES_API_KEY>"
export FIRSTSALES_BASE_URL="https://api.app.firstsales.io"
```

Or pass flags:

```bash
firstsales whoami \
  --api-key "<YOUR_FIRSTSALES_API_KEY>" \
  --base-url "https://api.app.firstsales.io" \
  --json
```

### Verify Identity

```bash
firstsales whoami --json
```

`whoami` is the FirstSales equivalent of `npm whoami`: it validates the active token and prints the user/key/org/workspace context without exposing raw or hashed keys.

### Check Setup

```bash
firstsales doctor --pretty
```

### First Read

```bash
firstsales orgs list --json
firstsales workspaces list --org org_123 --json
firstsales campaigns list --org org_123 --workspace ws_123 --json
```

### First Safe Mutation

```bash
firstsales contacts create \
  --org org_123 \
  --workspace ws_123 \
  --data '{"email":"alex@example.com","firstName":"Alex"}' \
  --idempotency-key import-row-001 \
  --json
```

### Destructive Mutation

```bash
firstsales contacts delete \
  --org org_123 \
  --workspace ws_123 \
  --contact contact_123 \
  --confirm \
  --json
```

---

## Configuration

### Environment Variables

| Variable | Purpose |
| --- | --- |
| `FIRSTSALES_API_KEY` | Developer API key used for bearer auth. |
| `FIRSTSALES_BASE_URL` | API base URL. Defaults to `https://api.app.firstsales.io`. |
| `FIRSTSALES_PROFILE` | Profile name to load from the local profile config. |

### Profile File

Profiles are useful on a developer machine. Prefer env vars for CI and agents.

```json
{
  "currentProfile": "prod",
  "profiles": {
    "prod": {
      "apiKey": "<YOUR_FIRSTSALES_API_KEY>",
      "baseUrl": "https://api.app.firstsales.io"
    },
    "staging": {
      "apiKey": "<YOUR_STAGING_FIRSTSALES_API_KEY>",
      "baseUrl": "https://staging-api.app.firstsales.io"
    }
  }
}
```

### Auth Resolution Order

1. `--api-key`
2. `FIRSTSALES_API_KEY`
3. selected local profile

### Base URL Resolution Order

1. `--base-url`
2. `FIRSTSALES_BASE_URL`
3. selected local profile
4. `https://api.app.firstsales.io`

---

## Global Flags

| Flag | Applies to | Purpose |
| --- | --- | --- |
| `--api-key <key>` | all API commands | Use a specific Developer API key. |
| `--base-url <url>` | all API commands | Override the API base URL. |
| `--profile <name>` | all API commands | Load a named local profile. |
| `--org <id>` | organization/workspace commands | Fill `{org}` path parameters. |
| `--workspace <id>` | workspace commands | Fill `{workspace}` path parameters. |
| `--json` | all commands | Emit compact JSON. This is the default. |
| `--pretty` | all commands | Emit formatted JSON. |
| `--data '<json>'` | mutating commands | Provide a JSON request body. |
| `--data-file <path>` | mutating commands | Read a JSON request body from disk. |
| `--idempotency-key <key>` | retryable mutations | Send an idempotency key. |
| `--dry-run` | API commands | Print method, URL, and body without sending the request. |
| `--confirm` | destructive commands | Required for destructive commands. |

---

## Safety Model

### API Key Safety

FirstSales Developer API keys are scoped and access-level aware.

- Workspace keys can only operate workspace-scoped resources.
- Organization keys need explicit organization scopes.
- Revoked keys fail immediately.
- Keys fail closed if the creator loses org access or is suspended.
- Raw keys are shown only once at creation and are never retrievable later.

### CLI Safety

| Protection | Behavior |
| --- | --- |
| Destructive guard | Commands marked destructive stop unless `--confirm` is passed. |
| Dry run | `--dry-run` previews the HTTP request without auth or network calls. |
| Idempotency | `--idempotency-key` sends retry protection for supported mutations. |
| Redaction | API errors and identity output do not print raw or hashed keys. |
| Unsupported surfaces | Signals and webhooks return `unsupported_operation` until public API support exists. |
| Stable errors | Non-zero exits return JSON errors that agents can parse. |

### Recommended Agent Loop

```text
1. firstsales whoami --json
2. Read org/workspace/resource state.
3. Plan the smallest mutation.
4. Use --dry-run when useful.
5. Use --idempotency-key for retryable writes.
6. Use --confirm only for intentional destructive commands.
7. Re-read state and verify the result.
```

---

## Use Cases

### Campaign Operations

```bash
firstsales campaigns list --org org_123 --workspace ws_123 --json
firstsales campaigns get --org org_123 --workspace ws_123 --campaign camp_123 --json
firstsales campaigns pause --org org_123 --workspace ws_123 --campaign camp_123 --json
firstsales campaigns resume --org org_123 --workspace ws_123 --campaign camp_123 --json
firstsales campaigns analytics --org org_123 --workspace ws_123 --campaign camp_123 --json
```

Use this for campaign audits, status checks, lifecycle changes, reporting, and agent-driven campaign monitoring.

### Contact Import and Cleanup

```bash
firstsales contacts create \
  --org org_123 \
  --workspace ws_123 \
  --data '{"email":"alex@example.com","firstName":"Alex"}' \
  --idempotency-key crm-import-alex@example.com \
  --json

firstsales contact-tags list --org org_123 --workspace ws_123 --json
firstsales contacts delete --org org_123 --workspace ws_123 --contact contact_123 --confirm
```

Use this for CRM syncs, enrichment pipelines, list cleanup, tag maintenance, imports, and exports.

### Inbox Review

```bash
firstsales inbox threads --org org_123 --workspace ws_123 --json
firstsales inbox thread --org org_123 --workspace ws_123 --thread thread_123 --json
firstsales inbox approve-draft --org org_123 --workspace ws_123 --email email_123 --idempotency-key approve-email-123
firstsales inbox reject-draft --org org_123 --workspace ws_123 --email email_123 --json
```

Use this for reply monitoring, draft approval queues, human-in-the-loop workflows, and read-state sync.

### Connector Health

```bash
firstsales connectors list --org org_123 --workspace ws_123 --json
firstsales connectors test --org org_123 --workspace ws_123 --connector conn_123 --json
```

Use this for deliverability checks, sender health diagnostics, and setup validation. Connector responses never return provider secrets.

### Knowledge Base and Offerings

```bash
firstsales kb list --org org_123 --workspace ws_123 --json
firstsales kb query --org org_123 --workspace ws_123 --kb kb_123 --data '{"query":"What problems do we solve?"}'
firstsales offerings list --org org_123 --workspace ws_123 --json
```

Use this to keep sales context current and to let agents retrieve approved positioning before writing or replying.

### Tracking Domains

```bash
firstsales tracking-domains list --org org_123 --workspace ws_123 --json
firstsales tracking-domains verify --org org_123 --workspace ws_123 --domain domain_123 --json
```

Use this for deliverability setup and domain verification checks.

### Billing and Credits

```bash
firstsales billing overview --org org_123 --json
firstsales billing credits --org org_123 --json
firstsales billing usage-summary --org org_123 --json
firstsales billing checkout --org org_123 --idempotency-key checkout-org-123-001 --json
```

Use this for spend reporting, credit monitoring, and safe checkout/top-up link creation.

### Team Administration

```bash
firstsales members list --org org_123 --json
firstsales invitations create --org org_123 --data '{"email":"teammate@example.com","role":"member"}' --json
firstsales groups create --org org_123 --data '{"name":"SDR Team"}' --json
firstsales domains add --org org_123 --data '{"domain":"example.com"}' --json
```

Use this for onboarding, group management, and domain allowlist automation.

### API Key Rotation

```bash
firstsales api-keys list --org org_123 --json
firstsales api-keys create \
  --org org_123 \
  --data '{"name":"Codex automation","scopes":["campaigns:read","contacts:write"],"accessLevel":"workspace"}' \
  --json
firstsales api-keys revoke --org org_123 --key key_123 --confirm --json
```

Use this for scoped automation keys, stale-key cleanup, and incident response.

---

## Complete Command Reference

Every command maps to a public Developer API endpoint. Commands marked destructive require `--confirm`.

| Command | Method | Public API path | Destructive | Required placeholders |
| --- | --- | --- | --- | --- |
| `whoami` | GET | `/api/v1/whoami` | no | - |
| `doctor` | GET | `/api/v1/whoami` | no | - |
| `orgs list` | GET | `/api/v1/organizations` | no | - |
| `organizations list` | GET | `/api/v1/organizations` | no | - |
| `workspaces list` | GET | `/api/v1/organizations/{org}/workspaces` | no | org |
| `campaigns list` | GET | `/api/v1/organizations/{org}/workspaces/{workspace}/campaigns` | no | org, workspace |
| `campaigns create` | POST | `/api/v1/organizations/{org}/workspaces/{workspace}/campaigns` | no | org, workspace |
| `campaigns get` | GET | `/api/v1/organizations/{org}/workspaces/{workspace}/campaigns/{campaign}` | no | campaign |
| `campaigns update` | PATCH | `/api/v1/organizations/{org}/workspaces/{workspace}/campaigns/{campaign}` | no | campaign |
| `campaigns start` | POST | `/api/v1/organizations/{org}/workspaces/{workspace}/campaigns/{campaign}/actions/start` | no | campaign |
| `campaigns pause` | POST | `/api/v1/organizations/{org}/workspaces/{workspace}/campaigns/{campaign}/actions/pause` | no | campaign |
| `campaigns resume` | POST | `/api/v1/organizations/{org}/workspaces/{workspace}/campaigns/{campaign}/actions/resume` | no | campaign |
| `campaigns progress` | GET | `/api/v1/organizations/{org}/workspaces/{workspace}/campaigns/{campaign}/progress` | no | campaign |
| `campaigns analytics` | GET | `/api/v1/organizations/{org}/workspaces/{workspace}/campaigns/{campaign}/analytics` | no | campaign |
| `campaigns events` | GET | `/api/v1/organizations/{org}/workspaces/{workspace}/campaigns/{campaign}/events` | no | campaign |
| `campaigns sources` | GET | `/api/v1/organizations/{org}/workspaces/{workspace}/campaigns/{campaign}/sources` | no | campaign |
| `campaigns workflow` | GET | `/api/v1/organizations/{org}/workspaces/{workspace}/campaigns/{campaign}/workflow` | no | campaign |
| `campaigns workflow-update` | PUT | `/api/v1/organizations/{org}/workspaces/{workspace}/campaigns/{campaign}/workflow` | no | campaign |
| `contacts list` | GET | `/api/v1/organizations/{org}/workspaces/{workspace}/contacts` | no | org, workspace |
| `contacts create` | POST | `/api/v1/organizations/{org}/workspaces/{workspace}/contacts` | no | org, workspace |
| `contacts get` | GET | `/api/v1/organizations/{org}/workspaces/{workspace}/contacts/{contact}` | no | contact |
| `contacts update` | PATCH | `/api/v1/organizations/{org}/workspaces/{workspace}/contacts/{contact}` | no | contact |
| `contacts delete` | DELETE | `/api/v1/organizations/{org}/workspaces/{workspace}/contacts/{contact}` | yes | contact |
| `contact-lists list` | GET | `/api/v1/organizations/{org}/workspaces/{workspace}/contact-lists` | no | org, workspace |
| `contact-lists create` | POST | `/api/v1/organizations/{org}/workspaces/{workspace}/contact-lists` | no | org, workspace |
| `contact-lists update` | PATCH | `/api/v1/organizations/{org}/workspaces/{workspace}/contact-lists/{list}` | no | list |
| `contact-lists delete` | DELETE | `/api/v1/organizations/{org}/workspaces/{workspace}/contact-lists/{list}` | yes | list |
| `contact-tags list` | GET | `/api/v1/organizations/{org}/workspaces/{workspace}/contact-tags` | no | org, workspace |
| `contact-tags rename` | PATCH | `/api/v1/organizations/{org}/workspaces/{workspace}/contact-tags/rename` | no | org, workspace |
| `contact-tags delete` | DELETE | `/api/v1/organizations/{org}/workspaces/{workspace}/contact-tags` | yes | org, workspace |
| `contact-imports create` | POST | `/api/v1/organizations/{org}/workspaces/{workspace}/contact-imports` | no | org, workspace |
| `contact-exports list` | GET | `/api/v1/organizations/{org}/workspaces/{workspace}/contact-exports` | no | org, workspace |
| `inbox threads` | GET | `/api/v1/organizations/{org}/workspaces/{workspace}/inbox/threads` | no | org, workspace |
| `inbox thread` | GET | `/api/v1/organizations/{org}/workspaces/{workspace}/inbox/threads/{thread}` | no | thread |
| `inbox reply` | POST | `/api/v1/organizations/{org}/workspaces/{workspace}/inbox/threads/{thread}/reply` | no | thread |
| `inbox read` | POST | `/api/v1/organizations/{org}/workspaces/{workspace}/inbox/threads/{thread}/read` | no | thread |
| `inbox approve-draft` | POST | `/api/v1/organizations/{org}/workspaces/{workspace}/inbox/drafts/{email}/approve` | no | email |
| `inbox reject-draft` | POST | `/api/v1/organizations/{org}/workspaces/{workspace}/inbox/drafts/{email}/reject` | no | email |
| `connectors list` | GET | `/api/v1/organizations/{org}/workspaces/{workspace}/connectors` | no | org, workspace |
| `connectors delete` | DELETE | `/api/v1/organizations/{org}/workspaces/{workspace}/connectors/{connector}` | yes | connector |
| `connectors test` | POST | `/api/v1/organizations/{org}/workspaces/{workspace}/connectors/{connector}/test` | no | connector |
| `kb list` | GET | `/api/v1/organizations/{org}/workspaces/{workspace}/knowledge-bases` | no | org, workspace |
| `kb create` | POST | `/api/v1/organizations/{org}/workspaces/{workspace}/knowledge-bases` | no | org, workspace |
| `kb get` | GET | `/api/v1/organizations/{org}/workspaces/{workspace}/knowledge-bases/{kb}` | no | kb |
| `kb update` | PATCH | `/api/v1/organizations/{org}/workspaces/{workspace}/knowledge-bases/{kb}` | no | kb |
| `kb delete` | DELETE | `/api/v1/organizations/{org}/workspaces/{workspace}/knowledge-bases/{kb}` | yes | kb |
| `kb query` | POST | `/api/v1/organizations/{org}/workspaces/{workspace}/knowledge-bases/{kb}/query` | no | kb |
| `offerings list` | GET | `/api/v1/organizations/{org}/workspaces/{workspace}/offerings` | no | org, workspace |
| `offerings create` | POST | `/api/v1/organizations/{org}/workspaces/{workspace}/offerings` | no | org, workspace |
| `offerings get` | GET | `/api/v1/organizations/{org}/workspaces/{workspace}/offerings/{offering}` | no | offering |
| `offerings update` | PATCH | `/api/v1/organizations/{org}/workspaces/{workspace}/offerings/{offering}` | no | offering |
| `offerings delete` | DELETE | `/api/v1/organizations/{org}/workspaces/{workspace}/offerings/{offering}` | yes | offering |
| `tracking-domains list` | GET | `/api/v1/organizations/{org}/workspaces/{workspace}/tracking-domains` | no | org, workspace |
| `tracking-domains create` | POST | `/api/v1/organizations/{org}/workspaces/{workspace}/tracking-domains` | no | org, workspace |
| `tracking-domains delete` | DELETE | `/api/v1/organizations/{org}/workspaces/{workspace}/tracking-domains/{domain}` | yes | domain |
| `tracking-domains verify` | POST | `/api/v1/organizations/{org}/workspaces/{workspace}/tracking-domains/{domain}/verify` | no | domain |
| `billing overview` | GET | `/api/v1/organizations/{org}/billing` | no | org |
| `billing credits` | GET | `/api/v1/organizations/{org}/billing/credits` | no | org |
| `billing usage-summary` | GET | `/api/v1/organizations/{org}/billing/credits/usage-summary` | no | org |
| `billing credit-history` | GET | `/api/v1/organizations/{org}/billing/credits/history` | no | org |
| `billing payments` | GET | `/api/v1/organizations/{org}/billing/payments` | no | org |
| `billing top-ups` | GET | `/api/v1/organizations/{org}/billing/top-ups` | no | org |
| `billing checkout` | POST | `/api/v1/organizations/{org}/billing/checkout` | no | org |
| `billing top-up` | POST | `/api/v1/organizations/{org}/billing/top-up` | no | org |
| `members list` | GET | `/api/v1/organizations/{org}/members` | no | org |
| `invitations list` | GET | `/api/v1/organizations/{org}/invitations` | no | org |
| `invitations create` | POST | `/api/v1/organizations/{org}/invitations` | no | org |
| `invitations cancel` | DELETE | `/api/v1/organizations/{org}/invitations/{invitation}` | yes | org, invitation |
| `groups list` | GET | `/api/v1/organizations/{org}/groups` | no | org |
| `groups create` | POST | `/api/v1/organizations/{org}/groups` | no | org |
| `groups update` | PATCH | `/api/v1/organizations/{org}/groups/{group}` | no | org, group |
| `groups delete` | DELETE | `/api/v1/organizations/{org}/groups/{group}` | yes | org, group |
| `domains list` | GET | `/api/v1/organizations/{org}/domains` | no | org |
| `domains add` | POST | `/api/v1/organizations/{org}/domains` | no | org |
| `domains remove` | DELETE | `/api/v1/organizations/{org}/domains/{domain}` | yes | org, domain |
| `api-keys list` | GET | `/api/v1/organizations/{org}/api-keys` | no | org |
| `api-keys create` | POST | `/api/v1/organizations/{org}/api-keys` | no | org |
| `api-keys revoke` | DELETE | `/api/v1/organizations/{org}/api-keys/{key}` | yes | org, key |

### Unsupported Surfaces

The CLI intentionally returns `unsupported_operation` for public surfaces that are not ready yet, including Signals and Webhooks. Do not work around this by calling app-private routes.

---

## Examples for AI Agents

### Inspect Campaign Health

```bash
firstsales whoami --json
firstsales campaigns get --org org_123 --workspace ws_123 --campaign camp_123 --json
firstsales campaigns progress --org org_123 --workspace ws_123 --campaign camp_123 --json
firstsales campaigns analytics --org org_123 --workspace ws_123 --campaign camp_123 --json
```

### Pause a Campaign After Checking State

```bash
firstsales campaigns get --org org_123 --workspace ws_123 --campaign camp_123 --json
firstsales campaigns pause \
  --org org_123 \
  --workspace ws_123 \
  --campaign camp_123 \
  --idempotency-key pause-camp-123-2026-06-30 \
  --json
firstsales campaigns get --org org_123 --workspace ws_123 --campaign camp_123 --json
```

### Approve a Draft Safely

```bash
firstsales inbox thread --org org_123 --workspace ws_123 --thread thread_123 --json
firstsales inbox approve-draft \
  --org org_123 \
  --workspace ws_123 \
  --email email_123 \
  --idempotency-key approve-email-123 \
  --json
```

### Rotate an API Key

```bash
firstsales api-keys list --org org_123 --json
firstsales api-keys create \
  --org org_123 \
  --data '{"name":"CI automation","scopes":["campaigns:read","contacts:write"],"accessLevel":"workspace"}' \
  --json
firstsales api-keys revoke --org org_123 --key old_key_123 --confirm --json
```

---

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `missing_api_key` | Set `FIRSTSALES_API_KEY` or pass `--api-key`. |
| `invalid_api_key` | Confirm the key was copied correctly and not revoked. |
| `insufficient_scope` | Create a key with the required resource scope. |
| `Workspace ID is required` | Pass `--workspace` for workspace-scoped commands. |
| `Workspace API keys cannot access organization management endpoints` | Use an organization-level key with explicit org scopes. |
| `destructive_confirmation_required` | Add `--confirm` only if the delete/revoke/cancel action is intentional. |
| `unsupported_operation` | The surface is not part of the public Developer API yet. |
| JSON parse error for `--data` | Validate the JSON string or use `--data-file`. |

---

## FAQ

### Is this an SDK?

No. It is a thin CLI over the public Developer API. Use the OpenAPI contract to generate SDKs.

### Does the CLI store API keys?

The CLI can read local profiles, but automation should prefer environment variables. Do not commit profile files or keys.

### Does `whoami` mutate anything?

No. It calls `GET /api/v1/whoami` and prints the authenticated identity/context.

### Why do deletes require `--confirm`?

The CLI is designed for AI agents and scripts. Destructive commands need an explicit operator signal.

### Can I use app-private routes if a command is missing?

No. Only `/api/v1` endpoints are supported. App-private, callback, tracking, unsubscribe, internal, and support routes are intentionally excluded.

### Where are the docs?

Developer docs are hosted from `firstsalesio/docs` and are prepared for `developer.firstsales.io`.

---

## Development

```bash
npm test
node bin/firstsales.js commands --json
npm pack --dry-run --json
```

The command registry is the source for CLI docs sync. When public API routes change, update the registry, tests, docs, and OpenAPI contract together.
