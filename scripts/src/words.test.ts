import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DICTIONARIES } from '@credo/ui/words';
import { describe, expect, it } from 'vitest';
import { runWords, wordsCsv } from './words';
import { check, resolveConfig } from 'prettier';
import { findWords } from './words-files';
import { parseCsv, readWords } from './words-read';

/** An answer that is no. */
const no = () => Promise.resolve('n');

/** This repository's root, where the real word files are. */
const REPO = fileURLToPath(new URL('../../', import.meta.url));

/** Runs `words` in a fresh folder; what it printed, its exit status and the folder. */
async function run(argv: string[], env: Record<string, string | undefined> = {}) {
  const folder = await mkdtemp(join(tmpdir(), 'words-'));
  const out: string[] = [];
  const err: string[] = [];
  const status = await runWords(argv, env, {
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    cwd: folder,
    root: REPO,
    ask: no,
  });
  return { status, out, err, folder };
}

/** The rows of a file `words out` wrote, each a list of its fields. */
function rowsOf(text: string): string[][] {
  return text
    .slice(1)
    .split('\r\n')
    .slice(0, -1)
    .map((line) => line.slice(1, -1).split('","'));
}

describe('words out', () => {
  it('writes a row for each of the 756 keys in the English order under its header', async () => {
    const { status, folder } = await run(['out', 'p1.csv']);
    expect(status).toBe(0);
    const rows = rowsOf(await readFile(join(folder, 'p1.csv'), 'utf8'));
    expect(rows[0]).toEqual(['key', 'English', 'Vietnamese', 'Note']);
    expect(rows).toHaveLength(757);
    expect(rows[1]).toEqual(['app.name', 'Credo', 'Credo', '']);
    expect(rows.map((row) => row[0]).slice(1, 4)).toEqual([
      'app.name',
      'common.loading',
      'common.retry',
    ]);
    expect(rows.find((row) => row[0] === 'auth.submit')?.[2]).toBe(DICTIONARIES.vi.auth.submit);
  });

  it('starts with the byte-order mark and ends each row with CRLF', async () => {
    const { folder } = await run(['out', 'p1.csv']);
    const bytes = await readFile(join(folder, 'p1.csv'));
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = bytes.toString('utf8');
    expect(text.endsWith('\r\n')).toBe(true);
    expect(text.split('\r\n')).toHaveLength(758);
    expect(text.replaceAll('\r\n', '')).not.toMatch(/[\r\n]/);
  });

  it('keeps a word with a comma, a double quote or a line break in one quoted field', () => {
    const text = wordsCsv({
      en: { a: { b: 'one, two', c: 'say "hi"', d: 'x\ny' } },
      vi: { a: { b: 'một, hai', c: 'nói "chào"', d: 'x\ny' } },
    });
    expect(text).toBe(
      '﻿"key","English","Vietnamese","Note"\r\n' +
        '"a.b","one, two","một, hai",""\r\n' +
        '"a.c","say ""hi""","nói ""chào""",""\r\n' +
        '"a.d","x\ny","x\ny",""\r\n',
    );
  });

  it('leaves the Vietnamese cell empty for a key only English has', () => {
    expect(wordsCsv({ en: { a: 'x' }, vi: {} })).toContain('"a","x","",""');
  });

  it('refuses a file that exists, leaves it as it was and exits 2', async () => {
    const { folder } = await run(['out', 'first.csv']);
    await writeFile(join(folder, 'sent.csv'), 'p1 sent this');
    const out: string[] = [];
    const err: string[] = [];
    const status = await runWords(
      ['out', 'sent.csv'],
      {},
      { out: (l) => out.push(l), err: (l) => err.push(l), cwd: folder, root: REPO, ask: no },
    );
    expect(status).toBe(2);
    expect(await readFile(join(folder, 'sent.csv'), 'utf8')).toBe('p1 sent this');
    expect(err[0]).toContain('already exists');
    expect(out).toEqual([]);
  });

  it('prints the usage and exits 2 for no file or an unknown verb', async () => {
    for (const argv of [['out'], [], ['in', 'a.csv'], ['out', 'a.csv', 'b.csv']]) {
      const { status, err, out } = await run(argv);
      expect(status).toBe(2);
      expect(err).toEqual([expect.stringMatching(/^usage: words out /)]);
      expect(out).toEqual([]);
    }
  });

  it('writes a relative file name in the folder the command was run from', async () => {
    const { folder } = await run(['out', 'unused.csv']);
    const ran = join(folder, 'ran-from');
    await mkdir(ran);
    const out: string[] = [];
    const status = await runWords(
      ['out', 'here.csv'],
      { INIT_CWD: ran },
      { out: (l) => out.push(l), err: () => undefined, cwd: folder, root: REPO, ask: no },
    );
    expect(status).toBe(0);
    expect(out).toEqual([`wrote ${join(ran, 'here.csv')}`]);
    expect((await readFile(join(ran, 'here.csv'), 'utf8')).charCodeAt(0)).toBe(0xfeff);
  });

  it('reads the relative name from the io folder when INIT_CWD is not set', async () => {
    const { folder, out } = await run(['out', 'there.csv']);
    expect(out).toEqual([`wrote ${join(folder, 'there.csv')}`]);
  });

  it('passes on a write error that is not an existing file', async () => {
    const { folder } = await run(['out', 'x.csv']);
    await expect(
      runWords(
        ['out', 'no-such-folder/x.csv'],
        {},
        { out: () => undefined, err: () => undefined, cwd: folder, root: REPO, ask: no },
      ),
    ).rejects.toThrow(/ENOENT/);
  });
});

