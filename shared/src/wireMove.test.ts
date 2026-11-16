import { describe, expect, it } from 'vitest';
import {
  clientListItemSchema,
  confirmActSchema,
  moveClientReplySchema,
  moveClientRequestSchema,
  moveClientRoute,
} from './wire';

const confirm = {
  token: 't.s',
  response: {
    id: 'cred',
    rawId: 'cred',
    type: 'public-key',
    response: { clientDataJSON: 'x', authenticatorData: 'y', signature: 'z' },
    clientExtensionResults: {},
  },
};

describe('a company moved between boxes, on the wire', () => {
  it('C14: The move has its own path under the client’s and its own touch act', () => {
    expect(moveClientRoute('acme-vn')).toBe('/api/operator/clients/acme-vn/move');
    expect(confirmActSchema.safeParse('move-client').success).toBe(true);
  });

  it('C14: A press is a beginning with a box and a touch, a stop, or nothing; anything else is refused', () => {
    expect(moveClientRequestSchema.safeParse({ to: 'b2', confirm }).success).toBe(true);
    expect(moveClientRequestSchema.safeParse({ stop: true }).success).toBe(true);
    expect(moveClientRequestSchema.safeParse({}).success).toBe(true);
    for (const bad of [
      { to: 'b2' },
      { to: 'B2', confirm },
      { stop: false },
      { stop: true, to: 'b2' },
      { more: 1 },
    ]) {
      expect(moveClientRequestSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it('C14: An answer says where the move is, a wait with seconds, a copy or a sweep with what is left, or done', () => {
    for (const good of [
      { phase: 'waiting', seconds: 15 },
      { phase: 'copying', left: 0 },
      { phase: 'switched', seconds: 15 },
      { phase: 'stopped', seconds: 15 },
      { phase: 'sweeping', left: 200 },
      { phase: 'done' },
    ]) {
      expect(moveClientReplySchema.safeParse(good).success, JSON.stringify(good)).toBe(true);
    }
    for (const bad of [
      { phase: 'waiting', seconds: 0 },
      { phase: 'copying', left: -1 },
      { phase: 'sweeping' },
      { phase: 'done', left: 0 },
      { phase: 'lost' },
    ]) {
      expect(moveClientReplySchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it('C15: A list item may name its box and its mark in either form, and one written before still parses', () => {
    const item = { code: 'acme-vn', name: 'Acme', madeAt: null, link: '/login' };
    expect(clientListItemSchema.safeParse(item).success).toBe(true);
    for (const form of ['copying', 'sweeping']) {
      const parsed = clientListItemSchema.safeParse({
        ...item,
        box: 'b2',
        move: { form, box: 'home' },
      });
      expect(parsed.success, form).toBe(true);
    }
    expect(
      clientListItemSchema.safeParse({ ...item, move: { form: 'done', box: 'b2' } }).success,
    ).toBe(false);
    expect(
      clientListItemSchema.safeParse({ ...item, move: { form: 'copying', box: 'b2', key: 'k' } })
        .success,
    ).toBe(false);
  });
});
