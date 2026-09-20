# NEXUS AI CLI Reference

The `nexus` CLI deploys and operates NEXUS AI resources from a terminal or CI system. This page documents CLI 4.1.8. Run `nexus --help` and `nexus <command> --help` for the exact syntax installed on your machine.

## Installation

```bash
# macOS
curl -fsSL https://nexusai.run/install-mac.sh | bash

# Linux
curl -fsSL https://nexusai.run/install.sh | bash

# npm (Node.js 18+)
npm install -g nexusapp-cli@latest
```

```bash
nexus --version
nexus --help
```

## Authentication and configuration

```bash
nexus auth login
nexus auth whoami
nexus auth logout
```

Browser login stores configuration in `~/.nexusai/config.json` with restricted file permissions.

| Environment variable | Purpose |
|---|---|
| `NEXUSAI_TOKEN` | Scoped access token; overrides the saved token |
| `NEXUSAI_API_URL` | API origin override; defaults to `https://nexusai.run` |

For CI:

```bash
export NEXUSAI_TOKEN="nxk_..."
export NEXUSAI_API_URL="https://nexusai.run"
nexus auth whoami
```

Never print a token or commit it to source control.

## Command map

```text
nexus auth          Authentication
nexus deploy        Deployment lifecycle
nexus secret        Secrets Vault
nexus project       Projects
nexus domain        Custom domains
nexus token         Access tokens
nexus member        Organization members
nexus db            Deployment database services and backups
nexus managed-db    Standalone local/cloud databases
nexus volume        Persistent filesystem volumes
nexus bucket        S3-compatible buckets and objects
nexus exec          Execute in a running docker deployment
nexus cp            Copy one file to/from a running docker deployment
```

Most read/list commands support `--json` for automation.

## Deployment commands

### List and inspect

```bash
nexus deploy list
nexus deploy list --status RUNNING
nexus deploy list --project <project-id>
nexus deploy get <name-or-id>
nexus deploy status <name-or-id>
nexus deploy status <name-or-id> --watch
```

Deployment names and IDs are accepted where the command says `<name-or-id>`. Use IDs in automation when names may be ambiguous.

### Deploy an image

```bash
nexus deploy create \
  --image nginx:latest \
  --port 80 \
  --name web \
  --provider docker
```

Provider values:

```text
docker
gcp_cloud_run
aws_ecs_fargate
azure_container_apps
```

### Deploy source

```bash
nexus deploy source \
  --repo https://github.com/you/app.git \
  --name app \
  --branch main \
  --provider docker \
  --environment PRODUCTION \
  --wait
```

Important options:

| Option | Purpose |
|---|---|
| `--project <id>` | Deploy into a specific project |
| `--region <region>` | Select the cloud region |
| `--env KEY=VALUE` | Add environment variables |
| `--env-file <file>` | Load dotenv-style variables |
| `--framework <name>` | Supply a framework hint |
| `--install-command <cmd>` | Override dependency installation |
| `--build-command <cmd>` | Override build |
| `--start-command <cmd>` | Override runtime start |
| `--output-dir <dir>` | Set build output directory |
| `--dockerfile <value>` | Repo path, local file, URL, or inline Dockerfile |
| `--repo-secret <name>` | Secret containing a private-repo token |
| `--auto-destroy <hours>` | Schedule cleanup for an ephemeral deploy |
| `--services <types>` | Comma-separated database/cache services |
| `--create-db <engine>` | Create one Postgres/MySQL database |
| `--managed-db <id>` | Attach an existing managed database |
| `--db-version`, `--db-region` | Managed database options |
| `--worker-command <cmd>` | Run a background worker sidecar |
| `--worker-name <name>` | Name the worker service |
| `--no-health-check` | Disable HTTP health checking intentionally |
| `--wait` | Wait for `RUNNING` or `FAILED` |

Full-stack `docker` example:

```bash
nexus deploy source \
  --repo https://github.com/you/app.git \
  --name app \
  --provider docker \
  --services postgresql,redis \
  --worker-command "npm run worker" \
  --wait
```

Cloud app with managed Postgres:

```bash
nexus deploy source \
  --repo https://github.com/you/app.git \
  --name app \
  --provider gcp_cloud_run \
  --region us-central1 \
  --create-db postgres \
  --wait
```

### Logs and health

```bash
nexus deploy logs app
nexus deploy logs app --type build --lines 200
nexus deploy logs app --follow
nexus deploy status app --watch
```

### Redeploy and rollback

```bash
nexus deploy redeploy app --wait
nexus deploy rollback app
nexus deploy rollback app --target <deployment-id> --yes
```

### Scale, stop, start, and delete

```bash
nexus deploy scale app 3
nexus deploy stop app
nexus deploy start app
nexus deploy delete app --yes
```

Replica range and provider support are validated by the API.

### Auto-destroy

```bash
nexus deploy auto-destroy app --in 4h
nexus deploy auto-destroy app --at 2026-12-01T04:00:00Z
nexus deploy auto-destroy app --off
```

Changing auto-destroy does not restart the deployment.

### Packaged deployments

The CLI includes guided commands for OpenClaw and Flixty:

```bash
nexus deploy openclaw --help
nexus deploy flixty --help
```

Review every generated secret and OAuth callback URL before using these in production.

## Secrets

```bash
nexus secret list
nexus secret list --environment PRODUCTION
nexus secret create --name DATABASE_URL --environment PRODUCTION
nexus secret update <secret-id>
nexus secret delete <secret-id> --yes
```

Interactive entry is preferred. `--value` is available but can expose a value through shell history.

## Projects

```bash
nexus project list
nexus project create --name "Production API"
nexus project delete <project-id> --yes
```

Use different project IDs for independently deployed environments of the same repository.

## Custom domains

```bash
nexus domain list app
nexus domain add app api.example.com
nexus domain verify app <domain-id>
nexus domain remove app <domain-id>
```

Use the domain ID returned by list/add. Apply exactly the DNS records shown by the platform.

## Access tokens

```bash
nexus token list
nexus token create
nexus token revoke <token-id>
```

Create the smallest scope set needed. The token value is sensitive and may only be displayed at creation.

## Team members

```bash
nexus member list
nexus member invite developer@example.com --role MEMBER
nexus member role <user-id> MEMBER
nexus member suspend <user-id>
nexus member activate <user-id>
```

Role changes require organization permissions. CLI roles are `ADMIN`, `MEMBER` (shown as Developer), `DEPLOYMENT_MANAGER`, `AUDITOR`, and `BILLING_MANAGER`; ownership transfer is not performed by this command.

## Deployment database services and backups

```bash
nexus db services
nexus db services app
nexus db backup <service-id>
nexus db backups <service-id>
nexus db backup-download <service-id> <backup-id> --out ./backup.dump
nexus db backup-upload <service-id> ./backup.dump
nexus db restore <service-id> <backup-id> --yes
nexus db restore-to <target-service-id> <backup-id> --yes
nexus db backup-delete <service-id> <backup-id> --yes
```

Daily backups:

```bash
nexus db backup-schedule <service-id> --enable --retention 7
nexus db backup-schedule <service-id> --disable
```

Restore in place is destructive. `restore-to` requires a compatible engine in the same organization.

## Standalone managed databases

### List and create

```bash
nexus managed-db list

# Local Postgres
nexus managed-db create app-db \
  --local \
  --engine postgres \
  --db-name appdb \
  --password-stdin

# Cloud managed database
nexus managed-db create app-db \
  --provider GCP_CLOUD_SQL \
  --engine postgres \
  --engine-version 17.10 \
  --region us-central1 \
  --instance-class db-custom-1-3840 \
  --allocated-gb 20
```