/** A scratch repository: the two real word files copied, and the file `words out` wrote. */
async function scene() {
  const folder = await mkdtemp(join(tmpdir(), 'words-in-'));
  const root = join(folder, 'repo');
  await mkdir(join(root, 'ui/src/i18n'), { recursive: true });
  for (const file of ['en.ts', 'vi.ts']) {
    await cp(join(REPO, 'ui/src/i18n', file), join(root, 'ui/src/i18n', file));
  }
  await cp(join(REPO, '.prettierrc.json'), join(root, '.prettierrc.json'));
  const sent = join(folder, 'sent.csv');
  await runWords(
    ['out', sent],
    {},
    { out: () => undefined, err: () => undefined, cwd: folder, root, ask: no },
  );
  const rows = parseCsv((await readFile(sent, 'utf8')).slice(1), ',');
  let count = 0;
  /** The sent rows as `change` leaves them, written as a returned file; its path. */
  async function returned(change: (rows: string[][]) => string[][], delimiter = ',', mark = '') {
    const text = change(rows.map((row) => [...row]))
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(delimiter))
      .join('\r\n');
    const path = join(folder, `returned-${++count}.csv`);
    await writeFile(path, mark + text + '\r\n');
    return path;
  }
  async function wordsIn(
    file: string,
    from = root,
    answer = 'n',
    formatter?: (source: string, path: string) => Promise<string>,
  ) {
    const out: string[] = [];
    const err: string[] = [];
    const asked: string[] = [];
    const ask = (question: string) => {
      asked.push(question);
      return Promise.resolve(answer);
    };
    const status = await runWords(
      ['in', sent, file],
      {},
      { out: (l) => out.push(l), err: (l) => err.push(l), cwd: folder, root: from, ask },
      undefined,
      formatter,
    );
    return { status, out: out.join('\n'), err: err.join('\n'), asked };
  }
  const cell = (key: string, column: number) => rows.find((row) => row[0] === key)![column];
  const edit = (key: string, column: number, word: string) => (all: string[][]) => {
    all.find((row) => row[0] === key)![column] = word;
    return all;
  };
  const viFile = join(root, 'ui/src/i18n/vi.ts');
  return { folder, root, sent, rows, returned, wordsIn, cell, edit, viFile };
}

const NONE = '0 changes, 0 clashes, 0 keys gone, 0 notes';

