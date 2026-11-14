import { statSync } from 'node:fs';
import { BaseSequencer, type TestSpecification } from 'vitest/node';

/**
 * Which of `count` shards each file runs in, by file size: the biggest file first, each into the shard whose total is
 * smallest so far (ties: the first shard; equal sizes: path order). The tests' time follows their file's size closely
 * enough here (on the two saved GitHub runs the slowest shard came out within 3 % of a third of the total, where
 * vitest's own split by path hash gave 1.6 times a third), and a size needs no table to keep: a new test file lands
 * in a shard on its own. Every runner reads the same files, so every runner draws the same split.
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
export class SizeShardSequencer extends BaseSequencer {
  override shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const shard = this.ctx.config.shard;
    if (!shard) return Promise.resolve(files);
    const mine = new Set(
      assignShards(
        files.map((spec) => ({ path: spec.moduleId, size: statSync(spec.moduleId).size })),
        shard.count,
      )[shard.index - 1],
    );
    return Promise.resolve(files.filter((spec) => mine.has(spec.moduleId)));
  }
}