Cloud provider values are `AWS_RDS`, `GCP_CLOUD_SQL`, and `AZURE_DATABASE`. Supported engines and versions depend on provider.

### Connect and attach

```bash
nexus managed-db connection app-db
nexus managed-db attach app-db --deployment <name-or-id>
nexus managed-db detach app-db --deployment <name-or-id>
```

Redeploy after changing an attachment.

### Query and snapshots

```bash
nexus managed-db query app-db "SELECT now()"
nexus managed-db snapshot app-db
nexus managed-db snapshots app-db
nexus managed-db restore app-db \
  --snapshot <snapshot-id> \
  --new-name restored-app-db
```

Restore creates a new database. Delete is destructive:

```bash
nexus managed-db delete app-db
# Required only when the database is still attached:
nexus managed-db delete app-db --force
```

## Volumes

```bash
nexus volume list
nexus volume create app-data --display-name "App data"
nexus volume attach <volume-id> <deployment-id> --mount /data
nexus deploy redeploy <deployment-id> --wait
nexus volume refresh-usage <volume-id>
nexus volume detach <volume-id>
nexus volume delete <volume-id> --yes
```

Volumes must be detached before deletion. Attach/detach takes effect after redeploy.

## Buckets

```bash
nexus bucket list
nexus bucket create user-uploads --display-name "User uploads"
nexus bucket attach <bucket-id> <deployment-id>
nexus deploy redeploy <deployment-id> --wait
nexus bucket refresh-usage <bucket-id>
nexus bucket credentials <bucket-id>
nexus bucket rotate-credentials <bucket-id> --yes
nexus bucket detach <bucket-id> <deployment-id>
nexus bucket delete <bucket-id> --yes
```

Objects:

```bash
nexus bucket files <bucket-id> --prefix uploads/
nexus bucket upload <bucket-id> ./report.pdf --key reports/report.pdf
nexus bucket download <bucket-id> reports/report.pdf --out ./report.pdf
nexus bucket rm <bucket-id> reports/report.pdf --yes
```

Bucket deletion removes all objects and requires detachment first.

## Execute and copy

Available only for running `docker` deployments:

```bash
nexus exec <deployment-id> -- ls -la /app
nexus cp ./index.html <deployment-id>:/app/public/index.html
nexus cp <deployment-id>:/app/config.json ./config.json
```

`exec` is non-interactive and output is capped. `cp` copies one file. Runtime edits do not survive image replacement.

## CI/CD example

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g nexusapp-cli@latest
      - name: Deploy
        env:
          NEXUSAI_TOKEN: ${{ secrets.NEXUSAI_TOKEN }}
        run: |
          nexus deploy source \
            --repo "https://github.com/${{ github.repository }}.git" \
            --branch "${{ github.ref_name }}" \
            --name app-production \
            --environment PRODUCTION \
            --wait
```

Use a dedicated scoped token, pin versions when reproducibility matters, and avoid putting application secrets on the command line.

## Exit codes and scripting

- A successful command exits `0`.
- Validation, authentication, API, or failed wait operations exit non-zero.
- Use `--json` where available instead of parsing tables.
- Use `--yes` only after resolving the exact resource ID.

## Troubleshooting

### Not logged in

```bash
nexus auth login
# or
export NEXUSAI_TOKEN="nxk_..."
```

### Wrong API origin

```bash
export NEXUSAI_API_URL="https://nexusai.run"
```

### Deployment not found

```bash
nexus deploy list --json
```

Confirm organization, project, exact name, and ID.

### Forbidden

Check organization role, access-token scopes, plan availability, and resource ownership.

### App never becomes healthy

Check build/runtime logs, `0.0.0.0` binding, service port, startup duration, required secrets, and dependency connectivity.

## Related pages

- [Quick Start](Quick-Start)
- [Deployment and Cloud Providers](Deployment-and-Cloud-Providers)
- [Databases, Backups, and Storage](Databases-and-Storage)
- [Secrets Vault](Secrets-Vault)
