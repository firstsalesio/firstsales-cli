---
name: firstsales-developer-api
description: Use the public FirstSales Developer API and OpenAPI contract when shell access is unavailable or a dedicated CLI command is not needed.
---

# FirstSales Developer API

Use this skill when an agent needs the public HTTP contract directly instead of the CLI wrapper.

## Canonical docs

- OpenAPI YAML: `https://developer.firstsales.io/openapi/firstsales-public-v1.yaml`
- OpenAPI JSON: `https://developer.firstsales.io/openapi/firstsales-public-v1.json`
- Authentication: `https://developer.firstsales.io/docs/authentication`
- CLI docs: `https://developer.firstsales.io/cli-reference/commands`

## Authentication rules

- Authenticate with a Developer API key as `Authorization: Bearer <FIRSTSALES_API_KEY>`.
- Use the narrowest scopes possible.
- Workspace keys stay within workspace-scoped resources.
- Organization routes need explicit organization scopes.
- Raw keys are reveal-once at creation time and are never retrievable later.

## Safe workflow

1. Start with `GET /api/v1/whoami`.
2. Follow the published OpenAPI path, method, query names, and body schema exactly.
3. Use idempotency only where the public contract allows retry-safe writes.
4. Never substitute dashboard cookies or Product MCP tokens for Developer API keys.

## Examples

```bash
curl https://api.app.firstsales.io/api/v1/whoami \
  -H "Authorization: Bearer $FIRSTSALES_API_KEY"

curl "https://api.app.firstsales.io/api/v1/organizations/org_123/workspaces/ws_123/campaigns" \
  -H "Authorization: Bearer $FIRSTSALES_API_KEY"

curl https://api.app.firstsales.io/api/v1/organizations/org_123/workspaces/ws_123/contacts \
  -H "Authorization: Bearer $FIRSTSALES_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: import-row-001" \
  -d '{"email":"alex@example.com"}'
```

## Do not use

- app-private routes
- internal admin/support routes
- callback, unsubscribe, or tracking endpoints
- Product MCP OAuth tokens as Developer API credentials
