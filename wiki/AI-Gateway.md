# NEXUS AI Gateway

NEXUS AI Gateway places one compatible endpoint between applications and model providers. It centralizes credentials, model aliases, routing, retries, failover, caching, budgets, rate limits, policies, and request telemetry.

- [Product page](https://nexusai.run/ai-gateway)
- [Gateway repository](https://github.com/nexusrun/nexus_aigateway)
- [Gateway API documentation](https://github.com/nexusrun/nexus_aigateway/tree/main/docs)

## Why use a gateway

Without a gateway, each application implements provider credentials, SDK differences, retries, spend controls, and telemetry. With NEXUS AI Gateway, clients call one endpoint and infrastructure policy handles those concerns consistently.

## Compatibility

The gateway accepts:

- OpenAI-compatible requests under `/v1`;
- Anthropic-compatible messages under `/v1/messages`.

Official SDKs generally work by changing the base URL and supplying a gateway-issued key. Keep prompts and response parsing unchanged unless a selected provider does not support a requested feature.

## Providers and virtual models

Current provider paths include Anthropic, OpenAI, Google Gemini, xAI, OpenRouter, Amazon Bedrock, and custom or self-hosted OpenAI-compatible endpoints.

Applications can address a stable virtual model alias while routing decides which provider/model serves the request. This reduces provider-specific code and makes fallback configuration an infrastructure concern.

## Core controls

### Routing and failover

- ordered provider routes;
- retries and circuit-breaking behavior;
- model fallback;
- virtual model aliases;
- provider health visibility.

### Cost and performance

- response caching for repeat requests;
- token and estimated-cost tracking;
- cache-savings reporting;
- model selection policies;
- provider and route-level analytics.

### Budgets and rate limits

Limits can be applied by gateway key, user, team, model, or request path, including request, token, spend, and concurrency controls.

### Credential isolation

Provider API keys remain behind the gateway. Applications receive independently revocable gateway credentials, allowing provider credential rotation without redeploying every client.

### Guardrails and audit logs

Request/response policies and audit records provide visibility at the model boundary. Review retention and redaction settings before sending sensitive prompts.

## Deploy the gateway on NEXUS AI

The public gateway repository includes `Dockerfile.nexus` and deployment documentation. A representative deployment is:

```bash
nexus deploy source \
  --repo https://github.com/nexusrun/nexus_aigateway.git \
  --name aigateway \
  --branch main \
  --provider docker \
  --services postgresql,redis \
  --dockerfile Dockerfile.nexus \
  --env-file .env \
  --environment PRODUCTION \
  --wait
```

Review the repository documentation and example environment file before deployment. Move production credentials from local env files into the NEXUS AI Secrets Vault.

## Call the compatible endpoint

```bash
curl https://your-gateway.example.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GATEWAY_API_KEY" \
  -d '{
    "model": "your-virtual-model",
    "messages": [{"role":"user","content":"Hello"}]
  }'
```

Use a gateway client key in the application. Do not expose provider master credentials.

## Production checklist

- Use PostgreSQL and Redis with persistent storage and backups.
- Put the public endpoint behind TLS and a custom domain.
- Create separate keys for applications, environments, and teams.
- Configure budgets before broad client rollout.
- Define fallback routes and test provider failure.
- Review cache rules for data sensitivity and correctness.
- Redact secrets and sensitive prompt data from logs.
- Monitor request errors, latency, spend, and provider health.
- Rotate provider and gateway credentials on a schedule.

## NEXUS AI Gateway vs NEXUS AI MCP

They solve different problems:

- **AI Gateway** routes application model traffic to AI providers.
- **NEXUS AI MCP** lets an AI agent operate the NEXUS AI deployment platform.

An application may use both: the app calls models through AI Gateway, while an agent deploys and operates the app through MCP.

## Related pages

- [Secrets Vault](Secrets-Vault)
- [Deployment and Cloud Providers](Deployment-and-Cloud-Providers)
- [MCP and REST API](MCP-and-API)
