# Frequently Asked Questions

This page reflects the current NEXUS AI platform. For live plan limits, models, regions, and prices, use the dashboard and [pricing page](https://nexusai.run/pricing).

## General

### What is NEXUS AI?

NEXUS AI is an MCP-native platform for building, previewing, deploying, and operating containerized applications. It combines an AI App Builder, source/image deployment, databases, storage, backups, secrets, logs, GitHub integration, REST APIs, a CLI, and an OAuth-protected MCP server.

### Is it only an AI code generator?

No. Code generation is one entry point. Existing Git repositories, uploaded source, and container images can use the same deployment and operations platform without AI generation.

### Is NEXUS AI a cloud provider?

It provides a managed container runtime and also orchestrates supported AWS, Google Cloud, and Azure services. Enterprise/private installations may run in customer-controlled infrastructure.

### Where is the current product documentation?

Use [nexusai.run/docs](https://nexusai.run/docs). This wiki focuses on stable concepts and public GitHub workflows.

## AI App Builder

### How is Builder different from Deploy from Prompt?

Builder is a persistent conversation with preview, manual edits, attachments, click-to-edit, checkpoints, GitHub push, and repeated deployments. Deploy from Prompt is a one-pass generation-and-deploy workflow.

### Does preview provision infrastructure or incur deployment usage?

No. The preview is bundled in the browser and rendered in a sandboxed iframe. Infrastructure is provisioned only after an explicit deployment.

### What can preview render?

React single-page apps render directly. Full-stack Next.js + Prisma apps use mock data in preview and a real database when deployed. Unsupported packages produce a visible compatibility message instead of silently failing.

### Can the AI see attached screenshots?

Yes. Images are sent as vision inputs after browser-side resizing. They can be used as design references or bug reports.

### Does click-to-edit send the whole page?

No. It sends a concise description of the selected element, visible text, classes/snippet, and ancestor path.

### Can I revert Builder changes?

Yes. Each assistant turn and saved manual edit creates a full checkpoint. Restoring a checkpoint creates a new checkpoint without deleting history.

### Can Builder create authentication?

It can generate a Next.js/Prisma user model, password hashing, signed HTTP-only sessions, and route guards. Add authentication after the base app in a focused follow-up and review the generated security model before production.

### Can I push Builder code to GitHub?

Yes, through the NEXUS AI GitHub App. Repository creation depends on GitHub installation permissions and account type; pushing to an existing permitted repository is the most reliable path.

## Deployments

### Which deployment providers are supported?

- NEXUS AI container runtime (`docker`)
- Google Cloud Run (`gcp_cloud_run`)
- AWS App Runner through the compatible CLI identifier `aws_ecs_fargate`
- Azure Container Apps (`azure_container_apps`)

Availability varies by plan and provider configuration.

### Which target supports database sidecars, workers, volumes, and buckets?

The NEXUS AI `docker` runtime supports the complete Compose-style stack. Cloud Run, App Runner, and Container Apps are single-container targets; use supported standalone managed databases there.

### Can I deploy without a Dockerfile?

Yes. NEXUS AI detects common frameworks and can build source repositories. Supply custom install/build/start commands or a Dockerfile when detection is not enough.

### What port should my app use?

Read `PORT` when available, listen on `0.0.0.0`, and ensure the declared service port matches. Listening only on `localhost` is a common cause of an unhealthy deployment.

### Can I run a background worker?

Yes on the NEXUS AI container runtime. Use `--worker-command` and optionally `--worker-name` in a source deployment.

### What does stop do?

Stop is a soft lifecycle action. Start rehydrates the same deployment configuration without a source rebuild. Delete is the destructive deployment action.

### Can I scale a deployment?

Use the dashboard, `nexus deploy scale`, REST API, or `nexusai_deploy_scale`. Provider and plan limits apply. A single-writer filesystem volume is not a distributed filesystem; use a bucket or database for shared replica state.

### Can I schedule an ephemeral environment for deletion?

Yes. Set `--auto-destroy` during source deployment or use `nexus deploy auto-destroy --in`, `--at`, or `--off` later.

### Are custom domains supported?

Yes. Add the domain, publish the exact returned DNS records, verify ownership, and wait for certificate issuance. Proxy services can interfere with ownership or TLS validation.

## Databases and storage

### Which database services can run beside an app?

PostgreSQL, MySQL, MongoDB, and Redis are supported as `docker` deployment services.

### What standalone databases are available?

NEXUS AI supports local standalone databases and configured AWS RDS, Google Cloud SQL, and Azure database services. Exact engines, versions, classes, and regions depend on provider availability.

### Can one database attach to more than one deployment?

Standalone managed databases can be attached according to platform/provider rules. Deployment sidecars belong to one deployment stack. Use explicit environment prefixes if multiple database connections are attached.

### What is the difference between a volume and a bucket?

A volume is a mounted filesystem path for one deployment. A bucket is S3-compatible object storage that can attach to multiple deployments. Volumes suit SQLite/filesystem state; buckets suit uploads and shared objects.

### Why is my new volume or bucket missing from the running app?

Attachments change desired configuration. Redeploy the app after attach, detach, or credential rotation.

### What database backups are supported?

Deployment services support engine-appropriate backups, download, in-place restore, cross-service restore, and scheduled backups. Standalone databases use snapshots and restore into a new database.

### Does application rollback restore the database?

No. Code releases and stateful resources have separate histories. Take a database backup before risky migrations and restore state explicitly.

### Can NEXUS AI connect to Supabase?

Yes. Register it as an external PostgreSQL source. Use the Supabase Session Pooler on port 5432, the pooler username, and SSL mode `require`.

## CLI, API, and MCP

### How do I install the CLI?

```bash
curl -fsSL https://nexusai.run/install-mac.sh | bash  # macOS
curl -fsSL https://nexusai.run/install.sh | bash      # Linux
npm install -g nexusapp-cli@latest                    # Node.js 18+
```

### How does CI authenticate?

Create a scoped access token and set `NEXUSAI_TOKEN`. Use `NEXUSAI_API_URL` only when targeting a non-default installation.

### Does NEXUS AI support MCP?

Yes. Connect `https://mcp.nexusai.run/mcp` with OAuth. The current server exposes 74 tools across Builder, deployments, secrets, domains, databases, backups, storage, support, and usage.

### Is the MCP server in the official registry?

Yes, under `io.github.nexusrun/nexus-ai`.

### Which clients are supported?

Any compatible HTTP MCP client can connect. Documented setups include ChatGPT, Claude Desktop, Claude Code, Cursor, and Codex.

### Does MCP require confirmation for dangerous actions?

Scopes separate read, mutation, and deletion privileges, and destructive operations are placed behind confirmation-aware tool categories. Review every resolved resource ID before approving an operation.

### Is there a REST API?

Yes. User workflows generally use a JWT; automation uses scoped access tokens or OAuth. See [MCP and REST API](MCP-and-API).

## Secrets and security

### How are secrets stored?

Secrets and provider credentials are encrypted at rest. Deployment secrets are injected at runtime rather than committed into source or images.

### Can I read secret values through list APIs?

Normal list operations return metadata, not plaintext values. Resource-specific credential reveal operations, such as bucket credentials, require elevated permission and are audit logged.

### Does updating a secret change running containers immediately?

No. Redeploy affected workloads so new process environments receive the value.

### What roles are available?

The active role model includes Owner, Admin, Member/Developer, Deployment Manager, Auditor, and Billing Manager responsibilities, with resource actions further constrained by scopes and provider rules. Use the current permissions matrix in [the docs](https://nexusai.run/docs#rbac-overview).

### Is NEXUS AI HIPAA compliant?

The platform provides HIPAA-aligned controls and healthcare/enterprise offerings. Whether a workload is compliant depends on configuration, contracts, operational procedures, and the services used. Review [the HIPAA page](https://nexusai.run/hipaa-compliance) and obtain the necessary BAA before processing PHI.

### Where do I report a vulnerability?

Report suspected vulnerabilities privately through [customer support](https://nexusai.run/customer-support). Do not disclose sensitive vulnerability details in a public issue.

## AI Gateway

### What does AI Gateway do?

It provides compatible model endpoints plus provider routing, fallback, caching, budgets, rate limits, analytics, credential isolation, guardrails, and audit records.

### Do I need to rewrite application code?

Usually not. Change the SDK base URL and gateway key. OpenAI-compatible traffic uses `/v1`; Anthropic-compatible messages use `/v1/messages`.

### Is AI Gateway the same as MCP?

No. AI Gateway routes model inference traffic. MCP lets an agent operate the NEXUS AI deployment platform.

## Billing and support

### Is there a free plan?

Plan names, allowances, and included providers can change. Use [nexusai.run/pricing](https://nexusai.run/pricing) for current information. The dashboard displays the active organization plan and usage.

### Are cloud-provider charges included?

Customer-owned AWS, Google Cloud, or Azure resources may be billed directly by that provider. Review both NEXUS AI and provider billing before enabling production workloads.

### How do I get help?

- [Customer support](https://nexusai.run/customer-support)
- In-app support tickets
- MCP support-ticket tools for authorized agents
- [Platform status](https://senalops.com/status/nexusai-status)

## Troubleshooting

### A build fails during dependency installation

Inspect full build logs, lockfile consistency, runtime version, private registry credentials, native build dependencies, and transient registry errors. Keep the build context small.

### The build succeeds but the service is unhealthy

Check `0.0.0.0` binding, port, start command, required secrets, migration duration, dependency connectivity, and runtime logs.

### A cloud deployment fails with permission errors

Confirm the connected service identity has the documented provider permissions and that IAM propagation has completed. Inspect the provider build/runtime logs as well as NEXUS AI logs.

### An operation returns 403

Check organization role, access-token/OAuth scope, plan availability, provider configuration, and whether the resource belongs to the active organization.

### Where are detailed troubleshooting guides?

Use the [Knowledge Base](https://nexusai.run/kb) and the troubleshooting sections in [the docs](https://nexusai.run/docs).
