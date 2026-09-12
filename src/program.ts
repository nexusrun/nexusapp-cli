import { Command } from 'commander';
import packageJson from '../package.json';
import { registerAuth } from './commands/auth.js';
import { registerDeploy } from './commands/deploy.js';
import { registerSecret } from './commands/secret.js';
import { registerProject } from './commands/project.js';
import { registerDomain } from './commands/domain.js';
import { registerToken } from './commands/token.js';
import { registerMember } from './commands/member.js';
import { registerDatabase } from './commands/database.js';
import { registerVolume } from './commands/volume.js';
import { registerBucket } from './commands/bucket.js';
import { registerManagedDb } from './commands/managedDb.js';
import { registerExec } from './commands/exec.js';

// Read from package.json at build time so this can never drift from the
// published version again (it silently did, frozen at 3.1.2, through every
// bump up to 4.1.2).
export const VERSION = packageJson.version;

/** Build a fresh command tree. The REPL rebuilds one per line so commander
 *  option state never bleeds between commands. */
export function buildProgram(): Command {
  const program = new Command();

  program
    .name('nexus')
    .description('NEXUS AI command-line interface')
    .version(VERSION);

  registerAuth(program);
  registerDeploy(program);
  registerSecret(program);
  registerProject(program);
  registerDomain(program);
  registerToken(program);
  registerMember(program);
  registerDatabase(program);
  registerVolume(program);
  registerBucket(program);
  registerManagedDb(program);
  registerExec(program);

  return program;
}
