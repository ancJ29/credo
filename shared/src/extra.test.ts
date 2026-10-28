import { describe, expect, it } from 'vitest';
import { EXTRA_MAX_BYTES, extraSchema } from './extra';

const ok = (value: unknown) => extraSchema.safeParse(value).success;

describe('extra', () => {
  it('Every record a client’s UI shows carries `extra`: a JSON object of at most 8 KB and five levels, with no key `__proto__`, `constructor` or `prototype`; the BFF stores and returns it untouched, each reader defaults it to `{}`, and a save replaces it whole', () => {
    // a JSON object, of any value inside
    expect(ok({ phone: '0901', note: null, n: 1.5, yes: true, list: [1, 'a', { b: 2 }] })).toBe(
      true,
    );
    for (const bad of [
      'text',
      1,
      null,
      [1],
      new Date(),
      { n: Number.NaN },
      { f: () => 1 },
      { u: undefined },
    ]) {
      expect(ok(bad), Object.prototype.toString.call(bad)).toBe(false);
    }

    // five levels deep, the object itself the first
    expect(ok({ a: { b: { c: { d: 1 } } } })).toBe(true);
    expect(ok({ a: { b: { c: { d: { e: 1 } } } } })).toBe(true);
    expect(ok({ a: { b: { c: { d: { e: { f: 1 } } } } } })).toBe(false);
    expect(ok({ a: [[[[1]]]] })).toBe(true);
    expect(ok({ a: [[[[[1]]]]] })).toBe(false);

    // at most 8 KB as JSON, counted in bytes
    const fill = (bytes: number) => ({ k: 'x'.repeat(bytes - '{"k":""}'.length) });
    expect(ok(fill(EXTRA_MAX_BYTES))).toBe(true);
    expect(ok(fill(EXTRA_MAX_BYTES + 1))).toBe(false);
    expect(ok({ k: 'ạ'.repeat(EXTRA_MAX_BYTES / 3) })).toBe(false);

    // the three keys, at any level, as the input names them
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      const named = JSON.parse(`{"${key}":1}`) as unknown;
      expect(ok(named), key).toBe(false);
      expect(ok({ deep: [JSON.parse(`{"${key}":1}`)] }), key).toBe(false);
    }
    expect(ok({ constructors: 1 })).toBe(true);

    // an object with no prototype is a plain one
    expect(ok(Object.assign(Object.create(null), { a: 1 }))).toBe(true);

    // each reader defaults it, and the value comes out as it went in
    expect(extraSchema.safeParse(undefined).data).toEqual({});
    const given = { phone: '0901' };
    expect(extraSchema.safeParse(given).data).toEqual(given);
  });
});
