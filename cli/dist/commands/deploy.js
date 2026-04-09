"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDeploy = registerDeploy;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const inquirer_1 = __importDefault(require("inquirer"));
const client_js_1 = require("../client.js");
const output_js_1 = require("../output.js");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Resolve a deployment name or UUID to its full record. */
async function resolveDeployment(nameOrId) {
    if (UUID_RE.test(nameOrId)) {
        try {
            const res = await client_js_1.client.get(`/api/deployments/${nameOrId}`);
            return (0, client_js_1.unwrap)(res.data);
        }
        catch { /* fall through to name search */ }
    }
    // Search by name across all deployments
    const listRes = await client_js_1.client.get('/api/deployments');
    const all = Array.isArray((0, client_js_1.unwrap)(listRes.data)) ? (0, client_js_1.unwrap)(listRes.data) : [];
    const match = all.find((d) => d.name === nameOrId || d.displayName === nameOrId);
    if (!match)
        throw new Error(`Deployment not found: "${nameOrId}"`);
    // Fetch full record for the resolved ID
    const res = await client_js_1.client.get(`/api/deployments/${match.id}`);
    return (0, client_js_1.unwrap)(res.data);
}
async function pollUntilDone(deploymentId, spin) {
    const terminal = new Set(['RUNNING', 'FAILED', 'TERMINATED', 'STOPPED']);
    while (true) {
        await new Promise((r) => setTimeout(r, 3000));
        try {
            const res = await client_js_1.client.get(`/api/deployments/${deploymentId}`);
            const d = (0, client_js_1.unwrap)(res.data);
            const status = (d.status || '').toUpperCase();
            spin.text = `Deploying ${d.name || deploymentId}... [${status}]`;
            if (terminal.has(status)) {
                if (status === 'RUNNING') {
                    spin.succeed(`Deployed: ${d.name}  →  ${d.url || d.serviceUrl || '—'}`);
                }
                else {
                    spin.fail(`Deployment ended with status: ${status}`);
                }
                return;
            }
        }
        catch (err) {
            spin.fail('Failed to poll status: ' + (0, client_js_1.apiError)(err));
            return;
        }
    }
}
/**
 * Parse a .env-style file into a key→value map.
 * Supports: KEY=VALUE, KEY="quoted value", KEY='quoted value', # comments, blank lines.
 * --env pairs always win over file values (caller merges file first, then pairs).
 */
