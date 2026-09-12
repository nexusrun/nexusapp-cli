import { Command } from 'commander';
import { client, apiError } from '../client.js';
import { printTable, printJson, success, errorMsg, timeAgo } from '../output.js';

export function registerManagedDb(program: Command): void {
  const md = program
    .command('managed-db')
    .description('Managed cloud databases (AWS RDS instances)');

  md
    .command('list')
    .description('List managed databases')
    .option('--json', 'Output raw JSON')
    .action(async (opts) => {
      try {
        const res = await client.get('/api/managed-databases');
        const dbs: any[] = res.data?.managedDatabases || [];
        if (opts.json) { printJson(dbs); return; }
        if (!dbs.length) { console.log('No managed databases found.'); return; }
        printTable(
          ['ID', 'NAME', 'ENGINE', 'STATUS', 'ENDPOINT', 'CREATED'],
          dbs.map((d: any) => [
            d.id,
            d.displayName ? `${d.name} (${d.displayName})` : d.name,
            `${d.engine} ${d.engineVersion}`,
            d.status,
            d.endpointHost ? `${d.endpointHost}:${d.endpointPort}` : '—',
            d.createdAt ? timeAgo(d.createdAt) : '—',
          ])
        );
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  md
    .command('create <name>')
    .description('Provision a new managed database')
    .requiredOption('--engine <engine>', 'POSTGRES or MYSQL')
    .requiredOption('--engine-version <version>', 'e.g. 17.10 (postgres), 8.0.46 (mysql)')
    .option('--provider <provider>', 'AWS_RDS, GCP_CLOUD_SQL, or AZURE_DATABASE', 'AWS_RDS')
    .option('--network-mode <mode>', 'public or vpc (AWS only; vpc = private, App Runner-only)')
    .option('--display-name <name>', 'Friendly display name')
    .option('--instance-class <class>', 'e.g. db.t3.micro (AWS) / db-custom-1-3840 (GCP)')
    .option('--allocated-gb <gb>', 'Storage in GB (20-1000)')
    .option('--region <region>', 'Cloud region')
    .option('--json', 'Output raw JSON')
    .action(async (name, opts) => {
      try {
        const res = await client.post('/api/managed-databases', {
          name,
          provider: opts.provider,
          networkMode: opts.networkMode,
          engine: opts.engine,
          engineVersion: opts.engineVersion,
          displayName: opts.displayName,
          instanceClass: opts.instanceClass,
          allocatedGb: opts.allocatedGb ? Number(opts.allocatedGb) : undefined,
          region: opts.region,
        });
        const db = res.data?.managedDatabase;
        if (opts.json) { printJson(db); return; }
        success(`Managed database created: ${db?.id} (${db?.status})`);
        console.log('Provisioning is async — run `nexus managed-db list` until status is AVAILABLE.');
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  md
    .command('delete <id>')
    .description('Delete a managed database (destroys data)')
    .option('--json', 'Output raw JSON')
    .action(async (id, opts) => {
      try {
        await client.delete(`/api/managed-databases/${id}`);
        if (opts.json) { printJson({ success: true }); return; }
        success(`Managed database ${id} deleted.`);
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  md
    .command('attach <id>')
    .description('Attach a managed database to a deployment')
    .requiredOption('--deployment <deploymentId>', 'Deployment ID')
    .option('--env-prefix <prefix>', 'Env var namespace (default DATABASE)')
    .option('--json', 'Output raw JSON')
    .action(async (id, opts) => {
      try {
        const res = await client.post(`/api/managed-databases/${id}/attach`, {
          deploymentId: opts.deployment,
          envPrefix: opts.envPrefix,
        });
        if (opts.json) { printJson(res.data?.attachment); return; }
        success(`Attached to ${opts.deployment}. Redeploy for DATABASE_* env vars to take effect.`);
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  md
    .command('detach <id>')
    .description('Detach a managed database from a deployment')
    .requiredOption('--deployment <deploymentId>', 'Deployment ID')
    .option('--json', 'Output raw JSON')
    .action(async (id, opts) => {
      try {
        await client.post(`/api/managed-databases/${id}/detach`, { deploymentId: opts.deployment });
        if (opts.json) { printJson({ success: true }); return; }
        success(`Detached from ${opts.deployment}.`);
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  md
    .command('snapshot <id>')
    .description('Create a snapshot backup of a managed database')
    .option('--notes <notes>', 'Optional notes')
    .option('--json', 'Output raw JSON')
    .action(async (id, opts) => {
      try {
        const res = await client.post(`/api/managed-databases/${id}/snapshots`, { notes: opts.notes });
        const snap = res.data?.snapshot;
        if (opts.json) { printJson(snap); return; }
        success(`Snapshot ${snap?.id} started (${snap?.status}).`);
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  md
    .command('snapshots <id>')
    .description('List snapshot backups for a managed database')
    .option('--json', 'Output raw JSON')
    .action(async (id, opts) => {
      try {
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
    .command('query <id> <sql>')
    .description('Run a SQL statement against a managed database')
    .option('--json', 'Output raw JSON')
    .action(async (id, sql, opts) => {
      try {
        const res = await client.post(`/api/managed-databases/${id}/query`, { sql });
        if (opts.json) { printJson(res.data); return; }
        const rows = res.data?.rows || [];
        console.log(`${res.data?.classification}: ${res.data?.rowCount} row(s)`);
        if (rows.length) printJson(rows);
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  md
    .command('restore <id>')
    .description('Restore a snapshot into a NEW managed database (non-destructive)')
    .requiredOption('--snapshot <snapshotId>', 'Snapshot ID to restore from')
    .requiredOption('--new-name <name>', 'Name for the restored database')
    .option('--json', 'Output raw JSON')
    .action(async (id, opts) => {
      try {
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