describe('words in', () => {
  it('takes back what out wrote, and the same rows with ; no mark or LF ends', async () => {
    const world = await scene();
    expect(await world.wordsIn(await world.returned((rows) => rows))).toEqual({
      status: 0,
      out: NONE,
      err: '',
      asked: [],
    });
    const semicolons = await world.returned((rows) => rows, ';');
    expect((await world.wordsIn(semicolons)).out).toBe(NONE);
    const lf = join(world.folder, 'lf.csv');
    await writeFile(lf, (await readFile(world.sent, 'utf8')).slice(1).replaceAll('\r\n', '\n'));
    expect((await world.wordsIn(lf)).out).toBe(NONE);
  });

  it('refuses a file not in UTF-8, naming CSV UTF-8', async () => {
    const world = await scene();
    const old = join(world.folder, 'old.csv');
    await writeFile(
      old,
      Buffer.concat([
        Buffer.from('key,English,Vietnamese\n"a","'),
        Buffer.from([0xe9]),
        Buffer.from('","x"\n'),
      ]),
    );
    const result = await world.wordsIn(old);
    expect(result.status).toBe(2);
    expect(result.err).toBe(
      'the file returned is not UTF-8: save it as CSV UTF-8 and send it again',
    );
    expect(result.out).toBe('');
  });

  it('shows a changed word with its key, language, file line, now and theirs', async () => {
    const world = await scene();
    const line =
      (await readFile(world.viFile, 'utf8')).split('\n').indexOf("    orders: 'Đơn hàng',") + 1;
    const file = await world.returned(world.edit('nav.orders', 2, 'Đơn đặt hàng'));
    const result = await world.wordsIn(file);
    expect(result.out).toBe(
      `change Vietnamese nav.orders (vi.ts line ${line})\n  now:    Đơn hàng\n  theirs: Đơn đặt hàng\n` +
        '1 changes, 0 clashes, 0 keys gone, 0 notes\nnothing written',
    );
    expect(await readFile(world.viFile, 'utf8')).toBe(
      await readFile(join(REPO, 'ui/src/i18n/vi.ts'), 'utf8'),
    );
    const english = await world.wordsIn(
      await world.returned(world.edit('nav.orders', 1, 'Orders!')),
    );
    expect(english.out).toContain(
      'change English nav.orders (en.ts line 26)\n  now:    Orders\n  theirs: Orders!',
    );
  });

  it('shows a note with its key, on a changed row or an unchanged one', async () => {
    const world = await scene();
    const file = await world.returned((rows) => {
      world.edit('nav.orders', 2, 'Đơn đặt hàng')(rows);
      world.edit('nav.orders', 3, 'p1: too formal')(rows);
      return world.edit('nav.settings', 3, 'p1: ok?')(rows);
    });
    const result = await world.wordsIn(file);
    expect(result.out).toContain('note nav.orders: p1: too formal');
    expect(result.out).toContain('note nav.settings: p1: ok?');
    expect(result.out).toContain('1 changes, 0 clashes, 0 keys gone, 2 notes');
  });

  it('refuses a missing column, a key twice or a key not sent, each row named', async () => {
    const world = await scene();
    const noColumn = join(world.folder, 'nocolumn.csv');
    await writeFile(noColumn, 'key,English\r\n"a","b"\r\n');
    const missing = await world.wordsIn(noColumn);
    expect(missing.status).toBe(2);
    expect(missing.err).toBe(
      'the file returned has no Vietnamese column: the first row must name them',
    );
    const file = await world.returned((rows) => [
      ...rows,
      rows[1],
      ['p2.invented', 'x', 'y', ''],
      ['', 'no key', 'y', ''],
    ]);
    const result = await world.wordsIn(file);
    expect(result.status).toBe(2);
    expect(result.err).toBe(
      'refused, nothing read in: 3 problems\n  app.name: the key is there twice\n' +
        '  p2.invented: not in the file you sent\n  a row with no key (English: no key): not in the file you sent',
    );
    expect(result.out).toBe('');
  });

  it('refuses an emptied cell or a line break in a cell, each row named', async () => {
    const world = await scene();
    const file = await world.returned((rows) => {
      world.edit('nav.orders', 2, '  ')(rows);
      world.edit('nav.settings', 1, 'Set\ntings')(rows);
      return world.edit('nav.staff', 2, 'a\rb')(rows);
    });
    const result = await world.wordsIn(file);
    expect(result.status).toBe(2);
    expect(result.err).toBe(
      'refused, nothing read in: 3 problems\n  nav.orders: the Vietnamese cell is empty\n' +
        '  nav.settings: the English cell holds a line break\n  nav.staff: the Vietnamese cell holds a line break',
    );
  });

  it('refuses a placeholder lost, added or renamed, naming the key and both sets', async () => {
    const world = await scene();
    const key = world.rows.find((row) => row[1].includes('{{max}}'))![0];
    const word = world.cell(key, 1);
    const lost = await world.wordsIn(await world.returned(world.edit(key, 1, 'no placeholder')));
    expect(lost.err).toBe(
      `refused, nothing read in: 1 problems\n  ${key}: the English placeholders were {{max}}, now none`,
    );
    const added = await world.wordsIn(
      await world.returned(world.edit('nav.orders', 1, 'Orders {{n}}')),
    );
    expect(added.err).toContain('nav.orders: the English placeholders were none, now {{n}}');
    const renamed = await world.wordsIn(
      await world.returned(world.edit(key, 1, word.replace('{{max}}', '{{most}}'))),
    );
    expect(renamed.err).toContain('were {{max}}, now {{most}}');
    const kept = await world.wordsIn(await world.returned(world.edit(key, 1, `${word} Really.`)));
    expect(kept.status).toBe(0);
  });

  it('reads a trailing space or decomposed accents as the same word', async () => {
    const world = await scene();
    const spaced = await world.returned(world.edit('nav.orders', 2, 'Đơn hàng '));
    expect((await world.wordsIn(spaced)).out).toBe(NONE);
    const decomposed = await world.returned(
      world.edit('nav.orders', 2, 'Đơn hàng'.normalize('NFD')),
    );
    expect((await world.wordsIn(decomposed)).out).toBe(NONE);
  });

  it('reads a placeholder repeated or its repeat dropped as the same, and refuses a brace left outside one', async () => {
    const world = await scene();
    const key = world.rows.find((row) => row[1].includes('{{max}}'))![0];
    const word = world.cell(key, 1);
    const doubled = await world.wordsIn(
      await world.returned(world.edit(key, 1, `${word} {{max}}`)),
    );
    expect(doubled.status).toBe(0);
    // the sent sheet now holds the doubled word; the original, repeat dropped, comes back
    await cp(
      await world.returned(world.edit(key, 1, `${word} {{max}}`), ',', '\ufeff'),
      world.sent,
    );
    const dropped = await world.wordsIn(await world.returned((rows) => rows));
    expect(dropped.status).toBe(0);
    const stray = await world.wordsIn(
      await world.returned(world.edit(key, 1, word.replace('{{max}}', '{{max}}}'))),
    );
    expect(stray.err).toContain(`${key}: the English word has a { or } outside a placeholder`);
  });

  it('changes nothing for a row left out, reordered rows, an extra column or empty rows', async () => {
    const world = await scene();
    const file = await world.returned((rows) => {
      const [header, ...rest] = rows;
      return [
        [...header, 'Extra'],
        [],
        ...rest
          .slice(2)
          .reverse()
          .map((row) => [...row, 'x']),
        ['', '', '', ''],
      ];
    });
    expect((await world.wordsIn(file)).out).toBe(NONE);
  });

  it('shows a word changed in the app since as a clash and a key gone since alone', async () => {
    const world = await scene();
    const vi = await readFile(world.viFile, 'utf8');
    await writeFile(
      world.viFile,
      vi
        .replace("orders: 'Đơn hàng',", "orders: 'Đơn',")
        .replace("    deliveries: 'Yêu cầu giao hàng',\n", ''),
    );
    const file = await world.returned((rows) => {
      world.edit('nav.orders', 2, 'Đơn đặt hàng')(rows);
      return world.edit('nav.deliveries', 2, 'Giao hàng')(rows);
    });
    const result = await world.wordsIn(file);
    expect(result.status).toBe(0);
    expect(result.out).toContain(
      'clash Vietnamese nav.orders (vi.ts line 27), not written\n  sent:   Đơn hàng\n  now:    Đơn\n  theirs: Đơn đặt hàng',
    );
    expect(result.out).toContain('gone nav.deliveries: no longer in the app, not written');
    expect(result.out).toContain('0 changes, 1 clashes, 1 keys gone, 0 notes');
    expect(await readFile(world.viFile, 'utf8')).not.toContain('Đơn đặt hàng');
  });

  it("shows the first partner's changed lines as clashes in the second's file", async () => {
    const world = await scene();
    const vi = await readFile(world.viFile, 'utf8');
    await writeFile(world.viFile, vi.replace("orders: 'Đơn hàng',", "orders: 'Đơn p1',"));
    const second = await world.wordsIn(await world.returned(world.edit('nav.orders', 2, 'Đơn p2')));
    expect(second.out).toContain('clash Vietnamese nav.orders (vi.ts line 27), not written');
    expect(second.out).toContain('  now:    Đơn p1\n  theirs: Đơn p2');
    expect(second.out).toContain('0 changes, 1 clashes');
    const alike = await world.wordsIn(await world.returned(world.edit('nav.orders', 2, 'Đơn p1')));
    expect(alike.out).toBe(`already so Vietnamese nav.orders (vi.ts line 27)\n${NONE}`);
  });

  it('finds each of the 756 keys in each word file, as the app reads it', async () => {
    const flatten = (tree: Record<string, unknown>, prefix = ''): [string, string][] =>
      Object.entries(tree).flatMap(([name, value]) =>
        typeof value === 'string'
          ? [[`${prefix}${name}`, value] as [string, string]]
          : flatten(value as Record<string, unknown>, `${prefix}${name}.`),
      );
    for (const code of ['en', 'vi'] as const) {
      const found = findWords(await readFile(join(REPO, 'ui/src/i18n', `${code}.ts`), 'utf8'));
      const read = flatten(DICTIONARIES[code]);
      expect(read).toHaveLength(756);
      expect(found.size).toBe(756);
      for (const [key, word] of read) expect(found.get(key)?.text).toBe(word);
    }
  });

  it('prints the usage for a single path and refuses a file it cannot read', async () => {
    const world = await scene();
    const out: string[] = [];
    const err: string[] = [];
    const io = {
      out: (l: string) => out.push(l),
      err: (l: string) => err.push(l),
      cwd: world.folder,
      ask: no,
      root: world.root,
    };
    expect(await runWords(['in', world.sent], {}, io)).toBe(2);
    expect(err[0]).toMatch(/^usage: words out /);
    expect(await runWords(['in', 'sent.csv', 'missing.csv'], {}, io)).toBe(2);
    const missing = join(world.folder, 'missing.csv');
    expect(err[1]).toBe(
      `cannot read the file returned: ${missing} (ENOENT: no such file or directory, open '${missing}')`,
    );
    await expect(world.wordsIn(world.sent, join(world.folder, 'no-repo'))).rejects.toThrow(
      /ENOENT/,
    );
  });
});

