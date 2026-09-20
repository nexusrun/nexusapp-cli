import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';
import { isReplMode } from './client.js';

/** The subset of ora's API actually used by command code. */
export interface SpinnerHandle {
  text: string;
  stop(): void;
  succeed(text?: string): void;
  fail(text?: string): void;
}

const STATUS_COLORS: Record<string, (s: string) => string> = {
  RUNNING: chalk.green,
  BUILDING: chalk.yellow,
  DEPLOYING: chalk.yellow,
  FAILED: chalk.red,
  STOPPED: chalk.gray,
  PENDING: chalk.blue,
  QUEUED: chalk.blue,
  TERMINATED: chalk.gray,
};

export function statusBadge(status: string): string {
  const colorFn = STATUS_COLORS[status?.toUpperCase()] || chalk.white;
  return colorFn(status || 'UNKNOWN');
}

export function printTable(headers: string[], rows: (string | undefined | null)[][]): void {
  const table = new Table({
    head: headers.map((h) => chalk.bold(h)),
    style: { head: [], border: [] },
    chars: {
      top: '', 'top-mid': '', 'top-left': '', 'top-right': '',
      bottom: '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
      left: '', 'left-mid': '', mid: '', 'mid-mid': '',
      right: '', 'right-mid': '', middle: '  ',
    },
  });

  for (const row of rows) {
    table.push(row.map((cell) => cell ?? chalk.gray('—')));
  }

  console.log(table.toString());
}

export function printJson(obj: unknown): void {
  console.log(JSON.stringify(obj, null, 2));
}

/**
 * Plain, non-animated stand-in for ora used inside the interactive REPL.
 * ora redraws its frame by moving the cursor in place, which fights the
 * readline interface driving the REPL prompt — frames never visibly render,
 * so a long-running command (e.g. `db backup`, `deploy source --wait`)
 * looks completely frozen until it finishes. Printing each text update as
 * its own line sidesteps that: it's not animated, but it's visible.
 */
class PlainSpinner implements SpinnerHandle {
  private _text: string;
  constructor(text: string) {
    this._text = text;
    console.log(chalk.dim('… ') + text);
  }
  get text(): string {
    return this._text;
  }
  set text(value: string) {
    if (value !== this._text) {
      this._text = value;
      console.log(chalk.dim('… ') + value);
    }
  }
  stop(): void {}
  succeed(text?: string): void {
    console.log(chalk.green('✓') + ' ' + (text ?? this._text));
  }
  fail(text?: string): void {
    console.log(chalk.red('✗') + ' ' + (text ?? this._text));
  }
}

export function spinner(text: string): SpinnerHandle {
  if (isReplMode()) {
    return new PlainSpinner(text);
  }
  return ora(text).start();
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function success(msg: string): void {
  console.log(chalk.green('✓') + ' ' + msg);
}

export function errorMsg(msg: string): void {
  console.error(chalk.red('✗') + ' ' + msg);
}
