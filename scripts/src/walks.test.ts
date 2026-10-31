import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { walksCommand } from './walks';

/** A PNG made here: RGBA, 8 bits, every row unfiltered. */
const png = (
  width: number,
  height: number,
  paint: (x: number, y: number) => number[] = () => [9, 9, 9, 255],
) => {
  const chunk = (type: string, body: Uint8Array) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, 'latin1');
    return Buffer.concat([head, body, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const rows = Array.from({ length: height }, (_, y) =>
    Buffer.from([0, ...Array.from({ length: width }, (_, x) => paint(x, y)).flat()]),
  );
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', new Uint8Array()),
  ]);
};
const moved = (at: [number, number][]) =>
  png(4, 4, (x, y) => (at.some(([a, b]) => a === x && b === y) ? [10, 9, 9, 255] : [9, 9, 9, 255]));

let temp: string;
beforeAll(async () => {
  temp = await mkdtemp(join(tmpdir(), 'credo-walks-test-'));
});
afterAll(() => rm(temp, { recursive: true, force: true }));

let count = 0;
/** Two folders of pictures, `left` and `right`, each a map from name to file. */
async function folders(
  left: Record<string, Buffer | string>,
  right: Record<string, Buffer | string>,
) {
  const base = join(temp, `case-${count++}`);
  const dirs = [join(base, 'left'), join(base, 'right')];
  for (const [dir, files] of [
    [dirs[0], left],
    [dirs[1], right],
  ] as const) {
    await mkdir(dir, { recursive: true });
    for (const [name, file] of Object.entries(files)) await writeFile(join(dir, name), file);
  }
  return { left: dirs[0], right: dirs[1], base };
}
const run = async (argv: string[], stdin = '') => {
  const lines: string[] = [];
  const code = await walksCommand(argv, {
    stdin: () => Promise.resolve(stdin),
    out: (line) => lines.push(line),
  });
  return { code, lines };
};

