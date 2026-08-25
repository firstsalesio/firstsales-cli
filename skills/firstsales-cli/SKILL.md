---
name: firstsales-cli
description: Use the `firstsales` CLI for deterministic shell automation against the public FirstSales Developer API.
---

# FirstSales CLI

Use this skill when an agent has shell access and needs a stable public interface for FirstSales.

## Choose this over raw API calls when

- the task already runs in a terminal, CI job, or coding agent shell
- machine-readable JSON output matters
- the task benefits from built-in destructive guards, dry runs, pagination, or idempotency flags

## Operating rules

1. Verify identity first.
2. Read the current state before mutation.
3. Prefer `--json` for automation.
4. Use `--dry-run` before risky writes when it adds confidence.
5. Use `--idempotency-key` only for retryable mutations.
6. Do not pass `--idempotency-key` to `api-keys create`.
7. Use `--confirm` only for intentional destructive commands.
8. Re-read state and verify after mutation.

## Core commands

```bash
firstsales whoami --json
firstsales campaigns list --org org_123 --workspace ws_123 --json
firstsales contacts create --org org_123 --workspace ws_123 --data '{"email":"alex@example.com"}' --idempotency-key import-row-001 --json
firstsales contacts delete --org org_123 --workspace ws_123 --contact contact_123 --confirm --json
firstsales api GET /api/v1/organizations/org_123/workspaces/ws_123/campaigns --json
```

## Boundaries

- Use only the public `/api/v1` surface.
- If the CLI returns `unsupported_operation`, stop and report that the capability is not public.
- Do not invent unpublished commands. `firstsales commands --json` is the local command registry authority.
