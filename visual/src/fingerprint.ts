import { createHash } from 'node:crypto';

/**
 * A screen's words as a short fingerprint: twelve hex digits of their hash. An answer is given on
 * a fingerprint, so the machine can tell, line by line, that the screen's words are still the ones
 * the human answered on. The build computes it; the page only copies it.
 */
export const fingerprintOf = (words: readonly string[]) =>
  createHash('sha256').update(words.join('\n')).digest('hex').slice(0, 12);
