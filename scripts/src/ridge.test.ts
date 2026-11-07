import { joinByLink } from '@credo/bff/tests/join';
import { buildApp } from '@credo/bff';
import {
  createCStorageClient,
  recordKeys,
  sha256Hex,
  storedAccountSchema,
  storedClientSchema,
  storedLinkSchema,
  storedRosterSchema,
} from '@credo/shared';
import { describe, expect, it } from 'vitest';
import { runRidge, type RidgeIo } from './ridge';

const KEYS = {
  C_STORAGE_URL: 'http://cs.test',
  INTERNAL_ACCESS_KEY: 'internal-key-xyz',
  SERVICE_CODE: 'bff',
  SERVICE_ACCESS_KEY: 'service-key-xyz',
};
const ORIGIN = 'https://app.example.test';
const WITH_ORIGIN = { ...KEYS, APP_ORIGIN: ORIGIN };

/** c-storage over `fetch`, in memory: one service, its records with a tag that changes at every
 * write, a write or removal over a tag that moved refused, and the register route. */
function memoryCStorage(options: { registered?: boolean } = {}) {
  const records = new Map<string, unknown>();
  const tags = new Map<string, string>();
  let writes = 0;
  let registered = options.registered ?? false;
  const call: typeof fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const headers = new Headers(init?.headers);
    const reply = (status: number, body: unknown = {}) =>
      Promise.resolve(new Response(status === 204 ? null : JSON.stringify(body), { status }));
    if (url.pathname === '/api/services/register') {
      if (registered) return reply(409);
      registered = true;
      return reply(201);
    }
    if (headers.get('x-access-key') !== KEYS.SERVICE_ACCESS_KEY) return reply(403);
    const base = `/api/records/${KEYS.SERVICE_CODE}`;
    const precondition = (key: string) => {
      if (headers.get('if-none-match') === '*') return !records.has(key);
      const wanted = headers.get('if-match');
      return wanted === null || tags.get(key) === wanted;
    };
    if (init?.method === 'POST' && url.pathname === base) {
      const { key, data } = JSON.parse(init.body as string) as { key: string; data: unknown };
      if (!precondition(key)) return reply(412);
      records.set(key, data);
      tags.set(key, String(++writes));
      return reply(201);
    }
    if (url.pathname === base && url.searchParams.has('prefix')) {
      const prefix = url.searchParams.get('prefix') ?? '';
      const listed = [...records.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((key) => ({ key, data: records.get(key), tag: tags.get(key) }));
      return reply(200, { records: listed, more: false });
    }
    const key = decodeURIComponent(url.pathname.slice(base.length + 1));
    if (init?.method === 'DELETE') {
      if (!precondition(key)) return reply(412);
      records.delete(key);
      tags.delete(key);
      return reply(204);
    }
    return records.has(key)
      ? reply(200, { record: { data: records.get(key), tag: tags.get(key) } })
      : reply(404);
  };
  return { records, call };
}

function run(argv: string[], env: Record<string, string | undefined>, call: typeof fetch) {
  const lines = { out: [] as string[], shown: [] as string[], err: [] as string[] };
  const io: RidgeIo = {
    out: (line) => lines.out.push(line),
    show: (line) => lines.shown.push(line),
    err: (line) => lines.err.push(line),
    fetch: call,
  };
  return runRidge(argv, env, io).then((status) => ({ status, ...lines }));
}

/** The address a fetch was given, whichever of its three shapes. */
const urlOf = (input: Parameters<typeof fetch>[0]): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

