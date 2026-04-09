import { Command } from 'commander';
import inquirer from 'inquirer';
import { client, apiError, unwrap } from '../client.js';
import { printTable, printJson, success, errorMsg, timeAgo } from '../output.js';

export function registerSecret(program: Command): void {
  const secret = program.command('secret').description('Secret management commands');

  // list
  secret
    .command('list')
    .description('List secrets')
    .option('--environment <env>', 'Filter by environment')
    .option('--json', 'Output raw JSON')
    .action(async (opts) => {
      try {
        const params: Record<string, string> = {};
        if (opts.environment) params.environment = opts.environment;

        const res = await client.get('/api/secrets', { params });
        const raw = unwrap(res.data);
        const secrets = Array.isArray(raw) ? raw : raw.secrets || [];

        if (opts.json) { printJson(secrets); return; }
        if (!secrets.length) { console.log('No secrets found.'); return; }

        printTable(
          ['ID', 'NAME', 'ENVIRONMENT', 'CREATED'],
          secrets.map((s: any) => [
            s.id,
            s.name,
            s.environment || '—',
            s.createdAt ? timeAgo(s.createdAt) : '—',
          ])
        );
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // create
  secret
    .command('create')
    .description('Create a new secret')
    .requiredOption('--name <name>', 'Secret name')
    .requiredOption('--environment <env>', 'Target environment')
    .option('--value <value>', 'Secret value (prompt if omitted)')
    .action(async (opts) => {
      let value = opts.value;

      if (!value) {
        const ans = await inquirer.prompt([
          { type: 'password', name: 'value', message: 'Value:', mask: '•' },
        ]);
        value = ans.value;
      }

      try {
        await client.post('/api/secrets', {
          name: opts.name,
          environment: opts.environment,
          value,
        });
        success(`Secret ${opts.name} created (${opts.environment})`);
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // update
  secret
    .command('update <id>')
    .description('Update a secret value')
    .option('--value <value>', 'New secret value (prompt if omitted)')
    .action(async (id, opts) => {
      let value = opts.value;

      if (!value) {
        const ans = await inquirer.prompt([
          { type: 'password', name: 'value', message: 'New value:', mask: '•' },
        ]);
        value = ans.value;
      }

      try {
        await client.put(`/api/secrets/${id}`, { value });
        success(`Secret ${id} updated.`);
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // delete
  secret
    .command('delete <id>')
    .description('Delete a secret')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (id, opts) => {
      if (!opts.yes) {
        const { confirm } = await inquirer.prompt([
          { type: 'confirm', name: 'confirm', message: `Delete secret "${id}"?`, default: false },
        ]);
        if (!confirm) { console.log('Cancelled.'); return; }
      }

      try {
        await client.delete(`/api/secrets/${id}`);
        success(`Secret ${id} deleted.`);
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });
}
