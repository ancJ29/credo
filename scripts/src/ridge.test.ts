import { verifyPassword } from '@credo/bff/password';
import { recordKeys, storedClientSchema, storedOperatorSchema } from '@credo/shared';
import { describe, expect, it } from 'vitest';
import { runRidge, type RidgeIo } from './ridge';

const KEYS = {
  C_STORAGE_URL: 'http://cs.test',
  INTERNAL_ACCESS_KEY: 'internal-key-xyz',
  SERVICE_CODE: 'bff',
  SERVICE_ACCESS_KEY: 'service-key-xyz',
};

/** c-storage over `fetch`, in memory: one service, its records, and the register route. */
function memoryCStorage(options: { registered?: boolean } = {}) {
  const records = new Map<string, unknown>();
  let registered = options.registered ?? false;
  const call: typeof fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const headers = new Headers(init?.headers);
    const reply = (status: number, body: unknown = {}) =>
      Promise.resolve(new Response(JSON.stringify(body), { status }));
    if (url.pathname === '/api/services/register') {
      if (registered) return reply(409);
      registered = true;
      return reply(201);
    }
    if (headers.get('x-access-key') !== KEYS.SERVICE_ACCESS_KEY) return reply(403);
    const base = `/api/records/${KEYS.SERVICE_CODE}`;
    if (init?.method === 'POST' && url.pathname === base) {
      const { key, data } = JSON.parse(init.body as string) as { key: string; data: unknown };
      if (headers.get('if-none-match') === '*' && records.has(key)) return reply(412);
      records.set(key, data);
      return reply(201);
    }
    const key = decodeURIComponent(url.pathname.slice(base.length + 1));
    return records.has(key)
      ? reply(200, { record: { data: records.get(key), tag: 't' } })
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

  it('makes the operator’s account, shows its first password to the terminal alone, and stores its hash', async () => {
    const { records, call } = memoryCStorage({ registered: true });

    const result = await run(['operator', 'Boss'], KEYS, call);

    expect(result.status).toBe(0);
    const password = /first password (\S+)$/.exec(result.shown[0] ?? '')?.[1] ?? '';
    expect(password).toHaveLength(16);
    expect(result.shown).toEqual([`the operator is boss, first password ${password}`]);
    expect(result.out.join('\n')).not.toContain(password);
    expect(result.out).toEqual(['operator boss made']);
    const stored = storedOperatorSchema.parse(records.get(recordKeys.operatorUser('boss')));
    expect(await verifyPassword(password, stored.passwordHash)).toBe(true);
    expect(JSON.stringify([...records.values()])).not.toContain(password);
  });

  it('names the operator "operator" when no name is given', async () => {
    const { records, call } = memoryCStorage();

    await run(['operator'], KEYS, call);

    expect([...records.keys()]).toEqual([recordKeys.operatorUser('operator')]);
  });

  it('refuses to make an operator over one that exists, and --replace gives a new password', async () => {
    const { records, call } = memoryCStorage();
    await run(['operator'], KEYS, call);
    const before = JSON.stringify(records.get(recordKeys.operatorUser('operator')));

    const refused = await run(['operator'], KEYS, call);
    expect(refused).toMatchObject({ status: 1, shown: [] });
    expect(refused.err[0]).toContain('--replace');
    expect(JSON.stringify(records.get(recordKeys.operatorUser('operator')))).toBe(before);

    const replaced = await run(['operator', '--replace'], KEYS, call);
    expect(replaced).toMatchObject({ status: 0, out: ['operator operator replaced'] });
    expect(JSON.stringify(records.get(recordKeys.operatorUser('operator')))).not.toBe(before);
  });

  it('takes a named operator after --replace, and refuses a name that is no name', async () => {
    const { records, call } = memoryCStorage();

    expect((await run(['operator', '--replace', 'second'], KEYS, call)).status).toBe(0);
    expect(records.has(recordKeys.operatorUser('second'))).toBe(true);
    expect(await run(['operator', 'no spaces'], KEYS, call)).toMatchObject({
      status: 1,
      err: ['error: that is not an operator name'],
    });
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

  it('names the variables at fault, never a value, and a command it does not know', async () => {
    const { call } = memoryCStorage();

    const missing = await run(['operator'], { ...KEYS, INTERNAL_ACCESS_KEY: '' }, call);
    expect(missing.err).toEqual(['error: invalid environment: INTERNAL_ACCESS_KEY']);
    expect(await run(['nothing'], KEYS, call)).toMatchObject({ status: 1 });
    expect(await run([], KEYS, call)).toMatchObject({ status: 1 });
  });

  it('reports a store that refuses, without the key', async () => {
    const { call } = memoryCStorage();

    const result = await run(['operator'], { ...KEYS, SERVICE_ACCESS_KEY: 'wrong' }, call);

    expect(result.status).toBe(1);
    expect(result.err.join()).not.toContain('wrong');
  });

  it('reports a store that does not answer', async () => {
    const result = await run(['operator'], KEYS, () => Promise.reject(new Error('down')));

    expect(result).toMatchObject({
      status: 1,
      err: ['error: c-storage did not answer POST a operator record'],
    });
  });
});
