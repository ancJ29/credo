import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * `walk/run.sh` in a made-up repository: the bare repo and a worktree beside it as $ROOT_DIR holds
 * them, and stand-ins for the commands the script reads (node, pnpm, ps, uptime). No browser starts:
 * each refusal stops before any act, and `--checks` stops after the reads.
 */
const SCRIPTS = fileURLToPath(new URL('..', import.meta.url));
const RUN_SH = fileURLToPath(new URL('../../walk/run.sh', import.meta.url));
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    cwd,
    encoding: 'utf8',
  });

let temp: string;
let seed: string;
let shims: string;
let chromium: string;
let pictures: { plain: string; moved: string };

/** A 4x4 RGBA picture, one channel a shade off when `moved`. */
function picture(moved: boolean) {
  const chunk = (type: string, body: Uint8Array) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, 'latin1');
    return Buffer.concat([head, body, Buffer.alloc(4)]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(4, 0);
  header.writeUInt32BE(4, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const rows = Array.from({ length: 4 }, (_, y) =>
    Buffer.from([
      0,
      ...Array.from({ length: 16 }, (_, i) => (moved && y === 1 && i === 5 ? 10 : 9)),
    ]),
  );
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', new Uint8Array()),
  ]);
}
beforeAll(() => {
  // the real path: git reports it, and the script’s root is derived from git
  temp = realpathSync(mkdtempSync(join(tmpdir(), 'credo-walk-run-test-')));
  seed = join(temp, 'seed');
  mkdirSync(join(seed, 'walk'), { recursive: true });
  mkdirSync(join(seed, 'scripts'));
  writeFileSync(join(seed, 'scripts/.gitkeep'), '');
  writeFileSync(join(seed, '.gitignore'), 'node_modules/\n');
  writeFileSync(join(seed, 'package.json'), '{ "packageManager": "pnpm@12.10.1" }\n');
  writeFileSync(join(seed, 'walk/run.sh'), readFileSync(RUN_SH));
  git(seed, 'init', '-q', '-b', 'main');
  git(seed, 'add', '.');
  git(seed, 'commit', '-q', '-m', 'seed');

  shims = join(temp, 'shims');
  mkdirSync(shims);
  const shim = (name: string, body: string) => {
    writeFileSync(join(shims, name), `#!/bin/bash\n${body}\n`);
    chmodSync(join(shims, name), 0o755);
  };
  shim(
    'node',
    `if [ "$1" = --version ]; then echo "\${SHIM_NODE:-v26.12.1}"; exit 0; fi
if [ "$1" = --import ]; then cd "${SCRIPTS}" && exec "${process.execPath}" "$@"; fi
echo "\${SHIM_CHROMIUM:-}"`,
  );
  shim(
    'pnpm',
    `if [ "$1" = --version ]; then echo "\${SHIM_PNPM:-12.10.1}"; exit 0; fi
if [ "$1" = stack ] || [ "$1" = fake ]; then shift 2; exec "$@"; fi
case " $* " in *" -g "*) n=\${SHIM_MATCHES:-1} ;; *) n=\${SHIM_LISTED:-2} ;; esac
case " $* " in
  *" --list "*)
    i=1; while [ "$i" -le "$n" ]; do i=$((i + 1)); echo "  [x] › a.spec.ts:1:1 › a walk on a pc (1280) › walks screen $i"; done ;;
  *)
    last=""; for a in "$@"; do last="$a"; done
    pic="$SHIM_PICTURE"
    case "$CREDO_SHOTS_DIR" in */$SHIM_MOVED_IN/*) pic="$SHIM_PICTURE_MOVED" ;; esac
    mkdir -p "$CREDO_SHOTS_DIR"
    case " $* " in
      *" -g "*) cp "$pic" "$CREDO_SHOTS_DIR/s\${last: -1}-en-390.png"; echo "  $((1 - \${SHIM_PASSED_LESS:-0})) passed (1s)" ;;
      *) cp "$pic" "$CREDO_SHOTS_DIR/s2-en-390.png"; cp "$pic" "$CREDO_SHOTS_DIR/s3-en-390.png"; echo "  $((2 - \${SHIM_PASSED_LESS:-0})) passed (1s)" ;;
    esac ;;
esac`,
  );
  shim(
    'uptime',
    'echo " 8:00  2 users${SHIM_LOAD_TEXT-, load averages: ${SHIM_LOAD:-2.50} 3.00 3.00}"',
  );
  shim(
    'ps',
    'if [ -n "$SHIM_PS_FAIL" ]; then echo "ps: Cannot get process list" >&2; exit 1; fi\ncat "$SHIM_PS"',
  );
  pictures = { plain: join(temp, 'plain.png'), moved: join(temp, 'moved.png') };
  writeFileSync(pictures.plain, picture(false));
  writeFileSync(pictures.moved, picture(true));
  chromium = join(temp, 'pw', 'chromium-1248', 'chrome');
  mkdirSync(join(temp, 'pw', 'chromium-1248'), { recursive: true });
  mkdirSync(join(temp, 'pw', 'chromium_headless_shell-1248'));
  writeFileSync(chromium, '');
  // a Chromium whose headless shell is not installed
  mkdirSync(join(temp, 'pw', 'chromium-9999'));
  writeFileSync(join(temp, 'pw', 'chromium-9999', 'chrome'), '');
});
afterAll(() => rmSync(temp, { recursive: true, force: true }));

