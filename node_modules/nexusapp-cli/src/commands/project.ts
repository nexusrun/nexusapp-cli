import { Command } from 'commander';
import inquirer from 'inquirer';
import { client, apiError, unwrap } from '../client.js';
import { printTable, printJson, success, errorMsg, timeAgo } from '../output.js';

export function registerProject(program: Command): void {
  const project = program.command('project').description('Project management commands');

  // list
  project
    .command('list')
    .description('List projects')
    .option('--json', 'Output raw JSON')
    .action(async (opts) => {
      try {
        const res = await client.get('/api/projects');
        const raw = unwrap(res.data);
        const projects = Array.isArray(raw) ? raw : raw.projects || [];

        if (opts.json) { printJson(projects); return; }
        if (!projects.length) { console.log('No projects found.'); return; }

        printTable(
          ['ID', 'NAME', 'CREATED'],
          projects.map((p: any) => [
            p.id,
            p.name,
            p.createdAt ? timeAgo(p.createdAt) : '—',
          ])
        );
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // create
  project
    .command('create')
    .description('Create a new project')
    .requiredOption('--name <name>', 'Project name')
    .option('--json', 'Output raw JSON')
    .action(async (opts) => {
      try {
        const res = await client.post('/api/projects', { name: opts.name });
        const p = unwrap(res.data);
        if (opts.json) { printJson(p); return; }
        success(`Project "${p.name}" created (${p.id})`);
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // delete
  project
    .command('delete <id>')
    .description('Delete a project')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (id, opts) => {
      if (!opts.yes) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Delete project "${id}"? All deployments in this project will be removed.`,
            default: false,
          },
        ]);
        if (!confirm) { console.log('Cancelled.'); return; }
      }

      try {
        await client.delete(`/api/projects/${id}`);
        success(`Project ${id} deleted.`);
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });
}
