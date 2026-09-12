import { Command } from 'commander';
import inquirer from 'inquirer';
import { client, apiError, unwrap } from '../client.js';
import { printTable, printJson, success, errorMsg, timeAgo } from '../output.js';

function formatBytes(bytes: number | bigint): string {
  const n = typeof bytes === 'bigint' ? Number(bytes) : bytes;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function registerVolume(program: Command): void {
  const vol = program
    .command('volume')
    .description('Persistent storage volumes (filesystem mounts attached to deployments)');

  vol
    .command('list')
    .description('List volumes')
    .option('--json', 'Output raw JSON')
    .action(async (opts) => {
      try {
        const res = await client.get('/api/volumes');
        const volumes: any[] = unwrap(res.data) || [];
        if (opts.json) { printJson(volumes); return; }
        if (!volumes.length) { console.log('No volumes found.'); return; }

        printTable(
          ['ID', 'NAME', 'SIZE', 'STATUS', 'ATTACHED TO', 'CREATED'],
          volumes.map((v: any) => [
            v.id,
            v.displayName ? `${v.name} (${v.displayName})` : v.name,
            formatBytes(v.sizeBytes),
            v.status,
            v.attachment ? `${v.attachment.deploymentName}:${v.attachment.mountPath}` : '—',
            v.createdAt ? timeAgo(v.createdAt) : '—',
          ])
        );
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  vol
    .command('create <name>')
    .description('Create a new volume (org-scoped)')
    .option('--display-name <name>', 'Friendly display name')
    .option('--json', 'Output raw JSON')
    .action(async (name, opts) => {
      try {
        const res = await client.post('/api/volumes', { name, displayName: opts.displayName });
        const v = unwrap(res.data);
        if (opts.json) { printJson(v); return; }
        success(`Volume created: ${v.id}  (${v.name})`);
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  vol
    .command('delete <id>')
    .description('Delete a volume (must be detached first)')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (id, opts) => {
      if (!opts.yes) {
        const { confirm } = await inquirer.prompt([
          { type: 'confirm', name: 'confirm', message: `Delete volume "${id}"? Data is destroyed.`, default: false },
        ]);
        if (!confirm) { console.log('Cancelled.'); return; }
      }
      try {
        await client.delete(`/api/volumes/${id}`);
        success(`Volume ${id} deleted.`);
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  vol
    .command('attach <id> <deployment-id>')
    .description('Attach a volume to a deployment (requires redeploy to take effect)')
    .option('--mount <path>', 'Mount path inside the container', '/data')
    .action(async (id, deploymentId, opts) => {
      try {
        const res = await client.post(`/api/volumes/${id}/attach`, {
          deploymentId,
          mountPath: opts.mount,
        });
        const dv = unwrap(res.data);
        success(`Attached volume ${id} to deployment ${deploymentId} at ${dv.mountPath}.`);
        console.log("  Run 'nexus deploy redeploy <id>' to mount it.");
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  vol
    .command('detach <id>')
    .description('Detach a volume from its deployment')
    .action(async (id) => {
      try {
        await client.post(`/api/volumes/${id}/detach`);
        success(`Volume ${id} detached.`);
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  vol
    .command('refresh-usage <id>')
    .description('Refresh on-disk usage for a volume')
    .option('--json', 'Output raw JSON')
    .action(async (id, opts) => {
      try {
        const res = await client.post(`/api/volumes/${id}/refresh-usage`);
        const v = unwrap(res.data);
        if (opts.json) { printJson(v); return; }
        success(`${v.name}: ${formatBytes(v.sizeBytes)}`);
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });
}