let count = 0;
/** A root with a bare repository and one worktree of it, `walk-steady`, clean and with main in. */
function layout() {
  const root = join(temp, `root-${count++}`);
  mkdirSync(root);
  git(root, 'clone', '-q', '--bare', seed, join(root, '.bare'));
  git(join(root, '.bare'), 'worktree', 'add', '-q', '-b', 'walk-steady', join(root, 'wip'), 'main');
  const tree = join(root, 'wip');
  mkdirSync(join(tree, 'walk/node_modules/@playwright/test'), { recursive: true });
  writeFileSync(
    join(tree, 'walk/node_modules/@playwright/test/package.json'),
    '{ "version": "1.64.0" }\n',
  );
  mkdirSync(join(tree, 'node_modules'));
  const ps = join(root, 'ps.txt');
  writeFileSync(ps, '  1     0 /sbin/launchd\n 20     1 /bin/zsh\n');
  return { root, tree, ps };
}

type Setup = Record<string, string>;
function run(l: ReturnType<typeof layout>, args: string[], env: Setup = {}) {
  const done = spawnSync('/bin/bash', [join(l.tree, 'walk/run.sh'), ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      NVM_DIR: join(temp, 'no-nvm'),
      PATH: `${shims}:/usr/bin:/bin`,
      TMPDIR: process.env['TMPDIR'] ?? tmpdir(),
      SHIM_PS: l.ps,
      SHIM_CHROMIUM: chromium,
      SHIM_PICTURE: pictures.plain,
      SHIM_PICTURE_MOVED: pictures.moved,
      SHIM_MOVED_IN: 'none',
      ...env,
    },
  });
  return { code: done.status, out: done.stdout + done.stderr };
}
const refusedWith = (
  l: ReturnType<typeof layout>,
  args: string[],
  reason: RegExp,
  env: Setup = {},
) => {
  const { code, out } = run(l, args, env);
  expect(out).toMatch(reason);
  expect(code).toBe(2);
  // nothing was acted on: no folder of results, no base touched
  expect(existsSync(join(l.root, 'walks'))).toBe(false);
  expect(git(l.tree, 'status', '--porcelain')).toBe('');
};

