import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { client, apiError, unwrap } from '../client.js';
import { printTable, printJson, success, errorMsg, timeAgo } from '../output.js';

const VALID_ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'DEPLOYMENT_MANAGER', 'AUDITOR', 'BILLING_MANAGER'];

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Developer',
  DEPLOYMENT_MANAGER: 'Deployment Manager',
  AUDITOR: 'Auditor',
  BILLING_MANAGER: 'Billing Manager',
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] || role;
}

function statusBadge(status: string): string {
  if (status === 'active') return chalk.green(status);
  if (status === 'suspended') return chalk.yellow(status);
  return chalk.gray(status);
}

export function registerMember(program: Command): void {
  const member = program.command('member').description('Team member management commands');

  // list
  member
    .command('list')
    .description('List all team members in the organization')
    .option('--json', 'Output raw JSON')
    .action(async (opts) => {
      try {
        const res = await client.get('/api/organizations/users');
        let members: any[] = unwrap(res.data);
        if (!Array.isArray(members)) members = [];

        if (opts.json) { printJson(members); return; }
        if (!members.length) { console.log('No members found.'); return; }

        printTable(
          ['ID', 'NAME', 'EMAIL', 'ROLE', 'STATUS', 'JOINED'],
          members.map((m: any) => [
            m.id,
            m.name || '—',
            m.email,
            roleLabel(m.role),
            statusBadge(m.status),
            m.createdAt ? timeAgo(m.createdAt) : '—',
          ])
        );
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // invite
  member
    .command('invite <email>')
    .description('Invite a new member to the organization')
    .requiredOption('--role <role>', `Role to assign (${VALID_ROLES.filter(r => r !== 'OWNER').join(', ')})`)
    .option('--json', 'Output raw JSON')
    .action(async (email, opts) => {
      const role = opts.role.toUpperCase();

      if (!VALID_ROLES.includes(role) || role === 'OWNER') {
        errorMsg(`Invalid role "${opts.role}". Valid roles: ${VALID_ROLES.filter(r => r !== 'OWNER').join(', ')}`);
        process.exit(1);
      }

      try {
        const res = await client.post('/api/organizations/users/invite', { email, role });
        const data = unwrap(res.data);
        const user = data.user || data;

        if (opts.json) { printJson(data); return; }

        success(`Invited ${email} as ${roleLabel(role)}.`);
        console.log(`  ${chalk.dim('User ID:')} ${user.id}`);
        console.log(`  ${chalk.dim('An email with login credentials has been sent.')}`);
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // role
  member
    .command('role <userId> <role>')
    .description('Update the role of a team member')
    .option('--json', 'Output raw JSON')
    .action(async (userId, roleArg, opts) => {
      const role = roleArg.toUpperCase();

      if (!VALID_ROLES.includes(role) || role === 'OWNER') {
        errorMsg(`Invalid role "${roleArg}". Valid roles: ${VALID_ROLES.filter(r => r !== 'OWNER').join(', ')}`);
        process.exit(1);
      }

      try {
        const res = await client.patch(`/api/organizations/users/${userId}/role`, { role });
        const updated = unwrap(res.data);

        if (opts.json) { printJson(updated); return; }

        success(`Updated ${updated.email} to ${roleLabel(updated.role)}.`);
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // suspend
  member
    .command('suspend <userId>')
    .description('Suspend a team member (blocks their access)')
    .option('--yes', 'Skip confirmation prompt')
    .option('--json', 'Output raw JSON')
    .action(async (userId, opts) => {
      if (!opts.yes) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Suspend member "${userId}"? They will lose access immediately.`,
            default: false,
          },
        ]);
        if (!confirm) { console.log('Cancelled.'); return; }
      }

      try {
        const res = await client.post(`/api/organizations/users/${userId}/suspend`, {});
        const updated = unwrap(res.data);

        if (opts.json) { printJson(updated); return; }

        success(`${updated.email} suspended.`);
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // activate
  member
    .command('activate <userId>')
    .description('Restore access for a suspended team member')
    .option('--json', 'Output raw JSON')
    .action(async (userId, opts) => {
      try {
        const res = await client.post(`/api/organizations/users/${userId}/activate`, {});
        const updated = unwrap(res.data);

        if (opts.json) { printJson(updated); return; }

        success(`${updated.email} activated.`);
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });
}
