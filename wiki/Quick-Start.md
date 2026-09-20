# Quick Start

Deploy an application with the dashboard, AI App Builder, CLI, or an MCP client. This guide starts with the CLI because it is repeatable and maps directly to the dashboard and API workflows.

## Before you begin

- Create an account at [nexusai.run/register](https://nexusai.run/register).
- Verify your email and complete organization setup.
- Install Node.js 18 or later if you use the npm installation path.
- For private repositories, add an appropriate source-control credential to the Secrets Vault.
- For AI Builder workflows, configure an AI provider in **AI Providers**. Availability varies by plan.

You do not need to connect AWS, Google Cloud, or Azure to use the NEXUS AI container runtime.

## 1. Install and authenticate the CLI

### macOS

```bash
curl -fsSL https://nexusai.run/install-mac.sh | bash
```

### Linux

```bash
curl -fsSL https://nexusai.run/install.sh | bash
```

### npm

```bash
npm install -g nexusapp-cli@latest
```

Verify and sign in:

```bash
nexus --version
nexus auth login
nexus auth whoami
```

For CI, create a scoped access token in **Access Tokens** and set it as `NEXUSAI_TOKEN` instead of running an interactive login.

## 2. Deploy a Git repository

The smallest source deployment is:

```bash
nexus deploy source \
  --repo https://github.com/you/your-app.git \
  --name your-app \
  --provider docker \
  --wait
```

NEXUS AI detects common frameworks and build commands. Override detection only when your repository needs it:

```bash
nexus deploy source \
  --repo https://github.com/you/your-app.git \
  --name your-app \
  --provider docker \
  --framework node \
  --install-command "npm ci" \
  --build-command "npm run build" \
  --start-command "npm start" \
  --environment PRODUCTION \
  --wait
```

Your process must listen on `0.0.0.0` and the configured service port. Read the `PORT` environment variable when possible.

## 3. Deploy a full stack

On the NEXUS AI container runtime, `--services` creates database or cache sidecars and injects connection variables into the app and worker containers.

```bash
nexus deploy source \
  --repo https://github.com/you/your-app.git \
  --name your-full-stack-app \
  --provider docker \
  --services postgresql,redis \
  --worker-command "npm run worker" \
  --environment PRODUCTION \
  --wait
```

Supported sidecar service types include PostgreSQL, MySQL, MongoDB, and Redis. The dashboard shows each service and its connection details on the deployment's **Databases** tab.

Cloud Run, App Runner, and Container Apps do not run Compose-style sidecars. For those providers, `--create-db postgres`, `--create-db mysql`, or `--managed-db <id>` attaches a supported managed database.

## 4. Add persistent storage

### Filesystem volume

```bash
nexus volume create app-data
nexus volume list
nexus volume attach <volume-id> <deployment-id> --mount /data
nexus deploy redeploy <deployment-id> --wait
```

Attaching changes desired configuration. Redeploy is required before the running container receives the mount.

### S3-compatible bucket

```bash
nexus bucket create user-uploads
nexus bucket attach <bucket-id> <deployment-id>
nexus deploy redeploy <deployment-id> --wait
```

The redeployed app receives scoped `S3_*` variables. Buckets can attach to multiple deployments; volumes attach to one deployment at a time.

## 5. Observe and operate the deployment

```bash
nexus deploy status your-full-stack-app
nexus deploy logs your-full-stack-app --follow
nexus deploy scale your-full-stack-app 3
nexus deploy auto-destroy your-full-stack-app --in 4h
```

Common lifecycle commands:

```bash
nexus deploy stop your-full-stack-app
nexus deploy start your-full-stack-app
nexus deploy redeploy your-full-stack-app --wait
nexus deploy rollback your-full-stack-app
```

Stop is a soft stop. Persistent services and storage are managed separately; deletion is the destructive operation.

## 6. Back up a database service

Discover the service ID, then create and download a backup:

```bash
nexus db services your-full-stack-app
nexus db backup <service-id>
nexus db backups <service-id>
nexus db backup-download <service-id> <backup-id> --out ./backup.dump
```

Restore to the same service or seed another compatible service:

```bash
nexus db restore <service-id> <backup-id> --yes
nexus db restore-to <target-service-id> <backup-id> --yes
```

Take a fresh backup before migrations or other destructive schema changes.

## Alternative: build with the AI App Builder

1. Open a project and choose **Build with AI**.
2. Describe the application.
3. Review the browser-local live preview.
4. Iterate with chat, direct code edits, screenshots, or click-to-edit.
5. Use the version menu to restore an earlier checkpoint if necessary.
6. Click **Deploy**, choose a provider and region, and follow the live status.

Full-stack Next.js + Prisma projects use mock data in preview and receive a real managed Postgres database when deployed.

## Alternative: deploy from an MCP client

Connect `https://mcp.nexusai.run/mcp`, complete OAuth, then ask the agent to run a workflow such as:

> Deploy this repository to NEXUS AI with PostgreSQL and Redis, wait for it to become healthy, then show me the public URL and the last 100 runtime log lines.

The agent can call `nexusai_deploy_source`, `nexusai_deploy_status`, and `nexusai_deploy_logs` with the scopes you approved.

## First-deploy checklist

- The app listens on `0.0.0.0`, not only `localhost`.
- The service port matches the application port.
- Required secrets exist in the correct environment.
- Private repository credentials are stored as secrets, not embedded in the URL.
- The health endpoint returns a successful response after startup.
- Database migrations run intentionally and have a backup/rollback plan.
- Volume or bucket attachments are followed by a redeploy.

## Next steps

- [AI App Builder and Application Generation](Application-Generation-Engine)
- [Deployment and Cloud Providers](Deployment-and-Cloud-Providers)
- [Databases, Backups, and Storage](Databases-and-Storage)
- [CLI Reference](CLI)
- [MCP and REST API](MCP-and-API)
- [FAQ](FAQ)
