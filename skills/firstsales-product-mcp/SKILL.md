---
name: firstsales-product-mcp
description: Use the OAuth-protected FirstSales Product MCP endpoint when an MCP-aware client needs released read-only product context.
---

# FirstSales Product MCP

Use this skill when the client speaks MCP and needs the released Product MCP surface instead of the full CLI or raw Developer API.

## Canonical endpoints

- MCP endpoint: `https://api.app.firstsales.io/mcp`
- OAuth protected resource metadata: `https://api.app.firstsales.io/.well-known/oauth-protected-resource/mcp`
- OAuth authorization server metadata: `https://app.firstsales.io/.well-known/oauth-authorization-server`
- Protocol guide: `https://developer.firstsales.io/agents/mcp-server`

## Transport and auth

- Transport is MCP `streamable-http`.
- Protocol revision is `2025-11-25`.
- Use OAuth with PKCE and an access token minted for the MCP resource.
- Send `Authorization: Bearer <access-token>` and `MCP-Protocol-Version: 2025-11-25`.
- Developer API keys and dashboard cookies are not accepted by Product MCP.

## Runtime authority

- Treat authenticated `server/discover` and `tools/list` as the live authority for the current tenant and grant.
- The released catalog is read-only today.
- If a desired action is mutating, destructive, billing-related, or approval-backed, switch to the CLI or Developer API instead of assuming MCP support.

## Use this over the CLI when

- the client is already MCP-native
- the task needs released product context instead of shell automation
- the tool catalog must be discovered dynamically per tenant grant

## Do not use

- for writes that require `--confirm`
- for Developer API key workflows
- for unpublished tools that are absent from `tools/list`
