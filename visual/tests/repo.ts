import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const AUTHOR = { name: 'Zed Quux', email: 'zed.quux@example.test' };

const git = (cwd: string, args: string[], committedAt?: number) =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: AUTHOR.name,
      GIT_AUTHOR_EMAIL: AUTHOR.email,
      GIT_COMMITTER_NAME: AUTHOR.name,
      GIT_COMMITTER_EMAIL: AUTHOR.email,
      ...(committedAt && {
        GIT_AUTHOR_DATE: `${committedAt} +0000`,
        GIT_COMMITTER_DATE: `${committedAt} +0000`,
      }),
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_SYSTEM: '/dev/null',
    },
  }).trim();

/**
 * The credo root's layout, made in a temporary folder: a bare repository at `<root>/.bare` and one
 * worktree of it on `branch`, with one commit made at `committedAt` (seconds since the epoch).
 */
export function makeRoot(branch = 'a-piece', committedAt = 1_793_127_540) {
  // Git answers real paths, and the temporary folder may sit behind a link.
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'walks-root-')));
  const seed = join(root, 'seed');
  mkdirSync(seed);
  git(seed, ['init', '-q', '-b', branch]);
  writeFileSync(join(seed, 'file.txt'), 'one\n');
  git(seed, ['add', 'file.txt']);
  git(seed, ['commit', '-q', '-m', 'one'], committedAt);
  git(root, ['clone', '-q', '--bare', seed, '.bare']);
  const worktree = join(root, 'piece');
  git(join(root, '.bare'), ['worktree', 'add', '-q', worktree, branch]);
  return { root, worktree, commit: git(worktree, ['rev-parse', '--short=9', 'HEAD']) };
}
