import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestModule } from 'vitest/node';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  hashOf,
  mergeTimes,
  readTable,
  TABLE_PATH,
  testFilesUnder,
  TimesReporter,
  weigh,
} from './shard-times';

let dir = '';
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'shard-times-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** A file of `text` in the scratch folder, its path back. */
function file(name: string, text: string): string {
  const path = join(dir, name);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, text);
  return path;
}

describe('hashOf', () => {
  it('follows the content alone: same text, same hash, in any file; one character more, another', () => {
    expect(hashOf(file('a.test.ts', 'one'))).toBe(hashOf(file('b.test.ts', 'one')));
    expect(hashOf(file('a.test.ts', 'one'))).not.toBe(hashOf(file('b.test.ts', 'one!')));
    expect(hashOf(file('a.test.ts', 'one'))).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('readTable', () => {
  it('reads the table, and an absent or unreadable one as empty', () => {
    expect(readTable(file('t.json', '{"ab":{"file":"x","ms":5}}'))).toEqual({
      ab: { file: 'x', ms: 5 },
    });
    expect(readTable(join(dir, 'none.json'))).toEqual({});
    expect(readTable(file('bad.json', 'not json'))).toEqual({});
  });

  it('holds this package: an entry for each key, a time that is a number', () => {
    const table = readTable(TABLE_PATH);
    expect(Object.keys(table).length).toBeGreaterThan(30);
    for (const [hash, entry] of Object.entries(table)) {
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
      expect(entry.ms).toBeGreaterThan(0);
    }
  });
});

describe('testFilesUnder', () => {
  it('finds the test files in every folder and leaves the rest', () => {
    const a = file('a.test.ts', '');
    const b = file('sub/b.test.ts', '');
    file('c.ts', '');
    expect(testFilesUnder(dir).sort()).toEqual([a, b]);
  });
});

describe('weigh', () => {
  it('a hit weighs its time from the table', () => {
    const a = file('a.test.ts', 'aaaa');
    const b = file('b.test.ts', 'bbbbbbbb');
    const table = {
      [hashOf(a)]: { file: 'a.test.ts', ms: 7000 },
      [hashOf(b)]: { file: 'b.test.ts', ms: 1000 },
    };
    expect(weigh([a, b], table, dir)).toEqual([
      { path: a, size: 7000 },
      { path: b, size: 1000 },
    ]);
  });

  it('an edited file, its path in the table under another hash, weighs the time last recorded for the path, whatever its bytes', () => {
    const a = file('a.test.ts', 'aaaa');
    const edited = file('sub/e.test.ts', 'e'.repeat(5000));
    const table = {
      [hashOf(a)]: { file: 'a.test.ts', ms: 4000 },
      oldhash: { file: 'sub/e.test.ts', ms: 25 },
    };
    expect(weigh([a, edited], table, dir)).toEqual([
      { path: a, size: 4000 },
      { path: edited, size: 25, miss: 'path' },
    ]);
  });

  it('a path the table never saw weighs its bytes at the hits rate of milliseconds per byte', () => {
    const a = file('a.test.ts', 'aaaa');
    const b = file('b.test.ts', 'bbbbbbbb');
    const fresh = file('c.test.ts', 'cc');
    const table = {
      [hashOf(a)]: { file: 'a.test.ts', ms: 4000 },
      [hashOf(b)]: { file: 'b.test.ts', ms: 8000 },
    };
    expect(weigh([a, b, fresh], table, dir)).toEqual([
      { path: a, size: 4000 },
      { path: b, size: 8000 },
      { path: fresh, size: 2000, miss: 'bytes' },
    ]);
  });

  it('an empty table weighs every file by its bytes', () => {
    const a = file('a.test.ts', 'aaaa');
    const b = file('b.test.ts', 'bb');
    expect(weigh([a, b], {}, dir)).toEqual([
      { path: a, size: 4, miss: 'bytes' },
      { path: b, size: 2, miss: 'bytes' },
    ]);
  });
});

describe('mergeTimes', () => {
  it('keeps the entries of files still there, drops the rest, lets a run overwrite, and sorts by file', () => {
    const a = file('a.test.ts', 'aaaa');
    const b = file('b.test.ts', 'bbbb2');
    const old = {
      [hashOf(a)]: { file: 'a.test.ts', ms: 100 },
      gone: { file: 'old.test.ts', ms: 9 },
    };
    const merged = mergeTimes(old, [a, b], [{ path: b, ms: 2000.4 }], dir);
    expect(merged).toEqual({
      [hashOf(a)]: { file: 'a.test.ts', ms: 100 },
      [hashOf(b)]: { file: 'b.test.ts', ms: 2000 },
    });
    expect(
      Object.values(
        mergeTimes(
          {},
          [a, b],
          [
            { path: b, ms: 1 },
            { path: a, ms: 1 },
          ],
          dir,
        ),
      ).map((e) => e.file),
    ).toEqual(['a.test.ts', 'b.test.ts']);
    const again = mergeTimes(merged, [a, b], [{ path: a, ms: 5 }], dir);
    expect(again[hashOf(a)]?.ms).toBe(5);
    expect(again[hashOf(b)]?.ms).toBe(2000);
  });
});

describe('TimesReporter', () => {
  const modules = (...entries: [string, number][]) =>
    entries.map(([moduleId, duration]) => ({
      moduleId,
      diagnostic: () => ({ duration }),
    })) as unknown as TestModule[];

  it('writes the table of a green run, keeping the entry of a file the run did not reach', () => {
    const a = file('src/a.test.ts', 'aaaa');
    const b = file('src/b.test.ts', 'bbbb');
    const table = join(dir, 'times.json');
    writeFileSync(table, JSON.stringify({ [hashOf(a)]: { file: 'a.test.ts', ms: 100 } }));
    new TimesReporter(table, join(dir, 'src')).onTestRunEnd(modules([b, 1500]), [], 'passed');
    const written = readFileSync(table, 'utf8');
    expect(written.endsWith('}\n')).toBe(true);
    expect(JSON.parse(written)).toEqual({
      [hashOf(a)]: { file: 'a.test.ts', ms: 100 },
      [hashOf(b)]: { file: 'b.test.ts', ms: 1500 },
    });
  });

  it('writes nothing after a red run, whose times say nothing', () => {
    const a = file('src/a.test.ts', 'aaaa');
    const table = join(dir, 'times.json');
    new TimesReporter(table, join(dir, 'src')).onTestRunEnd(modules([a, 10]), [], 'failed');
    expect(() => readFileSync(table)).toThrow();
  });

  it('writes nothing when the run had an unhandled error, though its modules passed', () => {
    const a = file('src/a.test.ts', 'aaaa');
    const table = join(dir, 'times.json');
    new TimesReporter(table, join(dir, 'src')).onTestRunEnd(
      modules([a, 10]),
      [new Error('x')],
      'passed',
    );
    expect(() => readFileSync(table)).toThrow();
  });
});
