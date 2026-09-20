# Versioning and Rollbacks

NEXUS AI keeps version history at two levels:

1. **Builder checkpoints** preserve source files during AI-assisted development.
2. **Deployment releases** preserve deployable runtime versions for rollback.

Database contents, volumes, buckets, and external services have separate lifecycles and are not automatically rewound by a code rollback.

## Builder checkpoints

The AI App Builder creates a checkpoint after each file-changing assistant turn and each saved manual edit.

- A checkpoint contains the complete current file set.
- Restoring an old checkpoint creates a new checkpoint.
- History is not destructively rewritten.
- Deploying does not close the builder session.

Use builder history when the source or UI changed during a conversation but has not necessarily been released.

## Deployment releases

A deployment release records the image/source result and deployment configuration used for a rollout. New releases are created by deploy, redeploy, GitHub auto-deploy, and Builder deployment workflows.

Inspect the deployment in the dashboard or CLI:

```bash
nexus deploy get app
nexus deploy status app
```

## Roll back

### Dashboard

Open a deployment, inspect its history, choose the intended healthy release, and confirm rollback.

### CLI

```bash
# Roll back to the previous eligible release
nexus deploy rollback app

# Skip the interactive confirmation in controlled automation
nexus deploy rollback app --yes
```

Use `nexus deploy rollback --help` for target-release options supported by the installed CLI.

### MCP

An agent can call `nexusai_deploy_rollback` with `deployments:create`. The client should show the target deployment and require confirmation before changing production.

## What rollback changes

A rollback restores a prior application release through the deployment pipeline. It can restore application code/image and associated release configuration supported by the provider.

It does **not** automatically:

- reverse database migrations;
- restore database rows;
- restore deleted bucket objects;
- rewind filesystem volume contents;
- revoke or restore external credentials;
- undo actions performed by the application against third-party systems.

Secrets are resolved from the current organization/environment configuration during deployment operations. Do not assume an old image receives an old secret value.

## Safe database change pattern

Before a risky migration:

```bash
nexus db services app
nexus db backup <service-id>
nexus db backups <service-id>
```

Then deploy, validate health and logs, and recover deliberately if necessary:

```bash
nexus deploy logs app --follow
nexus db restore <service-id> <backup-id> --yes
nexus deploy rollback app --yes
```

The order depends on migration compatibility. Prefer expand/contract migrations so both old and new application versions can run during rollback.

## Stop/start is not rollback

```bash
nexus deploy stop app
nexus deploy start app
```

Stop/start preserves the same deployment configuration and does not rebuild source. Use it for operational pause/resume. Use redeploy for a fresh rollout and rollback for a prior release.

## Redeploy is not a new environment

```bash
nexus deploy redeploy app --wait
```

Redeploy retains the deployment identity and URL where supported. It applies current source/configuration and attachment state. Use separate projects or deployments for development, staging, and production instead of repeatedly repurposing one deployment.

## GitHub releases

GitHub auto-deploy creates a new release for an accepted push. The dashboard records commit/branch context for GitHub-triggered deployments. Rolling back the runtime does not revert the Git branch; fix or revert the repository so the next auto-deploy does not reintroduce the problem.

## Storage and service considerations

- **Volumes:** persist independently from an app release; rollback does not restore files.
- **Buckets:** object state persists independently; use application-level object versioning/backup where needed.
- **Database sidecars:** data persists independently; use database backups.
- **Standalone managed databases:** use snapshots and non-destructive restore-to-new-database workflows.
- **External databases:** use the provider's backup and recovery controls.

## Recommended release process

1. Deploy and test in staging.
2. Back up stateful services.
3. Use backward-compatible schema migrations.
4. Release to production.
5. Check health, logs, and critical user flows.
6. Keep the previous release eligible for rollback.
7. Roll back code only after deciding how to handle state changes.
8. Reconcile the Git branch after an emergency rollback.

## Auto-destroy and deletion

Auto-destroy removes an ephemeral deployment at its scheduled time; it is not rollback. Deployment deletion is also not rollback and may make the runtime unavailable immediately. Confirm attached databases and storage before deletion.

## Troubleshooting

### No rollback target is available

The deployment may not have an earlier eligible release, or the provider may no longer have the required artifact. Check deployment history and build logs.

### Rollback succeeds but the app still fails

Check current secrets, database schema compatibility, external dependencies, health port, and runtime logs. The failure may be outside the application image.

### Auto-deploy immediately replaces the rollback

Revert or fix the source branch, or disable the binding temporarily while the incident is contained.

## Related pages

- [AI App Builder and Application Generation](Application-Generation-Engine)
- [Databases, Backups, and Storage](Databases-and-Storage)
- [GitHub Deployments](GitHub-Deployments)
- [Secrets Vault](Secrets-Vault)
