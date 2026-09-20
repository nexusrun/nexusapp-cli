# Deployment and Cloud Providers

NEXUS AI uses one deployment model across the dashboard, CLI, REST API, and MCP. A deployment can start from source code, an existing image, an AI Builder snapshot, or a GitHub binding.

## Deployment inputs

### Git source

NEXUS AI clones the repository and branch, detects or accepts build settings, builds a container image, and deploys it.

```bash
nexus deploy source \
  --repo https://github.com/you/app.git \
  --branch main \
  --name app \
  --provider docker \
  --wait
```

Private repositories use a stored secret through `--repo-secret`; do not place a token in the repository URL.

### Container image

```bash
nexus deploy create \
  --image nginx:latest \
  --port 80 \
  --name web \
  --provider docker
```

The platform validates allowed images and Dockerfile behavior before deployment.

### Local source and AI-generated source

The dashboard supports uploaded local source, one-shot prompt deployment, and AI Builder deployment. All use the same build and runtime lifecycle after source is accepted.

## Provider matrix

| Provider value | Runtime | Typical use |
|---|---|---|
| `docker` | NEXUS AI container runtime | Full-stack apps, sidecar databases, Redis, workers, volumes, and buckets |
| `gcp_cloud_run` | Google Cloud Run | Managed single-container app; optional supported managed DB |
| `aws_ecs_fargate` | AWS App Runner implementation | Managed single-container app; optional supported managed DB |
| `azure_container_apps` | Azure Container Apps | Managed single-container app; optional supported managed DB |

The AWS CLI identifier is retained for compatibility even though the current deployment implementation targets App Runner.

Provider availability and allowed regions depend on plan and organization configuration.

## NEXUS AI container runtime

Use `docker` when the application needs a locally orchestrated full stack:

- PostgreSQL, MySQL, MongoDB, or Redis sidecars;
- a background worker process;
- persistent filesystem volumes;
- S3-compatible object-storage buckets;
- container-level `exec` and single-file `cp` operations;
- service-to-service networking through internal hostnames.

Example:

```bash
nexus deploy source \
  --repo https://github.com/you/app.git \
  --name app \
  --provider docker \
  --services postgresql,redis \
  --worker-command "npm run worker" \
  --wait
```

## Cloud provider targets

Cloud Run, App Runner, and Container Apps are single-container runtimes. Compose-style sidecars and locally mounted NEXUS AI volumes are not available there.

For a cloud deployment that needs a database, create or attach a supported managed database:

```bash
nexus deploy source \
  --repo https://github.com/you/app.git \
  --name app \
  --provider gcp_cloud_run \
  --region us-central1 \
  --create-db postgres \
  --wait
```

Or attach an existing managed database:

```bash
nexus deploy source \
  --repo https://github.com/you/app.git \
  --name app \
  --provider gcp_cloud_run \
  --managed-db <database-id> \
  --wait
```

Supported managed offerings include NEXUS AI local databases plus provider-backed AWS RDS, Google Cloud SQL, and Azure database services where configured.

## Build configuration

Framework detection covers common Node.js, Python, Go, Ruby, PHP, Java, and static-web patterns. Override detection with:

- `--framework`;
- `--install-command`;
- `--build-command`;
- `--start-command`;
- `--output-dir`;
- `--dockerfile`.

`--dockerfile` accepts a repository-relative path, local file, URL, or inline content. Keep the build context small with `.dockerignore`.

## Ports and health

- Bind the process to `0.0.0.0`.
- Use the platform `PORT` value or ensure the configured service port matches.
- A successful build does not guarantee a healthy runtime.
- Long migrations or blocking startup work can cause health timeouts.
- Use `--no-health-check` only when the workload intentionally has no HTTP service.

```bash
nexus deploy status app
nexus deploy logs app --type build --lines 200
nexus deploy logs app --follow
```

## Environments and configuration

Deployments use `DEVELOPMENT`, `STAGING`, or `PRODUCTION`. Use separate projects or deployment names for independently managed environments.

```bash
nexus deploy source \
  --repo https://github.com/you/app.git \
  --project <production-project-id> \
  --environment PRODUCTION \
  --env-file .env.production \
  --wait
```

Do not commit production secrets to an env file. Use the Secrets Vault for long-lived credentials.

## Lifecycle operations

```bash
nexus deploy get app
nexus deploy status app --watch
nexus deploy logs app --follow
nexus deploy scale app 3
nexus deploy stop app
nexus deploy start app
nexus deploy redeploy app --wait
nexus deploy rollback app
nexus deploy delete app --yes
```

Stop and start preserve deployment configuration. Delete removes the deployment and can affect provider resources. Database, volume, and bucket lifecycle rules are separate; inspect attachments and backups before deleting a production stack.

## Auto-destroy previews

Create an ephemeral environment:

```bash
nexus deploy source \
  --repo https://github.com/you/app.git \
  --branch feature/demo \
  --auto-destroy 4 \
  --wait
```

Change or remove the schedule with `nexus deploy auto-destroy`; check the installed command help for accepted duration and timestamp forms.

## Custom domains

```bash
nexus domain add app api.example.com
nexus domain list app
nexus domain verify app <domain-id>
nexus domain remove app <domain-id>
```

Follow the DNS values returned by the platform. Keep proxying disabled while a provider requires direct ownership or TLS verification. DNS and certificate issuance can remain pending after the application itself is healthy.

## Container access

`nexus exec` and `nexus cp` are available only for running `docker` deployments:

```bash
nexus exec <deployment-id> -- ls -la /app
nexus cp ./index.html <deployment-id>:/app/public/index.html
nexus cp <deployment-id>:/app/config.json ./config.json
```

Copied files change the running container, not the immutable release. They can disappear after redeploy or rollback; commit durable fixes to source.

## Related pages

- [Quick Start](Quick-Start)
- [GitHub Deployments](GitHub-Deployments)
- [Databases, Backups, and Storage](Databases-and-Storage)
- [Versioning and Rollbacks](Versioning-and-Rollbacks)
- [CLI Reference](CLI)
