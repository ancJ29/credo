import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { TestSpecification } from 'vitest/node';
import { describe, expect, it } from 'vitest';
import { assignShards, SizeShardSequencer } from './shard-sequencer';

const here = resolve(import.meta.dirname);

/** Every test file under src, as vitest's own `include` finds them. */
function testFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return testFiles(path);
    return entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

const spec = (path: string) => ({ moduleId: path }) as TestSpecification;
const sequencer = (shard: { index: number; count: number } | undefined) =>
  new SizeShardSequencer({ config: { shard } } as never);

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

describe('SizeShardSequencer on this package', () => {
  const all = testFiles(here);

  it('runs every test file in exactly one of the three shards', async () => {
    const seen: string[] = [];
    for (const index of [1, 2, 3]) {
      const mine = await sequencer({ index, count: 3 }).shard(all.map(spec));
      seen.push(...mine.map((s) => s.moduleId));
    }
    expect(seen.sort()).toEqual([...all].sort());
  });

  it('keeps the biggest shard near a third of the files bytes, so a new file needs no table', async () => {
    const sizes: number[] = [];
    for (const index of [1, 2, 3]) {
      const mine = await sequencer({ index, count: 3 }).shard(all.map(spec));
      sizes.push(mine.reduce((sum, s) => sum + statSync(s.moduleId).size, 0));
    }
    const third = sizes.reduce((a, b) => a + b, 0) / 3;
    expect(Math.max(...sizes)).toBeLessThan(third * 1.15);
  });

  it('keeps every file when no shard is asked for', async () => {
    const specs = all.map(spec);
    expect(await sequencer(undefined).shard(specs)).toBe(specs);
  });
});
