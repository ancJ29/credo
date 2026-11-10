import { timingSafeEqual } from 'node:crypto';

/** Equal bytes, compared in time that does not depend on where they differ. A length that
 * differs is answered at once, which `timingSafeEqual` would throw on. */
export const constantTimeEqual = (a: Buffer, b: Buffer) =>
  a.length === b.length && timingSafeEqual(a, b);
