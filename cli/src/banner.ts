import chalk from 'chalk';
import axios from 'axios';
import packageJson from '../package.json';
import { getConfig } from './config.js';

const VERSION = packageJson.version;

// Vertical gradient shades (NEXUS AI sky-blue brand) applied to the logo rows.
const SHADES = ['#22d3ee', '#38bdf8', '#38bdf8', '#0ea5e9', '#0ea5e9', '#0284c7'];

const LOGO = [
  '███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗',
  '████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝',
  '██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗',
  '██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║',
  '██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║',
  '╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝',
];

const ANSI = /\x1b\[[0-9;]*m/g;
const visibleWidth = (s: string): number => s.replace(ANSI, '').length;

const INDENT = ' ';
const INNER_WIDTH = 54;

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

function boxLine(content: string): string {
  const pad = Math.max(0, INNER_WIDTH - visibleWidth(content));
  return INDENT + chalk.dim('│ ') + content + ' '.repeat(pad) + chalk.dim(' │');
}

/** Best-effort account lookup; never throws and never blocks for long. */
async function resolveAccount(): Promise<{ email: string; org: string } | null> {
  const cfg = getConfig();
  if (!cfg.token) return null;
  try {
    const res = await axios.get(`${cfg.apiUrl}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${cfg.token}` },
      timeout: 4000,
    });
    const data = res.data?.data ?? res.data;
    const u = data?.user ?? data;
    return {
      email: u?.email || 'authenticated',
      org: u?.organization?.name || '',
    };
  } catch {
    // Offline, expired, or unreachable — still report that a token is present.
    return { email: 'authenticated', org: '' };
  }
}

export async function showWelcome(): Promise<void> {
  const account = await resolveAccount();

  console.log('');
  LOGO.forEach((row, i) => {
    console.log(INDENT + chalk.hex(SHADES[i])(row));
  });
  console.log(INDENT + chalk.dim('Deploy, and Manage  apps, databases, and storage'));
  console.log('');

  // Truncate the plain body first so we never slice through ANSI codes.
  const mark = account ? chalk.green('✓ ') : chalk.yellow('! ');
  const body = account
    ? `Logged in as ${account.email}${account.org ? ` · ${account.org}` : ''}`
    : "Not logged in · run 'nexus auth login'";
  const [head, ...tail] = truncate(body, INNER_WIDTH - 2).split(' · ');
  const status = mark + chalk.white(head) + (tail.length ? chalk.dim(' · ' + tail.join(' · ')) : '');

  const top = INDENT + chalk.dim('╭' + '─'.repeat(INNER_WIDTH + 2) + '╮');
  const bottom = INDENT + chalk.dim('╰' + '─'.repeat(INNER_WIDTH + 2) + '╯');

  console.log(top);
  console.log(boxLine(chalk.cyan('◆ ') + chalk.bold.white('Welcome to NEXUS AI')));
  console.log(boxLine(''));
  console.log(boxLine(chalk.dim('Deploy from Git to AWS, Google Cloud, and Azure.')));
  console.log(boxLine(chalk.dim('Postgres, MySQL, volumes, buckets, backups, domains.')));
  console.log(boxLine(''));
  console.log(boxLine(status));
  console.log(bottom);
  console.log('');

  const tips: [string, string][] = account
    ? [
        ['deploy source --repo <url>', 'Deploy a Git repository'],
        ['deploy list', 'View your deployments'],
        ['db backup <service>', 'Back up a database'],
        ['help', 'Show all commands'],
      ]
    : [
        ['nexus auth login', 'Sign in with your browser'],
        ['nexus deploy source --repo <url>', 'Deploy a Git repository'],
        ['nexus --help', 'Show all commands'],
      ];

  const cmdWidth = Math.max(...tips.map(([c]) => c.length));
  console.log(INDENT + chalk.bold('Getting started'));
  for (const [cmd, desc] of tips) {
    console.log(INDENT + '  ' + chalk.cyan(cmd.padEnd(cmdWidth)) + '  ' + chalk.dim(desc));
  }
  console.log('');
  console.log(INDENT + chalk.dim(`v${VERSION} · docs: https://nexusai.run/docs`));
  console.log('');
}
