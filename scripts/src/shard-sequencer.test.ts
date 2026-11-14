import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { TestSpecification } from 'vitest/node';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assignShards, TableShardSequencer } from './shard-sequencer';
import { hashOf, readTable, TABLE_PATH, testFilesUnder, weigh } from './shard-times';

const here = resolve(import.meta.dirname);

const spec = (path: string) => ({ moduleId: path }) as TestSpecification;
const sequencer = (shard: { index: number; count: number } | undefined) =>
  new TableShardSequencer({ config: { shard } } as never);

/** The sequencer reading the table at `path` instead of the package's own. */
class AtTable extends TableShardSequencer {
  constructor(shard: { index: number; count: number }, path: string) {
    super({ config: { shard } } as never);
    this.tablePath = path;
  }
}

describe('assignShards', () => {
  it('puts the biggest first into the lightest shard, a tie of totals to the first shard and equal sizes in path order', () => {
    const files = [
      { path: 'b', size: 5 },
      { path: 'a', size: 5 },
      { path: 'c', size: 4 },
      { path: 'd', size: 3 },
    ];
    expect(assignShards(files, 3)).toEqual([['a'], ['b'], ['c', 'd']]);
    expect(assignShards([...files].reverse(), 3)).toEqual([['a'], ['b'], ['c', 'd']]);
  });

  it('gives every shard back even when there are fewer files than shards', () => {
    expect(assignShards([{ path: 'a', size: 1 }], 3)).toEqual([['a'], [], []]);
  });
});

describe('TableShardSequencer on this package', () => {
  const all = testFilesUnder(here);

  it('runs every test file in exactly one of the three shards', async () => {
    const seen: string[] = [];
    for (const index of [1, 2, 3]) {
      const mine = await sequencer({ index, count: 3 }).shard(all.map(spec));
      seen.push(...mine.map((s) => s.moduleId));
    }
    expect(seen.sort()).toEqual([...all].sort());
  });

  it('keeps the slowest shard near a third of the table time, so the table is worth keeping', async () => {
    const weight = new Map(weigh(all, readTable(TABLE_PATH)).map((w) => [w.path, w.size]));
    const totals: number[] = [];
    for (const index of [1, 2, 3]) {
      const mine = await sequencer({ index, count: 3 }).shard(all.map(spec));
      totals.push(mine.reduce((sum, s) => sum + (weight.get(s.moduleId) ?? 0), 0));
    }
    const third = totals.reduce((a, b) => a + b, 0) / 3;
    expect(Math.max(...totals)).toBeLessThan(third * 1.08);
    expect(Math.min(...totals)).toBeGreaterThan(third * 0.92);
  });

  it('keeps every file when no shard is asked for', async () => {
    const specs = all.map(spec);
    expect(await sequencer(undefined).shard(specs)).toBe(specs);
  });
});

describe('TableShardSequencer on a made-up table', () => {
  let scratch = '';
  let files: string[] = [];
  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), 'shard-table-'));
    files = ['a', 'b', 'c', 'd'].map((name, i) => {
      const path = join(scratch, `${name}.test.ts`);
      writeFileSync(path, 'x'.repeat(10 + i));
      return path;
    });
  });
  afterEach(() => rmSync(scratch, { recursive: true, force: true }));
  const shards = async (path: string) =>
    Promise.all(
      [1, 2].map(async (index) =>
        (await new AtTable({ index, count: 2 }, path).shard(files.map(spec))).map(
          (s) => s.moduleId,
        ),
      ),
    );
  const table = (path: string, ms: number[]) =>
    writeFileSync(
      path,
      JSON.stringify(Object.fromEntries(files.map((f, i) => [hashOf(f), { file: f, ms: ms[i] }]))),
    );

  it('splits by the table: a slow small file stands alone against the rest, which size alone would not do', async () => {
    const path = join(scratch, 'hit.json');
    table(path, [9000, 1000, 1000, 1000]);
    expect(await shards(path)).toEqual([[files[0]], [files[1], files[2], files[3]]]);
  });

  it('a file the table does not hold falls back to its size, at the rate the table gives', async () => {
    const path = join(scratch, 'miss.json');
    table(path, [9000, 1000, 1000, 1000]);
    writeFileSync(files[3], 'changed '.repeat(2000));
    const [first, second] = await shards(path);
    expect(first).toEqual([files[3]]);
    expect(second).toEqual([files[0], files[1], files[2]]);
  });

  it('an empty or an absent table splits by size alone', async () => {
    writeFileSync(join(scratch, 'empty.json'), '{}');
    const bySize = [
      [files[0], files[3]],
      [files[1], files[2]],
    ];
    expect(await shards(join(scratch, 'empty.json'))).toEqual(bySize);
    expect(await shards(join(scratch, 'absent.json'))).toEqual(bySize);
  });
});
