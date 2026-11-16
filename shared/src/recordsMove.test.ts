import { describe, expect, it } from 'vitest';
import { ACTIONS } from './activity';
import { isMoving, storedClientSchema, storedMoveSchema } from './records';

const ID = '5f0c1a5e-2d6c-4a53-9c3b-0f3d3f1d6a10';

describe('the mark a company’s line carries while it moves', () => {
  it('reads both forms, the copying one with or without the key of the last press', () => {
    const copying = { form: 'copying', to: 'b2', markedAt: 1 };
    expect(storedMoveSchema.parse(copying)).toEqual(copying);
    expect(storedMoveSchema.parse({ ...copying, after: 'k' })).toEqual({ ...copying, after: 'k' });
    const sweeping = { form: 'sweeping', box: 'home', sweepAt: 2, closed: false };
    expect(storedMoveSchema.parse(sweeping)).toEqual(sweeping);
  });

  it('refuses a form the line has none of, a missing field and one more', () => {
    expect(storedMoveSchema.safeParse({ form: 'done' }).success).toBe(false);
    expect(storedMoveSchema.safeParse({ form: 'copying', to: 'b2' }).success).toBe(false);
    expect(
      storedMoveSchema.safeParse({
        form: 'sweeping',
        box: 'b2',
        sweepAt: 1,
        closed: true,
        to: 'b2',
      }).success,
    ).toBe(false);
  });

  it('is part of the line, optional, so a line written before it still parses', () => {
    expect(storedClientSchema.parse({ id: ID, name: 'Acme' }).move).toBeUndefined();
    const line = {
      id: ID,
      name: 'Acme',
      move: { form: 'sweeping', box: 'b2', sweepAt: 2, closed: true },
    };
    expect(storedClientSchema.parse(line)).toEqual(line);
  });

  it('is told by one predicate, in either form and by none', () => {
    expect(isMoving({})).toBe(false);
    expect(isMoving({ move: { form: 'copying', to: 'b2', markedAt: 1 } })).toBe(true);
    expect(isMoving({ move: { form: 'sweeping', box: 'b2', sweepAt: 1, closed: false } })).toBe(
      true,
    );
  });

  it('has its own entry action, in words', () => {
    expect(ACTIONS['client.move']).toBe('client moved');
  });
});
