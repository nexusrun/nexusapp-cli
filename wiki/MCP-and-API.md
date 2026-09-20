# MCP and REST API

NEXUS AI exposes the platform through an OAuth-protected MCP server and a REST API. Use MCP when an agent should discover and call platform tools; use REST when application code needs direct endpoint control.

## MCP endpoint

```text
Endpoint:         https://mcp.nexusai.run/mcp
Transport:        HTTP JSON-RPC 2.0 over POST
Registry ID:      io.github.nexusrun/nexus-ai
Protocol version: 2026-01-16
Methods:          ping, initialize, tools/list, tools/call
```

Registry listing:

<https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.nexusrun/nexus-ai>

OAuth discovery metadata is served from `mcp.nexusai.run`:

```text
https://mcp.nexusai.run/.well-known/oauth-authorization-server
https://mcp.nexusai.run/.well-known/oauth-protected-resource/mcp
https://mcp.nexusai.run/.well-known/openid-configuration
```

`GET` and `DELETE` are intentionally rejected on `/mcp`; use `POST`.

## Connect common clients

### ChatGPT

Add `https://mcp.nexusai.run/mcp` as a connected app/MCP server, complete OAuth, and approve the requested scopes.

### Claude Desktop

```json
{
  "mcpServers": {
    "nexus-ai": {
      "url": "https://mcp.nexusai.run/mcp"
    }
  }
}
```

Restart Claude Desktop and complete OAuth on first use.

### Claude Code

```bash
claude mcp add --transport http nexus-ai https://mcp.nexusai.run/mcp
```

### Cursor

Add an HTTP MCP server with URL `https://mcp.nexusai.run/mcp`. Cursor starts OAuth on first connection.

### Codex CLI

```bash
codex mcp add nexus-ai --url https://mcp.nexusai.run/mcp
codex mcp login nexus-ai
```

Verify any connection by asking the client to call `nexusai_whoami`.

## Tool coverage

The current server exposes 74 tools in these groups:

| Group | Examples |
|---|---|
| Identity and projects | `nexusai_whoami`, `nexusai_projects_list` |
| Builder handoff | `nexusai_builder_push`, `nexusai_builder_pull` |
| Deployments | create, source deploy, status, logs, health, redeploy, rollback, scale, start/stop/delete, auto-destroy |
| Secrets and domains | list/create/update/delete secrets; add/list/verify/remove domains |
| External DB intelligence | source connect, schema inspection, query preview/execute, propose/apply fixes |
| Deployment databases | service discovery, backup, list/download, schedule, restore, cross-service restore |
| Managed databases | create, attach, query/execute, snapshots, restore, delete |
| Storage | volumes; bucket lifecycle, objects, and credential rotation |
| Support and usage | tickets and usage statistics |

Use `tools/list` as the runtime source of truth because tool coverage can grow between wiki updates.

## Scopes and confirmation gates

MCP tools require fine-grained OAuth scopes such as:

```text
deployments:read       deployments:create       deployments:logs
deployments:delete     secrets:read              secrets:manage
domains:read           domains:manage            db:read
db:query               db:admin                 volumes:manage
buckets:manage         managed_db:manage         support:write
```

Read-only, mutating, and destructive operations are separated. Destructive tools such as deployment deletion, secret deletion, domain removal, database deletion, storage deletion, credential rotation, file deletion, restore, and write-query operations require appropriate scopes and may require explicit client confirmation.

Grant the smallest scope set needed for the workflow. Revoke unused clients and tokens.

## Example MCP workflows

### Build in chat, preview in Builder

```text
nexusai_projects_list
-> agent generates files
-> nexusai_builder_push
-> user reviews the preview
-> nexusai_builder_pull (optional)
-> deploy after approval
```

### Safe migration

```text
nexusai_db_services_list
-> nexusai_db_backup
-> run migration
-> nexusai_deploy_logs
-> on failure: nexusai_db_restore + nexusai_deploy_rollback
```

### Diagnose a failed deployment

```text
nexusai_deploy_status
-> nexusai_deploy_logs
-> fix secret, schema, or source
-> nexusai_deploy_redeploy
-> nexusai_deploy_health
```

## REST API basics

The public API base URL is:

```bash
export NEXUS_API_BASE="https://nexusai.run/api"
```

Dashboard-oriented endpoints generally use a user JWT:

```bash
curl -s "$NEXUS_API_BASE/projects" \
  -H "Authorization: Bearer $NEXUS_JWT"
```

Automation endpoint families use scoped `nxk_...` access tokens:

```bash
curl -s "$NEXUS_API_BASE/gpt/providers" \
  -H "Authorization: Bearer $NEXUS_TOKEN"
```

Create access tokens in **Access Tokens** or with `nexus token create`. A token is shown only when created; store it in a secret manager.

## Authentication patterns

### User JWT

Use login endpoints for interactive product workflows, then send the returned JWT in the `Authorization` header.

### Scoped access token

Use `nxk_...` tokens for CLI, CI, GPT actions, and server automation. Scope and revoke each token independently.

### OAuth

Use OAuth for MCP clients and ChatGPT Apps so every user connects with their own tenant-scoped identity. Public clients use authorization code + PKCE (`S256`).

```text
Authorization: https://nexusai.run/oauth/authorize
Token:         https://nexusai.run/api/oauth/token
User info:     https://nexusai.run/api/oauth/me
```

## API error handling

- `400`: validate request fields and provider-specific options.
- `401`: token is missing, expired, or invalid.
- `403`: role, plan, scope, or organization policy blocks the action.
- `404`: verify the ID belongs to the authenticated organization.
- `409`: inspect resource state or uniqueness conflicts.
- `429`: respect rate/quota information and retry only when appropriate.
- `5xx`: record the request context and check platform status before retrying with backoff.

Never log bearer tokens or returned credentials.

## Related pages

- [CLI Reference](CLI)
- [AI App Builder and Application Generation](Application-Generation-Engine)
- [Databases, Backups, and Storage](Databases-and-Storage)
- [Secrets Vault](Secrets-Vault)
