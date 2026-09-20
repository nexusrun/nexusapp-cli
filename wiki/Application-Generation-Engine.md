# AI App Builder and Application Generation

The current NEXUS AI creation experience is the **AI App Builder**: a persistent conversation with a live preview, editable files, version checkpoints, GitHub handoff, and deployment. A one-shot **Deploy from Prompt** flow remains available for simple generation-and-deploy tasks.

## Choose the right workflow

| Workflow | Best for |
|---|---|
| AI App Builder | Iterative product work, visual review, direct edits, full-stack apps, and GitHub push |
| Deploy from Prompt | A small service or prototype that can be generated and deployed in one pass |
| Deploy from Git/local source | Existing applications where AI generation is unnecessary |
| MCP builder handoff | Generate files in ChatGPT, Claude, Cursor, or Codex and preview them in NEXUS AI before deployment |

## Start a builder session

1. Open a project.
2. Select **Build with AI**.
3. Choose a configured AI provider.
4. Describe the application in the chat panel.
5. Review the generated files and live preview.
6. Continue the conversation until the application is ready.

Builder sessions are persistent. Each assistant turn stores a complete snapshot of the files.

## Live preview security and behavior

The React preview runs locally in the browser:

- files are bundled with `esbuild-wasm`;
- the app renders inside a sandboxed iframe;
- the iframe allows scripts but does not receive same-origin access;
- generated code cannot read the NEXUS AI session or local storage;
- previewing does not provision infrastructure.

React single-page apps preview directly. Full-stack Next.js + Prisma apps use a mock-data implementation in preview because the browser sandbox does not connect to a production database. Deployment provisions and connects the real database.

## Edit and iterate

You can change an app four ways:

1. **Chat** — describe the change in plain language.
2. **Code panel** — edit and save a file directly.
3. **Image attachment** — paste or upload a PNG, JPEG, WebP, or GIF as a design reference or bug screenshot. Up to three images can be included in one message.
4. **Click-to-edit** — select an element in the preview, then describe the change. The builder sends a small element description rather than the entire page.

Images are resized in the browser before upload. The selected AI model receives the actual image as a vision input, not only its file name.

## Version checkpoints

- Every assistant response that changes files creates a checkpoint.
- Saving a manual code edit also creates a checkpoint.
- Restoring an earlier checkpoint creates a new checkpoint; it does not erase history.
- Deployment does not end the builder session. Continue iterating and redeploy when ready.

Builder checkpoints and deployment releases are related but distinct. Builder history tracks source snapshots; deployment rollback restores an earlier deployed release.

## Full-stack apps and authentication

The builder can create Next.js App Router + Prisma applications. When a full-stack build is deployed, NEXUS AI can provision managed Postgres and inject the database connection.

For built-in authentication, first generate the base app, then ask for login and signup as a follow-up. The builder can add a Prisma user model, password hashing, signed HTTP-only session cookies, and route guards. Review authentication and authorization code before production use.

## Self-healing preview and deployment

- Preview build failures can trigger up to two automatic AI repair attempts.
- Deployment status remains visible in the builder header.
- A failed deployment can be sent through **Fix with AI**.
- If a managed database already exists, the repair redeploy reuses it instead of creating a duplicate.

AI repair is a convenience, not a substitute for tests, security review, or a database backup before risky changes.

## Push to GitHub

1. Select **Push to GitHub** in the builder.
2. Connect the NEXUS AI GitHub App if necessary.
3. Choose an existing repository or create an allowed organization repository.
4. Push the current complete snapshot.

Each push creates a commit containing the current file set, including deletions. Repository creation and push depend on the permissions granted to the GitHub App. Installation tokens cannot create repositories in every personal-account configuration; use an existing repository or an organization installation when required.

## MCP handoff

An MCP-compatible agent can push an app into a project builder session:

```text
1. nexusai_projects_list
2. The agent generates files in chat or the IDE
3. nexusai_builder_push
4. Open the returned builder preview URL
5. Iterate in the builder
6. nexusai_builder_pull (optional, to return builder edits to the agent)
7. Deploy after review
```

`nexusai_builder_push` requires `deployments:create`; `nexusai_builder_pull` requires `deployments:read`.

## AI providers

The platform supports configured Anthropic, OpenAI, Google Gemini, xAI, Cohere, OpenRouter, managed, and compatible custom-provider paths. Exact models and plan availability change over time; use the **AI Providers** screen as the authoritative list for your organization.

Provider credentials are encrypted. A builder session requires an enabled provider, including sessions created through MCP handoff.

## Prompt guidance

Useful prompts describe:

- the user and primary workflow;
- pages, states, and navigation;
- data entities and relationships;
- authentication and permission rules;
- visual direction, including responsive behavior;
- required integrations;
- success and error states.

Example:

```text
Build a responsive customer-support portal with a dark blue visual system.
Users can sign up, create tickets, attach screenshots, and view ticket history.
Admins can assign tickets and change status. Use Next.js + Prisma and include
empty, loading, validation, and permission-denied states. Start with the base
app; we will add authentication in the next turn.
```

Prefer focused follow-ups over asking one model response to implement every feature at once.

## Production checklist

- Review all generated dependencies and code.
- Add automated tests for critical behavior.
- Verify authentication, authorization, and tenant boundaries.
- Keep credentials in the Secrets Vault.
- Confirm database migrations and backup strategy.
- Test health checks, startup time, and shutdown behavior.
- Review the public URL, custom domain, and TLS state.
- Check logs after the first production deployment.

## Related pages

- [Quick Start](Quick-Start)
- [Versioning and Rollbacks](Versioning-and-Rollbacks)
- [GitHub Deployments](GitHub-Deployments)
- [Secrets Vault](Secrets-Vault)
- [MCP and REST API](MCP-and-API)
