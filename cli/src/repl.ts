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

export async function startRepl(buildProgram: () => Command): Promise<void> {
  console.log(
    ' Type a command (e.g. ' + chalk.cyan('deploy list') + '), ' +
    chalk.cyan('help') + ', or ' + chalk.cyan('exit') + '.'
  );
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan('nexus') + chalk.dim(' › '),
    completer: buildCompleter(buildProgram()),
  });

  let closed = false;
  rl.on('close', () => { closed = true; });
  const prompt = () => {
    if (!closed) rl.prompt();
  };

  setReplMode(); // fatal API errors reject instead of exiting the process
  rl.on('SIGINT', () => rl.close()); // Ctrl-C leaves the shell cleanly
  prompt();

  // Iterating the interface yields one line at a time and only pulls the next
  // after the loop body finishes, so commands run strictly one-at-a-time.
  for await (const line of rl) {
    const input = line.trim();
    if (!input) {
      prompt();
      continue;
    }
    const lower = input.toLowerCase();
    if (lower === 'exit' || lower === 'quit' || lower === ':q') {
      break;
    }
    if (lower === 'clear' || lower === 'cls') {
      console.clear();
      prompt();
      continue;
    }

    await runCommand(buildProgram, tokenize(lower === 'help' ? '--help' : input));
    console.log('');
    prompt();
  }

  if (!closed) rl.close();
  console.log(chalk.dim('Goodbye.'));
}
