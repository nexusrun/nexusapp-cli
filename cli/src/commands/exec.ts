import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { client, apiError, unwrap } from '../client.js';
import { success, errorMsg, printJson } from '../output.js';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Parse a "<deploymentId>:<path>" argument. Returns null if the arg has no
 * colon (i.e. it's a local path). UUIDs contain hyphens but no colons, so the
 * first ":" cleanly separates the two halves.
 */
function parseRemoteRef(arg: string): { deploymentId: string; remotePath: string } | null {
  const idx = arg.indexOf(':');
  if (idx < 0) return null;
  const deploymentId = arg.slice(0, idx);
  const remotePath = arg.slice(idx + 1);
  if (!deploymentId || !remotePath) return null;
  return { deploymentId, remotePath };
}

export function registerExec(program: Command): void {
  program
    .command('exec <deploymentId> [command...]')
    .description('Run a command inside the running deployment container (LOCAL_DOCKER only)')
    .option('--timeout <seconds>', 'Max seconds before the command is killed (default 60, max 1800)', (v) => parseInt(v, 10))
    .option('--workdir <path>', 'Working directory inside the container')
    .option('--json', 'Output raw JSON result')
    .allowUnknownOption(false)
    .action(async (deploymentId, commandParts, opts) => {
      if (!commandParts || commandParts.length === 0) {
        errorMsg('Provide a command to run, e.g. `nexus exec <id> ls -la /app`');
        process.exit(2);
      }

      try {
        const res = await client.post(
          `/api/deployments/${deploymentId}/exec`,
          {
            command: commandParts,
            timeoutSeconds: opts.timeout,
            workingDir: opts.workdir,
          },
          { timeout: 0 }
        );
        const result = unwrap(res.data);

        if (opts.json) {
          printJson(result);
          process.exit(result.exitCode === 0 ? 0 : 1);
        }

        if (result.stdout) process.stdout.write(result.stdout);
        if (result.stderr) process.stderr.write(result.stderr);
        if (result.truncated) {
          process.stderr.write('\n[output truncated at 2MB per stream]\n');
        }
        process.exit(result.exitCode === 0 ? 0 : result.exitCode || 1);
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  program
    .command('cp <source> <destination>')
    .description(
      'Copy a single file between a local path and a running deployment container.\n' +
      '  Upload:   nexus cp ./index.html <deploymentId>:/app/public/index.html\n' +
      '  Download: nexus cp <deploymentId>:/app/config.json ./config.json'
    )
    .action(async (source, destination) => {
      const srcRemote = parseRemoteRef(source);
      const dstRemote = parseRemoteRef(destination);

      if (srcRemote && dstRemote) {
        errorMsg('Container-to-container copy is not supported. Download first, then upload.');
        process.exit(2);
      }
      if (!srcRemote && !dstRemote) {
        errorMsg('At least one side must be a container reference (e.g. `<deploymentId>:/app/file.txt`).');
        process.exit(2);
      }

      try {
        if (!srcRemote && dstRemote) {
          // Upload: local -> container
          const localPath = path.resolve(source);
          if (!fs.existsSync(localPath)) {
            errorMsg(`Local file not found: ${localPath}`);
            process.exit(1);
          }
          const stat = fs.statSync(localPath);
          if (!stat.isFile()) {
            errorMsg(`Not a regular file: ${localPath} (directory uploads not supported — tar + exec instead)`);
            process.exit(1);
          }
          const stream = fs.createReadStream(localPath);
          const res = await client.post(
            `/api/deployments/${dstRemote.deploymentId}/files`,
            stream,
            {
              params: { path: dstRemote.remotePath },
              headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Length': String(stat.size),
              },
              timeout: 0,
              maxBodyLength: Infinity,
              maxContentLength: Infinity,
            }
          );
          const data = unwrap(res.data);
          success(`Uploaded ${formatBytes(data.bytesWritten || stat.size)} → ${dstRemote.deploymentId}:${data.targetPath || dstRemote.remotePath}`);
          return;
        }

        // Download: container -> local
        const remote = srcRemote!;
        const localPath = path.resolve(destination);
        const dir = path.dirname(localPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const res = await client.get(`/api/deployments/${remote.deploymentId}/files`, {
          params: { path: remote.remotePath },
          responseType: 'stream',
          timeout: 0,
          maxContentLength: Infinity,
        });

        let bytes = 0;
        res.data.on('data', (chunk: Buffer) => { bytes += chunk.length; });

        await new Promise<void>((resolve, reject) => {
          const writer = fs.createWriteStream(localPath);
          res.data.pipe(writer);
          writer.on('finish', () => resolve());
          writer.on('error', reject);
          res.data.on('error', reject);
        });

        success(`Downloaded ${formatBytes(bytes)} → ${localPath}`);
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });
}