describe('walk/run.sh refuses before it acts', () => {
  it('an unknown walk, an unknown option, no walk, and --moved without a list', () => {
    const l = layout();

    refusedWith(l, ['piece-9'], /== refused: unknown walk 'piece-9'/);
    refusedWith(l, ['operator', '--bogus'], /== refused: unknown option --bogus/);
    refusedWith(l, [], /== refused: no walk named/);
    refusedWith(l, ['operator', '--moved'], /== refused: --moved needs a list of screens or all/);
    refusedWith(
      l,
      ['operator', '--moved', '--write'],
      /== refused: --moved needs a list of screens or all/,
    );
  });

  it('a tree that is not clean', () => {
    const l = layout();
    writeFileSync(join(l.tree, 'stray.txt'), 'x');

    const { code, out } = run(l, ['operator']);

    expect(out).toMatch(/== refused: the worktree is not clean: \?\? stray.txt/);
    expect(code).toBe(2);
  });

  it('a merge going', () => {
    const l = layout();
    const head = git(l.tree, 'rev-parse', 'HEAD').trim();
    const gitDir = git(l.tree, 'rev-parse', '--absolute-git-dir').trim();
    writeFileSync(join(gitDir, 'MERGE_HEAD'), `${head}\n`);

    refusedWith(l, ['operator'], /== refused: a merge is going/);
  });

  it('main not merged in', () => {
    const l = layout();
    // main moved on to a commit the worktree does not hold
    const elsewhere = git(l.tree, 'commit-tree', 'HEAD^{tree}', '-m', 'elsewhere').trim();
    git(join(l.root, '.bare'), 'update-ref', 'refs/heads/main', elsewhere);

    refusedWith(l, ['operator'], /== refused: main is not merged into walk-steady/);
  });

  it('a node that is not v26.12.1, and a pnpm that is not the repo’s', () => {
    const l = layout();

    refusedWith(l, ['operator'], /== refused: node is 'v22.1.0'.*expected v26.12.1/, {
      SHIM_NODE: 'v22.1.0',
    });
    refusedWith(
      l,
      ['operator'],
      /== refused: pnpm is '11.0.0', the repo's packageManager wants '12.10.1'/,
      {
        SHIM_PNPM: '11.0.0',
      },
    );
  });

  it('the gate lock, and a load above 12', () => {
    const l = layout();
    mkdirSync(join(l.root, '.gate-lock'));
    refusedWith(l, ['operator'], /== refused: the gate lock .* is there/);
    rmSync(join(l.root, '.gate-lock'), { recursive: true });

    refusedWith(l, ['operator'], /== refused: the Mac's one-minute load is 13.40, above 12/, {
      SHIM_LOAD: '13.40',
    });
  });

  it('a Chromium or a headless shell that is not installed', () => {
    const l = layout();

    refusedWith(l, ['operator'], /== refused: Playwright's Chromium is not installed/, {
      SHIM_CHROMIUM: '',
    });
    refusedWith(l, ['operator'], /== refused: Playwright's headless shell is not installed/, {
      SHIM_CHROMIUM: join(temp, 'pw', 'chromium-9999', 'chrome'),
    });
  });

  it('a process list that cannot be read, and a run of credo’s with a live parent', () => {
    const l = layout();

    refusedWith(
      l,
      ['operator'],
      /== refused: the process list could not be read \(ps: ps: Cannot get process list\)/,
      {
        SHIM_PS_FAIL: '1',
      },
    );
    writeFileSync(
      l.ps,
      `  1     0 /sbin/launchd\n 77   300 node ${l.root}/other/node_modules/playwright/cli.js test\n`,
    );
    refusedWith(
      l,
      ['operator'],
      /== refused: another walk, stack or fake of credo's is running \(pids 77\)/,
    );
  });
});

describe('walk/run.sh refuses what it cannot read or match', () => {
  it('no node_modules, a Playwright of another version, and a load it cannot read', () => {
    const l = layout();
    rmSync(join(l.tree, 'node_modules'), { recursive: true });
    refusedWith(l, ['operator'], /== refused: no node_modules in /);
    mkdirSync(join(l.tree, 'node_modules'));

    writeFileSync(
      join(l.tree, 'walk/node_modules/@playwright/test/package.json'),
      '{ "version": "1.70.0" }\n',
    );
    refusedWith(l, ['operator'], /== refused: Playwright is '1.70.0', expected 1.64.x/);
    writeFileSync(
      join(l.tree, 'walk/node_modules/@playwright/test/package.json'),
      '{ "version": "1.64.0" }\n',
    );

    refusedWith(l, ['operator'], /== refused: the Mac's load could not be read from uptime/, {
      SHIM_LOAD_TEXT: '',
    });
  });

  it('a project Playwright lists no test for, and a test whose pattern does not match exactly one', () => {
    const l = layout();

    refusedWith(l, ['operator'], /== refused: Playwright lists no test for project operator-fake/, {
      SHIM_LISTED: '0',
    });
    refusedWith(l, ['operator'], /== refused: the pattern for .* does not match exactly 1 test/, {
      SHIM_MATCHES: '2',
    });
  });

  it('a process list the strays’ choice cannot read', () => {
    const l = layout();
    writeFileSync(l.ps, 'ps: not a listing\n');

    refusedWith(
      l,
      ['operator'],
      /== refused: the process list is not readable: unreadable: .*not a listing/,
    );
  });
});

