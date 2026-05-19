import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { client, apiError, unwrap } from '../client.js';
import { printTable, printJson, success, errorMsg, timeAgo } from '../output.js';

function parseDuration(str: string): Date {
  const match = str.match(/^(\d+)(d|h|m)$/);
  if (!match) {
    throw new Error(`Invalid duration "${str}". Use format like: 90d, 4h, 30m`);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const msMap: Record<string, number> = { d: 86400000, h: 3600000, m: 60000 };
  return new Date(Date.now() + value * msMap[unit]);
}

function formatScopes(scopes: string): string {
  return scopes
    .split(',')
    .map((s) => s.trim())
    .join(', ');
}

function tokenStatus(t: any): string {
  if (t.revokedAt) return chalk.red('revoked');
  if (t.expiresAt && new Date(t.expiresAt) < new Date()) return chalk.yellow('expired');
  return chalk.green('active');
}

export function registerToken(program: Command): void {
  const token = program.command('token').description('Access token management commands');

  // list
  token
    .command('list')
    .description('List access tokens')
    .option('--json', 'Output raw JSON')
    .option('--show-last-used', 'Show last used column')
    .option('--no-expiry', 'Show only tokens with no expiry date')
    .option('--unused-since <days>', 'Show tokens unused for N or more days')
    .action(async (opts) => {
      try {
        const res = await client.get('/api/tokens');
        let tokens: any[] = unwrap(res.data);
        if (!Array.isArray(tokens)) tokens = [];

        if (opts.noExpiry) {
          tokens = tokens.filter((t: any) => !t.expiresAt);
        }

        if (opts.unusedSince) {
          const days = parseInt(opts.unusedSince, 10);
          if (isNaN(days) || days < 0) {
            errorMsg('--unused-since requires a positive integer (number of days)');
            process.exit(1);
          }
          const cutoff = new Date(Date.now() - days * 86400000);
          tokens = tokens.filter((t: any) => {
            if (!t.lastUsedAt) return true;
            return new Date(t.lastUsedAt) < cutoff;
          });
        }

        if (opts.json) { printJson(tokens); return; }
        if (!tokens.length) { console.log('No tokens found.'); return; }

        const headers = ['ID', 'NAME', 'SCOPES', 'STATUS', 'EXPIRES', 'CREATED'];
        if (opts.showLastUsed) headers.push('LAST USED');

        printTable(
          headers,
          tokens.map((t: any) => {
            const row: (string | null)[] = [
              t.id,
              t.name,
              formatScopes(t.scopes || ''),
              tokenStatus(t),
              t.expiresAt ? timeAgo(t.expiresAt) : '—',
              t.createdAt ? timeAgo(t.createdAt) : '—',
            ];
            if (opts.showLastUsed) {
              row.push(t.lastUsedAt ? timeAgo(t.lastUsedAt) : 'never');
            }
            return row;
          })
        );
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // create
  token
    .command('create')
    .description('Create a new access token')
    .requiredOption('--name <name>', 'Token name')
    .requiredOption('--scopes <scopes>', 'Comma-separated scopes (e.g. deploy:write,secrets:read)')
    .option('--expires <duration>', 'Expiry duration (e.g. 90d, 4h, 30m)')
    .option('--json', 'Output raw JSON')
    .action(async (opts) => {
      let expiresAt: string | undefined;

      if (opts.expires) {
        try {
          expiresAt = parseDuration(opts.expires).toISOString();
        } catch (e: any) {
          errorMsg(e.message);
          process.exit(1);
        }
      }

      try {
        const res = await client.post('/api/tokens', {
          name: opts.name,
          scopes: opts.scopes,
          ...(expiresAt ? { expiresAt } : {}),
        });

        const data = unwrap(res.data);

        if (opts.json) { printJson(data); return; }

        console.log('');
        console.log(chalk.bold('Token created'));
        console.log('');
        console.log(`  ${chalk.dim('ID:')}      ${data.id}`);
        console.log(`  ${chalk.dim('Name:')}    ${data.name}`);
        console.log(`  ${chalk.dim('Scopes:')}  ${formatScopes(data.scopes)}`);
        if (data.expiresAt) {
          console.log(`  ${chalk.dim('Expires:')} ${new Date(data.expiresAt).toLocaleDateString()}`);
        }
        console.log('');
        console.log(`  ${chalk.dim('Token value (shown once — copy it now):')}`)
        console.log('');
        console.log(`  ${chalk.cyan(data.token)}`);
        console.log('');
        console.log(chalk.yellow('  This value will not be shown again.'));
        console.log('');
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // revoke
  token
    .command('revoke <id>')
    .description('Revoke an access token')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (id, opts) => {
      if (!opts.yes) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Revoke token "${id}"? This cannot be undone.`,
            default: false,
          },
        ]);
        if (!confirm) { console.log('Cancelled.'); return; }
      }

      try {
        await client.post(`/api/tokens/${id}/revoke`, {});
        success(`Token ${id} revoked.`);
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });
}
