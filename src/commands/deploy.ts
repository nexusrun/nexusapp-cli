import { randomBytes } from 'crypto';
import { Command } from 'commander';
import inquirer from 'inquirer';
import { client, apiError, unwrap } from '../client.js';
import { statusBadge, printTable, printJson, spinner, timeAgo, success, errorMsg } from '../output.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve a deployment name or UUID to its full record. */
async function resolveDeployment(nameOrId: string): Promise<any> {
  if (UUID_RE.test(nameOrId)) {
    try {
      const res = await client.get(`/api/deployments/${nameOrId}`);
      return unwrap(res.data);
    } catch { /* fall through to name search */ }
  }
  // Search by name across all deployments
  const listRes = await client.get('/api/deployments');
  const all: any[] = Array.isArray(unwrap(listRes.data)) ? unwrap(listRes.data) : [];
  const match = all.find((d) => d.name === nameOrId || d.displayName === nameOrId);
  if (!match) throw new Error(`Deployment not found: "${nameOrId}"`);
  // Fetch full record for the resolved ID
  const res = await client.get(`/api/deployments/${match.id}`);
  return unwrap(res.data);
}

async function pollUntilDone(deploymentId: string, spin: ReturnType<typeof spinner>): Promise<void> {
  const terminal = new Set(['RUNNING', 'FAILED', 'TERMINATED', 'STOPPED']);
  while (true) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const res = await client.get(`/api/deployments/${deploymentId}`);
      const d = unwrap(res.data);
      const status = (d.status || '').toUpperCase();
      spin.text = `Deploying ${d.name || deploymentId}... [${status}]`;
      if (terminal.has(status)) {
        if (status === 'RUNNING') {
          spin.succeed(`Deployed: ${d.name}  →  ${d.url || d.serviceUrl || '—'}`);
        } else {
          spin.fail(`Deployment ended with status: ${status}`);
        }
        return;
      }
    } catch (err) {
      spin.fail('Failed to poll status: ' + apiError(err));
      return;
    }
  }
}

