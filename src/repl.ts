import readline from 'node:readline';
import chalk from 'chalk';
import type { Command } from 'commander';
import { setReplMode } from './client.js';

/** Thrown in place of process.exit() while a command runs inside the shell, so a
 *  single failing command returns to the prompt instead of killing the session. */
class ExitSignal extends Error {
  constructor(public code?: number) {
    super('exit');
  }
}

// Friendly top-level aliases so natural phrasing works at the prompt. Values may
// expand to multiple tokens (e.g. "whoami" -> "auth whoami").
const ALIASES: Record<string, string> = {
  deployment: 'deploy',
  deployments: 'deploy',
  deploys: 'deploy',
  databases: 'db',
  secrets: 'secret',
  projects: 'project',
  domains: 'domain',
  tokens: 'token',
  members: 'member',
  volumes: 'volume',
  buckets: 'bucket',
  login: 'auth login',
  logout: 'auth logout',
  whoami: 'auth whoami',
};

/** Build a readline completer from the command tree: top-level commands at the
 *  first word, a command's subcommands at the second. Derived from the program
 *  so it stays correct as commands are added. */
export function buildCompleter(program: Command): (line: string) => [string[], string] {
  const REPL_WORDS = ['help', 'clear', 'exit', 'login', 'logout', 'whoami'];
  const topLevel = [
    ...new Set([...program.commands.map((c) => c.name()), ...REPL_WORDS]),
  ].sort();
  const subcommands: Record<string, string[]> = {};
  for (const c of program.commands) {
    subcommands[c.name()] = c.commands.map((s) => s.name()).sort();
  }

  return (line: string): [string[], string] => {
    const parts = line.replace(/^\s+/, '').split(/\s+/);
    const word = parts[parts.length - 1] ?? '';
    let pool: string[];
    if (parts.length <= 1) {
      pool = topLevel;
    } else {
      const real = (ALIASES[parts[0]] ?? parts[0]).split(' ')[0];
      pool = subcommands[real] ?? [];
    }
    const hits = pool.filter((c) => c.startsWith(word));
    return [hits, word];
  };
}

/** Split a line into argv, honoring single and double quotes. */
function tokenize(line: string): string[] {
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    out.push(m[1] ?? m[2] ?? m[3]);
  }
  return out;
}

function isCommanderError(e: unknown): boolean {
  return !!e && typeof (e as { code?: unknown }).code === 'string'
    && (e as { code: string }).code.startsWith('commander.');
}

async function runCommand(buildProgram: () => Command, rawTokens: string[]): Promise<void> {
  let tokens = [...rawTokens];
  if (tokens[0] === 'nexus') tokens = tokens.slice(1); // tolerate a habitual prefix
  if (tokens.length === 0) return;
  if (tokens[0] in ALIASES) tokens = [...ALIASES[tokens[0]].split(' '), ...tokens.slice(1)];

  const realExit = process.exit.bind(process);
  // Command actions and the API client call process.exit() on errors. Inside the
  // shell, turn that into a catchable signal so the session survives.
  (process as unknown as { exit: (code?: number) => never }).exit = (code?: number) => {
    throw new ExitSignal(code);
  };

  try {
    const program = buildProgram();
    program.exitOverride(); // commander throws instead of exiting on help/usage errors
    await program.parseAsync(['node', 'nexus', ...tokens]);
  } catch (e) {
    if (e instanceof ExitSignal || isCommanderError(e)) {
      // The command (or commander) already printed its message; just return.
    } else {
      console.error(chalk.red('✗ ') + ((e as Error)?.message || String(e)));
    }
  } finally {
    (process as unknown as { exit: typeof realExit }).exit = realExit;
  }
}

/**
 * Read exactly one line from a fresh readline interface, then resolve.
 * The interface is NOT closed here — the caller closes it immediately after,
 * before running whatever command the line names. That matters because some
 * commands (e.g. `db backup-delete`) show their own inquirer confirmation
 * prompt, which attaches its own listeners to stdin. A readline.Interface's
 * keypress handling isn't actually suspended by `.pause()` on a TTY, so if
 * ours were still alive while inquirer's prompt runs, it independently
 * parses the same keystrokes and queues the typed answer (e.g. "y") as if it
 * were the *next* shell command. Fully closing our interface first removes
 * its stdin listeners entirely, so only inquirer's own prompt sees that
 * input.
 */
function readLine(rl: readline.Interface): Promise<{ line: string | null; sigint: boolean }> {
  return new Promise((resolve) => {
    const onLine = (line: string) => {
      cleanup();
      resolve({ line, sigint: false });
    };
    const onSigint = () => {
      cleanup();
      resolve({ line: null, sigint: true });
    };
    const onClose = () => {
      cleanup();
      resolve({ line: null, sigint: false });
    };
    function cleanup() {
      rl.removeListener('line', onLine);
      rl.removeListener('SIGINT', onSigint);
      rl.removeListener('close', onClose);
    }
    rl.once('line', onLine);
    rl.once('SIGINT', onSigint);
    rl.once('close', onClose);
    rl.prompt();
  });
}

export async function startRepl(buildProgram: () => Command): Promise<void> {
  console.log(
    ' Type a command (e.g. ' + chalk.cyan('deploy list') + '), ' +
    chalk.cyan('help') + ', or ' + chalk.cyan('exit') + '.'
  );
  console.log('');

  setReplMode(); // fatal API errors reject instead of exiting the process

  // A fresh readline.Interface per prompt cycle, closed the instant its one
  // line is read — see readLine() for why this can't be a single long-lived
  // interface shared with command execution.
  for (;;) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('nexus') + chalk.dim(' › '),
      completer: buildCompleter(buildProgram()),
    });

    const { line, sigint } = await readLine(rl);
    rl.close();

    if (sigint || line === null) {
      break; // Ctrl-C or Ctrl-D at the prompt leaves the shell cleanly
    }

    const input = line.trim();
    if (!input) continue;

    const lower = input.toLowerCase();
    if (lower === 'exit' || lower === 'quit' || lower === ':q') {
      break;
    }
    if (lower === 'clear' || lower === 'cls') {
      console.clear();
      continue;
    }

    await runCommand(buildProgram, tokenize(lower === 'help' ? '--help' : input));
    console.log('');
  }

  console.log(chalk.dim('Goodbye.'));
}
