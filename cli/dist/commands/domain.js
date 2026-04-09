"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDomain = registerDomain;
const inquirer_1 = __importDefault(require("inquirer"));
const client_js_1 = require("../client.js");
const output_js_1 = require("../output.js");
const chalk_1 = __importDefault(require("chalk"));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function resolveDeployment(nameOrId) {
    if (UUID_RE.test(nameOrId)) {
        try {
            const res = await client_js_1.client.get(`/api/deployments/${nameOrId}`);
            return (0, client_js_1.unwrap)(res.data);
        }
        catch { /* fall through */ }
    }
    const listRes = await client_js_1.client.get('/api/deployments');
    const all = Array.isArray((0, client_js_1.unwrap)(listRes.data)) ? (0, client_js_1.unwrap)(listRes.data) : [];
    const match = all.find((d) => d.name === nameOrId || d.displayName === nameOrId);
    if (!match)
        throw new Error(`Deployment not found: "${nameOrId}"`);
    const res = await client_js_1.client.get(`/api/deployments/${match.id}`);
    return (0, client_js_1.unwrap)(res.data);
}
function verificationBadge(status) {
    switch ((status || '').toUpperCase()) {
        case 'VERIFIED': return chalk_1.default.green('VERIFIED');
        case 'PENDING': return chalk_1.default.yellow('PENDING');
        case 'FAILED': return chalk_1.default.red('FAILED');
        default: return chalk_1.default.gray(status || 'UNKNOWN');
    }
}
function registerDomain(program) {
    const domain = program.command('domain').description('Custom domain management');
    // list
    domain
        .command('list <deployment>')
        .description('List custom domains for a deployment')
        .option('--json', 'Output raw JSON')
        .action(async (nameOrId, opts) => {
        try {
            const d = await resolveDeployment(nameOrId);
            const res = await client_js_1.client.get(`/api/deployments/${d.id}/domains`);
            const domains = (0, client_js_1.unwrap)(res.data) || [];
            if (opts.json) {
                (0, output_js_1.printJson)(domains);
                return;
            }
            if (!domains.length) {
                console.log(`No custom domains on "${d.displayName || d.name}".`);
                return;
            }
            (0, output_js_1.printTable)(['ID', 'DOMAIN', 'STATUS', 'SSL', 'ADDED'], domains.map((dom) => [
                dom.id,
                dom.domain,
                verificationBadge(dom.verificationStatus),
                dom.sslStatus ? chalk_1.default.green('✓') : chalk_1.default.gray('—'),
                dom.createdAt ? (0, output_js_1.timeAgo)(dom.createdAt) : '—',
            ]));
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
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
            const res = await client_js_1.client.post(`/api/deployments/${d.id}/domains`, { domain: domainName });
            const dom = (0, client_js_1.unwrap)(res.data);
            if (opts.json) {
                (0, output_js_1.printJson)(dom);
                return;
            }
            (0, output_js_1.success)(`Domain "${dom.domain}" added to "${d.displayName || d.name}"`);
            console.log('');
            console.log('  Next steps to verify ownership:');
            if (dom.txtRecord || dom.verificationToken) {
                console.log(`  1. Add a DNS TXT record:`);
                console.log(`     Name:  ${chalk_1.default.cyan(dom.txtRecordName || `_nexusai-verify.${domainName}`)}`);
                console.log(`     Value: ${chalk_1.default.cyan(dom.txtRecord || dom.verificationToken)}`);
            }
            else {
                console.log(`  1. Point your DNS to the deployment URL`);
            }
            console.log(`  2. Run: ${chalk_1.default.bold(`nexus domain verify ${nameOrId} ${dom.id}`)}`);
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
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
            const res = await client_js_1.client.post(`/api/deployments/${d.id}/domains/${domainId}/verify`);
            const result = (0, client_js_1.unwrap)(res.data);
            if (opts.json) {
                (0, output_js_1.printJson)(result);
                return;
            }
            const dom = result.domain || result;
            const status = (dom.verificationStatus || '').toUpperCase();
            if (status === 'VERIFIED') {
                (0, output_js_1.success)(`Domain "${dom.domain}" verified successfully`);
                if (dom.sslStatus) {
                    console.log(`  SSL: ${chalk_1.default.green('active')}`);
                }
            }
            else {
                console.log(`  Status: ${verificationBadge(status)}`);
                console.log('');
                if (result.verificationResult?.error) {
                    console.log(`  ${chalk_1.default.yellow('!')} ${result.verificationResult.error}`);
                }
                console.log(`  DNS changes can take up to 48h to propagate.`);
                console.log(`  Run this command again once DNS has updated.`);
            }
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
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
                    const listRes = await client_js_1.client.get(`/api/deployments/${d.id}/domains`);
                    const domains = (0, client_js_1.unwrap)(listRes.data) || [];
                    const found = domains.find((dom) => dom.id === domainId);
                    if (found)
                        domainName = found.domain;
                }
                catch { /* use id */ }
                const { confirm } = await inquirer_1.default.prompt([
                    { type: 'confirm', name: 'confirm', message: `Remove domain "${domainName}" from "${d.displayName || d.name}"?`, default: false },
                ]);
                if (!confirm) {
                    console.log('Cancelled.');
                    return;
                }
            }
            await client_js_1.client.delete(`/api/deployments/${d.id}/domains/${domainId}`);
            (0, output_js_1.success)(`Domain removed.`);
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
            process.exit(1);
        }
    });
}
//# sourceMappingURL=domain.js.map