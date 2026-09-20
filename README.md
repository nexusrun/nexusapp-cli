# NEXUS AI CLI

Deploy, manage, and monitor cloud applications from the terminal: deployments, standalone databases, storage, secrets, domains, and team access.

[![NEXUS AI CLI demo](https://nexusai.run/videos/nexus-cli-demo.gif)](https://nexusai.run/videos/nexus-cli-demo.mp4)

<sub>Autoplaying preview. [Watch the full-quality video](https://nexusai.run/videos/nexus-cli-demo.mp4).</sub>

```
npm install -g nexusapp-cli@latest
nexus auth login
nexus deploy source --repo https://github.com/you/app --name my-app --provider gcp_cloud_run
```

## Installation

```bash
npm install -g nexusapp-cli@latest
```

Requires Node.js 18 or later. Run `nexus --help` and `nexus <command> --help` for the exact syntax of the version you have installed.

## Authentication

### Browser login (default)

```bash
nexus auth login
```

Opens a browser window to complete OAuth. The token is saved to `~/.nexusai/config.json` and reused automatically.

### Token-based login (CI/CD)

Set `NEXUSAI_TOKEN` in the environment. The CLI picks it up automatically without requiring `nexus auth login`. You can also pass an existing `nxk_*` token with `nexus auth login --token <token>`.

```bash
export NEXUSAI_TOKEN=your-api-token
nexus deploy list
```

### Other auth commands

```bash
nexus auth whoami     # show current user and org
nexus auth logout     # log out and revoke the access token
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `NEXUSAI_TOKEN` | API token. Set this in CI/CD instead of running `nexus auth login`. |
| `NEXUSAI_URL` | Override the API base URL (default: `https://nexusai.run`). |

---

## Commands

### `nexus deploy`

#### List deployments

```bash
nexus deploy list
nexus deploy list --status RUNNING
nexus deploy list --project <project-id>
nexus deploy list --json
```

#### Get deployment details

```bash
nexus deploy get <name-or-id>
nexus deploy get my-app --json
```

#### Create from a container image

```bash
nexus deploy create \
  --image nginx:latest \
  --port 80 \
  --name my-nginx \
  --provider gcp_cloud_run \
  --env KEY=value \
  --env-file .env.production
```

#### Deploy from a Git repository

Detects the runtime from your repo automatically. No Dockerfile required.

```bash
nexus deploy source \
  --repo https://github.com/you/app \
  --name my-app \
  --provider aws_ecs_fargate

# With options
nexus deploy source \
  --repo https://github.com/you/app \
  --name my-app \
  --provider gcp_cloud_run \
  --branch main \
  --env-file .env.production \
  --env NODE_ENV=production \
  --environment PRODUCTION \
  --wait
```

**Supported providers:** `aws_ecs_fargate` · `gcp_cloud_run` · `azure_container_apps` · `docker`

Useful `deploy source` options:

| Option | Description |
|---|---|
| `--project <id>` | Deploy into a specific project (use separate projects for dev, staging, and prod) |
| `--region <region>` | Cloud region, for example `us-central1` |
| `--framework <framework>` | Framework hint, for example `node`, `python`, `go` |
| `--build-command`, `--start-command`, `--install-command`, `--output-dir` | Override detected commands |
| `--dockerfile <path-or-url-or-content>` | Use a repo path, local file, URL, or inline Dockerfile |
| `--repo-secret <name>` | Secret holding a private-repo token |
| `--services postgres,redis` | Provision services. Sidecars on `docker`, managed databases on cloud providers |
| `--create-db <engine>` / `--db-version` / `--db-region` | Provision a managed cloud database (`postgres` or `mysql`) |
| `--managed-db <id>` | Attach an existing standalone database and inject its connection env |
| `--worker-command <cmd>` / `--worker-name <name>` | Run a background worker sidecar |
| `--auto-destroy <hours>` | Tear the deployment down after N hours |
| `--no-health-check` | Disable health checks |

#### Redeploy

Rebuilds from the current source and rolls out a new version.

```bash
nexus deploy redeploy my-app
nexus deploy redeploy my-app --yes          # skip confirmation
nexus deploy redeploy my-app --env-file .env --wait
```

#### Rollback

Reverts to the previous container image.

```bash
nexus deploy rollback my-app
nexus deploy rollback <deployment-id> --yes
```

#### Start / Stop

```bash
nexus deploy stop my-app
nexus deploy start my-app
```

#### Delete

```bash
nexus deploy delete my-app
nexus deploy delete my-app --yes
```

#### Deployment status

```bash
nexus deploy status my-app
nexus deploy status my-app --watch    # refresh every 3s
nexus deploy status my-app --json
```

#### Stream logs

```bash
nexus deploy logs my-app
nexus deploy logs my-app --follow     # tail in real time
nexus deploy logs my-app --lines 200
nexus deploy logs my-app --json
```

#### Scale replicas

```bash
nexus deploy scale my-app 3
```

#### Auto-destroy

Set, extend, or disable a deployment's expiry without restarting it.

```bash
nexus deploy auto-destroy my-app --in 4h
nexus deploy auto-destroy my-app --at 2026-10-01T00:00:00Z
nexus deploy auto-destroy my-app --off
```

#### Run commands and copy files

For deployments running on NEXUS AI managed infrastructure (`docker`).

```bash
nexus exec my-app ls -la /app
nexus exec my-app --timeout 300 --workdir /app npm run migrate
nexus cp ./index.html my-app:/app/public/index.html    # upload
nexus cp my-app:/app/config.json ./config.json         # download
```

#### Deploy OpenClaw gateway

Deploys an [OpenClaw](https://openclaw.dev) Claude Code-compatible AI coding gateway. The gateway token is auto-generated if not provided.

```bash
nexus deploy openclaw

# With options
nexus deploy openclaw \
  --name my-openclaw \
  --provider gcp_cloud_run \
  --claude-api-key <key> \
  --wait
```

| Option | Description |
|---|---|
| `--name` | Deployment name (default: `openclaw-gateway`) |
| `--gateway-token` | Auth token (auto-generated if omitted) |
| `--claude-api-key` | `CLAUDE_AI_SESSION_KEY` value |
| `--claude-web-session` | `CLAUDE_WEB_SESSION_KEY` value |
| `--claude-web-cookie` | `CLAUDE_WEB_COOKIE` value |
| `--provider` | Cloud provider |
| `--env-file` | Load additional env vars from a `.env` file |

#### Deploy Flixty social studio

Deploys [Flixty](https://github.com/nexusrun/flixty), a self-hosted social media creator studio for X, LinkedIn, Facebook, Instagram, TikTok, and YouTube. Session secret is auto-generated.

```bash
nexus deploy flixty

# With platform credentials
nexus deploy flixty \
  --name my-flixty \
  --provider gcp_cloud_run \
  --base-url https://flixty.example.com \
  --anthropic-api-key <key> \
  --env-file .env.flixty \
  --wait
```

| Option | Description |
|---|---|
| `--name` | Deployment name (default: `flixty`) |
| `--session-secret` | Express session secret (auto-generated if omitted) |
| `--base-url` | Public URL, required for OAuth redirect URIs. Set after first deploy if not known yet. |
| `--anthropic-api-key` | Enables AI Assist via Claude |
| `--x-client-id` / `--x-client-secret` | X/Twitter OAuth |
| `--linkedin-client-id` / `--linkedin-client-secret` | LinkedIn OAuth |
| `--fb-app-id` / `--fb-app-secret` | Facebook + Instagram |
| `--tiktok-client-key` / `--tiktok-client-secret` | TikTok |
| `--google-client-id` / `--google-client-secret` | YouTube + Google Sign-In |
| `--provider` | Cloud provider |
| `--env-file` | Load env vars from a `.env` file |

---

### `nexus secret`

Secrets are encrypted at rest (AES-256-GCM) and injected as environment variables at container start.

```bash
# List secrets
nexus secret list
nexus secret list --environment PRODUCTION

# Create a secret
nexus secret create --name DATABASE_URL --environment PRODUCTION
# (prompts for value securely)

nexus secret create --name API_KEY --environment PRODUCTION --value sk-...

# Update a secret
nexus secret update <id>
nexus secret update <id> --value new-value

# Delete a secret
nexus secret delete <id>
nexus secret delete <id> --yes
```

---

### `nexus domain`

```bash
# List custom domains for a deployment (shows domain IDs)
nexus domain list my-app

# Add a custom domain
nexus domain add my-app app.example.com

# Check verification status (takes the domain ID from `domain list`)
nexus domain verify my-app <domain-id>

# Remove a domain
nexus domain remove my-app <domain-id> --yes
```

After adding a domain, point a CNAME record at the deployment URL shown in `nexus deploy status`, then run `nexus domain verify` to confirm. Custom domains are available on Starter and above.

---

### `nexus project`

```bash
nexus project list
nexus project create --name my-project
nexus project delete <id>
```

---

### `nexus managed-db`

Standalone databases that live independently of any app. Run PostgreSQL or Redis on NEXUS AI with `--local`, or PostgreSQL and MySQL on AWS RDS, Google Cloud SQL, or Azure Database. Available on paid plans.

```bash
nexus managed-db list

# Local database on NEXUS AI
nexus managed-db create shop --local --engine postgres --db-name shop_db --username shop_user
nexus managed-db create cache --local --engine redis

# Cloud database
nexus managed-db create prod-db --provider GCP_CLOUD_SQL --engine postgres --engine-version 17

# Keep a password out of shell history
echo "$DB_PASSWORD" | nexus managed-db create shop --local --engine postgres --password-stdin

# Credentials
nexus managed-db connection shop
nexus managed-db connection shop --url-only

# Attach to an app (injects DATABASE_URL and friends on the next deploy)
nexus managed-db attach shop --deployment my-app
nexus deploy redeploy my-app --wait
nexus managed-db detach shop --deployment my-app

# Snapshots
nexus managed-db snapshot shop --notes "before migration"
nexus managed-db snapshots shop
nexus managed-db restore shop --snapshot <snapshot-id> --new-name shop-restored

# Delete (destroys data)
nexus managed-db delete shop
```

#### Run SQL

```bash
nexus managed-db query shop "SELECT id, email FROM users LIMIT 10"
nexus managed-db query shop "CREATE TABLE notes (id serial PRIMARY KEY, body text NOT NULL)"
nexus managed-db query shop "INSERT INTO notes (body) VALUES ('hello')"
nexus managed-db query shop "SELECT * FROM users LIMIT 5" --json | jq '.rows[].email'
nexus managed-db query shop "$(cat migration.sql)"
```

- Always wrap the SQL in quotes, otherwise the shell splits it into separate arguments.
- PostgreSQL and MySQL only. One statement per call.
- Allowed: `SELECT`, `EXPLAIN`, `INSERT`, `UPDATE`, `DELETE` (with a `WHERE` clause), table, index, view, function, procedure, and trigger DDL, and `TRUNCATE`.
- Blocked: `CREATE DATABASE`, `DROP DATABASE`, `GRANT`, `REVOKE`, `CREATE ROLE`, and `CREATE EXTENSION`. They fail with `Query blocked: Statement type not permitted`. For unrestricted access, use `nexus managed-db connection` and connect with `psql` or `mysql`.
- Reads need `managed_databases.read`. Writes and DDL need `managed_databases.manage`.

---

### `nexus db`

Backups for database services that run inside a deployment (for example `--services postgres`). Find service IDs with `nexus db services`.

```bash
nexus db services [deployment]
nexus db backup <service-id>
nexus db backups <service-id>
nexus db restore <service-id> <backup-id> --yes
nexus db restore-to <target-service-id> <backup-id>     # into a different service, same engine
nexus db backup-download <service-id> <backup-id> --out ./backup.dump
nexus db backup-download <service-id> <backup-id> --share --ttl 600   # signed URL (30 to 3600 seconds)
nexus db backup-upload <service-id> ./backup.dump
nexus db backup-delete <service-id> <backup-id> --yes

# Daily automatic backups, kept 7 days by default (cannot go lower)
nexus db backup-schedule <service-id> --enable --retention 14
nexus db backup-schedule <service-id> --disable
```

---

### `nexus bucket`

S3-compatible buckets with a scoped service account per bucket.

```bash
nexus bucket create user-uploads
nexus bucket list
nexus bucket attach <bucket-id> <deployment-id>   # injects S3_* env vars on next deploy
nexus bucket detach <bucket-id> <deployment-id>
nexus bucket credentials <bucket-id>              # reveal credentials (audit-logged)
nexus bucket rotate-credentials <bucket-id> --yes

nexus bucket files <bucket-id> --prefix images/
nexus bucket upload <bucket-id> ./logo.png --key images/logo.png
nexus bucket download <bucket-id> images/logo.png --out ./logo.png
nexus bucket download <bucket-id> images/logo.png --share --ttl 300   # signed URL
nexus bucket rm <bucket-id> images/logo.png --yes
nexus bucket refresh-usage <bucket-id>
nexus bucket delete <bucket-id> --yes             # must be detached, deletes all objects
```

Redeploy after attaching so the app receives `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, and `S3_SECRET_KEY`.

---

### `nexus volume`

Persistent volumes that survive restarts, redeploys, and host reboots.

```bash
nexus volume create app-data
nexus volume list
nexus volume attach <volume-id> <deployment-id> --mount /data   # redeploy to take effect
nexus volume detach <volume-id>
nexus volume refresh-usage <volume-id>
nexus volume delete <volume-id> --yes                           # must be detached
```

---

### `nexus member`

```bash
nexus member list
nexus member invite dev@example.com --role MEMBER
nexus member role <user-id> AUDITOR
nexus member suspend <user-id> --yes
nexus member activate <user-id>
```

Roles: `ADMIN`, `MEMBER`, `DEPLOYMENT_MANAGER`, `AUDITOR`, `BILLING_MANAGER`.

---

### `nexus token`

Scoped access tokens for CI and automation.

```bash
nexus token list
nexus token list --show-last-used --unused-since 30
nexus token create --name ci-deploy --scopes deployments:read,deployments:create --expires 90d
nexus token revoke <id> --yes
```

The token value is shown once, at creation. Use it as `NEXUSAI_TOKEN`.

---

## Loading Environment Variables from a File

All deploy commands accept `--env-file <path>` to load variables from a `.env`-style file.

```bash
nexus deploy source --repo https://github.com/you/app --env-file .env.production
nexus deploy redeploy my-app --env-file .env.production
nexus deploy flixty --env-file .env.flixty
```

**File format:**

```dotenv
# Comments are ignored
DATABASE_URL=postgres://user:pass@host/db
NODE_ENV=production
API_KEY="value with spaces"
SECRET='another value'
```

**Merge order** (later wins): `--env-file` → `--env`. Inline `--env` pairs always override file values. For `redeploy`, existing deployment env vars are the base.

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Install NEXUS AI CLI
        run: npm install -g nexusapp-cli@latest

      - name: Deploy
        run: nexus deploy redeploy ${{ secrets.NEXUSAI_DEPLOYMENT_ID }} --yes
        env:
          NEXUSAI_TOKEN: ${{ secrets.NEXUSAI_TOKEN }}
```

Add `NEXUSAI_TOKEN` and `NEXUSAI_DEPLOYMENT_ID` as repository secrets in GitHub → Settings → Secrets.

Get your deployment ID from:

```bash
nexus deploy list --json | grep '"id"'
# or
nexus deploy status my-app --json | grep '"id"'
```

---

## Global Flags

These flags work on any command:

| Flag | Description |
|---|---|
| `--json` | Output raw JSON instead of formatted tables |
| `--yes` | Skip confirmation prompts |
| `--wait` | Block until the deployment reaches a terminal state (`RUNNING`, `FAILED`, or `STOPPED`) |
| `--watch` | Refresh status output every 3 seconds |

---

## Common Workflows

### First deploy

```bash
npm install -g nexusapp-cli@latest
nexus auth login
nexus deploy source \
  --repo https://github.com/you/app \
  --name my-app \
  --provider gcp_cloud_run \
  --env-file .env.production \
  --wait
```

### Set secrets then redeploy

```bash
nexus secret create --name DATABASE_URL --environment PRODUCTION
nexus secret create --name STRIPE_KEY --environment PRODUCTION
nexus deploy redeploy my-app --yes
```

### Rollback a bad release

```bash
nexus deploy rollback my-app --yes
nexus deploy status my-app --watch
```

### Full stack with a database and a bucket

```bash
nexus managed-db create shop --local --engine postgres
nexus bucket create user-uploads
nexus deploy source --repo https://github.com/you/app --name my-app --provider docker --wait
nexus managed-db attach shop --deployment my-app
nexus bucket attach <bucket-id> <deployment-id>
nexus deploy redeploy my-app --wait
nexus managed-db query shop "SELECT 1"
```

### Add a custom domain

```bash
nexus domain add my-app app.example.com
# Point a CNAME at the deployment URL shown
nexus domain list my-app                    # find the domain ID
nexus domain verify my-app <domain-id>
```

---

## Links

- Dashboard: [nexusai.run](https://nexusai.run)
- Docs: [nexusai.run/docs](https://nexusai.run/docs)
- Full CLI reference: [`wiki/CLI.md`](../wiki/CLI.md)
- Support: [support@nexusai.run](mailto:support@nexusai.run)
