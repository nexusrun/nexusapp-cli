# NEXUS AI

NEXUS AI is an MCP-native application platform for building, previewing, deploying, and operating containerized applications. Start from an AI conversation, a Git repository, local source, or an existing container image, then manage the application through the dashboard, CLI, REST API, or an MCP-compatible agent.

- [Website](https://nexusai.run)
- [Documentation](https://nexusai.run/docs)
- [Changelog](https://nexusai.run/changelog)
- [Pricing](https://nexusai.run/pricing)
- [Status](https://senalops.com/status/nexusai-status)
- [Support](https://nexusai.run/customer-support)
- [GitHub organization](https://github.com/nexusrun)

## Current platform capabilities

### Build and preview with AI

The AI App Builder provides a persistent chat session, browser-local live preview, direct code editing, restorable checkpoints, screenshot attachments, click-to-edit targeting, deploy-failure repair, and GitHub push. It supports React previews and full-stack Next.js + Prisma projects with a mock-data preview and a real managed database at deployment time.

### Deploy through one platform

Deploy from:

- an AI Builder session;
- a public or private Git repository;
- uploaded local source;
- an existing container image;
- the dashboard, CLI, REST API, or MCP tools.

The NEXUS AI container runtime supports applications with database and cache sidecars, background workers, persistent volumes, and S3-compatible buckets. Single-container applications can also target Google Cloud Run, AWS App Runner, or Azure Container Apps.

### Operate full-stack applications

Current lifecycle operations include build and runtime logs, health status, start and stop, redeploy, replica scaling, auto-destroy schedules, rollback, custom domains, secrets, database backups, cross-service restores, persistent storage, audit logs, and support tickets.

### Work from an AI agent

The OAuth-protected MCP server exposes 74 tools for builder handoff, deployments, secrets, domains, databases, backups, storage, support, and usage. It works with ChatGPT, Claude Desktop, Claude Code, Cursor, Codex, and custom MCP clients.

```text
MCP endpoint: https://mcp.nexusai.run/mcp
Registry ID:  io.github.nexusrun/nexus-ai
Transport:    HTTP JSON-RPC 2.0 (POST)
```

### Route model traffic through AI Gateway

NEXUS AI Gateway provides OpenAI- and Anthropic-compatible endpoints, virtual models, provider routing, retries and failover, caching, budgets, rate limits, usage and cost analytics, key isolation, policies, and audit logs.

## Deployment targets

| Target | Best for | Full-stack services |
|---|---|---|
| NEXUS AI container runtime (`docker`) | Apps with sidecars, workers, volumes, buckets, and service databases | Yes |
| Google Cloud Run (`gcp_cloud_run`) | Managed single-container applications | Managed Postgres/MySQL can be provisioned separately |
| AWS App Runner (`aws_ecs_fargate`) | Managed single-container applications | Managed Postgres/MySQL can be provisioned separately |
| Azure Container Apps (`azure_container_apps`) | Managed single-container applications | Managed Postgres/MySQL can be provisioned separately |
| Customer-owned or private runtime | Enterprise deployments | Depends on installation |

Provider and feature availability depends on the organization plan. Use the [live pricing page](https://nexusai.run/pricing) for current limits.

## Ways to use NEXUS AI

| Interface | Use it for |
|---|---|
| Dashboard | Visual project, deployment, database, storage, provider, team, billing, and audit management |
| AI App Builder | Conversational app creation, preview, editing, checkpoints, GitHub push, and deployment |
| CLI | Repeatable terminal and CI/CD workflows |
| REST API | Product integrations and custom automation |
| MCP server | Agent-driven workflows with OAuth and fine-grained scopes |

## Wiki navigation

- [Quick Start](Quick-Start)
- [AI App Builder and Application Generation](Application-Generation-Engine)
- [Deployment and Cloud Providers](Deployment-and-Cloud-Providers)
- [Databases, Backups, and Storage](Databases-and-Storage)
- [GitHub Deployments](GitHub-Deployments)
- [AI Gateway](AI-Gateway)
- [MCP and REST API](MCP-and-API)
- [CLI Reference](CLI)
- [Secrets Vault](Secrets-Vault)
- [Versioning and Rollbacks](Versioning-and-Rollbacks)
- [FAQ](FAQ)

## Security model at a glance

- Organization-scoped data and runtime resources.
- Encrypted provider credentials and secrets.
- Scoped, revocable access tokens and OAuth grants.
- Role-based access control and audit logging.
- Confirmation gates for destructive MCP operations.
- Sandboxed browser preview without same-origin access to the NEXUS AI session.
- Backup and restore operations remain explicit and audit logged.

Compliance needs vary by workload; review the [security](https://nexusai.run/security) and [HIPAA](https://nexusai.run/hipaa-compliance) pages before placing regulated data on the platform. Report suspected vulnerabilities privately through [customer support](https://nexusai.run/customer-support), not a public issue.

## Source of truth and update policy

This wiki explains stable workflows. The following live references take precedence when details change:

1. `nexus --help` for installed CLI syntax;
2. [nexusai.run/docs](https://nexusai.run/docs) for current product workflows and troubleshooting;
3. [nexusai.run/pricing](https://nexusai.run/pricing) for plan limits and pricing;
4. the dashboard for provider, region, model, and organization-specific availability.

---

Updated for NEXUS AI web/backend 2.0 and CLI 4.1.8.
