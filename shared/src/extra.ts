import { z } from 'zod';

/** What `extra` may hold: a JSON object a client's own logic owns. The BFF checks it only for
 * this bound, stores it and returns it untouched. */
export const EXTRA_MAX_BYTES = 8 * 1024;
export const EXTRA_MAX_DEPTH = 5;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Whether `value` is JSON: strings, finite numbers, booleans, null, arrays and plain objects, none
 * deeper than `depth` levels, and no object holding a forbidden key. */
function isBoundedJson(value: unknown, depth: number): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || depth < 1) return false;
  if (Array.isArray(value)) return value.every((item) => isBoundedJson(item, depth - 1));
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    return false;
  }
  return Object.entries(value).every(
    ([key, item]) => !FORBIDDEN_KEYS.has(key) && isBoundedJson(item, depth - 1),
  );
}

export const extraIsValid = (value: unknown) =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  isBoundedJson(value, EXTRA_MAX_DEPTH) &&
  new TextEncoder().encode(JSON.stringify(value)).length <= EXTRA_MAX_BYTES;

/** `extra` as every reader takes it: a bounded JSON object, `{}` when the record or the answer
 * was written before the field existed. The input is checked as it came, since a parse that
 * copied it would drop a key named `__proto__` instead of refusing it. */
export const extraSchema = z
  .custom<Record<string, unknown>>(extraIsValid, 'a JSON object of at most 8 KB and 5 levels')
  .default({});
export type Extra = z.output<typeof extraSchema>;