describe('the raw count of two folders of pictures', () => {
  it('pictures equal pixel for pixel read 0 moved and green, whatever their files’ bytes', async () => {
    const d = await folders({ 'a-1-en-390.png': png(4, 4) }, { 'a-1-en-390.png': png(4, 4) });

    const { code, lines } = await run(['compare', 'fake to full-1', d.left, d.right]);

    expect(code).toBe(0);
    expect(lines).toEqual([
      'compare fake to full-1: 1 pictures, 0 moved, 0 new, 0 without a counterpart, 0 unreadable',
      'result: green',
    ]);
  });

  it('a moved picture is red with its raw pixels, largest shade and box, and written to the raw file', async () => {
    const d = await folders(
      {
        'a-1-en-390.png': moved([
          [1, 2],
          [3, 2],
        ]),
      },
      { 'a-1-en-390.png': png(4, 4) },
    );
    const raw = join(d.base, 'raw.txt');

    const { code, lines } = await run(['compare', 'fake to full-1', d.left, d.right, '--raw', raw]);

    expect(code).toBe(1);
    expect(lines).toContain('  moved a-1-en-390.png: 2 px, shade 1, box 1,2 to 3,2');
    expect(lines.at(-1)).toBe('result: red: 1 moved');
    expect(await readFile(raw, 'utf8')).toBe(
      'fake to full-1 a-1-en-390.png: 2 px, shade 1, box 1,2 to 3,2\n',
    );
  });

  it('two sizes read as moved, both sizes named', async () => {
    const d = await folders({ 'a-1-en-390.png': png(4, 5) }, { 'a-1-en-390.png': png(4, 4) });

    const { code, lines } = await run(['compare', 'x', d.left, d.right]);

    expect(code).toBe(1);
    expect(lines).toContain('  moved a-1-en-390.png: size 4x5 against 4x4');
  });

  it('a file it cannot read is named and red, never read as equal', async () => {
    const d = await folders(
      { 'a-1-en-390.png': 'not a picture' },
      { 'a-1-en-390.png': 'not a picture' },
    );

    const { code, lines } = await run(['compare', 'x', d.left, d.right]);

    expect(code).toBe(1);
    expect(lines).toContain(
      '  unreadable a-1-en-390.png: not a PNG: its first bytes are not the PNG signature',
    );
  });

  it('a picture with no counterpart is named on its side, and two empty folders are no verdict', async () => {
    const d = await folders(
      { 'a-1-en-390.png': png(4, 4), 'only-left-en-390.png': png(4, 4) },
      { 'a-1-en-390.png': png(4, 4), 'only-right-en-390.png': png(4, 4) },
    );
    const empty = await folders({}, {});

    const both = await run(['compare', 'x', d.left, d.right]);
    const none = await run(['compare', 'x', empty.left, empty.right]);

    expect(both.code).toBe(1);
    expect(both.lines).toContain('  only in the left: only-left-en-390.png');
    expect(both.lines).toContain('  only in the right: only-right-en-390.png');
    expect(none.code).toBe(1);
    expect(none.lines).toContain('  no pictures to compare');
  });

  it('against the bases a new picture is listed and green, and a base no picture matches is red', async () => {
    const d = await folders(
      { 'a-1-en-390.png': png(4, 4), 'new-en-390.png': png(4, 4) },
      { 'a-1-en-390.png': png(4, 4), 'old-en-390.png': png(4, 4) },
    );
    const fresh = await folders(
      { 'a-1-en-390.png': png(4, 4), 'new-en-390.png': png(4, 4) },
      { 'a-1-en-390.png': png(4, 4) },
    );

    const retired = await run(['compare', 'x', d.left, d.right, '--bases']);
    const added = await run(['compare', 'x', fresh.left, fresh.right, '--bases']);

    expect(retired.code).toBe(1);
    expect(retired.lines).toContain('  base with no picture: old-en-390.png');
    expect(added.code).toBe(0);
    expect(added.lines).toContain('  new new-en-390.png');
  });

  it('with --allow-retired a base no picture matches is listed as retired and green, for a write', async () => {
    const d = await folders(
      { 'a-1-en-390.png': png(4, 4) },
      { 'a-1-en-390.png': png(4, 4), 'old-en-390.png': png(4, 4) },
    );

    const { code, lines } = await run([
      'compare',
      'x',
      d.left,
      d.right,
      '--bases',
      '--allow-retired',
    ]);

    expect(code).toBe(0);
    expect(lines).toContain('  retired old-en-390.png');
  });

  it('a screen moved and not named in --moved is red, a named one is allowed, a named one unmoved is printed', async () => {
    const d = await folders(
      {
        'op-3-made-en-1280.png': moved([[0, 0]]),
        'op-3-made-vi-1280.png': moved([[0, 0]]),
        'op-5-dash-en-1280.png': png(4, 4),
        'op-4-taken-en-1280.png': moved([[1, 1]]),
      },
      {
        'op-3-made-en-1280.png': png(4, 4),
        'op-3-made-vi-1280.png': png(4, 4),
        'op-5-dash-en-1280.png': png(4, 4),
        'op-4-taken-en-1280.png': png(4, 4),
      },
    );

    const unnamed = await run(['compare', 'x', d.left, d.right, '--bases']);
    const named = await run([
      'compare',
      'x',
      d.left,
      d.right,
      '--bases',
      '--moved',
      'op-3-made,op-4-taken,op-5-dash',
    ]);
    const all = await run(['compare', 'x', d.left, d.right, '--bases', '--moved', 'all']);

    expect(unnamed.code).toBe(1);
    expect(unnamed.lines).toContain(
      '  red op-3-made-en-1280.png moved and its screen is not named in --moved',
    );
    expect(named.code).toBe(0);
    expect(named.lines).toContain(
      '  moved op-3-made-en-1280.png: 1 px, shade 1, box 0,0 to 0,0 (named)',
    );
    expect(named.lines).toContain('  named, not moved: op-5-dash');
    expect(all.code).toBe(0);
    expect(all.lines).not.toContain('  named, not moved: op-5-dash');
  });

  it('a moved picture is red whether the other side is named by --moved or not, outside --bases', async () => {
    const d = await folders(
      { 'op-3-made-en-1280.png': moved([[0, 0]]) },
      { 'op-3-made-en-1280.png': png(4, 4) },
    );

    const { code } = await run(['compare', 'x', d.left, d.right, '--moved', 'op-3-made']);

    expect(code).toBe(1);
  });

  it('refuses a call it does not understand, by name', async () => {
    expect((await run([])).lines[0]).toMatch(/^usage:/);
    expect((await run(['compare', 'x'])).code).toBe(2);
    expect((await run(['compare', 'x', 'l', 'r', '--nonsense'])).lines).toContain(
      'unknown option --nonsense',
    );
    expect((await run(['compare', 'x', 'l', 'r', '--moved'])).lines).toContain(
      '--moved needs a list or all',
    );
    expect((await run(['compare', 'x', 'l', 'r', '--raw'])).lines).toContain('--raw needs a file');
  });
});

describe('the strays, from a process listing', () => {
  it('names a stray and a busy process, one a line, and refuses a listing it cannot read', async () => {
    const list = [
      '  1     0 /sbin/launchd',
      ' 10     1 node /work/credo/wip/node_modules/vitest/vitest.mjs run',
      ' 11   300 node /work/credo/wip/node_modules/playwright/cli.js test',
    ].join('\n');

    expect(await run(['strays', '/work/credo', '999'], list)).toEqual({
      code: 0,
      lines: [
        'stray 10 node /work/credo/wip/node_modules/vitest/vitest.mjs run',
        'busy 11 node /work/credo/wip/node_modules/playwright/cli.js test',
      ],
    });
    expect(await run(['strays', '/work/credo', '999'], 'ps: Cannot get process list')).toEqual({
      code: 2,
      lines: ['unreadable: the process list is not readable: ps: Cannot get process list'],
    });
    expect((await run(['strays', '/work/credo'])).code).toBe(2);
  });
});
