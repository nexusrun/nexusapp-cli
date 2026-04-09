import { Command } from 'commander';
import inquirer from 'inquirer';
import { client, apiError, unwrap } from '../client.js';
import { printTable, printJson, success, errorMsg, timeAgo } from '../output.js';
import chalk from 'chalk';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveDeployment(nameOrId: string): Promise<any> {
  if (UUID_RE.test(nameOrId)) {
    try {
      const res = await client.get(`/api/deployments/${nameOrId}`);
      return unwrap(res.data);
    } catch { /* fall through */ }
  }
  const listRes = await client.get('/api/deployments');
  const all: any[] = Array.isArray(unwrap(listRes.data)) ? unwrap(listRes.data) : [];
  const match = all.find((d) => d.name === nameOrId || d.displayName === nameOrId);
  if (!match) throw new Error(`Deployment not found: "${nameOrId}"`);
  const res = await client.get(`/api/deployments/${match.id}`);
  return unwrap(res.data);
}

function verificationBadge(status: string): string {
  switch ((status || '').toUpperCase()) {
    case 'VERIFIED': return chalk.green('VERIFIED');
    case 'PENDING':  return chalk.yellow('PENDING');
    case 'FAILED':   return chalk.red('FAILED');
    default:         return chalk.gray(status || 'UNKNOWN');
  }
}

export function registerDomain(program: Command): void {
  const domain = program.command('domain').description('Custom domain management');

  // list
  domain
    .command('list <deployment>')
    .description('List custom domains for a deployment')
    .option('--json', 'Output raw JSON')
    .action(async (nameOrId, opts) => {
      try {
        const d = await resolveDeployment(nameOrId);
        const res = await client.get(`/api/deployments/${d.id}/domains`);
        const domains: any[] = unwrap(res.data) || [];

        if (opts.json) { printJson(domains); return; }
        if (!domains.length) {
          console.log(`No custom domains on "${d.displayName || d.name}".`);
          return;
        }

        printTable(
          ['ID', 'DOMAIN', 'STATUS', 'SSL', 'ADDED'],
          domains.map((dom: any) => [
            dom.id,
            dom.domain,
            verificationBadge(dom.verificationStatus),
            dom.sslStatus ? chalk.green('✓') : chalk.gray('—'),
            dom.createdAt ? timeAgo(dom.createdAt) : '—',
          ])
        );
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // add
  domain
    .command('add <deployment> <domain>')
    .description('Add a custom domain to a deployment')
    .option('--json', 'Output raw JSON')
    .action(async (nameOrId, domainName, opts) => {
      try {
        const d = await resolveDeployment(nameOrId);
        const res = await client.post(`/api/deployments/${d.id}/domains`, { domain: domainName });
        const dom = unwrap(res.data);

        if (opts.json) { printJson(dom); return; }

        success(`Domain "${dom.domain}" added to "${d.displayName || d.name}"`);
        console.log('');
        console.log('  Next steps to verify ownership:');
        if (dom.txtRecord || dom.verificationToken) {
          console.log(`  1. Add a DNS TXT record:`);
          console.log(`     Name:  ${chalk.cyan(dom.txtRecordName || `_nexusai-verify.${domainName}`)}`);
          console.log(`     Value: ${chalk.cyan(dom.txtRecord || dom.verificationToken)}`);
        } else {
          console.log(`  1. Point your DNS to the deployment URL`);
        }
        console.log(`  2. Run: ${chalk.bold(`nexus domain verify ${nameOrId} ${dom.id}`)}`);
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // verify
  domain
    .command('verify <deployment> <domain-id>')
    .description('Trigger DNS verification for a custom domain')
    .option('--json', 'Output raw JSON')
    .action(async (nameOrId, domainId, opts) => {
      try {
        const d = await resolveDeployment(nameOrId);
        const res = await client.post(`/api/deployments/${d.id}/domains/${domainId}/verify`);
        const result = unwrap(res.data);

        if (opts.json) { printJson(result); return; }

        const dom = result.domain || result;
        const status = (dom.verificationStatus || '').toUpperCase();

        if (status === 'VERIFIED') {
          success(`Domain "${dom.domain}" verified successfully`);
          if (dom.sslStatus) {
            console.log(`  SSL: ${chalk.green('active')}`);
          }
        } else {
          console.log(`  Status: ${verificationBadge(status)}`);
          console.log('');
          if (result.verificationResult?.error) {
            console.log(`  ${chalk.yellow('!')} ${result.verificationResult.error}`);
          }
          console.log(`  DNS changes can take up to 48h to propagate.`);
          console.log(`  Run this command again once DNS has updated.`);
        }
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });

  // remove
  domain
    .command('remove <deployment> <domain-id>')
    .description('Remove a custom domain from a deployment')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (nameOrId, domainId, opts) => {
      try {
        const d = await resolveDeployment(nameOrId);

        if (!opts.yes) {
          // Show the domain name in the prompt
          let domainName = domainId;
          try {
            const listRes = await client.get(`/api/deployments/${d.id}/domains`);
            const domains: any[] = unwrap(listRes.data) || [];
            const found = domains.find((dom) => dom.id === domainId);
            if (found) domainName = found.domain;
          } catch { /* use id */ }

          const { confirm } = await inquirer.prompt([
            { type: 'confirm', name: 'confirm', message: `Remove domain "${domainName}" from "${d.displayName || d.name}"?`, default: false },
          ]);
          if (!confirm) { console.log('Cancelled.'); return; }
        }

        await client.delete(`/api/deployments/${d.id}/domains/${domainId}`);
        success(`Domain removed.`);
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });
}