export function registerDeploy(program: Command): void {
  const deploy = program.command('deploy').description('Deployment commands');

  // list
  deploy
    .command('list')
    .description('List deployments')
    .option('--project <id>', 'Filter by project ID')
    .option('--status <status>', 'Filter by status')
    .option('--json', 'Output raw JSON')
    .action(async (opts) => {
      try {
        const url = opts.project ? `/api/deployments/project/${opts.project}` : '/api/deployments';
        const params: Record<string, string> = {};
        if (opts.status) params.status = opts.status;

        const res = await client.get(url, { params });
        const raw = unwrap(res.data);
        const deployments = Array.isArray(raw) ? raw : raw.deployments || [];

        if (opts.json) { printJson(deployments); return; }
        if (!deployments.length) { console.log('No deployments found.'); return; }

        printTable(
          ['NAME', 'ID', 'STATUS', 'PROVIDER', 'URL', 'CREATED'],
          deployments.map((d: any) => [
            d.displayName || d.name,
            d.id,
            statusBadge(d.status),
            d.provider || '—',
            d.url || d.serviceUrl || '—',
            d.createdAt ? timeAgo(d.createdAt) : '—',
          ])
        );
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // get
  deploy
    .command('get <name-or-id>')
    .description('Get deployment details')
    .option('--json', 'Output raw JSON')
    .action(async (nameOrId, opts) => {
      try {
        const d = await resolveDeployment(nameOrId);
        if (opts.json) { printJson(d); return; }
        printTable(['Field', 'Value'], [
          ['ID', d.id],
          ['Name', d.displayName || d.name],
          ['Status', statusBadge(d.status)],
          ['Provider', d.provider],
          ['Image', d.imageName || '—'],
          ['Port', String(d.port || '—')],
          ['URL', d.url || d.serviceUrl || '—'],
          ['Replicas', String(d.replicas ?? '—')],
          ['Project', d.projectId || '—'],
          ['Created', d.createdAt ? timeAgo(d.createdAt) : '—'],
          ['Updated', d.updatedAt ? timeAgo(d.updatedAt) : '—'],
        ]);
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // create (image-based)
  deploy
    .command('create')
    .description('Create a deployment from a container image')
    .requiredOption('--image <image>', 'Container image (e.g. nginx:latest)')
    .requiredOption('--port <port>', 'Container port', parseInt)
    .option('--name <name>', 'Deployment name')
    .option('--project <id>', 'Project ID')
    .option('--provider <provider>', 'Provider (docker|gcp_cloud_run|aws_ecs_fargate|azure_container_apps)')
    .option('--env <pairs...>', 'Environment variables as KEY=VALUE')
    .option('--no-health-check', 'Disable health checks for this deployment')
    .option('--wait', 'Wait until deployment is RUNNING or FAILED')
    .option('--json', 'Output raw JSON')
    .action(async (opts) => {
      const envVars: Record<string, string> = {};
      if (opts.env) {
        for (const pair of opts.env) {
          const idx = pair.indexOf('=');
          if (idx > 0) envVars[pair.slice(0, idx)] = pair.slice(idx + 1);
        }
      }
      const payload: Record<string, any> = { image: opts.image, port: opts.port };
      if (opts.name) payload.name = opts.name;
      if (opts.project) payload.projectId = opts.project;
      if (opts.provider) payload.provider = opts.provider;
      if (opts.healthCheck === false) payload.healthCheckEnabled = false;
      if (Object.keys(envVars).length) payload.envVars = envVars;

      try {
        const res = await client.post('/api/gpt/deploy', payload);
        const d = res.data;
        if (opts.json) { printJson(d); return; }
        if (opts.wait) {
          const spin = spinner(`Deploying ${d.name || opts.name || opts.image}...`);
          await pollUntilDone(d.id, spin);
        } else {
          success(`Deployment queued: ${d.name || d.id}`);
          console.log(`  Run 'nexus deploy status ${d.id} --watch' to track progress`);
        }
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // source (repo-based)
  deploy
    .command('source')
    .description('Deploy from a Git repository')
    .requiredOption('--repo <url>', 'Git repository URL')
    .option('--name <name>', 'Deployment name')
    .option('--branch <branch>', 'Git branch')
    .option('--provider <provider>', 'Provider (docker|gcp_cloud_run|aws_ecs_fargate|azure_container_apps)')
    .option('--env <pairs...>', 'Environment variables as KEY=VALUE')
    .option('--framework <framework>', 'Framework hint (e.g. node, python, go)')
    .option('--build-command <cmd>', 'Custom build command')
    .option('--start-command <cmd>', 'Custom start command')
    .option('--install-command <cmd>', 'Custom install command')
    .option('--output-dir <dir>', 'Build output directory')
    .option('--dockerfile <path>', 'Path to Dockerfile in repo')
    .option('--repo-secret <name>', 'Secret name containing private repo token')
    .option('--environment <env>', 'Deployment environment (DEVELOPMENT|STAGING|PRODUCTION)', 'DEVELOPMENT')
    .option('--auto-destroy <hours>', 'Auto-destroy after N hours', parseInt)
    .option('--no-health-check', 'Disable health checks for this deployment')
    .option('--wait', 'Wait until deployment is RUNNING or FAILED')
    .option('--json', 'Output raw JSON')
    .action(async (opts) => {
      const envVars: Record<string, string> = {};
      if (opts.env) {
        for (const pair of opts.env) {
          const idx = pair.indexOf('=');
          if (idx > 0) envVars[pair.slice(0, idx)] = pair.slice(idx + 1);
        }
      }
      const payload: Record<string, any> = { sourceType: 'repo', repoUrl: opts.repo };
      if (opts.name) payload.name = opts.name;
      if (opts.branch) payload.repoBranch = opts.branch;
      if (opts.provider) payload.provider = opts.provider;
      if (opts.environment) payload.environment = opts.environment;
      if (opts.framework) payload.framework = opts.framework;
      if (opts.buildCommand) payload.buildCommand = opts.buildCommand;
      if (opts.startCommand) payload.startCommand = opts.startCommand;
      if (opts.installCommand) payload.installCommand = opts.installCommand;
      if (opts.outputDir) payload.outputDir = opts.outputDir;
      if (opts.dockerfile) payload.dockerfile = opts.dockerfile;
      if (opts.repoSecret) payload.repoSecretName = opts.repoSecret;
      if (opts.autoDestroy) payload.autoDestroyHours = opts.autoDestroy;
      if (opts.healthCheck === false) payload.healthCheckEnabled = false;
      if (Object.keys(envVars).length) payload.envVars = envVars;

      try {
        const res = await client.post('/api/gpt/deploy/source', payload);
        const d = res.data;
        if (opts.json) { printJson(d); return; }
        if (opts.wait) {
          const spin = spinner(`Building and deploying ${d.name || opts.name || opts.repo}...`);
          await pollUntilDone(d.id, spin);
        } else {
          success(`Source deployment queued: ${d.name || d.id}`);
          console.log(`  ID: ${d.id}`);
          console.log(`  Run 'nexus deploy status ${d.id} --watch' to track progress`);
        }
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // redeploy
  deploy
    .command('redeploy <name-or-id>')
    .description('Redeploy an existing deployment with the same config')
    .option('--name <name>', 'Override deployment name')
    .option('--provider <provider>', 'Override provider')
    .option('--env <pairs...>', 'Override / add environment variables as KEY=VALUE')
    .option('--wait', 'Wait until deployment is RUNNING or FAILED')
    .option('--yes', 'Skip confirmation prompt')
    .option('--json', 'Output raw JSON')
    .action(async (nameOrId, opts) => {
      let deployment: any;
      try {
        deployment = await resolveDeployment(nameOrId);
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }

      if (!opts.yes) {
        const { confirm } = await inquirer.prompt([
          { type: 'confirm', name: 'confirm', message: `Redeploy "${deployment.displayName || deployment.name}"?`, default: true },
        ]);
        if (!confirm) { console.log('Cancelled.'); return; }
      }

      const baseEnvVars: Record<string, string> = { ...(deployment.envVars || {}) };
      if (opts.env) {
        for (const pair of (opts.env as string[])) {
          const idx = pair.indexOf('=');
          if (idx > 0) baseEnvVars[pair.slice(0, idx)] = pair.slice(idx + 1);
        }
      }
      const provider = opts.provider || undefined;

      try {
        if (deployment.imageName) {
          const payload: Record<string, any> = {
            image: deployment.imageName,
            port: deployment.port,
            name: opts.name || `${deployment.name}-redeploy`,
          };
          if (provider) payload.provider = provider;
          if (Object.keys(baseEnvVars).length) payload.envVars = baseEnvVars;

          const res = await client.post('/api/gpt/deploy', payload);
          const d = res.data;
          if (opts.json) { printJson(d); return; }
          if (opts.wait) {
            await pollUntilDone(d.id, spinner(`Redeploying ${d.name || nameOrId}...`));
          } else {
            success(`Redeploy queued: ${d.name || d.id}`);
            console.log(`  Run 'nexus deploy status ${d.id} --watch' to track progress`);
          }
          return;
        }

        // Source deployment — look up repo from project
        const projectRes = await client.get(`/api/projects/${deployment.projectId}`);
        const project = unwrap(projectRes.data);

        if (project.repoUrl) {
          const payload: Record<string, any> = {
            sourceType: 'repo',
            repoUrl: project.repoUrl,
            name: opts.name || `${deployment.name}-redeploy`,
          };
          if (project.gitBranch) payload.repoBranch = project.gitBranch;
          if (project.framework) payload.framework = project.framework;
          if (provider) payload.provider = provider;
          if (Object.keys(baseEnvVars).length) payload.envVars = baseEnvVars;

          const res = await client.post('/api/gpt/deploy/source', payload);
          const d = res.data;
          if (opts.json) { printJson(d); return; }
          if (opts.wait) {
            await pollUntilDone(d.id, spinner(`Rebuilding ${d.name || nameOrId}...`));
          } else {
            success(`Redeploy queued: ${d.name || d.id}`);
            console.log(`  Repo: ${project.repoUrl}${project.gitBranch ? ` @ ${project.gitBranch}` : ''}`);
            console.log(`  Run 'nexus deploy status ${d.id} --watch' to track progress`);
          }
          return;
        }

        errorMsg('Cannot redeploy: no image or repo URL found. Use "nexus deploy source --repo <url>" instead.');
        process.exit(1);
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // stop
  deploy
    .command('stop <name-or-id>')
    .description('Stop a running deployment')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (nameOrId, opts) => {
      try {
        const d = await resolveDeployment(nameOrId);
        if (!opts.yes) {
          const { confirm } = await inquirer.prompt([
            { type: 'confirm', name: 'confirm', message: `Stop "${d.displayName || d.name}"?`, default: false },
          ]);
          if (!confirm) { console.log('Cancelled.'); return; }
        }
        await client.post(`/api/deployments/${d.id}/stop`);
        success(`Deployment "${d.displayName || d.name}" stopped.`);
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // start
  deploy
    .command('start <name-or-id>')
    .description('Start a stopped deployment')
    .action(async (nameOrId) => {
      try {
        const d = await resolveDeployment(nameOrId);
        await client.post(`/api/deployments/${d.id}/start`);
        success(`Deployment "${d.displayName || d.name}" started.`);
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // delete
  deploy
    .command('delete <name-or-id>')
    .description('Delete a deployment')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (nameOrId, opts) => {
      try {
        const d = await resolveDeployment(nameOrId);
        if (!opts.yes) {
          const { confirm } = await inquirer.prompt([
            { type: 'confirm', name: 'confirm', message: `Delete "${d.displayName || d.name}"? This cannot be undone.`, default: false },
          ]);
          if (!confirm) { console.log('Cancelled.'); return; }
        }
        await client.delete(`/api/deployments/${d.id}`);
        success(`Deployment "${d.displayName || d.name}" deleted.`);
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // logs
  deploy
    .command('logs <name-or-id>')
    .description('View deployment logs')
    .option('--type <type>', 'Log type: runtime or build', 'runtime')
    .option('--lines <n>', 'Number of log lines', '100')
    .option('--follow', 'Poll for new logs every 2s')
    .action(async (nameOrId, opts) => {
      let deployId: string;
      try {
        const d = await resolveDeployment(nameOrId);
        deployId = d.id;
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
        return;
      }

      const limit = parseInt(opts.lines, 10) || 100;

      /** Normalise the API response into an array of { message, timestamp? } */
      const fetchLogs = async (lastTimestamp?: string): Promise<{ message: string; timestamp?: string }[]> => {
        const params: Record<string, any> = { type: opts.type, limit };
        if (lastTimestamp) params.after = lastTimestamp;
        const res = await client.get(`/api/deployments/${deployId}/logs`, { params });
        const raw = unwrap(res.data);

        // Shape: { logs: "line1\nline2\n..." }
        if (raw && typeof raw.logs === 'string') {
          return raw.logs
            .split('\n')
            .filter((l: string) => l.length > 0)
            .map((l: string) => ({ message: l }));
        }

        // Shape: [ { message, timestamp }, ... ] or [ "line1", ... ]
        const arr: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.logs) ? raw.logs : [];
        return arr.map((entry) =>
          typeof entry === 'string'
            ? { message: entry }
            : { message: entry.message || entry.log || String(entry), timestamp: entry.timestamp }
        );
      };

      try {
        const logs = await fetchLogs();
        let lastTimestamp: string | undefined;
        for (const log of logs) {
          const ts = log.timestamp ? `[${new Date(log.timestamp).toLocaleTimeString()}] ` : '';
          console.log(`${ts}${log.message}`);
          lastTimestamp = log.timestamp || lastTimestamp;
        }
        if (!opts.follow) return;
        while (true) {
          await new Promise((r) => setTimeout(r, 2000));
          try {
            const newLogs = await fetchLogs(lastTimestamp);
            for (const log of newLogs) {
              const ts = log.timestamp ? `[${new Date(log.timestamp).toLocaleTimeString()}] ` : '';
              console.log(`${ts}${log.message}`);
              lastTimestamp = log.timestamp || lastTimestamp;
            }
          } catch { /* ignore transient errors in follow mode */ }
        }
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // scale
  deploy
    .command('scale <name-or-id> <replicas>')
    .description('Scale deployment replicas')
    .action(async (nameOrId, replicas) => {
      const count = parseInt(replicas, 10);
      if (isNaN(count) || count < 1 || count > 10) {
        errorMsg('Replicas must be a number between 1 and 10.');
        process.exit(1);
      }
      try {
        const d = await resolveDeployment(nameOrId);
        await client.post(`/api/deployments/${d.id}/scale`, { replicas: count });
        success(`Deployment "${d.displayName || d.name}" scaled to ${count} replica(s).`);
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // rollback
  deploy
    .command('rollback <name-or-id>')
    .description('Roll back a deployment to the previous version')
    .option('--target <deployment-id>', 'Target deployment ID to roll back to')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (nameOrId, opts) => {
      try {
        const d = await resolveDeployment(nameOrId);
        if (!opts.yes) {
          const { confirm } = await inquirer.prompt([
            { type: 'confirm', name: 'confirm', message: `Roll back "${d.displayName || d.name}" to the previous version?`, default: false },
          ]);
          if (!confirm) { console.log('Cancelled.'); return; }
        }
        const payload: Record<string, any> = {};
        if (opts.target) payload.targetDeploymentId = opts.target;
        const res = await client.post(`/api/deployments/${d.id}/rollback`, payload);
        const result = unwrap(res.data);
        success(`Rollback initiated → new deployment ${result.id || '?'}`);
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // openclaw
  deploy
    .command('openclaw')
    .description('Deploy an OpenClaw gateway (alpine/openclaw:latest) on port 18789')
    .option('--name <name>', 'Deployment name', 'openclaw-gateway')
    .option('--gateway-token <token>', 'OpenClaw gateway auth token (auto-generated if not set)')
    .option('--claude-api-key <key>', 'CLAUDE_AI_SESSION_KEY value')
    .option('--claude-web-session <key>', 'CLAUDE_WEB_SESSION_KEY value')
    .option('--claude-web-cookie <cookie>', 'CLAUDE_WEB_COOKIE value')
    .option('--provider <provider>', 'Provider (docker|gcp_cloud_run|aws_ecs_fargate|azure_container_apps)')
    .option('--env <pairs...>', 'Additional environment variables as KEY=VALUE')
    .option('--wait', 'Wait until deployment is RUNNING or FAILED')
    .option('--json', 'Output raw JSON')
    .action(async (opts) => {
      const gatewayToken = opts.gatewayToken || randomBytes(32).toString('hex');
      const envVars: Record<string, string> = {
        HOME: '/home/node',
        OPENCLAW_GATEWAY_TOKEN: gatewayToken,
        OPENCLAW_GATEWAY_BIND: 'lan',
        OPENCLAW_GATEWAY_CONTROL_UI_DANGEROUSLY_ALLOW_HOST_HEADER_ORIGIN_FALLBACK: 'true',
      };
      if (opts.claudeApiKey) envVars['CLAUDE_AI_SESSION_KEY'] = opts.claudeApiKey;
      if (opts.claudeWebSession) envVars['CLAUDE_WEB_SESSION_KEY'] = opts.claudeWebSession;
      if (opts.claudeWebCookie) envVars['CLAUDE_WEB_COOKIE'] = opts.claudeWebCookie;
      if (opts.env) {
        for (const pair of opts.env as string[]) {
          const idx = pair.indexOf('=');
          if (idx > 0) envVars[pair.slice(0, idx)] = pair.slice(idx + 1);
        }
      }
      const payload: Record<string, any> = {
        image: 'alpine/openclaw:latest',
        port: 18789,
        name: opts.name,
        envVars,
        startCommand: 'mkdir -p /home/node/.openclaw && echo \'{"gateway":{"controlUi":{"dangerouslyAllowHostHeaderOriginFallback":true}}}\' > /home/node/.openclaw/openclaw.json && node dist/index.js gateway --bind lan --port 18789 --allow-unconfigured',
        healthCheckEnabled: false, // OpenClaw gateway has no HTTP health endpoint
      };
      if (opts.provider) payload.provider = opts.provider;

      try {
        const res = await client.post('/api/gpt/deploy', payload);
        const d = res.data;
        if (opts.json) { printJson({ ...d, gatewayToken }); return; }
        if (opts.wait) {
          const spin = spinner('Deploying OpenClaw gateway...');
          await pollUntilDone(d.id, spin);
        } else {
          success(`OpenClaw gateway queued: ${d.name || d.id}`);
          console.log(`  Gateway token: ${gatewayToken}`);
          console.log(`  Port: 18789`);
          console.log(`  Run 'nexus deploy status ${d.id} --watch' to track progress`);
        }
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // status
  deploy
    .command('status <name-or-id>')
    .description('Show deployment status')
    .option('--watch', 'Refresh every 3s')
    .option('--json', 'Output raw JSON')
    .action(async (nameOrId, opts) => {
      let deployId: string;
      try {
        const d = await resolveDeployment(nameOrId);
        deployId = d.id;
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
        return;
      }

      const show = async () => {
        const res = await client.get(`/api/deployments/${deployId}`);
        const d = unwrap(res.data);
        if (opts.json) { printJson(d); return; }
        if (opts.watch) process.stdout.write('\x1Bc');
        printTable(['Field', 'Value'], [
          ['Name', d.displayName || d.name],
          ['Status', statusBadge(d.status)],
          ['Provider', d.provider || '—'],
          ['URL', d.url || d.serviceUrl || '—'],
          ['Replicas', String(d.replicas ?? '—')],
          ['Updated', d.updatedAt ? timeAgo(d.updatedAt) : '—'],
        ]);
      };

      try {
        await show();
        if (!opts.watch) return;
        while (true) {
          await new Promise((r) => setTimeout(r, 3000));
          try { await show(); } catch { /* ignore */ }
        }
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });
}
