#!/usr/bin/env node
import { Command } from 'commander';
import { registerAuth } from './commands/auth.js';
import { registerDeploy } from './commands/deploy.js';
import { registerSecret } from './commands/secret.js';
import { registerProject } from './commands/project.js';
import { registerDomain } from './commands/domain.js';

const program = new Command();

program
  .name('nexus')
  .description('NEXUS AI command-line interface')
  .version('1.0.0');

registerAuth(program);
registerDeploy(program);
registerSecret(program);
registerProject(program);
registerDomain(program);

program.parseAsync(process.argv).catch((err) => {
  console.error(err.message || String(err));
  process.exit(1);
});
