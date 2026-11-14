import { describe, expect, it } from 'vitest';
import { boxNameSchema, createClientRequestSchema, HOME_BOX, storedClientSchema } from './index';

describe('A box is named in a company’s line and in the operator’s form', () => {
  it('is a few lowercase letters and digits, and home is the first box’s', () => {
    expect(HOME_BOX).toBe('home');
    for (const good of ['b2', 'home', 'a', 'box12345678901a']) {
      expect(boxNameSchema.safeParse(good).success, good).toBe(true);
    }
    for (const bad of ['', '2b', 'B2', 'b-2', 'b 2', 'x'.repeat(17)]) {
      expect(boxNameSchema.safeParse(bad).success, bad).toBe(false);
    }
  });

  it('is optional in a line and in the form, and refused when it is not a name', () => {
    const id = '6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
    expect(storedClientSchema.safeParse({ id, name: 'A' }).success).toBe(true);
    expect(storedClientSchema.parse({ id, name: 'A', box: 'b2' }).box).toBe('b2');
    expect(storedClientSchema.safeParse({ id, name: 'A', box: 'B 2' }).success).toBe(false);
    expect(createClientRequestSchema.parse({ code: 'acme', name: 'A', box: 'b2' }).box).toBe('b2');
    expect(
      createClientRequestSchema.safeParse({ code: 'acme', name: 'A', box: 'No' }).success,
    ).toBe(false);
  });
});