describe('what the ops scripts ask of ridge', () => {
  it('registers the BFF’s service with the super-admin key, then says it is present', async () => {
    const { call } = memoryCStorage();
    const env = { ...KEYS, X_SUPER_ADMIN_KEY: 'admin' };

    expect(await run(['register'], env, call)).toMatchObject({
      status: 0,
      out: ['service registered'],
    });
    expect(await run(['register'], env, call)).toMatchObject({
      status: 0,
      out: ['service present'],
    });
  });

  it('will not register without the super-admin key, and names the variable', async () => {
    const { call } = memoryCStorage();

    const result = await run(['register'], KEYS, call);

    expect(result).toMatchObject({
      status: 1,
      err: ['error: invalid environment: X_SUPER_ADMIN_KEY'],
    });
  });

  it('makes the operator and a join link, shows the link to the terminal alone, and stores its hash', async () => {
    const { records, call } = memoryCStorage({ registered: true });

    const result = await run(['operator', 'Boss'], WITH_ORIGIN, call);

    expect(result.status).toBe(0);
    const token = /join link https:\/\/app\.example\.test\/operator\/join#([\w-]{43})$/.exec(
      result.shown[0] ?? '',
    )?.[1];
    expect(result.shown).toEqual([
      `the operator is boss, join link ${ORIGIN}/operator/join#${token}`,
    ]);
    expect(result.out).toEqual(['operator boss made']);
    expect(result.out.join('\n')).not.toContain(token);
    const roster = storedRosterSchema.parse(records.get(recordKeys.operatorRoster));
    expect(roster.operators).toMatchObject([{ name: 'boss', state: 'invited', addedBy: null }]);
    const account = storedAccountSchema.parse(
      records.get(recordKeys.operatorAccount(roster.operators[0].id)),
    );
    expect(account.linkHash).toBe(await sha256Hex(token!));
    expect(JSON.stringify([...records.values()])).not.toContain(token);
  });

  it('names the operator "operator" when no name is given', async () => {
    const { records, call } = memoryCStorage();

    await run(['operator'], WITH_ORIGIN, call);

    expect(
      storedRosterSchema.parse(records.get(recordKeys.operatorRoster)).operators[0]?.name,
    ).toBe('operator');
  });

  it('refuses to make an operator that exists, and --replace gives a new-passkey link', async () => {
    const { records, call } = memoryCStorage();
    await run(['operator'], WITH_ORIGIN, call);
    const before = JSON.stringify([...records]);

    const refused = await run(['operator'], WITH_ORIGIN, call);
    expect(refused).toMatchObject({ status: 1, shown: [] });
    expect(refused.err[0]).toContain('--replace');
    expect(JSON.stringify([...records])).toBe(before);

    const replaced = await run(['operator', '--replace'], WITH_ORIGIN, call);
    expect(replaced).toMatchObject({ status: 0, out: ['operator operator replaced'] });
    expect(replaced.shown[0]).toMatch(/^the operator is operator, new-passkey link https:\/\/app/);
    expect(JSON.stringify([...records])).not.toBe(before);
    const token = replaced.shown[0].split('#')[1];
    expect(JSON.stringify([...records])).not.toContain(token);
    // The link replaces the passkeys held and ends their sessions, so it is no first-passkey link.
    expect(
      storedLinkSchema.parse(records.get(recordKeys.operatorLink(await sha256Hex(token)))),
    ).toMatchObject({ kind: 'replace', madeBy: null });
  });

  it('takes a named operator after --replace, and refuses one that is not there or is no name', async () => {
    const { call } = memoryCStorage();

    const none = await run(['operator', '--replace', 'second'], WITH_ORIGIN, call);
    expect(none).toMatchObject({ status: 1, shown: [] });
    expect(none.err[0]).toContain('there is no operator second');
    expect(await run(['operator', 'no spaces'], WITH_ORIGIN, call)).toMatchObject({
      status: 1,
      err: ['error: that is not an operator name'],
    });
    await run(['operator', 'second'], WITH_ORIGIN, call);
    expect((await run(['operator', '--replace', 'second'], WITH_ORIGIN, call)).status).toBe(0);
  });

  it('--replace finds the operator the way a create refuses one, trimmed and without case', async () => {
    const { records, call } = memoryCStorage();
    await run(['operator', 'kho'], WITH_ORIGIN, call);
    const roster = storedRosterSchema.parse(records.get(recordKeys.operatorRoster));
    records.set(recordKeys.operatorRoster, {
      operators: roster.operators.map((line) => ({ ...line, name: ' Kho ' })),
    });

    const result = await run(['operator', '--replace', 'kho'], WITH_ORIGIN, call);

    expect(result).toMatchObject({ status: 0, out: ['operator kho replaced'] });
    expect(result.shown[0]).toMatch(/new-passkey link/);
  });

  it('names no address it was not given, or one a passkey cannot be bound to', async () => {
    const { records, call } = memoryCStorage();

    for (const env of [KEYS, { ...KEYS, APP_ORIGIN: 'http://127.0.0.1:3181' }]) {
      expect(await run(['operator'], env, call)).toMatchObject({
        status: 1,
        err: ['error: invalid environment: APP_ORIGIN'],
        shown: [],
      });
    }
    expect(records.size).toBe(0);
  });

  it('will not give a link to an operator whose account is gone', async () => {
    const { records, call } = memoryCStorage();
    await run(['operator'], WITH_ORIGIN, call);
    const roster = storedRosterSchema.parse(records.get(recordKeys.operatorRoster));
    records.delete(recordKeys.operatorAccount(roster.operators[0].id));

    const result = await run(['operator', '--replace'], WITH_ORIGIN, call);

    expect(result).toMatchObject({ status: 1, shown: [] });
    expect(result.err[0]).toContain('has no account');
  });

  it('makes a link the BFF accepts: the operator joins by it with a passkey', async () => {
    const { call } = memoryCStorage();
    const result = await run(['operator'], WITH_ORIGIN, call);
    const token = result.shown[0].split('#')[1];
    const storage = createCStorageClient({
      baseUrl: KEYS.C_STORAGE_URL,
      internalAccessKey: KEYS.INTERNAL_ACCESS_KEY,
      serviceCode: KEYS.SERVICE_CODE,
      accessKey: KEYS.SERVICE_ACCESS_KEY,
      fetch: call,
    });
    const app = buildApp({
      storage,
      now: () => Date.now(),
      origin: ORIGIN,
      serviceKey: KEYS.SERVICE_ACCESS_KEY,
      logger: false,
    });

    const { session } = await joinByLink(app, token, ORIGIN);

    expect(session.operator.name).toBe('operator');
  });

  it('makes a client by the operator’s create and prints the root’s first password to out', async () => {
    const { records, call } = memoryCStorage();

    const result = await run(['tenant', 'check-acme', 'Check Co'], KEYS, call);

    expect(result.status).toBe(0);
    expect(result.out).toHaveLength(1);
    expect(result.shown).toEqual([]);
    expect(storedClientSchema.parse(records.get(recordKeys.client('check-acme'))).name).toBe(
      'Check Co',
    );
    expect(JSON.stringify([...records.values()])).not.toContain(result.out[0]);
  });

  it('stamps the client it makes with the time it was made, so ridge’s list is newest first', async () => {
    const { records, call } = memoryCStorage();
    const before = Date.now();

    await run(['tenant', 'check-acme', 'Check Co'], KEYS, call);

    const { madeAt } = storedClientSchema.parse(records.get(recordKeys.client('check-acme')));
    expect(madeAt).toBeGreaterThanOrEqual(before);
    expect(madeAt).toBeLessThanOrEqual(Date.now());
  });

  it('refuses a taken code, a bad code and a missing name', async () => {
    const { call } = memoryCStorage();
    await run(['tenant', 'check-acme', 'Check Co'], KEYS, call);

    expect(await run(['tenant', 'check-acme', 'Other'], KEYS, call)).toMatchObject({
      status: 1,
      err: ['error: the code check-acme names a client already'],
    });
    expect((await run(['tenant', 'Bad Code', 'x'], KEYS, call)).status).toBe(1);
    expect((await run(['tenant', 'good-code'], KEYS, call)).status).toBe(1);
  });

  const CHECK = 'check-20261107t085500z';

  it('untenant deletes the client the tenant command made, every record of it, and frees the code', async () => {
    const { records, call } = memoryCStorage();
    await run(['tenant', CHECK, 'Check Co'], KEYS, call);
    expect(records.size).toBe(3);

    const result = await run(['untenant', CHECK], KEYS, call);

    expect(result.err).toEqual([]);
    expect(result).toMatchObject({ status: 0, out: [`client ${CHECK} deleted`] });
    expect(records.size).toBe(0);
    expect((await run(['tenant', CHECK, 'Again'], KEYS, call)).status).toBe(0);
  });

  it('untenant on a check code with no client is a quiet success', async () => {
    const { call } = memoryCStorage();

    expect(await run(['untenant', CHECK], KEYS, call)).toMatchObject({
      status: 0,
      out: [`no client ${CHECK} to delete`],
    });
  });

  it('untenant refuses any code that is not the check’s own, and deletes nothing', async () => {
    const { records, call } = memoryCStorage();
    await run(['tenant', 'acme', 'A real client'], KEYS, call);

    for (const code of ['acme', 'check-acme', 'Bad Code', 'check-20261107t085500z-x']) {
      expect(await run(['untenant', code], KEYS, call)).toMatchObject({
        status: 1,
        err: ['error: untenant deletes only the deploy check’s own client, check-<date>t<time>z'],
      });
    }
    expect((await run(['untenant'], KEYS, call)).status).toBe(1);
    expect(records.size).toBe(3);
  });

  it('untenant says nothing was deleted when the client moved under it, and exits 1', async () => {
    const { records, call } = memoryCStorage();
    await run(['tenant', CHECK, 'Check Co'], KEYS, call);
    const refuseIndexRemoval: typeof fetch = (input, init) =>
      init?.method === 'DELETE' && urlOf(input).endsWith(encodeURIComponent(`client.${CHECK}`))
        ? Promise.resolve(new Response('{}', { status: 412 }))
        : call(input, init);

    expect(await run(['untenant', CHECK], KEYS, refuseIndexRemoval)).toMatchObject({
      status: 1,
      err: [`error: nothing was deleted: the client ${CHECK} changed while it was being read`],
    });
    expect(records.has(`client.${CHECK}`)).toBe(true);
  });

  it('untenant says nothing was deleted when another deletion under the code is unfinished', async () => {
    const { call } = memoryCStorage();
    await run(['tenant', CHECK, 'Check Co'], KEYS, call);
    await call(`${KEYS.C_STORAGE_URL}/api/records/${KEYS.SERVICE_CODE}`, {
      method: 'POST',
      headers: { 'x-access-key': KEYS.SERVICE_ACCESS_KEY },
      body: JSON.stringify({
        key: recordKeys.clientDeletion(CHECK),
        data: {
          id: '6f1c2b1e-3c3a-4a8e-9b1d-2f4e5a6b7c8d',
          name: 'x',
          by: '00000000-0000-0000-0000-000000000000',
          startedAt: 1,
        },
      }),
    });

    expect(await run(['untenant', CHECK], KEYS, call)).toMatchObject({
      status: 1,
      err: [
        `error: nothing was deleted: an earlier deletion under the code ${CHECK} is still unfinished`,
      ],
    });
  });

  it('untenant says how many records are left when the sweep could not remove them', async () => {
    const { call } = memoryCStorage();
    await run(['tenant', CHECK, 'Check Co'], KEYS, call);
    const refuseTenantRemoval: typeof fetch = (input, init) =>
      init?.method === 'DELETE' && decodeURIComponent(urlOf(input)).includes('/tenant.')
        ? Promise.resolve(new Response('{}', { status: 412 }))
        : call(input, init);

    expect(await run(['untenant', CHECK], KEYS, refuseTenantRemoval)).toMatchObject({
      status: 1,
      err: [`error: the client ${CHECK} is out of the list but 2 records are left`],
    });
  });

  it('row 7: seed reads the real clock when none is given, and on an empty service makes nothing', async () => {
    const { records, call } = memoryCStorage({ registered: true });

    const result = await run(['seed'], KEYS, call);

    expect(result).toMatchObject({ status: 0, shown: [], err: [] });
    expect(result.out.at(-1)).toBe(
      'seed: 6 copies mapped, 0 up to date, 6 not on this service, 0 days applied',
    );
    expect(records.size).toBe(0);
  });

  it('names the variables at fault, never a value, and a command it does not know', async () => {
    const { call } = memoryCStorage();

    const missing = await run(['operator'], { ...WITH_ORIGIN, INTERNAL_ACCESS_KEY: '' }, call);
    expect(missing.err).toEqual(['error: invalid environment: INTERNAL_ACCESS_KEY']);
    expect(await run(['nothing'], KEYS, call)).toMatchObject({ status: 1 });
    expect(await run([], KEYS, call)).toMatchObject({ status: 1 });
  });

  it('reports a store that refuses, without the key', async () => {
    const { call } = memoryCStorage();

    const result = await run(['operator'], { ...WITH_ORIGIN, SERVICE_ACCESS_KEY: 'wrong' }, call);

    expect(result.status).toBe(1);
    expect(result.err.join()).not.toContain('wrong');
  });

  it('reports a store that does not answer', async () => {
    const result = await run(['operator'], WITH_ORIGIN, () => Promise.reject(new Error('down')));

    expect(result).toMatchObject({
      status: 1,
      err: ['error: c-storage did not answer GET a operator record'],
    });
  });
});
