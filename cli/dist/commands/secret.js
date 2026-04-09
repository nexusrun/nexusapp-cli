"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSecret = registerSecret;
const inquirer_1 = __importDefault(require("inquirer"));
const client_js_1 = require("../client.js");
const output_js_1 = require("../output.js");
function registerSecret(program) {
    const secret = program.command('secret').description('Secret management commands');
    // list
    secret
        .command('list')
        .description('List secrets')
        .option('--environment <env>', 'Filter by environment')
        .option('--json', 'Output raw JSON')
        .action(async (opts) => {
        try {
            const params = {};
            if (opts.environment)
                params.environment = opts.environment;
            const res = await client_js_1.client.get('/api/secrets', { params });
            const raw = (0, client_js_1.unwrap)(res.data);
            const secrets = Array.isArray(raw) ? raw : raw.secrets || [];
            if (opts.json) {
                (0, output_js_1.printJson)(secrets);
                return;
            }
            if (!secrets.length) {
                console.log('No secrets found.');
                return;
            }
            (0, output_js_1.printTable)(['ID', 'NAME', 'ENVIRONMENT', 'CREATED'], secrets.map((s) => [
                s.id,
                s.name,
                s.environment || '—',
                s.createdAt ? (0, output_js_1.timeAgo)(s.createdAt) : '—',
            ]));
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
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
            const ans = await inquirer_1.default.prompt([
                { type: 'password', name: 'value', message: 'Value:', mask: '•' },
            ]);
            value = ans.value;
        }
        try {
            await client_js_1.client.post('/api/secrets', {
                name: opts.name,
                environment: opts.environment,
                value,
            });
            (0, output_js_1.success)(`Secret ${opts.name} created (${opts.environment})`);
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
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
            const ans = await inquirer_1.default.prompt([
                { type: 'password', name: 'value', message: 'New value:', mask: '•' },
            ]);
            value = ans.value;
        }
        try {
            await client_js_1.client.put(`/api/secrets/${id}`, { value });
            (0, output_js_1.success)(`Secret ${id} updated.`);
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
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
            const { confirm } = await inquirer_1.default.prompt([
                { type: 'confirm', name: 'confirm', message: `Delete secret "${id}"?`, default: false },
            ]);
            if (!confirm) {
                console.log('Cancelled.');
                return;
            }
        }
        try {
            await client_js_1.client.delete(`/api/secrets/${id}`);
            (0, output_js_1.success)(`Secret ${id} deleted.`);
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
            process.exit(1);
        }
    });
}
//# sourceMappingURL=secret.js.map