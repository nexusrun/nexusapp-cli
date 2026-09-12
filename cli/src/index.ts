#!/usr/bin/env node
import { buildProgram } from './program.js';

async function main(): Promise<void> {
  // No command given: show the branded welcome screen, then drop into the
  // interactive shell when attached to a terminal. Piped/CI use (no TTY) just
  // prints the banner and exits so nothing hangs waiting on input.
  if (process.argv.length <= 2) {
    const { showWelcome } = await import('./banner.js');
    await showWelcome();
    if (process.stdin.isTTY) {
      const { startRepl } = await import('./repl.js');
      await startRepl(buildProgram);
    }
    return;
  }

  await buildProgram().parseAsync(process.argv);
}

main().catch((err) => {
  console.error(err.message || String(err));
  process.exit(1);
});
