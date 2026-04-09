"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerProject = registerProject;
const inquirer_1 = __importDefault(require("inquirer"));
const client_js_1 = require("../client.js");
const output_js_1 = require("../output.js");
function registerProject(program) {
    const project = program.command('project').description('Project management commands');
    // list
    project
        .command('list')
        .description('List projects')
        .option('--json', 'Output raw JSON')
        .action(async (opts) => {
        try {
            const res = await client_js_1.client.get('/api/projects');
            const raw = (0, client_js_1.unwrap)(res.data);
            const projects = Array.isArray(raw) ? raw : raw.projects || [];
            if (opts.json) {
                (0, output_js_1.printJson)(projects);
                return;
            }
            if (!projects.length) {
                console.log('No projects found.');
                return;
            }
            (0, output_js_1.printTable)(['ID', 'NAME', 'CREATED'], projects.map((p) => [
                p.id,
                p.name,
                p.createdAt ? (0, output_js_1.timeAgo)(p.createdAt) : '—',
            ]));
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
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
            const res = await client_js_1.client.post('/api/projects', { name: opts.name });
            const p = (0, client_js_1.unwrap)(res.data);
            if (opts.json) {
                (0, output_js_1.printJson)(p);
                return;
            }
            (0, output_js_1.success)(`Project "${p.name}" created (${p.id})`);
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
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
            const { confirm } = await inquirer_1.default.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: `Delete project "${id}"? All deployments in this project will be removed.`,
                    default: false,
                },
            ]);
            if (!confirm) {
                console.log('Cancelled.');
                return;
            }
        }
        try {
            await client_js_1.client.delete(`/api/projects/${id}`);
            (0, output_js_1.success)(`Project ${id} deleted.`);
        }
        catch (err) {
            (0, output_js_1.errorMsg)((0, client_js_1.apiError)(err));
            process.exit(1);
        }
    });
}
//# sourceMappingURL=project.js.map