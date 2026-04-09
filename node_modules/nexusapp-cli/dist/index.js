#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const auth_js_1 = require("./commands/auth.js");
const deploy_js_1 = require("./commands/deploy.js");
const secret_js_1 = require("./commands/secret.js");
const project_js_1 = require("./commands/project.js");
const domain_js_1 = require("./commands/domain.js");
const program = new commander_1.Command();
program
    .name('nexus')
    .description('NEXUS AI command-line interface')
    .version('1.0.0');
(0, auth_js_1.registerAuth)(program);
(0, deploy_js_1.registerDeploy)(program);
(0, secret_js_1.registerSecret)(program);
(0, project_js_1.registerProject)(program);
(0, domain_js_1.registerDomain)(program);
program.parseAsync(process.argv).catch((err) => {
    console.error(err.message || String(err));
    process.exit(1);
});
//# sourceMappingURL=index.js.map