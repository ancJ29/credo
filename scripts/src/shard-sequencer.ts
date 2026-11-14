import { BaseSequencer, type TestSpecification } from 'vitest/node';
import { readTable, TABLE_PATH, weigh } from './shard-times';

/**
 * Which of `count` shards each file runs in, by weight: the heaviest file first, each into the shard whose total is
 * smallest so far (ties: the first shard; equal weights: path order). The weight is the file's time from
 * `shard-times.json` where the table holds its content's hash, else its size scaled to the table's time (`weigh` in
 * shard-times.ts), so a changed or new file lands by its size until a local run refreshes the table. The by-size split
 * alone left the slowest shard 27 % over a third on GitHub's run, vitest's hash split 1.6 times. Every runner reads
 * the same files and the same table, so every runner draws the same split.
 */
export function assignShards(
  files: readonly { path: string; size: number }[],
  count: number,
): string[][] {
  const shards = Array.from({ length: count }, () => ({ paths: [] as string[], total: 0 }));
  const biggestFirst = [...files].sort((a, b) => b.size - a.size || (a.path < b.path ? -1 : 1));
  for (const file of biggestFirst) {
    const lightest = shards.reduce((best, shard) => (shard.total < best.total ? shard : best));
    lightest.paths.push(file.path);
    lightest.total += file.size;
  }
  return shards.map((shard) => shard.paths);
}

/** Vitest's `--shard=i/n` with that split in place of its hash split (`sequence.sequencer` in vitest.config.ts). */
export class TableShardSequencer extends BaseSequencer {
  protected tablePath = TABLE_PATH;

  override shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const shard = this.ctx.config.shard;
    if (!shard) return Promise.resolve(files);
    const weights = weigh(
      files.map((spec) => spec.moduleId),
      readTable(this.tablePath),
    );
    const mine = new Set(assignShards(weights, shard.count)[shard.index - 1]);
    return Promise.resolve(files.filter((spec) => mine.has(spec.moduleId)));
  }
}
