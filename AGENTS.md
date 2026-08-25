# FirstSales CLI Public Agent Guidance

Use this repository only for public FirstSales agent assets.

## Source of truth

- `src/commands.js` is the command registry authority for the packaged CLI surface.
- `release/firstsales-public-v1.cli-publish-contract.json` is the published CLI contract authority.
- `https://developer.firstsales.io/llms.txt` is the public docs index for API, CLI, and MCP guidance.
- `https://developer.firstsales.io/skill.md` is the canonical public FirstSales agent skill.

## Safety rules

- Use only public `/api/v1` Developer API routes and the documented Product MCP endpoint.
- Never suggest app-private routes, dashboard callbacks, tracking handlers, support/admin routes, or internal cron paths.
- Start with read operations such as `firstsales whoami`, `list`, and `get` before mutation guidance.
- Keep mutation guidance retry-safe: use `--idempotency-key` only for supported write commands and never for `api-keys create`.
- Treat destructive commands as opt-in only. Public CLI guidance must keep `--confirm` on destructive commands.
- Do not print or persist raw API keys, OAuth tokens, or reveal-once `rawKey` values.

## Contribution rules

- Keep assets grounded in the released public surface only.
- When command guidance changes, verify the command exists in `src/commands.js`.
- When MCP guidance changes, verify it matches `https://developer.firstsales.io/agents/mcp-server`.
- Keep diffs small. No new dependencies.
- Update README links and the contract test with any new public asset.
- Verify with `npm test`.
