import { describe, expect, it } from 'vitest';
import { boxesReplySchema, createClientRequestSchema, ROUTES } from './wire';

describe('the boxes the operator picks from', () => {
  it('C: A box is a name, its companies and its free disk, or no disk when it did not answer', () => {
    const reply = {
      boxes: [
        { name: 'home', companies: 3, freeBytes: 1024 },
        { name: 'b2', companies: 0, freeBytes: null },
      ],
    };

    expect(boxesReplySchema.safeParse(reply).data).toEqual(reply);
    expect(ROUTES.operatorBoxes).toBe('/api/operator/boxes');
  });

  it('C: A box with a bad name, a negative count or a stray field is refused', () => {
    const one = { name: 'home', companies: 1, freeBytes: 1 };
    for (const bad of [
      { ...one, name: 'Home' },
      { ...one, companies: -1 },
      { ...one, freeBytes: -1 },
      { ...one, extra: 1 },
    ]) {
      expect(boxesReplySchema.safeParse({ boxes: [bad] }).success).toBe(false);
    }
  });

  it('C: The form’s request takes a box the form chose', () => {
    expect(
      createClientRequestSchema.safeParse({ code: 'acme', name: 'A', box: 'b2' }).success,
    ).toBe(true);
  });
});
