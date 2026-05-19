import { Command } from 'commander';
import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import { client, apiError, unwrap } from '../client.js';
import { printTable, printJson, success, errorMsg, timeAgo } from '../output.js';

function formatBytes(bytes: number | bigint): string {
  const n = typeof bytes === 'bigint' ? Number(bytes) : bytes;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function registerBucket(program: Command): void {
  const bk = program
    .command('bucket')
    .description('Object storage buckets (S3-compatible MinIO buckets)');

  bk
    .command('list')
    .description('List buckets')
    .option('--json', 'Output raw JSON')
    .action(async (opts) => {
      try {
        const res = await client.get('/api/buckets');
        const buckets: any[] = unwrap(res.data) || [];
        if (opts.json) { printJson(buckets); return; }
        if (!buckets.length) { console.log('No buckets found.'); return; }

        printTable(
          ['ID', 'NAME', 'SIZE', 'OBJECTS', 'ATTACHED TO', 'CREATED'],
          buckets.map((b: any) => [
            b.id,
            b.displayName ? `${b.name} (${b.displayName})` : b.name,
            formatBytes(b.sizeBytes),
            String(b.objectCount),
            b.attachments?.length ? b.attachments.map((a: any) => a.deploymentName).join(', ') : '—',
            b.createdAt ? timeAgo(b.createdAt) : '—',
          ])
        );
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  bk
    .command('create <name>')
    .description('Create a new bucket (org-scoped)')
    .option('--display-name <name>', 'Friendly display name')
    .option('--region <region>', 'Region', 'us-east-1')
    .option('--json', 'Output raw JSON')
    .action(async (name, opts) => {
      try {
        const res = await client.post('/api/buckets', {
          name,
          displayName: opts.displayName,
          region: opts.region,
        });
        const b = unwrap(res.data);
        if (opts.json) { printJson(b); return; }
        success(`Bucket created: ${b.id}  (${b.name})`);
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  bk
    .command('delete <id>')
    .description('Delete a bucket (must be detached first; deletes all objects)')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (id, opts) => {
      if (!opts.yes) {
        const { confirm } = await inquirer.prompt([
          { type: 'confirm', name: 'confirm', message: `Delete bucket "${id}" and ALL its objects?`, default: false },
        ]);
        if (!confirm) { console.log('Cancelled.'); return; }
      }
      try {
        await client.delete(`/api/buckets/${id}`);
        success(`Bucket ${id} deleted.`);
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  bk
    .command('attach <id> <deployment-id>')
    .description('Attach a bucket to a deployment (injects S3_* env vars on next deploy)')
    .action(async (id, deploymentId) => {
      try {
        await client.post(`/api/buckets/${id}/attach`, { deploymentId });
        success(`Attached bucket ${id} to deployment ${deploymentId}.`);
        console.log("  Run 'nexus deploy redeploy <id>' for env vars to take effect.");
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  bk
    .command('detach <id> <deployment-id>')
    .description('Detach a bucket from a deployment')
    .action(async (id, deploymentId) => {
      try {
        await client.post(`/api/buckets/${id}/detach`, { deploymentId });
        success(`Bucket ${id} detached from ${deploymentId}.`);
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  bk
    .command('credentials <id>')
    .description('Reveal the S3-compatible credentials for an external client (audit-logged)')
    .option('--json', 'Output raw JSON')
    .action(async (id, opts) => {
      try {
        const res = await client.get(`/api/buckets/${id}/credentials`);
        const c = unwrap(res.data);
        if (opts.json) { printJson(c); return; }
        console.log(`Endpoint:    ${c.endpoint}`);
        console.log(`Region:      ${c.region}`);
        console.log(`Bucket:      ${c.bucket}`);
        console.log(`Access key:  ${c.accessKey}`);
        console.log(`Secret key:  ${c.secretKey}`);
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  bk
    .command('rotate-credentials <id>')
    .description('Rotate the per-bucket S3 access key (use to migrate legacy buckets to scoped IAM)')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (id, opts) => {
      if (!opts.yes) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Rotate credentials? Attached deployments must be redeployed to pick up new S3_* env vars.',
            default: false,
          },
        ]);
        if (!confirm) { console.log('Cancelled.'); return; }
      }
      try {
        await client.post(`/api/buckets/${id}/rotate-credentials`);
        success(`Credentials rotated. Redeploy any attached deployments.`);
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  bk
    .command('refresh-usage <id>')
    .description('Refresh size and object count for a bucket')
    .option('--json', 'Output raw JSON')
    .action(async (id, opts) => {
      try {
        const res = await client.post(`/api/buckets/${id}/refresh-usage`);
        const b = unwrap(res.data);
        if (opts.json) { printJson(b); return; }
        success(`${b.name}: ${formatBytes(b.sizeBytes)} across ${b.objectCount} object(s)`);
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  // ---- file ops ------------------------------------------------------------

  bk
    .command('files <id>')
    .description('List files in a bucket')
    .option('--prefix <prefix>', 'Filter by key prefix')
    .option('--limit <n>', 'Max keys to return (default 1000)', '1000')
    .option('--json', 'Output raw JSON')
    .action(async (id, opts) => {
      try {
        const params: Record<string, string> = { limit: opts.limit };
        if (opts.prefix) params.prefix = opts.prefix;
        const res = await client.get(`/api/buckets/${id}/files`, { params });
        const data = unwrap(res.data);
        if (opts.json) { printJson(data); return; }
        if (!data.objects?.length) { console.log('Empty.'); return; }
        printTable(
          ['KEY', 'SIZE', 'MODIFIED'],
          data.objects.map((o: any) => [
            o.key,
            formatBytes(o.sizeBytes),
            o.lastModified ? timeAgo(o.lastModified) : '—',
          ])
        );
        if (data.truncated) console.log(`(truncated — pass --limit to see more)`);
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  bk
    .command('upload <id> <local-file>')
    .description('Upload a local file into the bucket')
    .option('--key <key>', 'Object key (default: filename of local file)')
    .action(async (id, localFile, opts) => {
      try {
        if (!fs.existsSync(localFile)) {
          errorMsg(`File not found: ${localFile}`);
          process.exit(1);
        }
        const key = opts.key || path.basename(localFile);
        const stat = fs.statSync(localFile);
        const stream = fs.createReadStream(localFile);
        await client.put(
          `/api/buckets/${id}/files/${encodeURIComponent(key)}`,
          stream,
          { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(stat.size) } }
        );
        success(`Uploaded ${formatBytes(stat.size)} → ${key}`);
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  bk
    .command('download <id> <key>')
    .description('Download a file from the bucket')
    .option('--out <path>', 'Local output path (default: key basename)')
    .option('--share', 'Print a short-lived signed URL instead of downloading')
    .option('--ttl <seconds>', 'Lifetime for --share URL in seconds (30-3600, default 300)', '300')
    .option('--json', 'Output raw JSON (only with --share)')
    .action(async (id, key, opts) => {
      try {
        if (opts.share) {
          const res = await client.post(
            `/api/buckets/${id}/files/${encodeURIComponent(key)}/download-url`,
            { ttlSeconds: parseInt(opts.ttl, 10) || 300 }
          );
          const data = unwrap(res.data);
          if (opts.json) { printJson(data); return; }
          console.log(`URL:        ${data.url}`);
          console.log(`Key:        ${data.key}`);
          console.log(`Expires at: ${data.expiresAt}`);
          return;
        }

        const res = await client.get(
          `/api/buckets/${id}/files/${encodeURIComponent(key)}/download`,
          { responseType: 'stream' }
        );
        const outPath = path.resolve(opts.out || path.basename(key));
        const dir = path.dirname(outPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        await new Promise<void>((resolve, reject) => {
          const writer = fs.createWriteStream(outPath);
          res.data.pipe(writer);
          writer.on('finish', () => resolve());
          writer.on('error', reject);
          res.data.on('error', reject);
        });
        success(`Downloaded → ${outPath}`);
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });

  bk
    .command('rm <id> <key>')
    .description('Delete a file from the bucket')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (id, key, opts) => {
      if (!opts.yes) {
        const { confirm } = await inquirer.prompt([
          { type: 'confirm', name: 'confirm', message: `Delete "${key}"?`, default: false },
        ]);
        if (!confirm) { console.log('Cancelled.'); return; }
      }
      try {
        await client.delete(`/api/buckets/${id}/files/${encodeURIComponent(key)}`);
        success(`Deleted ${key}`);
      } catch (err) { errorMsg(apiError(err)); process.exit(1); }
    });
}
