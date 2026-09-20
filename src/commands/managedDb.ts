import { Command } from 'commander';
import { client, apiError, unwrap } from '../client.js';
import { printTable, printJson, success, errorMsg, timeAgo } from '../output.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ENGINE_ALIASES: Record<string, string> = {
  postgres: 'POSTGRES', postgresql: 'POSTGRES', pg: 'POSTGRES',
  mysql: 'MYSQL',
  redis: 'REDIS',
};

function normalizeEngine(value: string): string {
  return ENGINE_ALIASES[value.trim().toLowerCase()] || value.trim().toUpperCase();
}

/** Resolve a database name or id to its id. */
async function resolveDbId(nameOrId: string): Promise<string> {
  if (UUID_RE.test(nameOrId)) return nameOrId;
  const res = await client.get('/api/managed-databases');
  const dbs: any[] = res.data?.managedDatabases || [];
  const match = dbs.find((d) => d.name === nameOrId || d.displayName === nameOrId);
  if (!match) throw new Error(`Database not found: "${nameOrId}"`);
  return match.id;
}

/** Resolve a deployment name or id to its id. */
async function resolveDeploymentId(nameOrId: string): Promise<string> {
  if (UUID_RE.test(nameOrId)) return nameOrId;
  const res = await client.get('/api/deployments');
  const raw = unwrap(res.data);
  const all: any[] = Array.isArray(raw) ? raw : raw.deployments || [];
  const match = all.find((d) => d.name === nameOrId || d.displayName === nameOrId);
  if (!match) throw new Error(`Deployment not found: "${nameOrId}"`);
  return match.id;
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data.replace(/\r?\n$/, '')));
    process.stdin.on('error', reject);
  });
}

