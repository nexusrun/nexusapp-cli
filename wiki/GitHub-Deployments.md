# GitHub Deployments

The NEXUS AI GitHub App connects repositories to projects and can deploy approved branches automatically after a push. The same integration also lets the AI App Builder push its current snapshot to GitHub.

## Connect the GitHub App

1. Open **GitHub** in the NEXUS AI dashboard.
2. Select **Connect GitHub**.
3. Choose a GitHub account or organization.
4. Grant access to all repositories or selected repositories.
5. Return to NEXUS AI and confirm the installation appears.

Grant the narrowest repository set that supports the intended workflow.

## Create a repository binding

1. Open **GitHub → Repo Bindings**.
2. Load repositories from an installation.
3. Select the repository and default branch.
4. Set the allowed branches.
5. Choose the runtime provider, build mode, service port, and optional subdomain.
6. Enable auto-deploy if pushes should create deployments automatically.
7. Save the binding.

A repository binding is organization scoped. The platform checks the binding and branch allowlist before acting on a webhook.

## Auto-deploy flow

```text
GitHub push
  -> webhook signature verification
  -> repository binding lookup
  -> branch allowlist and auto-deploy checks
  -> deployment queued
  -> build and runtime provisioning
  -> status becomes healthy or failed
```

Use **GitHub Deployments** to inspect commit, branch, actor, deployment state, and runtime URL. Use **Webhook Deliveries** to inspect GitHub delivery IDs and processing results.

## Manual deployment

A binding can remain manual. Trigger a deployment from the dashboard or the REST API when you are ready:

```bash
curl -s -X POST "$NEXUS_API_BASE/github/bindings/<bindingId>/deploy" \
  -H "Authorization: Bearer $NEXUS_JWT" \
  -H "Content-Type: application/json" \
  -d '{"branch":"main"}'
```

## Builder push to GitHub

The AI App Builder can push its complete current snapshot:

1. Open the builder session.
2. Select **Push to GitHub**.
3. Choose a connected installation.
4. Select an existing repository or create a permitted organization repository.
5. Push the snapshot.

Each push creates a commit reflecting the current file set, including deleted files. Creating a new repository requires GitHub administration permission; writing files requires contents permission. Personal-account repository creation is not available in every GitHub App installation-token flow.

## Permissions

GitHub installation permissions and NEXUS AI roles both apply. In general:

- Owners and Admins can connect installations and manage bindings.
- Developers can use repositories and deployments permitted by the organization role model.
- GitHub itself must grant the installation access to the target repository.

If a repository is missing, check the GitHub App installation settings before reconnecting the integration.

## Troubleshooting

### Installation returns 404

Confirm the configured GitHub App slug and installation URL. An App display name is not always the same as its slug.

### Installation completed but NEXUS AI did not update

Check the callback URL, signed-in NEXUS AI organization, and whether the installation was created under the expected GitHub account.

### Webhook arrives but no deployment starts

Check:

- webhook signature verification;
- repository binding state;
- exact branch name and branch allowlist;
- auto-deploy setting;
- repository installation access;
- deployment quota and provider configuration;
- the delivery result shown in the dashboard.

### Builder cannot create a repository

Use an existing repository or install the GitHub App on an organization with repository administration permission.

## Related pages

- [AI App Builder and Application Generation](Application-Generation-Engine)
- [Deployment and Cloud Providers](Deployment-and-Cloud-Providers)
- [Versioning and Rollbacks](Versioning-and-Rollbacks)
