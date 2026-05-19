import { Command } from 'commander';
import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import { client, apiError, unwrap } from '../client.js';
import { printTable, printJson, success, errorMsg, spinner, timeAgo } from '../output.js';

function formatBytes(bytes: bigint | number): string {
  const n = typeof bytes === 'bigint' ? Number(bytes) : bytes;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve a deployment name or UUID to its ID, or return undefined to list all services. */
async function resolveDeploymentId(nameOrId?: string): Promise<string | undefined> {
  if (!nameOrId) return undefined;
  if (UUID_RE.test(nameOrId)) return nameOrId;
  const listRes = await client.get('/api/deployments');
  const raw = unwrap(listRes.data);
  const all: any[] = Array.isArray(raw) ? raw : raw.deployments || [];
  const match = all.find((d) => d.name === nameOrId || d.displayName === nameOrId);
  if (!match) throw new Error(`Deployment not found: "${nameOrId}"`);
  return match.id;
}

export function registerDatabase(program: Command): void {
  const db = program
    .command('db')
    .description('Database service and backup commands (run `nexus db services` to list service IDs)');

  // services (list)
  db
    .command('services [deployment-name-or-id]')
    .description('List database services and their IDs (optionally filtered by deployment)')
    .option('--json', 'Output raw JSON')
    .action(async (deployment, opts) => {
      try {
        const deploymentId = await resolveDeploymentId(deployment);
        const res = await client.get('/api/deployment-services', {
          params: deploymentId ? { deployment: deploymentId } : {},
        });
        const services: any[] = unwrap(res.data) || [];

        if (opts.json) { printJson(services); return; }
        if (!services.length) {
          console.log('No database services found. Provision one with `nexus deploy source ... --services postgresql,redis`.');
          return;
        }

        printTable(
          ['SERVICE ID', 'TYPE', 'NAME', 'DEPLOYMENT', 'STATUS', 'AUTO-BACKUP'],
          services.map((s: any) => [
            s.id,
            s.serviceType || '—',
            s.displayName || s.serviceName || '—',
            s.deployment?.displayName || s.deployment?.name || s.deploymentId || '—',
            s.status || '—',
            s.backupEnabled ? 'on' : 'off',
          ])
        );
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // backup
  db
    .command('backup <service-id>')
    .description('Create a database backup for a deployment service')
    .option('--json', 'Output raw JSON')
    .action(async (serviceId, opts) => {
      const spin = spinner('Creating backup...');
      try {
        const res = await client.post(`/api/deployment-services/${serviceId}/backup`);
        const backup = unwrap(res.data);
        spin.stop();
        if (opts.json) { printJson(backup); return; }
        printTable(
          ['ID', 'TYPE', 'SIZE', 'CREATED'],
          [[
            backup.id,
            backup.serviceType || '—',
            backup.fileSizeBytes != null ? formatBytes(backup.fileSizeBytes) : '—',
            backup.createdAt ? timeAgo(backup.createdAt) : '—',
          ]]
        );
      } catch (err) {
        spin.stop();
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // backups (list)
  db
    .command('backups <service-id>')
    .description('List backups for a deployment service')
    .option('--json', 'Output raw JSON')
    .action(async (serviceId, opts) => {
      try {
        const res = await client.get(`/api/deployment-services/${serviceId}/backups`);
        const raw = unwrap(res.data);
        const backups: any[] = Array.isArray(raw) ? raw : raw.backups || [];

        if (opts.json) { printJson(backups); return; }
        if (!backups.length) { console.log('No backups found.'); return; }

        printTable(
          ['ID', 'TYPE', 'SIZE', 'STATUS', 'CREATED'],
          backups.map((b: any) => [
            b.id,
            b.serviceType || '—',
            b.fileSizeBytes != null ? formatBytes(b.fileSizeBytes) : '—',
            b.status || '—',
            b.createdAt ? timeAgo(b.createdAt) : '—',
          ])
        );
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // restore
  db
    .command('restore <service-id> <backup-id>')
    .description('Restore a deployment service from a backup')
    .option('--yes', 'Skip confirmation prompt')
    .option('--json', 'Output raw JSON')
    .action(async (serviceId, backupId, opts) => {
      if (!opts.yes) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Restore will overwrite current data. Continue?',
            default: false,
          },
        ]);
        if (!confirm) { console.log('Cancelled.'); return; }
      }

      const spin = spinner('Restoring database...');
      try {
        const res = await client.post(`/api/deployment-services/${serviceId}/restore`, { backupId });
        const result = unwrap(res.data);
        spin.stop();
        if (opts.json) { printJson(result); return; }
        success('Database restored successfully.');
      } catch (err) {
        spin.stop();
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // backup-download
  db
    .command('backup-download <service-id> <backup-id>')
    .description('Download a backup file to your local machine (works for offline restore)')
    .option('--out <path>', 'Output file path (default: ./<original-filename>)')
    .option('--share', 'Print a short-lived signed URL instead of downloading directly')
    .option('--ttl <seconds>', 'Lifetime for --share URL in seconds (30-3600, default 300)', '300')
    .option('--json', 'Output raw JSON (only meaningful with --share)')
    .action(async (serviceId, backupId, opts) => {
      try {
        if (opts.share) {
          const res = await client.post(
            `/api/deployment-services/${serviceId}/backups/${backupId}/download-url`,
            { ttlSeconds: parseInt(opts.ttl, 10) || 300 }
          );
          const data = unwrap(res.data);
          if (opts.json) { printJson(data); return; }
          console.log(`URL:        ${data.url}`);
          console.log(`File:       ${data.fileName}`);
          console.log(`Size:       ${formatBytes(data.fileSizeBytes)}`);
          console.log(`Expires at: ${data.expiresAt}`);
          console.log('');
          console.log('Anyone with this URL can download the backup until it expires.');
          return;
        }

        const spin = spinner('Downloading backup...');
        const res = await client.get(
          `/api/deployment-services/${serviceId}/backups/${backupId}/download`,
          { responseType: 'stream' }
        );

        const disposition: string = res.headers['content-disposition'] || '';
        const matched = disposition.match(/filename="?([^"]+)"?/);
        const fileName = matched?.[1] || `backup-${backupId}`;
        const outPath = path.resolve(opts.out || fileName);

        const dir = path.dirname(outPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        await new Promise<void>((resolve, reject) => {
          const writer = fs.createWriteStream(outPath);
          res.data.pipe(writer);
          writer.on('finish', () => resolve());
          writer.on('error', reject);
          res.data.on('error', reject);
        });

        const size = fs.statSync(outPath).size;
        spin.stop();
        success(`Downloaded ${formatBytes(size)} → ${outPath}`);
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // restore-to (cross-service restore)
  db
    .command('restore-to <target-service-id> <backup-id>')
    .description('Restore a backup into a DIFFERENT deployment service in the same org (engines must match)')
    .option('--yes', 'Skip confirmation prompt')
    .option('--json', 'Output raw JSON')
    .action(async (targetServiceId, backupId, opts) => {
      if (!opts.yes) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Restore backup ${backupId} into service ${targetServiceId}? Existing data on the target will be overwritten.`,
            default: false,
          },
        ]);
        if (!confirm) { console.log('Cancelled.'); return; }
      }

      const spin = spinner('Restoring database into target service...');
      try {
        const res = await client.post(
          `/api/deployment-services/${targetServiceId}/restore-from/${backupId}`
        );
        const result = unwrap(res.data);
        spin.stop();
        if (opts.json) { printJson(result); return; }
        success('Database restored successfully into target service.');
      } catch (err) {
        spin.stop();
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // backup-delete
  db
    .command('backup-delete <service-id> <backup-id>')
    .description('Delete a backup')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (serviceId, backupId, opts) => {
      if (!opts.yes) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Permanently delete this backup?',
            default: false,
          },
        ]);
        if (!confirm) { console.log('Cancelled.'); return; }
      }

      try {
        await client.delete(`/api/deployment-services/${serviceId}/backups/${backupId}`);
        success('Backup deleted.');
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // backup-schedule
  db
    .command('backup-schedule <service-id>')
    .description('Enable or disable daily automatic backups for a deployment service')
    .option('--enable', 'Enable daily auto-backups')
    .option('--disable', 'Disable daily auto-backups')
    .option('--json', 'Output raw JSON')
    .action(async (serviceId, opts) => {
      if (!opts.enable && !opts.disable) {
        errorMsg('Specify either --enable or --disable.');
        process.exit(1);
      }

      const enabled = Boolean(opts.enable);
      try {
        const res = await client.patch(`/api/deployment-services/${serviceId}/backup/schedule`, { enabled });
        const result = unwrap(res.data);
        if (opts.json) { printJson(result); return; }
        success(enabled ? 'Daily backups enabled.' : 'Daily backups disabled.');
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });
}
