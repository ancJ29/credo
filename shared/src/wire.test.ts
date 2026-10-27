import { describe, expect, it } from 'vitest';
import {
  conflictReplySchema,
  configDocSchema,
  errorReplySchema,
  meReplySchema,
  ROUTES,
  saveConfigRequestSchema,
  sessionReplySchema,
  signInRequestSchema,
} from './wire';

const config = {
  name: 'A',
  logo: null,
  colour: '#000000',
  languages: ['vi'],
  defaultLanguage: 'vi',
};
const user = { name: 'root', root: true };

describe('the wire contract', () => {
  it('names the four routes under /api', () => {
    expect(Object.values(ROUTES).every((path) => path.startsWith('/api/'))).toBe(true);
    expect(ROUTES.config).toBe('/api/config');
  });

  it('parses what the BFF sends and refuses what it never sends', () => {
    expect(signInRequestSchema.safeParse({ name: 'root', password: 'x' }).success).toBe(true);
    expect(signInRequestSchema.safeParse({ name: '', password: 'x' }).success).toBe(false);
    expect(sessionReplySchema.safeParse({ authId: 'd.s', expiresAt: 1, user }).success).toBe(true);
    expect(meReplySchema.safeParse({ user, extra: 1 }).success).toBe(false);
    expect(configDocSchema.safeParse({ config, version: 'tag' }).success).toBe(true);
    expect(saveConfigRequestSchema.safeParse({ config, version: null }).success).toBe(true);
    expect(saveConfigRequestSchema.safeParse({ config }).success).toBe(false);
    expect(conflictReplySchema.safeParse({ error: 'Conflict', current: null }).success).toBe(true);
    expect(errorReplySchema.safeParse({ error: 'Bad request', details: 'x' }).success).toBe(true);
  });
});
