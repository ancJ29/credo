import { describe, expect, it } from 'vitest';
import {
  conflictReplySchema,
  configDocSchema,
  createClientReplySchema,
  createClientRequestSchema,
  errorReplySchema,
  meReplySchema,
  operatorMeReplySchema,
  operatorSessionReplySchema,
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

const TAG = 'a'.repeat(64);

describe('the wire contract', () => {
  it('names every route under /api', () => {
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

  it('takes a save’s version only as a c-storage tag or null: anything else can never match', () => {
    const save = (version: unknown) => saveConfigRequestSchema.safeParse({ config, version });
    expect(save(TAG).success).toBe(true);
    for (const version of ['v1', '', 'A'.repeat(64), `${TAG}0`, TAG.slice(1), undefined]) {
      expect(save(version).success, String(version)).toBe(false);
    }
  });

  it('takes a name and password that are well-formed text of a bounded length', () => {
    const signIn = (name: string, password: string) =>
      signInRequestSchema.safeParse({ name, password }).success;
    expect(signIn('n'.repeat(200), 'p'.repeat(1024))).toBe(true);
    expect(signIn('n'.repeat(201), 'x')).toBe(false);
    expect(signIn('x', 'p'.repeat(1025))).toBe(false);
    expect(signIn('\ud800', 'x')).toBe(false);
    expect(signIn('x', 'a\udc00b')).toBe(false);
  });

  it('parses the operator’s and the client-making shapes, and refuses extras and bad codes', () => {
    const operator = { name: 'operator' };
    expect(
      operatorSessionReplySchema.safeParse({ authId: 'd.s', expiresAt: 1, operator }).success,
    ).toBe(true);
    expect(operatorMeReplySchema.safeParse({ operator, user }).success).toBe(false);
    expect(createClientRequestSchema.safeParse({ code: 'acme', name: ' Acme ' }).data).toEqual({
      code: 'acme',
      name: 'Acme',
    });
    expect(createClientRequestSchema.safeParse({ code: 'Acme', name: 'Acme' }).success).toBe(false);
    expect(createClientRequestSchema.safeParse({ code: 'acme', name: '  ' }).success).toBe(false);
    expect(
      createClientReplySchema.safeParse({
        link: '/login?client-code=acme',
        rootName: 'root',
        password: 'p',
      }).success,
    ).toBe(true);
  });
});
