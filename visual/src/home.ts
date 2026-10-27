import { execFile } from 'node:child_process';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

const pad = (value: number) => String(value).padStart(2, '0');

/** An instant in Vietnam's time, from the date's parts (UTC+7, with no daylight saving). */
export function vietnamTime(at: Date) {
  const local = new Date(at.getTime() + VIETNAM_OFFSET_MS);
  const date = `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
  const clock = `${pad(local.getUTCHours())}${pad(local.getUTCMinutes())}${pad(local.getUTCSeconds())}`;
  return {
    date,
    clock,
    /** For the page: `2026-10-28 01:59 +07`. */
    shown: `${date} ${clock.slice(0, 2)}:${clock.slice(2, 4)} +07`,
  };
}

/** What the page says it was built from: never a path, never a person. */
export type Source = {
  branch: string;
  /** The commit's short hash. */
  commit: string;
  /** Whether the tree differed from the commit. */
  changed: boolean;
  committedAt: Date;
  /** The folder that holds every worktree's builds. */
  home: string;
};

async function git(cwd: string, ...args: string[]) {
  return (await run('git', args, { cwd })).stdout.trim();
}

/**
 * The repository `cwd` is in: its branch, commit and time, and `walks/` in the folder that holds
 * `.bare`, found from git's common directory, so every worktree builds into one list outside them
 * all. Outside a repository it says so, and nothing is written.
 */
export async function sourceOf(cwd: string): Promise<Source> {
  let common: string;
  try {
    common = await git(cwd, 'rev-parse', '--git-common-dir');
  } catch {
    throw new Error('not inside a git repository: no folder to write the walks page to');
  }
  const [branch, commit, seconds, status] = await Promise.all([
    git(cwd, 'rev-parse', '--abbrev-ref', 'HEAD'),
    git(cwd, 'rev-parse', '--short=9', 'HEAD'),
    git(cwd, 'log', '-1', '--format=%ct'),
    git(cwd, 'status', '--porcelain'),
  ]);
  const gitDir = isAbsolute(common) ? common : resolve(cwd, common);
  return {
    branch,
    commit,
    changed: status !== '',
    committedAt: new Date(Number(seconds) * 1000),
    home: join(dirname(gitDir), 'walks'),
  };
}

/** `<date>-<time>-<commit>` in Vietnam's time, `-changes` when the tree differed from the commit. */
export function folderName(source: Source, builtAt: Date) {
  const { date, clock } = vietnamTime(builtAt);
  return `${date}-${clock}-${source.commit}${source.changed ? '-changes' : ''}`;
}
