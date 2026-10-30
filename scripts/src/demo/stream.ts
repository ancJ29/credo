import { createHash } from 'node:crypto';

/** A seeded stream of numbers in [0, 1): each draw is the SHA-256 of the stream's parts and the
 * draw's position, so the same parts give the same draws on any machine, with no dependency. */
export type Stream = {
  next(): number;
  /** A whole number from 0 up to `n - 1`. */
  int(n: number): number;
  pick<T>(items: readonly T[]): T;
  chance(p: number): boolean;
  /** An item chosen in proportion to its weight. */
  weighted<T>(items: readonly { weight: number; value: T }[]): T;
};

export function streamOf(...parts: (string | number)[]): Stream {
  const seed = parts.join('\u0000');
  let position = 0;
  const next = () => {
    const digest = createHash('sha256').update(`${seed}\u0000${position++}`).digest();
    return digest.readUInt32BE(0) / 2 ** 32;
  };
  const int = (n: number) => Math.floor(next() * n);
  return {
    next,
    int,
    pick: (items) => items[int(items.length)],
    chance: (p) => next() < p,
    weighted: (items) => {
      let left = next() * items.reduce((sum, item) => sum + item.weight, 0);
      for (const item of items) {
        left -= item.weight;
        if (left < 0) return item.value;
      }
      return items[items.length - 1].value;
    },
  };
}