describe('walk/run.sh --checks', () => {
  it('knows the lists’ walk by its name, its own two projects and its own folder of bases', () => {
    const l = layout();
    writeFileSync(l.ps, '  1     0 /sbin/launchd\n');

    const { code, out } = run(l, ['admin-lists', '--checks']);

    expect(code).toBe(0);
    expect(out).toContain('admin-lists: lists-fake lists 2 tests');
    expect(out).toContain('admin-lists: lists-full lists 2 tests');
    expect(out).toMatch(/== verdict: checks only: nothing was run/);
  });

  it('reads everything, names a stray it would stop, acts on nothing and logs every line', () => {
    const l = layout();
    writeFileSync(
      l.ps,
      `  1     0 /sbin/launchd\n 88     1 node ${l.root}/other/node_modules/vitest/vitest.mjs run\n`,
    );

    const { code, out } = run(l, ['piece-2', 'operator', '--checks']);

    expect(code).toBe(0);
    expect(out).toContain(
      'node v26.12.1, pnpm 12.10.1, Playwright 1.64.0, Chromium r1248; load 2.50 (at most 12)',
    );
    expect(out).toContain('piece-2: fake lists 2 tests');
    expect(out).toContain('operator: operator-full lists 2 tests');
    expect(out).toContain('stray 88:');
    expect(out).toMatch(
      /== verdict: checks only: nothing was run \(1 strays would be stopped\)\n== done/,
    );
    expect(existsSync(join(l.root, 'walks'))).toBe(false);
    const logs = readFileSync(join(l.root, 'logs', readdirLog(l)), 'utf8');
    expect(logs).toContain('== done');
  });
});

const readdirLog = (l: ReturnType<typeof layout>) =>
  execFileSync('ls', [join(l.root, 'logs')], { encoding: 'utf8' })
    .trim()
    .split('\n')[0];

describe('walk/run.sh on stand-ins for the stack, the fake and the browser', () => {
  const baseOf = (l: ReturnType<typeof layout>, screen: string) =>
    join(l.tree, `walk/specs/operator.spec.ts-snapshots/${screen}-en-390-operator-full-darwin.png`);
  const committed = (l: ReturnType<typeof layout>) => {
    run(l, ['operator', '--moved', 'all', '--write']);
    git(l.tree, 'add', '.');
    git(l.tree, 'commit', '-q', '-m', 'bases');
  };

  it('a green read with --write puts the pictures in as bases, and a second run finds every raw count 0', () => {
    const l = layout();

    const first = run(l, ['operator', '--moved', 'all', '--write']);

    expect(first.out).toMatch(/== verdict: green/);
    expect(first.code).toBe(0);
    expect(first.out).toContain('operator: 2 bases written');
    expect(existsSync(baseOf(l, 's2'))).toBe(true);
    expect(existsSync(baseOf(l, 's3'))).toBe(true);
    git(l.tree, 'add', '.');
    git(l.tree, 'commit', '-q', '-m', 'bases');

    const second = run(l, ['operator']);

    expect(second.out).toMatch(/== verdict: green/);
    expect(second.out).toContain(
      'compare full-1 to the bases: operator: 2 pictures, 0 moved, 0 new',
    );
    expect(second.code).toBe(0);
    expect(git(l.tree, 'status', '--porcelain')).toBe('');
  });

  it('a picture that moves between the two stacks is red and nothing is written', () => {
    const l = layout();

    const { code, out } = run(l, ['operator', '--moved', 'all', '--write'], {
      SHIM_MOVED_IN: 'full-2',
    });

    expect(out).toMatch(/== verdict: red: .*full-1 to full-2: operator/);
    expect(out).toContain('moved s2-en-390.png: 1 px, shade 1, box 1,1 to 1,1');
    expect(out).toContain('not written: the read is red');
    expect(code).toBe(1);
    expect(existsSync(baseOf(l, 's2'))).toBe(false);
  });

  it('a base that moves is red unless its screen is named in --moved, and then it is allowed', () => {
    const l = layout();
    committed(l);
    const moved = { SHIM_PICTURE: pictures.moved };

    const unnamed = run(l, ['operator'], moved);
    const named = run(l, ['operator', '--moved', 's2,s3'], moved);

    expect(unnamed.out).toMatch(/== verdict: red: .*full-1 to the bases: operator/);
    expect(unnamed.out).toContain('red s2-en-390.png moved and its screen is not named in --moved');
    expect(unnamed.code).toBe(1);
    expect(named.out).toMatch(/== verdict: green/);
    expect(named.code).toBe(0);
  });

  it('a pass whose tests did not all pass is red, whatever the pictures say', () => {
    const l = layout();

    const { code, out } = run(l, ['operator', '--moved', 'all'], { SHIM_PASSED_LESS: '1' });

    expect(code).toBe(1);
    expect(out).toMatch(/== verdict: red: fake operator took 1 of 2 tests/);
  });
});
