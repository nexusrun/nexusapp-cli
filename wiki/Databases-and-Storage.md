# Databases, Backups, and Storage

NEXUS AI supports deployment-attached database services, standalone managed databases, external database connections, persistent filesystem volumes, and S3-compatible buckets. These are separate resource types with different lifecycle rules.

## Choose the right resource

| Resource | Use it when |
|---|---|
| Deployment service | The database or cache should be provisioned beside a `docker` deployment |
| Standalone managed database | Several deployments need a separately managed database, or a cloud provider database is required |
| External DB source | You already have PostgreSQL/Supabase or another supported external database and want safe query/schema tools |
| Volume | The app needs a persistent filesystem path such as `/data` |
| Bucket | The app uses object keys and an S3-compatible SDK |

## Deployment-attached services

Create services with a source deployment:

```bash
nexus deploy source \
  --repo https://github.com/you/app.git \
  --provider docker \
  --services postgresql,redis \
  --wait
```

Supported sidecar types and conventional internal ports:

| Service | Internal hostname | Port |
|---|---|---:|
| PostgreSQL | `postgresql` | 5432 |
| MySQL | `mysql` | 3306 |
| MongoDB | `mongodb` | 27017 |
| Redis | `redis` | 6379 |

NEXUS AI injects connection variables into the app and any configured worker. Use internal hostnames for container-to-service traffic, not published host ports.

Discover services later with:

```bash
nexus db services
nexus db services <deployment-name-or-id>
```

## Standalone databases

Standalone databases can be NEXUS AI local databases or provider-backed managed services where the organization has configured AWS, Google Cloud, or Azure.

```bash
nexus managed-db list
nexus managed-db create app-db --engine postgres --local
nexus managed-db connection app-db
nexus managed-db attach app-db --deployment <deployment-id>
nexus managed-db query app-db "SELECT now()"
```

Use `nexus managed-db create --help` for provider, engine, version, region, credential, and size options available in the installed CLI.

Attach/detach controls which deployment receives connection configuration. Redeploy after changing a database attachment.

## Full-stack cloud deployment

For Cloud Run, App Runner, or Container Apps, request a supported managed database:

```bash
nexus deploy source \
  --repo https://github.com/you/app.git \
  --provider gcp_cloud_run \
  --create-db postgres \
  --db-region us-central1 \
  --wait
```

`--services postgres` and `--create-db postgres` converge on a managed database for cloud providers. On `docker`, `--services` creates a sidecar.

## Database backups

Deployment-service backups support PostgreSQL, MySQL, MongoDB, and Redis using engine-appropriate tools. Backups are organization scoped and tracked separately from deployment releases.

```bash
nexus db services app
nexus db backup <service-id>
nexus db backups <service-id>
nexus db backup-download <service-id> <backup-id> --out ./backup.dump
```

Additional workflows:

```bash
# Upload an existing dump so NEXUS AI can restore it
nexus db backup-upload <service-id> ./backup.dump

# Restore in place (destructive to current data)
nexus db restore <service-id> <backup-id> --yes

# Restore into another compatible service in the same organization
nexus db restore-to <target-service-id> <backup-id> --yes

# Daily schedule
nexus db backup-schedule <service-id> --enable
```

Engines must match for cross-service restore. Create a fresh backup before migrations, and test restores rather than assuming a backup is usable.

Standalone databases use snapshot commands:

```bash
nexus managed-db snapshot app-db
nexus managed-db snapshots app-db
nexus managed-db restore app-db --snapshot <snapshot-id> --name restored-db
```

Standalone restore creates a new database instead of overwriting the source.

## External database connections

The dashboard and MCP API can register external database sources, inspect schema, preview SQL, execute approved queries, and propose database fixes from error logs.

For Supabase PostgreSQL, use the **Session Pooler** on port 5432. The username normally follows `postgres.<project-ref>` and SSL mode should be `require`.

Safety controls include:

- one SQL statement per request;
- read-only transactions for SELECT;
- statement timeouts and row caps;
- confirmation for data-changing queries;
- blocking dangerous operations such as `DROP DATABASE`, role creation, server-side program execution, or unbounded UPDATE/DELETE;
- audit records that avoid storing raw SQL where possible.

Schema-aware AI proposals must still be reviewed before apply.

## Persistent volumes

Volumes are organization-scoped filesystem storage attached to one deployment at a mount path.

```bash
nexus volume create app-data --display-name "App data"
nexus volume attach <volume-id> <deployment-id> --mount /data
nexus deploy redeploy <deployment-id> --wait
nexus volume refresh-usage <volume-id>
```

Key behavior:

- attach/detach requires redeployment to change the running container;
- data survives container replacement and deployment restart;
- a volume must be detached before deletion;
- multiple replicas should not assume a volume behaves like a distributed filesystem;
- use buckets for horizontally scaled shared object data.

## S3-compatible buckets

Buckets are organization-scoped object storage and can attach to multiple deployments.

```bash
nexus bucket create user-uploads
nexus bucket attach <bucket-id> <deployment-id>
nexus deploy redeploy <deployment-id> --wait
```

Manage objects:

```bash
nexus bucket files <bucket-id> --prefix uploads/
nexus bucket upload <bucket-id> ./report.pdf --key reports/report.pdf
nexus bucket download <bucket-id> reports/report.pdf --out ./report.pdf
nexus bucket rm <bucket-id> reports/report.pdf --yes
```

Retrieve or rotate scoped credentials:

```bash
nexus bucket credentials <bucket-id>
nexus bucket rotate-credentials <bucket-id> --yes
```

Credential reads and rotation are sensitive and audit logged. Redeploy every attached application after rotation so it receives the new `S3_*` variables.

## Deletion checklist

Before deleting a database, volume, bucket, or deployment:

1. list attachments and dependent deployments;
2. create and download a recent backup when data matters;
3. verify the restore procedure;
4. detach the resource where required;
5. understand whether provider-side resources will also be deleted;
6. use `--yes` only after confirming the resolved resource ID.

## Related pages

- [Deployment and Cloud Providers](Deployment-and-Cloud-Providers)
- [Secrets Vault](Secrets-Vault)
- [Versioning and Rollbacks](Versioning-and-Rollbacks)
- [CLI Reference](CLI)
- [MCP and REST API](MCP-and-API)