function parseEnvFile(filePath) {
    let raw;
    try {
        raw = (0, fs_1.readFileSync)(filePath, 'utf8');
    }
    catch {
        (0, output_js_1.errorMsg)(`Cannot read env file: ${filePath}`);
        process.exit(1);
    }
    const result = {};
    for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#'))
            continue;
        const idx = trimmed.indexOf('=');
        if (idx <= 0)
            continue;
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1);
        // Strip inline comments after unquoted values
        if ((val.startsWith('"') && val.includes('"', 1)) || (val.startsWith("'") && val.includes("'", 1))) {
            const q = val[0];
            const close = val.indexOf(q, 1);
            val = val.slice(1, close);
        }
        else {
            val = val.split('#')[0].trim();
        }
        if (key)
            result[key] = val;
    }
    return result;
}
function registerDeploy(program) {
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
            const params = {};
            if (opts.status)
                params.status = opts.status;
            const res = await client_js_1.client.get(url, { params });
            const raw = (0, client_js_1.unwrap)(res.data);
            const deployments = Array.isArray(raw) ? raw : raw.deployments || [];
            if (opts.json) {
                (0, output_js_1.printJson)(deployments);
                return;
            }
            if (!deployments.length) {
                console.log('No deployments found.');
                return;
            }
            (0, output_js_1.printTable)(['NAME', 'ID', 'STATUS', 'PROVIDER', 'URL', 'CREATED'], deployments.map((d) => [
                d.displayName || d.name,
                d.id,
                (0, output_js_1.statusBadge)(d.status),
                d.provider || '—',
                d.url || d.serviceUrl || '—',
                d.createdAt ? (0, output_js_1.timeAgo)(d.createdAt) : '—',
            ]));
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
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
            if (opts.json) {
                (0, output_js_1.printJson)(d);
                return;
            }
            (0, output_js_1.printTable)(['Field', 'Value'], [
                ['ID', d.id],
                ['Name', d.displayName || d.name],
                ['Status', (0, output_js_1.statusBadge)(d.status)],
                ['Provider', d.provider],
                ['Image', d.imageName || '—'],
                ['Port', String(d.port || '—')],
                ['URL', d.url || d.serviceUrl || '—'],
                ['Replicas', String(d.replicas ?? '—')],
                ['Project', d.projectId || '—'],
                ['Created', d.createdAt ? (0, output_js_1.timeAgo)(d.createdAt) : '—'],
                ['Updated', d.updatedAt ? (0, output_js_1.timeAgo)(d.updatedAt) : '—'],
            ]);
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
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
        .option('--env-file <file>', 'Load environment variables from a .env file')
        .option('--no-health-check', 'Disable health checks for this deployment')
        .option('--wait', 'Wait until deployment is RUNNING or FAILED')
        .option('--json', 'Output raw JSON')
        .action(async (opts) => {
        const envVars = {};
        if (opts.envFile)
            Object.assign(envVars, parseEnvFile(opts.envFile));
        if (opts.env) {
            for (const pair of opts.env) {
                const idx = pair.indexOf('=');
                if (idx > 0)
                    envVars[pair.slice(0, idx)] = pair.slice(idx + 1);
            }
        }
        const payload = { image: opts.image, port: opts.port };
        if (opts.name)
            payload.name = opts.name;
        if (opts.project)
            payload.projectId = opts.project;
        if (opts.provider)
            payload.provider = opts.provider;
        if (opts.healthCheck === false)
            payload.healthCheckEnabled = false;
        if (Object.keys(envVars).length)
            payload.envVars = envVars;
        try {
            const res = await client_js_1.client.post('/api/gpt/deploy', payload);
            const d = res.data;
            if (opts.json) {
                (0, output_js_1.printJson)(d);
                return;
            }
            if (opts.wait) {
                const spin = (0, output_js_1.spinner)(`Deploying ${d.name || opts.name || opts.image}...`);
                await pollUntilDone(d.id, spin);
            }
            else {
                (0, output_js_1.success)(`Deployment queued: ${d.name || d.id}`);
                console.log(`  Run 'nexus deploy status ${d.id} --watch' to track progress`);
            }
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
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
        .option('--env-file <file>', 'Load environment variables from a .env file')
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
        const envVars = {};
        if (opts.envFile)
            Object.assign(envVars, parseEnvFile(opts.envFile));
        if (opts.env) {
            for (const pair of opts.env) {
                const idx = pair.indexOf('=');
                if (idx > 0)
                    envVars[pair.slice(0, idx)] = pair.slice(idx + 1);
            }
        }
        const payload = { sourceType: 'repo', repoUrl: opts.repo };
        if (opts.name)
            payload.name = opts.name;
        if (opts.branch)
            payload.repoBranch = opts.branch;
        if (opts.provider)
            payload.provider = opts.provider;
        if (opts.environment)
            payload.environment = opts.environment;
        if (opts.framework)
            payload.framework = opts.framework;
        if (opts.buildCommand)
            payload.buildCommand = opts.buildCommand;
        if (opts.startCommand)
            payload.startCommand = opts.startCommand;
        if (opts.installCommand)
            payload.installCommand = opts.installCommand;
        if (opts.outputDir)
            payload.outputDir = opts.outputDir;
        if (opts.dockerfile)
            payload.dockerfile = opts.dockerfile;
        if (opts.repoSecret)
            payload.repoSecretName = opts.repoSecret;
        if (opts.autoDestroy)
            payload.autoDestroyHours = opts.autoDestroy;
        if (opts.healthCheck === false)
            payload.healthCheckEnabled = false;
        if (Object.keys(envVars).length)
            payload.envVars = envVars;
        try {
            const res = await client_js_1.client.post('/api/gpt/deploy/source', payload);
            const d = res.data;
            if (opts.json) {
                (0, output_js_1.printJson)(d);
                return;
            }
            if (opts.wait) {
                const spin = (0, output_js_1.spinner)(`Building and deploying ${d.name || opts.name || opts.repo}...`);
                await pollUntilDone(d.id, spin);
            }
            else {
                (0, output_js_1.success)(`Source deployment queued: ${d.name || d.id}`);
                console.log(`  ID: ${d.id}`);
                console.log(`  Run 'nexus deploy status ${d.id} --watch' to track progress`);
            }
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
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
        .option('--env-file <file>', 'Load environment variables from a .env file (merged with existing, --env wins)')
        .option('--wait', 'Wait until deployment is RUNNING or FAILED')
        .option('--yes', 'Skip confirmation prompt')
        .option('--json', 'Output raw JSON')
        .action(async (nameOrId, opts) => {
        let deployment;
        try {
            deployment = await resolveDeployment(nameOrId);
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
            process.exit(1);
        }
        if (!opts.yes) {
            const { confirm } = await inquirer_1.default.prompt([
                { type: 'confirm', name: 'confirm', message: `Redeploy "${deployment.displayName || deployment.name}"?`, default: true },
            ]);
            if (!confirm) {
                console.log('Cancelled.');
                return;
            }
        }
        const baseEnvVars = { ...(deployment.envVars || {}) };
        if (opts.envFile)
            Object.assign(baseEnvVars, parseEnvFile(opts.envFile));
        if (opts.env) {
            for (const pair of opts.env) {
                const idx = pair.indexOf('=');
                if (idx > 0)
                    baseEnvVars[pair.slice(0, idx)] = pair.slice(idx + 1);
            }
        }
        const provider = opts.provider || undefined;
        try {
            if (deployment.imageName) {
                const payload = {
                    image: deployment.imageName,
                    port: deployment.port,
                    name: opts.name || `${deployment.name}-redeploy`,
                };
                if (provider)
                    payload.provider = provider;
                if (Object.keys(baseEnvVars).length)
                    payload.envVars = baseEnvVars;
                const res = await client_js_1.client.post('/api/gpt/deploy', payload);
                const d = res.data;
                if (opts.json) {
                    (0, output_js_1.printJson)(d);
                    return;
                }
                if (opts.wait) {
                    await pollUntilDone(d.id, (0, output_js_1.spinner)(`Redeploying ${d.name || nameOrId}...`));
                }
                else {
                    (0, output_js_1.success)(`Redeploy queued: ${d.name || d.id}`);
                    console.log(`  Run 'nexus deploy status ${d.id} --watch' to track progress`);
                }
                return;
            }
            // Source deployment — look up repo from project
            const projectRes = await client_js_1.client.get(`/api/projects/${deployment.projectId}`);
            const project = (0, client_js_1.unwrap)(projectRes.data);
            if (project.repoUrl) {
                const payload = {
                    sourceType: 'repo',
                    repoUrl: project.repoUrl,
                    name: opts.name || `${deployment.name}-redeploy`,
                };
                if (project.gitBranch)
                    payload.repoBranch = project.gitBranch;
                if (project.framework)
                    payload.framework = project.framework;
                if (provider)
                    payload.provider = provider;
                if (Object.keys(baseEnvVars).length)
                    payload.envVars = baseEnvVars;
                const res = await client_js_1.client.post('/api/gpt/deploy/source', payload);
                const d = res.data;
                if (opts.json) {
                    (0, output_js_1.printJson)(d);
                    return;
                }
                if (opts.wait) {
                    await pollUntilDone(d.id, (0, output_js_1.spinner)(`Rebuilding ${d.name || nameOrId}...`));
                }
                else {
                    (0, output_js_1.success)(`Redeploy queued: ${d.name || d.id}`);
                    console.log(`  Repo: ${project.repoUrl}${project.gitBranch ? ` @ ${project.gitBranch}` : ''}`);
                    console.log(`  Run 'nexus deploy status ${d.id} --watch' to track progress`);
                }
                return;
            }
            (0, output_js_1.errorMsg)('Cannot redeploy: no image or repo URL found. Use "nexus deploy source --repo <url>" instead.');
            process.exit(1);
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
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
                const { confirm } = await inquirer_1.default.prompt([
                    { type: 'confirm', name: 'confirm', message: `Stop "${d.displayName || d.name}"?`, default: false },
                ]);
                if (!confirm) {
                    console.log('Cancelled.');
                    return;
                }
            }
            await client_js_1.client.post(`/api/deployments/${d.id}/stop`);
            (0, output_js_1.success)(`Deployment "${d.displayName || d.name}" stopped.`);
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
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
            await client_js_1.client.post(`/api/deployments/${d.id}/start`);
            (0, output_js_1.success)(`Deployment "${d.displayName || d.name}" started.`);
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
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
                const { confirm } = await inquirer_1.default.prompt([
                    { type: 'confirm', name: 'confirm', message: `Delete "${d.displayName || d.name}"? This cannot be undone.`, default: false },
                ]);
                if (!confirm) {
                    console.log('Cancelled.');
                    return;
                }
            }
            await client_js_1.client.delete(`/api/deployments/${d.id}`);
            (0, output_js_1.success)(`Deployment "${d.displayName || d.name}" deleted.`);
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
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
        let deployId;
        try {
            const d = await resolveDeployment(nameOrId);
            deployId = d.id;
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
            process.exit(1);
            return;
        }
        const limit = parseInt(opts.lines, 10) || 100;
        /** Normalise the API response into an array of { message, timestamp? } */
        const fetchLogs = async (lastTimestamp) => {
            const params = { type: opts.type, limit };
            if (lastTimestamp)
                params.after = lastTimestamp;
            const res = await client_js_1.client.get(`/api/deployments/${deployId}/logs`, { params });
            const raw = (0, client_js_1.unwrap)(res.data);
            // Shape: { logs: "line1\nline2\n..." }
            if (raw && typeof raw.logs === 'string') {
                return raw.logs
                    .split('\n')
                    .filter((l) => l.length > 0)
                    .map((l) => ({ message: l }));
            }
            // Shape: [ { message, timestamp }, ... ] or [ "line1", ... ]
            const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.logs) ? raw.logs : [];
            return arr.map((entry) => typeof entry === 'string'
                ? { message: entry }
                : { message: entry.message || entry.log || String(entry), timestamp: entry.timestamp });
        };
        try {
            const logs = await fetchLogs();
            let lastTimestamp;
            for (const log of logs) {
                const ts = log.timestamp ? `[${new Date(log.timestamp).toLocaleTimeString()}] ` : '';
                console.log(`${ts}${log.message}`);
                lastTimestamp = log.timestamp || lastTimestamp;
            }
            if (!opts.follow)
                return;
            while (true) {
                await new Promise((r) => setTimeout(r, 2000));
                try {
                    const newLogs = await fetchLogs(lastTimestamp);
                    for (const log of newLogs) {
                        const ts = log.timestamp ? `[${new Date(log.timestamp).toLocaleTimeString()}] ` : '';
                        console.log(`${ts}${log.message}`);
                        lastTimestamp = log.timestamp || lastTimestamp;
                    }
                }
                catch { /* ignore transient errors in follow mode */ }
            }
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
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
            (0, output_js_1.errorMsg)('Replicas must be a number between 1 and 10.');
            process.exit(1);
        }
        try {
            const d = await resolveDeployment(nameOrId);
            await client_js_1.client.post(`/api/deployments/${d.id}/scale`, { replicas: count });
            (0, output_js_1.success)(`Deployment "${d.displayName || d.name}" scaled to ${count} replica(s).`);
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
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
                const { confirm } = await inquirer_1.default.prompt([
                    { type: 'confirm', name: 'confirm', message: `Roll back "${d.displayName || d.name}" to the previous version?`, default: false },
                ]);
                if (!confirm) {
                    console.log('Cancelled.');
                    return;
                }
            }
            const payload = {};
            if (opts.target)
                payload.targetDeploymentId = opts.target;
            const res = await client_js_1.client.post(`/api/deployments/${d.id}/rollback`, payload);
            const result = (0, client_js_1.unwrap)(res.data);
            (0, output_js_1.success)(`Rollback initiated → new deployment ${result.id || '?'}`);
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
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
        .option('--env-file <file>', 'Load environment variables from a .env file')
        .option('--wait', 'Wait until deployment is RUNNING or FAILED')
        .option('--json', 'Output raw JSON')
        .action(async (opts) => {
        const gatewayToken = opts.gatewayToken || (0, crypto_1.randomBytes)(32).toString('hex');
        const envVars = {
            HOME: '/home/node',
            OPENCLAW_GATEWAY_TOKEN: gatewayToken,
            OPENCLAW_GATEWAY_BIND: 'lan',
            OPENCLAW_GATEWAY_CONTROL_UI_DANGEROUSLY_ALLOW_HOST_HEADER_ORIGIN_FALLBACK: 'true',
        };
        if (opts.claudeApiKey)
            envVars['CLAUDE_AI_SESSION_KEY'] = opts.claudeApiKey;
        if (opts.claudeWebSession)
            envVars['CLAUDE_WEB_SESSION_KEY'] = opts.claudeWebSession;
        if (opts.claudeWebCookie)
            envVars['CLAUDE_WEB_COOKIE'] = opts.claudeWebCookie;
        if (opts.envFile)
            Object.assign(envVars, parseEnvFile(opts.envFile));
        if (opts.env) {
            for (const pair of opts.env) {
                const idx = pair.indexOf('=');
                if (idx > 0)
                    envVars[pair.slice(0, idx)] = pair.slice(idx + 1);
            }
        }
        const payload = {
            image: 'alpine/openclaw:latest',
            port: 18789,
            name: opts.name,
            envVars,
            startCommand: 'mkdir -p /home/node/.openclaw && echo \'{"gateway":{"controlUi":{"dangerouslyAllowHostHeaderOriginFallback":true,"dangerouslyDisableDeviceAuth":true},"trustedProxies":["172.16.0.0/12","10.0.0.0/8"]}}\' > /home/node/.openclaw/openclaw.json && node dist/index.js gateway --bind lan --port 18789 --allow-unconfigured',
            healthCheckEnabled: false, // OpenClaw gateway has no HTTP health endpoint
        };
        if (opts.provider)
            payload.provider = opts.provider;
        try {
            const res = await client_js_1.client.post('/api/gpt/deploy', payload);
            const d = res.data;
            if (opts.json) {
                (0, output_js_1.printJson)({ ...d, gatewayToken });
                return;
            }
            if (opts.wait) {
                const spin = (0, output_js_1.spinner)('Deploying OpenClaw gateway...');
                await pollUntilDone(d.id, spin);
            }
            else {
                (0, output_js_1.success)(`OpenClaw gateway queued: ${d.name || d.id}`);
                console.log(`  Gateway token: ${gatewayToken}`);
                console.log(`  Port: 18789`);
                console.log(`  Run 'nexus deploy status ${d.id} --watch' to track progress`);
            }
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
            process.exit(1);
        }
    });
    // flixty
    deploy
        .command('flixty')
        .description('Deploy Flixty social media creator studio from source (github.com/nexusrun/flixty)')
        .option('--name <name>', 'Deployment name', 'flixty')
        .option('--session-secret <secret>', 'Express session secret (auto-generated if not set)')
        .option('--base-url <url>', 'Public URL of the deployment (for OAuth redirect URIs)')
        .option('--anthropic-api-key <key>', 'Anthropic API key for AI Assist')
        .option('--x-client-id <id>', 'X/Twitter OAuth 2.0 Client ID')
        .option('--x-client-secret <secret>', 'X/Twitter OAuth 2.0 Client Secret')
        .option('--linkedin-client-id <id>', 'LinkedIn OAuth Client ID')
        .option('--linkedin-client-secret <secret>', 'LinkedIn OAuth Client Secret')
        .option('--fb-app-id <id>', 'Facebook App ID')
        .option('--fb-app-secret <secret>', 'Facebook App Secret')
        .option('--tiktok-client-key <key>', 'TikTok Client Key')
        .option('--tiktok-client-secret <secret>', 'TikTok Client Secret')
        .option('--google-client-id <id>', 'Google Client ID (YouTube)')
        .option('--google-client-secret <secret>', 'Google Client Secret')
        .option('--provider <provider>', 'Provider (gcp_cloud_run|aws_ecs_fargate|azure_container_apps)')
        .option('--env <pairs...>', 'Additional environment variables as KEY=VALUE')
        .option('--env-file <file>', 'Load environment variables from a .env file')
        .option('--wait', 'Wait until deployment is RUNNING or FAILED')
        .option('--json', 'Output raw JSON')
        .action(async (opts) => {
        const sessionSecret = opts.sessionSecret || (0, crypto_1.randomBytes)(32).toString('hex');
        const envVars = {
            SESSION_SECRET: sessionSecret,
            PORT: '3000',
            NODE_ENV: 'production',
        };
        if (opts.baseUrl)
            envVars['BASE_URL'] = opts.baseUrl;
        if (opts.anthropicApiKey)
            envVars['ANTHROPIC_API_KEY'] = opts.anthropicApiKey;
        if (opts.xClientId)
            envVars['X_CLIENT_ID'] = opts.xClientId;
        if (opts.xClientSecret)
            envVars['X_CLIENT_SECRET'] = opts.xClientSecret;
        if (opts.linkedinClientId)
            envVars['LINKEDIN_CLIENT_ID'] = opts.linkedinClientId;
        if (opts.linkedinClientSecret)
            envVars['LINKEDIN_CLIENT_SECRET'] = opts.linkedinClientSecret;
        if (opts.fbAppId)
            envVars['FB_APP_ID'] = opts.fbAppId;
        if (opts.fbAppSecret)
            envVars['FB_APP_SECRET'] = opts.fbAppSecret;
        if (opts.tiktokClientKey)
            envVars['TIKTOK_CLIENT_KEY'] = opts.tiktokClientKey;
        if (opts.tiktokClientSecret)
            envVars['TIKTOK_CLIENT_SECRET'] = opts.tiktokClientSecret;
        if (opts.googleClientId)
            envVars['GOOGLE_CLIENT_ID'] = opts.googleClientId;
        if (opts.googleClientSecret)
            envVars['GOOGLE_CLIENT_SECRET'] = opts.googleClientSecret;
        if (opts.envFile)
            Object.assign(envVars, parseEnvFile(opts.envFile));
        if (opts.env) {
            for (const pair of opts.env) {
                const idx = pair.indexOf('=');
                if (idx > 0)
                    envVars[pair.slice(0, idx)] = pair.slice(idx + 1);
            }
        }
        const payload = {
            sourceType: 'repo',
            repoUrl: 'https://github.com/nexusrun/flixty.git',
            name: opts.name,
            environment: 'PRODUCTION',
            startCommand: 'node server.js',
            envVars,
            healthCheckEnabled: true,
        };
        if (opts.provider)
            payload.provider = opts.provider;
        try {
            const res = await client_js_1.client.post('/api/gpt/deploy-source', payload);
            const d = res.data;
            if (opts.json) {
                (0, output_js_1.printJson)({ ...d, sessionSecret });
                return;
            }
            if (opts.wait) {
                const spin = (0, output_js_1.spinner)('Deploying Flixty...');
                await pollUntilDone(d.id, spin);
            }
            else {
                (0, output_js_1.success)(`Flixty queued: ${d.name || d.id}`);
                console.log(`  Session secret: ${sessionSecret}`);
                console.log(`  Port: 3000`);
                if (!opts.baseUrl) {
                    console.log(`  Note: once running, redeploy with --base-url <public-url> for OAuth to work`);
                }
                console.log(`  Run 'nexus deploy status ${d.id} --watch' to track progress`);
            }
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
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
        let deployId;
        try {
            const d = await resolveDeployment(nameOrId);
            deployId = d.id;
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
            process.exit(1);
            return;
        }
        const show = async () => {
            const res = await client_js_1.client.get(`/api/deployments/${deployId}`);
            const d = (0, client_js_1.unwrap)(res.data);
            if (opts.json) {
                (0, output_js_1.printJson)(d);
                return;
            }
            if (opts.watch)
                process.stdout.write('\x1Bc');
            (0, output_js_1.printTable)(['Field', 'Value'], [
                ['Name', d.displayName || d.name],
                ['Status', (0, output_js_1.statusBadge)(d.status)],
                ['Provider', d.provider || '—'],
                ['URL', d.url || d.serviceUrl || '—'],
                ['Replicas', String(d.replicas ?? '—')],
                ['Updated', d.updatedAt ? (0, output_js_1.timeAgo)(d.updatedAt) : '—'],
            ]);
        };
        try {
            await show();
            if (!opts.watch)
                return;
            while (true) {
                await new Promise((r) => setTimeout(r, 3000));
                try {
                    await show();
                }
                catch { /* ignore */ }
            }
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
            process.exit(1);
        }
    });
}
//# sourceMappingURL=deploy.js.map