import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/** The worktree that has `main` checked out, from `git worktree list --porcelain`: the one folder
 * of this repository that is never deleted, so a claim naming its install outlives every piece. */
export function trunkOf(porcelain: string): string | undefined {
  for (const block of porcelain.split(/\n\s*\n/)) {
    const lines = block.split('\n');
    if (lines.includes('branch refs/heads/main')) {
      return lines.find((line) => line.startsWith('worktree '))?.slice('worktree '.length);
    }
  }
  return undefined;
}

/** Playwright's claim file for an installation: its `playwright-core` folder's path hashed by sha1,
 * the file holding that path. An install deletes every browser no surviving claim names. */
export const claimName = (core: string) => createHash('sha1').update(core).digest('hex');

const NAMES = ['chromium', 'chromium-headless-shell'];

/**
 * Makes sure the browser folder holds a claim that will not vanish, and says which. The path is the
 * trunk's own `playwright-core` (resolved the way Playwright hashes it: `@playwright/test` from the
 * trunk's `walk`, then `playwright-core` from there), and the trunk's `browsers.json` must name the
 * revision this run uses, or the claim would protect the wrong browser. A claim already there is left
 * alone; a new one is written beside the folder and renamed in, so an install never reads half of it.
 * Anything that stops it throws one line.
 */
export function registerClaim(options: {
  porcelain: string;
  browsersDir: string;
  revision: string;
}): string {
  const { porcelain, browsersDir, revision } = options;
  const trunk = trunkOf(porcelain);
  if (!trunk) throw new Error('no worktree has main checked out, and the claim lives there');
  const install = `install there: cd ${trunk} && pnpm install --offline --frozen-lockfile`;
  let core: string;
  let browsers: { name: string; revision: string }[];
  try {
    const entry = createRequire(join(trunk, 'walk/package.json')).resolve('@playwright/test');
    core = join(createRequire(entry).resolve('playwright-core/package.json'), '..');
    browsers = (
      JSON.parse(readFileSync(join(core, 'browsers.json'), 'utf8')) as { browsers: typeof browsers }
    ).browsers;
  } catch (error) {
    throw new Error(
      `the trunk's playwright-core or its browsers.json cannot be read (${(error as Error).message.split('\n')[0]}): ${install}`,
      { cause: error },
    );
  }
  for (const name of NAMES) {
    const named = browsers.find((browser) => browser.name === name)?.revision;
    if (named !== revision) {
      throw new Error(
        `the trunk's playwright-core names ${name} r${named ?? 'none'}, this run uses r${revision}: ${install}`,
      );
    }
  }
  const file = join(browsersDir, '.links', claimName(core));
  const protects = `protects Chromium r${revision}`;
  // Playwright unlinks a link file it cannot read, so only a file holding the path counts as there.
  if (existsSync(file) && readFileSync(file, 'utf8') === core) {
    return `claim ${core} (already there): ${protects}`;
  }
  const draft = join(browsersDir, `.claim-${process.pid}`);
  try {
    mkdirSync(join(browsersDir, '.links'), { recursive: true });
    writeFileSync(draft, core);
    renameSync(draft, file);
  } catch (error) {
    rmSync(draft, { force: true });
    throw new Error(
      `the claim folder ${join(browsersDir, '.links')} cannot be written from here (${(error as NodeJS.ErrnoException).code}), and nothing else was tried`,
      { cause: error },
    );
  }
  return `claim ${core} (registered): ${protects}`;
}