export function registerManagedDb(program: Command): void {
  const md = program
    .command('managed-db')
    .description('Standalone databases: NEXUS AI local (--local) or managed cloud (AWS RDS, Cloud SQL, Azure)');

  md
    .command('list')
    .description('List databases')
    .option('--json', 'Output raw JSON')
    .action(async (opts) => {
      try {
        const res = await client.get('/api/managed-databases');
        const dbs: any[] = res.data?.managedDatabases || [];
        if (opts.json) { printJson(dbs); return; }
        if (!dbs.length) { console.log('No databases found.'); return; }
        printTable(
          ['ID', 'NAME', 'ENGINE', 'LOCATION', 'STATUS', 'ENDPOINT', 'ATTACHED TO', 'CREATED'],
          dbs.map((d: any) => [
            d.id,
            d.displayName ? `${d.name} (${d.displayName})` : d.name,
            `${d.engine} ${d.engineVersion}`,
            d.provider === 'NEXUS_DOCKER' ? 'NEXUS AI (local)' : `${d.provider} ${d.region}`,
            d.status,
            d.endpointHost ? `${d.endpointHost}:${d.endpointPort}` : '—',
            (d.attachments || []).map((a: any) => a.deploymentName).join(', ') || '—',
            d.createdAt ? timeAgo(d.createdAt) : '—',
          ])
        );
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  md
    .command('create <name>')
    .description('Create a standalone database (paid plans)')
    .requiredOption('--engine <engine>', 'postgres or redis (--local); postgres or mysql (cloud)')
    .option('--local', 'Run it on NEXUS AI instead of a cloud provider')
    .option('--engine-version <version>', 'Local: 17/16/15 (postgres) or 7 (redis), newest by default. Cloud: required, e.g. 17.10')
    .option('--db-name <name>', 'Initial database name (local postgres; default appdb)')
    .option('--username <username>', 'Database user (local; default nexusadmin for postgres)')
    .option('--password <password>', 'Database password (local; generated when omitted)')
    .option('--password-stdin', 'Read the password from stdin, keeping it out of shell history')
    .option('--provider <provider>', 'Cloud provider: AWS_RDS, GCP_CLOUD_SQL, or AZURE_DATABASE')
    .option('--network-mode <mode>', 'public or vpc (AWS only; vpc = private, App Runner-only)')
    .option('--display-name <name>', 'Friendly display name')
    .option('--instance-class <class>', 'Cloud only, e.g. db.t3.micro (AWS) / db-custom-1-3840 (GCP)')
    .option('--allocated-gb <gb>', 'Cloud only. Storage in GB (20-1000)')
    .option('--region <region>', 'Cloud only. Cloud region')
    .option('--json', 'Output raw JSON')
    .action(async (name, opts) => {
      try {
        if (opts.local && opts.provider) {
          errorMsg('Use either --local or --provider, not both.');
          process.exit(1);
        }
        if (opts.password && opts.passwordStdin) {
          errorMsg('Use either --password or --password-stdin, not both.');
          process.exit(1);
        }
        const password = opts.passwordStdin ? await readStdin() : opts.password;
        const res = await client.post('/api/managed-databases', {
          name,
          provider: opts.local ? 'NEXUS_DOCKER' : opts.provider || 'AWS_RDS',
          networkMode: opts.networkMode,
          engine: normalizeEngine(opts.engine),
          engineVersion: opts.engineVersion,
          databaseName: opts.dbName,
          username: opts.username,
          password,
          displayName: opts.displayName,
          instanceClass: opts.instanceClass,
          allocatedGb: opts.allocatedGb ? Number(opts.allocatedGb) : undefined,
          region: opts.region,
        });
        const db = res.data?.managedDatabase;
        if (opts.json) { printJson(res.data); return; }
        success(`Database created: ${db?.name} (${db?.id})`);
        // Only echo a password the platform generated; one the user supplied
        // (especially via stdin) must not be printed back.
        if (res.data?.password && !password) {
          console.log(`  Password (shown once): ${res.data.password}`);
        }
        if (opts.local) {
          console.log(`  Ready in a few seconds. Then: nexus managed-db connection ${db?.name}`);
          console.log(`  Attach it to an app:      nexus managed-db attach ${db?.name} --deployment <app>`);
        } else {
          console.log('  Provisioning is async. Run `nexus managed-db list` until status is AVAILABLE.');
        }
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  md
    .command('connection <name-or-id>')
    .description('Show connection details for a local database (includes the password)')
    .option('--json', 'Output raw JSON')
    .option('--url-only', 'Print only the connection URL')
    .action(async (nameOrId, opts) => {
      try {
        const id = await resolveDbId(nameOrId);
        const res = await client.get(`/api/managed-databases/${id}/connection`);
        const c = res.data?.connection;
        if (opts.json) { printJson(c); return; }
        if (opts.urlOnly) { console.log(c?.url); return; }
        printTable(['Field', 'Value'], [
          ['Engine', c?.engine],
          ['URL', c?.url],
          ['Host', c?.host],
          ['Port', String(c?.port ?? '—')],
          ['Username', c?.username || '—'],
          ['Password', c?.password],
          ['Database', c?.databaseName || '—'],
        ]);
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  md
    .command('delete <name-or-id>')
    .description('Delete a database (destroys data)')
    .option('--force', 'Delete even while attached to apps (they lose the env vars on next deploy)')
    .option('--json', 'Output raw JSON')
    .action(async (nameOrId, opts) => {
      try {
        const id = await resolveDbId(nameOrId);
        await client.delete(`/api/managed-databases/${id}${opts.force ? '?force=true' : ''}`);
        if (opts.json) { printJson({ success: true }); return; }
        success(`Database ${nameOrId} deleted.`);
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  md
    .command('attach <name-or-id>')
    .description('Attach a database to an app')
    .requiredOption('--deployment <name-or-id>', 'Deployment name or ID')
    .option('--env-prefix <prefix>', 'Env var namespace (default DATABASE, or REDIS for Redis)')
    .option('--json', 'Output raw JSON')
    .action(async (nameOrId, opts) => {
      try {
        const id = await resolveDbId(nameOrId);
        const deploymentId = await resolveDeploymentId(opts.deployment);
        const res = await client.post(`/api/managed-databases/${id}/attach`, {
          deploymentId,
          envPrefix: opts.envPrefix,
        });
        if (opts.json) { printJson(res.data?.attachment); return; }
        const prefix = res.data?.attachment?.envPrefix || 'DATABASE';
        success(`Attached ${nameOrId} to ${opts.deployment} as ${prefix}_URL.`);
        console.log(`  Redeploy to apply: nexus deploy redeploy ${opts.deployment}`);
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  md
    .command('detach <name-or-id>')
    .description('Detach a database from an app')
    .requiredOption('--deployment <name-or-id>', 'Deployment name or ID')
    .option('--json', 'Output raw JSON')
    .action(async (nameOrId, opts) => {
      try {
        const id = await resolveDbId(nameOrId);
        const deploymentId = await resolveDeploymentId(opts.deployment);
        await client.post(`/api/managed-databases/${id}/detach`, { deploymentId });
        if (opts.json) { printJson({ success: true }); return; }
        success(`Detached ${nameOrId} from ${opts.deployment}.`);
        console.log(`  Redeploy to apply: nexus deploy redeploy ${opts.deployment}`);
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  md
    .command('snapshot <name-or-id>')
    .description('Create a snapshot backup of a database')
    .option('--notes <notes>', 'Optional notes')
    .option('--json', 'Output raw JSON')
    .action(async (nameOrId, opts) => {
      try {
        const id = await resolveDbId(nameOrId);
        const res = await client.post(`/api/managed-databases/${id}/snapshots`, { notes: opts.notes });
        const snap = res.data?.snapshot;
        if (opts.json) { printJson(snap); return; }
        success(`Snapshot ${snap?.id} (${snap?.status}).`);
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  md
    .command('snapshots <name-or-id>')
    .description('List snapshot backups for a database')
    .option('--json', 'Output raw JSON')
    .action(async (nameOrId, opts) => {
      try {
        const id = await resolveDbId(nameOrId);
        const res = await client.get(`/api/managed-databases/${id}/snapshots`);
        const snaps: any[] = res.data?.snapshots || [];
        if (opts.json) { printJson(snaps); return; }
        if (!snaps.length) { console.log('No snapshots found.'); return; }
        printTable(
          ['ID', 'STATUS', 'SIZE (B)', 'NOTES', 'CREATED'],
          snaps.map((s: any) => [s.id, s.status, String(s.sizeBytes), s.notes || '—', s.createdAt ? timeAgo(s.createdAt) : '—'])
        );
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  md
    .command('query <name-or-id> <sql>')
    .description('Run a SQL statement against a Postgres or MySQL database')
    .option('--json', 'Output raw JSON')
    .action(async (nameOrId, sql, opts) => {
      try {
        const id = await resolveDbId(nameOrId);
        const res = await client.post(`/api/managed-databases/${id}/query`, { sql });
        if (opts.json) { printJson(res.data); return; }
        const rows = res.data?.rows || [];
        console.log(`${res.data?.classification}: ${res.data?.rowCount} row(s)`);
        if (rows.length) printJson(rows);
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  md
    .command('restore <name-or-id>')
    .description('Restore a snapshot into a NEW database (non-destructive)')
    .requiredOption('--snapshot <snapshotId>', 'Snapshot ID to restore from')
    .requiredOption('--new-name <name>', 'Name for the restored database')
    .option('--json', 'Output raw JSON')
    .action(async (nameOrId, opts) => {
      try {
        const id = await resolveDbId(nameOrId);
        const res = await client.post(`/api/managed-databases/${id}/restore`, {
          snapshotId: opts.snapshot,
          newName: opts.newName,
        });
        const db = res.data?.managedDatabase;
        if (opts.json) { printJson(db); return; }
        success(`Restore started: new database ${db?.id} (${db?.status}). Run \`nexus managed-db list\` until AVAILABLE.`);
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });
}
