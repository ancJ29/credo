import { describe, expect, it } from 'vitest';
import {
  bffErrorSchema,
  type ClientListItem,
  clientLinkPath,
  clientListReplySchema,
  conflictReplySchema,
  configDocSchema,
  createClientReplySchema,
  createClientRequestSchema,
  errorReplySchema,
  joinLinkPath,
  joinOptionsReplySchema,
  joinOptionsRequestSchema,
  joinRequestSchema,
  joinTokenSchema,
  meReplySchema,
  newestFirst,
  operatorMeReplySchema,
  operatorSessionReplySchema,
  optionsReplySchema,
  confirmOptionsRequestSchema,
  passkeyAddRequestSchema,
  passkeyRemoveRequestSchema,
  passkeyListReplySchema,
  NO_RENEW_QUERY,
  passkeyRoutes,
  passkeySignInRequestSchema,
  employeeRoutes,
  ROUTES,
  saveConfigRequestSchema,
  servicesReplySchema,
  sessionReplySchema,
  signInRequestSchema,
  tokenOfFragment,
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

  it('names a person’s routes under the employees', () => {
    expect(employeeRoutes.one('i')).toBe('/api/employees/i');
    expect(employeeRoutes.archive('i')).toBe('/api/employees/i/archive');
    expect(employeeRoutes.password('i')).toBe('/api/employees/i/password');
    expect(employeeRoutes.code('i')).toBe('/api/employees/i/code');
    expect(employeeRoutes.photo('i')).toBe('/api/employees/i/photo');
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

describe('what a sign-in answers', () => {
  it('Sign-in and `me` answer the person’s resolved permissions; the UI’s parse defaults them to none', () => {
    const held = { name: 'lan', root: false, permissions: { 'staff.canView': true } };
    expect(
      sessionReplySchema.safeParse({ authId: 'd.s', expiresAt: 1, user: held }).data?.user,
    ).toEqual(held);
    expect(meReplySchema.safeParse({ user: held }).data?.user.permissions).toEqual({
      'staff.canView': true,
    });
    // an answer written before the field existed
    expect(
      meReplySchema.safeParse({ user: { name: 'lan', root: false } }).data?.user.permissions,
    ).toEqual({});
    expect(
      meReplySchema.safeParse({ user: { ...held, permissions: { 'staff.canFire': true } } })
        .success,
    ).toBe(false);
  });
});

describe('the operator’s list of clients', () => {
  const item = (code: string, madeAt: number | null): ClientListItem => ({
    code,
    name: code,
    madeAt,
    link: clientLinkPath(code),
  });

  it('The link’s path is built by one function, `…/login?client-code=<code>`', () => {
    expect(clientLinkPath('acme')).toBe('/login?client-code=acme');
  });

  it('The reply holds each client’s code, name as made, made-on time (or none) and link path, and nothing more', () => {
    const good = { clients: [item('acme', 5), item('old-one', null)] };
    expect(clientListReplySchema.safeParse(good).data).toEqual(good);
    expect(
      clientListReplySchema.safeParse({ clients: [{ ...item('acme', 5), id: 'x' }] }).success,
    ).toBe(false);
    expect(clientListReplySchema.safeParse({ clients: [item('A c', 5)] }).success).toBe(false);
  });

  it('The list runs newest first, and the clients with no time come after them, by code', () => {
    const shuffled = [
      item('zeta', null),
      item('beta', 10),
      item('alpha', null),
      item('gamma', 20),
      item('delta', 10),
    ];
    expect(shuffled.sort(newestFirst).map((client) => client.code)).toEqual([
      'gamma',
      'beta',
      'delta',
      'alpha',
      'zeta',
    ]);
    expect([item('b', 1), item('a', 1)].sort(newestFirst).map((c) => c.code)).toEqual(['a', 'b']);
  });
});

describe('the operator’s passkey ceremonies', () => {
  const challenge = 'Zm9v';
  const token = 'c'.repeat(43);
  const credential = {
    id: 'cred',
    rawId: 'cred',
    type: 'public-key',
    response: { clientDataJSON: 'x', attestationObject: 'y' },
    clientExtensionResults: {},
  };

  it('A join link is a 32-byte token in the address’s fragment, built by one function', () => {
    expect(joinLinkPath(token)).toBe(`/operator/join#${token}`);
    expect(joinTokenSchema.safeParse(token).success).toBe(true);
    expect(joinTokenSchema.safeParse('c'.repeat(42)).success).toBe(false);
    expect(joinTokenSchema.safeParse(`${'c'.repeat(42)}/`).success).toBe(false);
    expect(tokenOfFragment(`#${token}`)).toBe(token);
    expect(tokenOfFragment('#nope')).toBeNull();
    expect(tokenOfFragment('')).toBeNull();
  });

  it('Names the ceremonies’ routes under /api/operator, the passkey’s own by its id', () => {
    expect(ROUTES.operatorPasskeyOptions).toBe('/api/operator/passkey/options');
    expect(ROUTES.operatorPasskeySignIn).toBe('/api/operator/passkey/sign-in');
    expect(ROUTES.operatorJoinOptions).toBe('/api/operator/join/options');
    expect(ROUTES.operatorJoin).toBe('/api/operator/join');
    expect(ROUTES.operatorPasskeys).toBe('/api/operator/passkeys');
    expect(passkeyRoutes.options).toBe('/api/operator/passkeys/options');
    expect(passkeyRoutes.confirmOptions).toBe('/api/operator/passkeys/confirm-options');
    expect(passkeyRoutes.one('k')).toBe('/api/operator/passkeys/k');
    expect(NO_RENEW_QUERY).toBe('renew=0');
  });

  it('Options come with the signed challenge’s token, and the library’s options are passed on whole', () => {
    const options = { challenge, rpId: 'localhost', userVerification: 'required', timeout: 1 };
    expect(optionsReplySchema.safeParse({ options, token: 't.s' }).data).toEqual({
      options,
      token: 't.s',
    });
    expect(optionsReplySchema.safeParse({ options: {}, token: 't.s' }).success).toBe(false);
    expect(optionsReplySchema.safeParse({ options, token: '' }).success).toBe(false);
    expect(optionsReplySchema.safeParse({ options, token: 't', more: 1 }).success).toBe(false);
  });

  it('A join’s options name whose link it is and who made it, or none when that one is deleted', () => {
    const options = { challenge };
    const base = { options, token: 't.s', name: 'Ops Two' };
    expect(joinOptionsReplySchema.safeParse({ ...base, madeBy: 'Ops One' }).success).toBe(true);
    expect(joinOptionsReplySchema.safeParse({ ...base, madeBy: null }).success).toBe(true);
    expect(joinOptionsReplySchema.safeParse(base).success).toBe(false);
  });

  it('A join’s options tell a link the terminal made from one whose maker is gone, false when an older BFF says nothing', () => {
    const base = { options: { challenge }, token: 't.s', name: 'Ops Two', madeBy: null };
    expect(joinOptionsReplySchema.parse(base).madeByTerminal).toBe(false);
    expect(joinOptionsReplySchema.parse({ ...base, madeByTerminal: true }).madeByTerminal).toBe(
      true,
    );
  });

  it('A sign-in, a join and a passkey added each send a token and the device’s answer, nothing more', () => {
    const request = { token: 't.s', response: credential };
    expect(passkeySignInRequestSchema.safeParse(request).success).toBe(true);
    expect(passkeyAddRequestSchema.safeParse(request).success).toBe(false);
    expect(passkeyAddRequestSchema.safeParse({ ...request, confirm: request }).success).toBe(true);
    expect(joinRequestSchema.safeParse({ ...request, link: token }).success).toBe(true);
    expect(joinRequestSchema.safeParse(request).success).toBe(false);
    expect(joinOptionsRequestSchema.safeParse({ link: token }).success).toBe(true);
    expect(joinOptionsRequestSchema.safeParse({ link: 'short' }).success).toBe(false);
    expect(passkeySignInRequestSchema.safeParse({ ...request, name: 'x' }).success).toBe(false);
    expect(
      passkeySignInRequestSchema.safeParse({ ...request, response: { ...credential, type: 'x' } })
        .success,
    ).toBe(false);
    expect(passkeySignInRequestSchema.safeParse({ token: '', response: credential }).success).toBe(
      false,
    );
  });

  it('An add or a remove of one’s own passkeys needs a fresh touch, named for the act, and nothing more', () => {
    const confirm = { token: 't.s', response: credential };
    expect(confirmOptionsRequestSchema.safeParse({ act: 'add' }).success).toBe(true);
    expect(confirmOptionsRequestSchema.safeParse({ act: 'remove' }).success).toBe(true);
    expect(confirmOptionsRequestSchema.safeParse({ act: 'delete' }).success).toBe(false);
    expect(confirmOptionsRequestSchema.safeParse({}).success).toBe(false);
    expect(passkeyRemoveRequestSchema.safeParse({ confirm }).success).toBe(true);
    expect(passkeyRemoveRequestSchema.safeParse({}).success).toBe(false);
    expect(passkeyRemoveRequestSchema.safeParse({ confirm, more: 1 }).success).toBe(false);
  });

  it('The operator’s own passkeys are listed by when each was added and last used, none yet for a new one', () => {
    const list = {
      passkeys: [
        { id: 'a', addedAt: 1, lastUsedAt: 2 },
        { id: 'b', addedAt: 3, lastUsedAt: null },
      ],
    };
    expect(passkeyListReplySchema.safeParse(list).data).toEqual(list);
    expect(passkeyListReplySchema.safeParse({ passkeys: [{ id: 'a', addedAt: 1 }] }).success).toBe(
      false,
    );
  });

  it('The operator’s view gains its id, read as empty when an older answer has none', () => {
    expect(operatorMeReplySchema.parse({ operator: { name: 'o' } })).toEqual({
      operator: { id: '', name: 'o' },
    });
    expect(operatorMeReplySchema.parse({ operator: { id: 'i', name: 'o' } }).operator.id).toBe('i');
  });

  it('C: The services answer holds the BFF’s build and c-storage’s build with its time, and nothing else', () => {
    const reply = { build: '4e1a9c7', storage: { build: '4e1a9c7', ms: 7 } };
    expect(ROUTES.operatorServices).toBe('/api/operator/services');
    expect(servicesReplySchema.safeParse(reply).data).toEqual(reply);
    expect(servicesReplySchema.safeParse({ ...reply, build: '' }).success).toBe(false);
    expect(servicesReplySchema.safeParse({ ...reply, more: 1 }).success).toBe(false);
    expect(servicesReplySchema.safeParse({ build: 'x' }).success).toBe(false);
    expect(
      servicesReplySchema.safeParse({ ...reply, storage: { build: 'x', ms: -1 } }).success,
    ).toBe(false);
    expect(
      servicesReplySchema.safeParse({ ...reply, storage: { build: 'x', ms: 1.5 } }).success,
    ).toBe(false);
  });

  it('C: Only an answer of the BFF’s own error shape is the BFF answering', () => {
    expect(bffErrorSchema.safeParse({ error: 'Service unavailable' }).success).toBe(true);
    expect(bffErrorSchema.safeParse({ error: 'Conflict', current: null }).success).toBe(true);
    expect(bffErrorSchema.safeParse({ message: 'Service Unavailable' }).success).toBe(false);
    expect(bffErrorSchema.safeParse('<html>502</html>').success).toBe(false);
    expect(bffErrorSchema.safeParse(null).success).toBe(false);
  });
});
