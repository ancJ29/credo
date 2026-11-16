import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DICTIONARIES } from '@credo/ui/words';
import { describe, expect, it } from 'vitest';
import { runWords, wordsCsv } from './words';

/** Runs `words` in a fresh folder; what it printed, its exit status and the folder. */
async function run(argv: string[], env: Record<string, string | undefined> = {}) {
  const folder = await mkdtemp(join(tmpdir(), 'words-'));
  const out: string[] = [];
  const err: string[] = [];
  const status = await runWords(argv, env, {
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    cwd: folder,
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
  it('writes a row for each of the 759 keys in the English order under its header', async () => {
    const { status, folder } = await run(['out', 'p1.csv']);
    expect(status).toBe(0);
    const rows = rowsOf(await readFile(join(folder, 'p1.csv'), 'utf8'));
    expect(rows[0]).toEqual(['key', 'English', 'Vietnamese', 'Note']);
    expect(rows).toHaveLength(760);
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
    expect(text.split('\r\n')).toHaveLength(761);
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
      { out: (l) => out.push(l), err: (l) => err.push(l), cwd: folder },
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
      { out: (l) => out.push(l), err: () => undefined, cwd: folder },
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
        { out: () => undefined, err: () => undefined, cwd: folder },
      ),
    ).rejects.toThrow(/ENOENT/);
  });
});
