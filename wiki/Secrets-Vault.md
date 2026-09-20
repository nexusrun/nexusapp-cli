# Secrets Vault

The Secrets Vault stores organization-scoped sensitive configuration and injects it into deployments without committing credentials to source code or container images.

## What belongs in the vault

- database connection strings and passwords;
- API and OAuth client secrets;
- private repository tokens;
- signing and encryption keys;
- webhook secrets;
- SMTP credentials;
- third-party service credentials.

Ordinary non-sensitive settings can remain deployment environment variables. Treat any value that grants access or reveals customer data as a secret.

## Encryption and access

Secrets are encrypted at rest with AES-256-GCM and decrypted only for authorized workflows. Values are not returned by normal list operations. Access is constrained by organization membership, role permissions, environment, and token/OAuth scope.

Self-hosted operators must keep the platform encryption key stable and protected. Changing it without a migration makes existing encrypted credentials unreadable.

## Create a secret

### Dashboard

1. Open **Secrets**.
2. Select **Add Secret**.
3. Enter a name, value, and environment.
4. Save, then redeploy workloads that need the new value.

### CLI

Interactive input keeps the value out of shell history:

```bash
nexus secret create --name DATABASE_URL --environment PRODUCTION
```

Inline values are supported but can remain in shell history and process inspection:

```bash
nexus secret create \
  --name API_KEY \
  --environment PRODUCTION \
  --value "$API_KEY"
```

### MCP

Use `nexusai_secrets_create` with `secrets:manage`. MCP clients should confirm sensitive mutations and avoid echoing values into chat transcripts.

## Environment scoping

Secret environments are `DEVELOPMENT`, `STAGING`, and `PRODUCTION`. The deployment receives values for its selected environment.

Use separate credentials per environment. Do not copy production keys into development merely for convenience.

## Runtime injection

Secrets become environment variables when a deployment is created or redeployed. They are not written into the source archive or built image.

After creating, updating, or deleting a secret, redeploy affected workloads:

```bash
nexus deploy redeploy app --wait
```

Existing running containers do not automatically refresh process environment variables.

## List, update, and delete

```bash
nexus secret list
nexus secret list --environment PRODUCTION
nexus secret update <secret-id>
nexus secret delete <secret-id> --yes
```

List results show metadata, not plaintext values. Deleting a vault entry does not remove a value already present in a running process; redeploy or restart with a new release.

## Rotation workflow

Use overlap when the external service allows more than one credential:

1. create a new credential at the provider;
2. update the NEXUS AI secret;
3. redeploy every dependent workload;
4. verify health and logs;
5. revoke the old provider credential;
6. record the rotation in the change process.

If the provider supports only one active credential, schedule a maintenance window and prepare rollback steps.

## AI provider credentials

AI provider keys are managed through **AI Providers**, not ordinary deployment secrets. They use encrypted storage and are selected by builder and generation workflows. Exact provider/model availability is shown in the dashboard.

## Storage and database credentials

NEXUS AI may generate credentials for database services, managed databases, or S3-compatible buckets. Use the resource-specific connection/credential actions to retrieve or rotate them. Those sensitive reads are separate from the general Secrets Vault and are audit logged.

After bucket credential rotation, redeploy every attached application so the new `S3_*` values take effect.

## Access tokens are not secrets entries

`nxk_...` access tokens are created under **Access Tokens** or `nexus token`. They have explicit scopes and revocation. Store a token securely after creation because the full value is not shown again.

```bash
nexus token list
nexus token create
nexus token revoke <token-id>
```

## Logging and audit guidance

- Avoid printing process environments.
- Redact authorization headers and connection URLs.
- Do not paste secrets into AI prompts, support tickets, issue trackers, or Git history.
- Review audit logs after sensitive reads, writes, deletes, and rotations.
- Use distinct credentials for each application or integration where possible.

Application code can still log a secret accidentally. The vault reduces exposure but cannot correct unsafe logging inside the application.

## CI/CD

Keep CI credentials in the CI provider's secret store:

```yaml
env:
  NEXUSAI_TOKEN: ${{ secrets.NEXUSAI_TOKEN }}
```

Use a narrowly scoped NEXUS AI token and rotate it independently from user credentials. Never commit `.env` files containing live values.

## Incident response

If a secret may be exposed:

1. revoke or rotate it at the upstream provider first;
2. update the NEXUS AI secret;
3. redeploy affected workloads;
4. revoke related access tokens or sessions;
5. inspect audit, build, runtime, and provider logs;
6. remove the value from Git history, tickets, or artifacts where possible;
7. document affected systems and the containment time.

## Related pages

- [Deployment and Cloud Providers](Deployment-and-Cloud-Providers)
- [Databases, Backups, and Storage](Databases-and-Storage)
- [MCP and REST API](MCP-and-API)
- [FAQ](FAQ)
