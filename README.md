nexusapp-cli# NEXUS AI CLI

Deploy, manage, and monitor cloud applications from the terminal.

```
npm install -g @nexusapp-cli
nexus login
nexus deploy source --repo https://github.com/you/app --name my-app --provider gcp_cloud_run
```

## Installation

```bash
npm install -g @nexusapp-cli
```

Requires Node.js 18 or later.

## Authentication

### Browser login (default)

```bash
nexus login
```

Opens a browser window to complete OAuth. The token is saved to `~/.nexusai/config.json` and reused automatically.

### Token-based login (CI/CD)

Set `NEXUSAI_TOKEN` in the environment — the CLI picks it up automatically without requiring `nexus login`.

```bash
export NEXUSAI_TOKEN=your-api-token
nexus deploy list
```

### Other auth commands

```bash
nexus whoami          # show current user and org
nexus logout          # clear saved credentials
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `NEXUSAI_TOKEN` | API token. Set this in CI/CD instead of running `nexus login`. |
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

Detects the runtime from your repo automatically — no Dockerfile required.

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

Deploys [Flixty](https://github.com/nexusrun/flixty) — a self-hosted social media creator studio for X, LinkedIn, Facebook, Instagram, TikTok, and YouTube. Session secret is auto-generated.

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
| `--base-url` | Public URL — required for OAuth redirect URIs. Set after first deploy if not known yet. |
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
# List custom domains for a deployment
nexus domain list my-app

# Add a custom domain
nexus domain add my-app --domain app.example.com

# Check verification status
nexus domain verify my-app --domain app.example.com

# Remove a domain
nexus domain remove my-app --domain app.example.com --yes
```

After adding a domain, point a CNAME record at the deployment URL shown in `nexus deploy status`, then run `nexus domain verify` to confirm.

---

### `nexus project`

```bash
nexus project list
nexus project create --name my-project
nexus project delete <id>
```

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
        run: npm install -g @nexusapp-cli

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
npm install -g @nexusapp-cli
nexus login
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

### Add a custom domain

```bash
nexus domain add my-app --domain app.example.com
# → Point CNAME at the deployment URL shown
nexus domain verify my-app --domain app.example.com
```

---

## Links

- Dashboard: [nexusai.run](https://nexusai.run)
- Docs: [nexusai.run/docs](https://nexusai.run/docs)
- Support: [support@nexusai.run](mailto:support@nexusai.run)