describe('words in, written', () => {
  const orders = (word: string) => `    orders: '${word}',`;

  it('writes nothing for any answer but y, and asks only when something changes', async () => {
    const world = await scene();
    const file = await world.returned(world.edit('nav.orders', 2, 'Đơn đặt hàng'));
    for (const answer of ['n', '', 'yes', 'sure']) {
      const result = await world.wordsIn(file, world.root, answer);
      expect(result.status).toBe(0);
      expect(result.asked).toEqual(['Write these 1 changes? (y/N)']);
      expect(result.out).toMatch(/nothing written$/);
    }
    expect(await readFile(world.viFile, 'utf8')).toBe(
      await readFile(join(REPO, 'ui/src/i18n/vi.ts'), 'utf8'),
    );
    const none = await world.wordsIn(await world.returned((rows) => rows), world.root, 'y');
    expect(none.asked).toEqual([]);
  });

  it('changes only the one property of vi.ts on y and leaves en.ts byte for byte', async () => {
    const world = await scene();
    const before = await readFile(world.viFile, 'utf8');
    const english = await readFile(join(world.root, 'ui/src/i18n/en.ts'), 'utf8');
    const result = await world.wordsIn(
      await world.returned(world.edit('nav.orders', 2, 'Đơn đặt hàng')),
      world.root,
      ' Y ',
    );
    expect(result.status).toBe(0);
    expect(result.out).toMatch(/wrote vi\.ts$/);
    const after = await readFile(world.viFile, 'utf8');
    expect(after).toBe(before.replace(orders('Đơn hàng'), orders('Đơn đặt hàng')));
    expect(await readFile(join(world.root, 'ui/src/i18n/en.ts'), 'utf8')).toBe(english);
  });

  it('writes a file the formatter passes and that reads the word back, quote and backslash too', async () => {
    const world = await scene();
    const word =
      "Don't \\ go: it's a very long word that goes past one hundred columns of the formatted line, so it wraps";
    const result = await world.wordsIn(
      await world.returned((rows) => {
        world.edit('nav.orders', 2, word)(rows);
        world.edit('nav.staff', 2, 'Nhân sự')(rows);
        return world.edit('nav.settings', 1, 'Setup')(rows);
      }),
      world.root,
      'y',
    );
    expect(result.status).toBe(0);
    for (const code of ['en', 'vi']) {
      const path = join(world.root, `ui/src/i18n/${code}.ts`);
      const text = await readFile(path, 'utf8');
      expect(await check(text, { ...(await resolveConfig(path)), filepath: path })).toBe(true);
    }
    const found = findWords(await readFile(world.viFile, 'utf8'));
    expect(found.get('nav.orders')?.text).toBe(word);
    expect(found.get('nav.settings')?.text).toBe('Cài đặt');
    expect(found.get('nav.staff')?.text).toBe('Nhân sự');
    expect(
      findWords(await readFile(join(world.root, 'ui/src/i18n/en.ts'), 'utf8')).get('nav.settings')
        ?.text,
    ).toBe('Setup');
  });

  it('writes neither file when a temporary file cannot be written, exit 1', async () => {
    const world = await scene();
    const english = await readFile(join(world.root, 'ui/src/i18n/en.ts'), 'utf8');
    await mkdir(`${world.viFile}.words-new`);
    const file = await world.returned((rows) => {
      world.edit('nav.orders', 1, 'Orders!')(rows);
      return world.edit('nav.orders', 2, 'Đơn đặt hàng')(rows);
    });
    const result = await world.wordsIn(file, world.root, 'y');
    expect(result.status).toBe(1);
    expect(result.err).toMatch(/^nothing written: /);
    expect(result.out).not.toContain('wrote');
    expect(await readFile(join(world.root, 'ui/src/i18n/en.ts'), 'utf8')).toBe(english);
    await expect(readFile(join(world.root, 'ui/src/i18n/en.ts.words-new'))).rejects.toThrow(
      /ENOENT/,
    );
  });

  it('writes neither file when the re-read finds a key not reading its word, exit 1', async () => {
    const world = await scene();
    const english = await readFile(join(world.root, 'ui/src/i18n/en.ts'), 'utf8');
    const vietnamese = await readFile(world.viFile, 'utf8');
    const file = await world.returned((rows) => {
      world.edit('nav.orders', 1, 'Orders!')(rows);
      return world.edit('nav.orders', 2, 'Đơn đặt hàng')(rows);
    });
    const spoil = (source: string, path: string) =>
      Promise.resolve(path.endsWith('vi.ts') ? source.replace("'Cài đặt'", "'Sai'") : source);
    const result = await world.wordsIn(file, world.root, 'y', spoil);
    expect(result.status).toBe(1);
    expect(result.err).toBe('nothing written: vi.ts did not read back as intended (nav.settings)');
    expect(await readFile(world.viFile, 'utf8')).toBe(vietnamese);
    expect(await readFile(join(world.root, 'ui/src/i18n/en.ts'), 'utf8')).toBe(english);
    const moved = await world.wordsIn(file, world.root, 'y', (source) =>
      Promise.resolve(source.replace('orders:', "extra: 'x',\n orders:")),
    );
    expect(moved.err).toBe('nothing written: en.ts did not read back as intended (its keys moved)');
    const dropped = await world.wordsIn(file, world.root, 'y', (source) =>
      Promise.resolve(source.replace(/.*deliveries: .*\n/, '')),
    );
    expect(dropped.err).toContain('nav.deliveries');
  });
});

describe('the reader', () => {
  it('reads quotes, doubled quotes, any line end and a last row without one', () => {
    expect(parseCsv('"a,""b""",c\r\n"x\ny",z\rq,\nlast', ',')).toEqual([
      ['a,"b"', 'c'],
      ['x\ny', 'z'],
      ['q', ''],
      ['last'],
    ]);
    expect(parseCsv('a;b;', ';')).toEqual([['a', 'b', '']]);
    expect(parseCsv('', ',')).toEqual([]);
  });

  it('finds columns by name in any order and tolerates short rows', () => {
    const text = 'Note;vietnamese;ENGLISH;Key\n"n";"v";"e";"k"\nonly\n';
    expect(readWords(new TextEncoder().encode(`\uFEFF${text}`), 'the file')).toEqual([
      { key: 'k', en: 'e', vi: 'v', note: 'n' },
      { key: '', en: '', vi: '', note: 'only' },
    ]);
    const bare = readWords(new TextEncoder().encode('key,English,Vietnamese\na,b,c'), 'the file');
    expect(bare).toEqual([{ key: 'a', en: 'b', vi: 'c', note: '' }]);
  });
});
