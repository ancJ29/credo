import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { claimName, registerClaim, trunkOf } from './claim';

const temp = realpathSync(mkdtempSync(join(tmpdir(), 'credo-claim-test-')));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

let count = 0;
/** A trunk with an install of playwright-core, a piece worktree beside it, and a browser folder. */
function setup(revisions: [string, string] = ['1248', '1248']) {
  const base = join(temp, `case-${count++}`);
  const trunk = join(base, 'main');
  const core = join(trunk, 'walk/node_modules/playwright-core');
  mkdirSync(join(trunk, 'walk/node_modules/@playwright/test'), { recursive: true });
  writeFileSync(join(trunk, 'walk/node_modules/@playwright/test/index.js'), '');
  mkdirSync(core);
  writeFileSync(join(core, 'package.json'), '{}');
  writeFileSync(
    join(core, 'browsers.json'),
    JSON.stringify({
      browsers: [
        { name: 'chromium', revision: revisions[0] },
        { name: 'chromium-headless-shell', revision: revisions[1] },
      ],
    }),
  );
  const browsersDir = join(base, 'browsers');
  mkdirSync(browsersDir);
  const porcelain = `worktree ${base}/.bare\nbare\n\nworktree ${join(base, 'wip-piece')}\nHEAD abc\nbranch refs/heads/a-piece\n\nworktree ${trunk}\nHEAD def\nbranch refs/heads/main\n`;
  return { base, trunk, core, browsersDir, porcelain };
}

describe('the browser claim is the trunk’s, a file named by the sha1 of its playwright-core path', () => {
  it('finds the trunk as the worktree with main checked out, never a piece’s or the bare folder', () => {
    const s = setup();

    expect(trunkOf(s.porcelain)).toBe(s.trunk);
    expect(trunkOf('worktree /x/.bare\nbare\n\nworktree /x/wip\nbranch refs/heads/other\n')).toBe(
      undefined,
    );
    expect(trunkOf('branch refs/heads/main\n')).toBe(undefined);
    expect(() =>
      registerClaim({
        porcelain: 'worktree /x\nbranch refs/heads/zzz\n',
        browsersDir: '/x',
        revision: '1',
      }),
    ).toThrow(/no worktree has main checked out/);
  });

  it('writes the claim for a playwright-core path as the file named by its sha1, holding that path', () => {
    const s = setup();

    const line = registerClaim({
      porcelain: s.porcelain,
      browsersDir: s.browsersDir,
      revision: '1248',
    });

    const name = createHash('sha1').update(s.core).digest('hex');
    expect(claimName(s.core)).toBe(name);
    expect(readdirSync(join(s.browsersDir, '.links'))).toEqual([name]);
    expect(readFileSync(join(s.browsersDir, '.links', name), 'utf8')).toBe(s.core);
    expect(line).toBe(`claim ${s.core} (registered): protects Chromium r1248`);
  });

  it('leaves a claim already registered for that path exactly as it is', () => {
    const s = setup();
    registerClaim({ porcelain: s.porcelain, browsersDir: s.browsersDir, revision: '1248' });
    const file = join(s.browsersDir, '.links', claimName(s.core));
    const before = statSync(file);

    const line = registerClaim({
      porcelain: s.porcelain,
      browsersDir: s.browsersDir,
      revision: '1248',
    });

    expect(line).toBe(`claim ${s.core} (already there): protects Chromium r1248`);
    expect(statSync(file).ino).toBe(before.ino);
    expect(statSync(file).mtimeMs).toBe(before.mtimeMs);
  });

  it('rewrites a claim file that is empty or torn, since Playwright unlinks one it cannot read', () => {
    const s = setup();
    const file = join(s.browsersDir, '.links', claimName(s.core));
    mkdirSync(join(s.browsersDir, '.links'));
    writeFileSync(file, '');

    const line = registerClaim({
      porcelain: s.porcelain,
      browsersDir: s.browsersDir,
      revision: '1248',
    });

    expect(line).toBe(`claim ${s.core} (registered): protects Chromium r1248`);
    expect(readFileSync(file, 'utf8')).toBe(s.core);
  });

  it('writes through a name of its own beside the claim folder and renames, leaving nothing behind', () => {
    const s = setup();

    registerClaim({ porcelain: s.porcelain, browsersDir: s.browsersDir, revision: '1248' });

    // the draft sits outside .links (an install reads every file in it) and is gone after the rename
    expect(readdirSync(s.browsersDir)).toEqual(['.links']);
    expect(readdirSync(join(s.browsersDir, '.links'))).toHaveLength(1);
  });

  it('says in one line that a claim folder cannot be written, and tries nothing else', () => {
    const s = setup();
    // a file where the claim folder should be: it cannot be made, for root too (EEXIST)
    writeFileSync(join(s.browsersDir, '.links'), 'not a folder');

    expect(() =>
      registerClaim({ porcelain: s.porcelain, browsersDir: s.browsersDir, revision: '1248' }),
    ).toThrow(
      /the claim folder .*\.links cannot be written from here \(EEXIST\), and nothing else was tried$/,
    );
    expect(readdirSync(s.browsersDir)).toEqual(['.links']);
    expect(readFileSync(join(s.browsersDir, '.links'), 'utf8')).toBe('not a folder');
  });

  it('refuses a trunk whose browsers.json names another revision, naming both and the install', () => {
    const s = setup(['1300', '1248']);
    const other = setup(['1248', '1300']);

    expect(() =>
      registerClaim({ porcelain: s.porcelain, browsersDir: s.browsersDir, revision: '1248' }),
    ).toThrow(
      /names chromium r1300, this run uses r1248: install there: cd .*main && pnpm install/,
    );
    expect(() =>
      registerClaim({
        porcelain: other.porcelain,
        browsersDir: other.browsersDir,
        revision: '1248',
      }),
    ).toThrow(/names chromium-headless-shell r1300, this run uses r1248/);
    writeFileSync(join(s.core, 'browsers.json'), JSON.stringify({ browsers: [] }));
    expect(() =>
      registerClaim({ porcelain: s.porcelain, browsersDir: s.browsersDir, revision: '1248' }),
    ).toThrow(/names chromium rnone/);
    expect(existsSync(join(s.browsersDir, '.links'))).toBe(false);
  });

  it('refuses a trunk with no install or no readable browsers.json', () => {
    const s = setup();
    rmSync(join(s.core, 'browsers.json'));
    expect(() =>
      registerClaim({ porcelain: s.porcelain, browsersDir: s.browsersDir, revision: '1248' }),
    ).toThrow(/cannot be read \(.*ENOENT.*\): install there/);
    rmSync(join(s.trunk, 'walk/node_modules'), { recursive: true });
    expect(() =>
      registerClaim({ porcelain: s.porcelain, browsersDir: s.browsersDir, revision: '1248' }),
    ).toThrow(/cannot be read/);
  });
});
