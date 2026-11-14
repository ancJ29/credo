import { randomUUID } from 'node:crypto';
import {
  CStorageError,
  type CStorageClient,
  IMPORT_CALL_ROWS,
  importCustomersReplySchema,
  importProductsReplySchema,
  listImportRoute,
  PERMISSIONS,
  recordKeys,
  ROUTES,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { recordingActivity } from '../../tests/audit';
import { type RunningCStorage, startCStorage } from '../../tests/c-storage';
import { staffTenant } from '../../tests/staff';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

type Tenant = Awaited<ReturnType<typeof staffTenant>>;
type Keys = ReturnType<typeof recordKeys.tenant>;

/** The two lists, each with a row that holds, a record as stored, and where its records sit. */
const LISTS = [
  {
    name: 'customers',
    route: ROUTES.customers,
    importRoute: listImportRoute('customers'),
    reply: importCustomersReplySchema,
    prefix: (keys: Keys) => keys.customerPrefix,
    key: (keys: Keys, id: string) => keys.customer(id),
    row: (over: object = {}) => ({ code: 'KH-1', name: 'Mai Linh', extra: {}, ...over }),
    // A field of the row that is required, to leave out.
    required: ['code', 'name'],
  },
  {
    name: 'products',
    route: ROUTES.products,
    importRoute: listImportRoute('products'),
    reply: importProductsReplySchema,
    prefix: (keys: Keys) => keys.productPrefix,
    key: (keys: Keys, id: string) => keys.product(id),
    row: (over: object = {}) => ({
      code: 'SP-1',
      name: 'Xi măng',
      unit: 'bao',
      price: 95000,
      stocked: true,
      extra: {},
      ...over,
    }),
    required: ['code', 'name', 'unit', 'price', 'stocked'],
  },
] as const;
type List = (typeof LISTS)[number];

/** A record as the store keeps it, written straight to c-storage. */
const stored = (list: List, over: object = {}) => ({ id: randomUUID(), ...list.row(), ...over });

async function hold(t: Tenant, list: List, over: object = {}) {
  const record = stored(list, over);
  await t.client.putRecord(list.key(t.keys, record.id), record);
  return record;
}

/** The root's import of rows; an answer that is not a 200 fails on its status. */
async function imported(t: Tenant, list: List, rows: unknown[]) {
  const reply = await t.rootCall.send('POST', list.importRoute, { rows });
  expect(reply.statusCode).toBe(200);
  return list.reply.parse(reply.json()).results;
}

const outcome = (result: { kind: string; reason?: string }) =>
  result.kind === 'added' ? 'added' : result.reason;

/** The codes the list shows the root, in the order shown. */
async function codesOf(t: Tenant, list: List) {
  const reply = await t.rootCall.get(list.route);
  expect(reply.statusCode).toBe(200);
  const body = reply.json<Record<string, { code: string }[]>>();
  return body[list.name].map((one) => one.code);
}

describe.each(LISTS)(
  'The $name: whoever may see orders reads the list, only the root imports into it',
  (list) => {
    it('refuses a person who holds every permission but the sight of orders, 403, on the list, and the person who has it, 403, on the import, and one not signed in, 401, on both, and adds nothing', async () => {
      const t = await staffTenant(cs);
      const blind = await t.staff('BLIND', {
        own: Object.fromEntries(PERMISSIONS.map((id) => [id, id !== 'orders.canView'])),
      });
      const sighted = await t.staff('SIGHTED', { own: { 'orders.canView': true } });

      const read = await blind.call.get(list.route);
      const seen = await sighted.call.get(list.route);
      const send = await sighted.call.send('POST', list.importRoute, { rows: [list.row()] });
      const unsignedRead = await t.app.inject({
        method: 'GET',
        url: list.route,
        headers: { 'x-client': 'acme-co' },
      });
      const unsignedSend = await t.app.inject({
        method: 'POST',
        url: list.importRoute,
        payload: { rows: [list.row()] },
        headers: { 'x-client': 'acme-co' },
      });

      expect([read.statusCode, seen.statusCode, send.statusCode]).toEqual([403, 200, 403]);
      expect([unsignedRead.statusCode, unsignedSend.statusCode]).toEqual([401, 401]);
      expect(await codesOf(t, list)).toEqual([]);
    });
  },
);

describe.each(LISTS)('The $name list is the company’s own, in code order, never short', (list) => {
  it('lists every record of the company in code order, and none of another company’s', async () => {
    const t = await staffTenant(cs);
    const other = await staffTenant(cs);
    // Ids whose key order is the reverse of the code order: c-storage lists by key, so only the
    // route's own sort can put the codes right.
    await hold(t, list, {
      id: '00000000-0000-4000-8000-000000000000',
      code: 'B-2',
      name: 'Second',
    });
    await hold(t, list, { id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', code: 'A-1', name: 'First' });
    await hold(other, list, { code: 'C-3' });

    expect(await codesOf(t, list)).toEqual(['A-1', 'B-2']);
  });

  it('lists a company of 2,500 whole, read in three pages, in code order', async () => {
    const t = await staffTenant(cs);
    const pages: (string | undefined)[] = [];
    const read = await staffTenant(cs, {
      wrap: (client): CStorageClient => ({
        ...client,
        async listRecords(prefix, after) {
          pages.push(after);
          return await client.listRecords(prefix, after);
        },
      }),
    });
    const codes = Array.from({ length: 2500 }, (_, i) => `KH-${String(i).padStart(4, '0')}`);
    // Random ids, so the key order is not the code order the route must answer in.
    for (let at = 0; at < codes.length; at += 50) {
      await Promise.all(
        codes.slice(at, at + 50).map((code) => hold(read, list, { code, name: code })),
      );
    }
    await hold(t, list, { code: 'ZZ-OTHER' });

    expect(await codesOf(read, list)).toEqual(codes);
    expect(pages).toHaveLength(3);
    expect(pages[0]).toBeUndefined();
  }, 60_000);

  it('answers 500 when c-storage says there are more records, and when a record does not parse, naming the kind and never the key', async () => {
    let more = false;
    const t = await staffTenant(cs, {
      wrap: (client): CStorageClient => ({
        ...client,
        async listRecords(prefix) {
          const listed = await client.listRecords(prefix);
          return more ? { ...listed, more: true } : listed;
        },
      }),
    });
    await hold(t, list, { code: 'A-1' });
    more = true;
    const short = await t.rootCall.get(list.route);
    more = false;
    const bad = randomUUID();
    await t.client.putRecord(list.key(t.keys, bad), { id: bad, nothing: 'useful' });
    const broken = await t.rootCall.get(list.route);

    expect(short.statusCode).toBe(500);
    expect(broken.statusCode).toBe(500);
    expect(short.body + broken.body).not.toContain(bad);
  });
});

describe.each(LISTS)('The rows of a $name import that hold are added', (list) => {
  it('adds each row as one record under a minted id, written once, in the order sent, and the list then shows them', async () => {
    const t = await staffTenant(cs);

    const results = await imported(t, list, [
      list.row({ code: 'kh-2', name: 'Two' }),
      list.row({ code: 'KH-1', name: 'One' }),
    ]);

    expect(results.map(outcome)).toEqual(['added', 'added']);
    const [two, one] = results.map((result) =>
      result.kind === 'added' ? result.record : (undefined as never),
    );
    expect(two).toMatchObject({ code: 'KH-2', name: 'Two' });
    expect(one).toMatchObject({ code: 'KH-1', name: 'One' });
    expect(two.id).not.toBe(one.id);
    const kept = await t.client.getRecord(list.key(t.keys, two.id));
    expect(kept?.data).toEqual(two);
    expect((await t.client.listRecords(list.prefix(t.keys))).records).toHaveLength(2);
    expect(await codesOf(t, list)).toEqual(['KH-1', 'KH-2']);
  });

  it('keeps extra as typed, and takes an empty one', async () => {
    const t = await staffTenant(cs);

    const results = await imported(t, list, [
      list.row({ code: 'A-1', extra: { phone: '0901 234 567', note: 'Gate 2' } }),
      list.row({ code: 'A-2', extra: {} }),
    ]);

    expect(results.map(outcome)).toEqual(['added', 'added']);
    expect(results[0]).toMatchObject({
      record: { extra: { phone: '0901 234 567', note: 'Gate 2' } },
    });
    expect(results[1]).toMatchObject({ record: { extra: {} } });
  });

  it('takes a whole call of 100 rows, and answers 400 to a call with none, with more, or with a key it does not know', async () => {
    const t = await staffTenant(cs);
    const send = (payload: unknown) => t.rootCall.send('POST', list.importRoute, payload);

    const full = await imported(
      t,
      list,
      Array.from({ length: IMPORT_CALL_ROWS }, (_, at) => list.row({ code: `X-${at}` })),
    );
    const many = Array.from({ length: IMPORT_CALL_ROWS + 1 }, (_, at) =>
      list.row({ code: `Y-${at}` }),
    );
    const answers = await Promise.all([
      send({ rows: [] }),
      send({ rows: many }),
      send({ rows: [list.row()], extra: 1 }),
      send({}),
    ]);

    expect(full).toHaveLength(IMPORT_CALL_ROWS);
    expect(answers.map((answer) => answer.statusCode)).toEqual([400, 400, 400, 400]);
    expect(await codesOf(t, list)).toHaveLength(IMPORT_CALL_ROWS);
  });
});

describe.each(LISTS)('A $name row that lacks what the list needs is refused', (list) => {
  it.each(list.required)(
    'refuses a row without its %s, writes nothing for it, and adds the rest',
    async (field) => {
      const t = await staffTenant(cs);
      const without = { ...list.row({ code: 'A-1' }) } as Record<string, unknown>;
      delete without[field];

      const results = await imported(t, list, [
        without,
        list.row({ code: 'A-2' }),
        'not an object',
      ]);

      expect(results.map(outcome)).toEqual(['invalid', 'added', 'invalid']);
      expect(await codesOf(t, list)).toEqual(['A-2']);
    },
  );

  it('refuses a name that is empty, a key the row does not know, and an extra that is no object', async () => {
    const t = await staffTenant(cs);

    const results = await imported(t, list, [
      list.row({ code: 'A-1', name: '   ' }),
      list.row({ code: 'A-2', password: 'x' }),
      list.row({ code: 'A-3', extra: [1] }),
    ]);

    expect(results.map(outcome)).toEqual(['invalid', 'invalid', 'invalid']);
    expect(await codesOf(t, list)).toEqual([]);
  });
});

describe.each(LISTS)(
  'A $name code is 2 to 20 letters, digits and hyphens, in capitals, unique in the list',
  (list) => {
    it('reads a code in capitals, and refuses one that is too short, too long or holds a space or a dot', async () => {
      const t = await staffTenant(cs);

      const results = await imported(t, list, [
        list.row({ code: ' kh-9 ' }),
        list.row({ code: 'A' }),
        list.row({ code: 'A'.repeat(21) }),
        list.row({ code: 'has space' }),
        list.row({ code: 'a.b' }),
      ]);

      expect(results.map(outcome)).toEqual(['added', 'invalid', 'invalid', 'invalid', 'invalid']);
      expect(await codesOf(t, list)).toEqual(['KH-9']);
    });

    it('refuses a code already in the list, in any case, and one twice in the file, and the one there stays as it was', async () => {
      const t = await staffTenant(cs);
      await hold(t, list, { code: 'HELD-1', name: 'Held' });

      const results = await imported(t, list, [
        list.row({ code: 'held-1', name: 'Again' }),
        list.row({ code: 'NEW-1', name: 'First' }),
        list.row({ code: 'new-1', name: 'Second' }),
        list.row({ code: 'NEW-2' }),
      ]);

      expect(results.map(outcome)).toEqual(['taken', 'added', 'taken', 'added']);
      const kept = (await t.rootCall.get(list.route)).json<
        Record<string, { code: string; name: string }[]>
      >()[list.name];
      expect(kept.find((one) => one.code === 'HELD-1')?.name).toBe('Held');
      expect(kept.find((one) => one.code === 'NEW-1')?.name).toBe('First');
      expect(kept.map((one) => one.code)).toEqual(['HELD-1', 'NEW-1', 'NEW-2']);
    });

    it('reads the list once for a call, and each code written joins it', async () => {
      let listings = 0;
      const t = await staffTenant(cs, {
        wrap: (client): CStorageClient => ({
          ...client,
          async listRecords(prefix) {
            if (prefix === list.prefix(t.keys)) listings++;
            return await client.listRecords(prefix);
          },
        }),
      });

      const results = await imported(t, list, [
        list.row({ code: 'A-1' }),
        list.row({ code: 'A-2' }),
        list.row({ code: 'A-1' }),
      ]);

      expect(listings).toBe(1);
      expect(results.map(outcome)).toEqual(['added', 'added', 'taken']);
    });

    it('sends the same file again and has every row refused as already in the list', async () => {
      const t = await staffTenant(cs);
      const file = [list.row({ code: 'A-1' }), list.row({ code: 'A-2' })];
      await imported(t, list, file);

      const again = await imported(t, list, file);

      expect(again.map(outcome)).toEqual(['taken', 'taken']);
      expect(await codesOf(t, list)).toEqual(['A-1', 'A-2']);
    });
  },
);

describe('A product says whether its stock is kept, and a price is a whole number of đồng', () => {
  const [, products] = LISTS;

  it('keeps stocked true and false as sent, and lists them as kept', async () => {
    const t = await staffTenant(cs);

    const results = await imported(t, products, [
      products.row({ code: 'A-1', stocked: true }),
      products.row({ code: 'A-2', stocked: false }),
    ]);

    expect(results.map(outcome)).toEqual(['added', 'added']);
    const kept = (await t.rootCall.get(ROUTES.products)).json<{
      products: { code: string; stocked: boolean }[];
    }>().products;
    expect(kept.map((one) => [one.code, one.stocked])).toEqual([
      ['A-1', true],
      ['A-2', false],
    ]);
  });

  it('refuses a stocked that is no yes or no', async () => {
    const t = await staffTenant(cs);

    const results = await imported(t, products, [
      products.row({ code: 'A-1', stocked: 'Có' }),
      products.row({ code: 'A-2', stocked: 1 }),
      products.row({ code: 'A-3', stocked: null }),
    ]);

    expect(results.map(outcome)).toEqual(['invalid', 'invalid', 'invalid']);
  });

  it('refuses a price that is not a whole number above zero, or above 10¹², and adds the one that is', async () => {
    const t = await staffTenant(cs);

    const results = await imported(t, products, [
      products.row({ code: 'A-1', price: 0 }),
      products.row({ code: 'A-2', price: -5 }),
      products.row({ code: 'A-3', price: 95000.5 }),
      products.row({ code: 'A-4', price: '95000' }),
      products.row({ code: 'A-5', price: 10 ** 12 + 1 }),
      products.row({ code: 'A-6', price: 10 ** 12 }),
    ]);

    expect(results.map(outcome)).toEqual([
      'invalid',
      'invalid',
      'invalid',
      'invalid',
      'invalid',
      'added',
    ]);
  });
});

describe.each(LISTS)(
  'A $name row that fails other than by a refusal is its own result, and the call goes on',
  (list) => {
    it('answers a row the store fails on as busy, and adds the rows before and after it', async () => {
      let failOn: string | null = null;
      const t = await staffTenant(cs, {
        wrap: (client): CStorageClient => ({
          ...client,
          async putRecord(key, data, ifTag) {
            if (failOn && (data as { code?: string }).code === failOn) {
              throw new CStorageError(503, 'down');
            }
            return await client.putRecord(key, data, ifTag);
          },
        }),
      });
      failOn = 'A-2';

      const results = await imported(t, list, [
        list.row({ code: 'A-1' }),
        list.row({ code: 'A-2' }),
        list.row({ code: 'A-3' }),
      ]);
      failOn = null;

      expect(results.map(outcome)).toEqual(['added', 'busy', 'added']);
      expect(await codesOf(t, list)).toEqual(['A-1', 'A-3']);
      const again = await imported(t, list, [list.row({ code: 'A-2' })]);
      expect(again.map(outcome)).toEqual(['added']);
    });

    it('answers a row as added, once, when the store wrote the record and its answer was lost', async () => {
      let lose = false;
      const t = await staffTenant(cs, {
        wrap: (client): CStorageClient => ({
          ...client,
          async putRecord(key, data, ifTag) {
            const saved = await client.putRecord(key, data, ifTag);
            if (lose && key.startsWith(list.prefix(t.keys))) {
              throw new CStorageError(null, 'c-storage did not answer a put');
            }
            return saved;
          },
        }),
      });
      lose = true;

      const results = await imported(t, list, [
        list.row({ code: 'A-1' }),
        list.row({ code: 'A-2' }),
      ]);
      lose = false;

      expect(results.map(outcome)).toEqual(['added', 'added']);
      expect(await codesOf(t, list)).toEqual(['A-1', 'A-2']);
    });

    it('answers a row as busy when the write failed and the store stays down for the read after it', async () => {
      let down = false;
      const t = await staffTenant(cs, {
        wrap: (client): CStorageClient => ({
          ...client,
          async getRecord(key) {
            if (down && key.startsWith(list.prefix(t.keys))) throw new CStorageError(503, 'down');
            return await client.getRecord(key);
          },
          async putRecord(key, data, ifTag) {
            if (down && key.startsWith(list.prefix(t.keys))) throw new CStorageError(503, 'down');
            return await client.putRecord(key, data, ifTag);
          },
        }),
      });
      down = true;

      const results = await imported(t, list, [list.row({ code: 'A-1' })]);
      down = false;

      expect(results.map(outcome)).toEqual(['busy']);
      expect(await codesOf(t, list)).toEqual([]);
    });

    it('answers a row as busy when the store says a record already sat under its fresh id', async () => {
      const t = await staffTenant(cs, {
        wrap: (client): CStorageClient => ({
          ...client,
          async putRecord(key, data, ifTag) {
            if ((data as { code?: string }).code === 'A-1') return 'moved';
            return await client.putRecord(key, data, ifTag);
          },
        }),
      });

      const results = await imported(t, list, [
        list.row({ code: 'A-1' }),
        list.row({ code: 'A-2' }),
      ]);

      expect(results.map(outcome)).toEqual(['busy', 'added']);
    });

    it('answers a row as busy when the write landed and the read after it failed, and a later row with the same code is taken, not written twice', async () => {
      let armed = false;
      let down = false;
      const t = await staffTenant(cs, {
        wrap: (client): CStorageClient => ({
          ...client,
          async getRecord(key) {
            if (down && key.startsWith(list.prefix(t.keys))) throw new CStorageError(503, 'down');
            return await client.getRecord(key);
          },
          async putRecord(key, data, ifTag) {
            const saved = await client.putRecord(key, data, ifTag);
            if (armed && key.startsWith(list.prefix(t.keys))) {
              down = true;
              throw new CStorageError(null, 'c-storage did not answer a put');
            }
            return saved;
          },
        }),
      });

      armed = true;
      const results = await imported(t, list, [
        list.row({ code: 'A-1' }),
        list.row({ code: 'A-1' }),
      ]);
      down = false;

      expect(results.map(outcome)).toEqual(['busy', 'taken']);
      expect(await codesOf(t, list)).toEqual(['A-1']);
    });

    it('ends the call as a 500, with the rows before it kept, on a failure that is no outage and no refusal', async () => {
      const t = await staffTenant(cs, {
        wrap: (client): CStorageClient => ({
          ...client,
          async putRecord(key, data, ifTag) {
            if ((data as { code?: string }).code === 'A-2') throw new Error('a bug, no outage');
            return await client.putRecord(key, data, ifTag);
          },
        }),
      });

      const reply = await t.rootCall.send('POST', list.importRoute, {
        rows: [list.row({ code: 'A-1' }), list.row({ code: 'A-2' }), list.row({ code: 'A-3' })],
      });

      expect(reply.statusCode).toBe(500);
      expect(await codesOf(t, list)).toEqual(['A-1']);
    });

    it('enters the rows stored before a fault ends the call, one entry each, though the call is a 500', async () => {
      const recorded = recordingActivity();
      const { entries } = recorded;
      const t = await staffTenant(cs, {
        activity: recorded.client,
        wrap: (client): CStorageClient => ({
          ...client,
          async putRecord(key, data, ifTag) {
            if ((data as { code?: string }).code === 'A-2') throw new Error('a bug, no outage');
            return await client.putRecord(key, data, ifTag);
          },
        }),
      });

      const reply = await t.rootCall.send('POST', list.importRoute, {
        rows: [list.row({ code: 'A-1' }), list.row({ code: 'A-2' }), list.row({ code: 'A-3' })],
      });

      expect(reply.statusCode).toBe(500);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.action).toMatch(/\.import$/);
      expect(entries[0]).toMatchObject({ memo: { outcome: 'saved' } });
    });

    it('keeps the call’s own refused entry when the fault comes before any row is stored', async () => {
      const recorded = recordingActivity();
      const { entries } = recorded;
      const t = await staffTenant(cs, {
        activity: recorded.client,
        wrap: (client): CStorageClient => ({
          ...client,
          async putRecord(key, data, ifTag) {
            if ((data as { code?: string }).code === 'A-1') throw new Error('a bug, no outage');
            return await client.putRecord(key, data, ifTag);
          },
        }),
      });

      const reply = await t.rootCall.send('POST', list.importRoute, {
        rows: [list.row({ code: 'A-1' })],
      });

      expect(reply.statusCode).toBe(500);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ memo: { outcome: 'refused' } });
    });
  },
);

describe('A customer is read and saved on its own route, over the version it was read at', () => {
  const asked = (version: string, over: object = {}) => ({
    version,
    name: 'Mai Linh Mới',
    extra: { phone: '0901', note: 'Gọi trước' },
    ...over,
  });
  const customerKey = (t: Tenant, id: string) => t.keys.customer(id);
  const storedNow = async (t: Tenant, id: string) =>
    (await t.client.getRecord(customerKey(t, id)))?.data;
  type Doc = {
    customer: { id: string; code: string; name: string; extra: object };
    version: string;
  };
  const read = async (call: Tenant['rootCall'], id: string) =>
    (await call.get(`${ROUTES.customers}/${id}`)).json<Doc>();
  const route = (id: string) => `${ROUTES.customers}/${id}`;
  const SEEDED = { code: 'KH-1', name: 'Mai Linh', extra: { phone: '0900', zalo: 'kept' } };

  it('reads one customer with its version, and answers 404 to an id that is no id and to one the company lacks', async () => {
    const t = await staffTenant(cs);
    const held = await hold(t, LISTS[0], SEEDED);

    const doc = await read(t.rootCall, held.id);

    expect(doc.customer).toEqual(held);
    expect(doc.version).toMatch(/^[0-9a-f]{64}$/);
    expect((await t.rootCall.get(route('nope'))).statusCode).toBe(404);
    expect((await t.rootCall.get(route(randomUUID()))).statusCode).toBe(404);
    expect((await t.rootCall.send('PUT', route(randomUUID()), asked(doc.version))).statusCode).toBe(
      404,
    );
  });

  it('row 1: stores the name, phone, address and note over the version read, and answers the record with its new version', async () => {
    const t = await staffTenant(cs);
    const held = await hold(t, LISTS[0], SEEDED);
    const before = await read(t.rootCall, held.id);
    const extra = { phone: '0901', address: '1 Lê Lợi', note: 'Gọi trước', zalo: 'kept' };

    const reply = await t.rootCall.send('PUT', route(held.id), asked(before.version, { extra }));

    expect(reply.statusCode).toBe(200);
    const doc = reply.json<Doc>();
    expect(doc.customer).toEqual({ ...held, name: 'Mai Linh Mới', extra });
    expect(doc.version).not.toBe(before.version);
    expect(await read(t.rootCall, held.id)).toEqual(doc);
    expect(await storedNow(t, held.id)).toEqual({ ...held, name: 'Mai Linh Mới', extra });
  });

  it('row 2: a version that moved writes nothing and answers 409 with the customer as it is now', async () => {
    const t = await staffTenant(cs);
    const held = await hold(t, LISTS[0], SEEDED);
    const before = await read(t.rootCall, held.id);
    const theirs = { ...held, name: 'Someone else', extra: {} };
    await t.client.putRecord(customerKey(t, held.id), theirs);

    const reply = await t.rootCall.send('PUT', route(held.id), asked(before.version));

    expect(reply.statusCode).toBe(409);
    const current = reply.json<{ current: Doc }>().current;
    expect(current.customer).toEqual(theirs);
    expect(current.version).not.toBe(before.version);
    expect(await storedNow(t, held.id)).toEqual(theirs);
  });

  describe('row 3: a write that landed counts as saved, not as a conflict', () => {
    /** A put on a customer that is forced: the real write lands, then the call goes wrong the way
     * `lose` says. `reached` counts the times the forced line ran, so a test that never gets there
     * fails on that count and not on luck. */
    const forced = (lose: 'answer lost' | 'retried over its own tag', readsFail = false) => {
      const state = { reached: 0, down: false, armed: false };
      const wrap = (client: CStorageClient, keys: () => Keys): CStorageClient => ({
        ...client,
        async getRecord(key) {
          if (state.down && key.startsWith(keys().customerPrefix)) {
            throw new CStorageError(503, 'down');
          }
          return await client.getRecord(key);
        },
        async putRecord(key, data, ifTag) {
          const saved = await client.putRecord(key, data, ifTag);
          if (!state.armed || !key.startsWith(keys().customerPrefix) || !ifTag) return saved;
          state.reached++;
          if (lose === 'retried over its own tag') return 'moved';
          state.down = readsFail;
          throw new CStorageError(null, 'c-storage did not answer a put');
        },
      });
      return { state, wrap };
    };

    it('when the retried write finds the tag moved by our own landed write', async () => {
      const { state, wrap } = forced('retried over its own tag');
      const t = await staffTenant(cs, { wrap: (client) => wrap(client, () => t.keys) });
      const held = await hold(t, LISTS[0], SEEDED);
      const before = await read(t.rootCall, held.id);
      state.armed = true;

      const reply = await t.rootCall.send('PUT', route(held.id), asked(before.version));

      expect(state.reached).toBe(1);
      expect(reply.statusCode).toBe(200);
      expect(reply.json<Doc>().customer.name).toBe('Mai Linh Mới');
      expect(reply.json<Doc>().version).not.toBe(before.version);
    });

    it('when the answer was lost and the record holds what was asked', async () => {
      const { state, wrap } = forced('answer lost');
      const t = await staffTenant(cs, { wrap: (client) => wrap(client, () => t.keys) });
      const held = await hold(t, LISTS[0], SEEDED);
      const before = await read(t.rootCall, held.id);
      state.armed = true;

      const reply = await t.rootCall.send('PUT', route(held.id), asked(before.version));

      expect(state.reached).toBe(1);
      expect(reply.statusCode).toBe(200);
      expect(reply.json<Doc>().customer.name).toBe('Mai Linh Mới');
    });

    it('but the failure stands when the answer was lost and the read after it fails too', async () => {
      const { state, wrap } = forced('answer lost', true);
      const t = await staffTenant(cs, { wrap: (client) => wrap(client, () => t.keys) });
      const held = await hold(t, LISTS[0], SEEDED);
      const before = await read(t.rootCall, held.id);
      state.armed = true;

      const reply = await t.rootCall.send('PUT', route(held.id), asked(before.version));
      state.down = false;

      expect(state.reached).toBe(1);
      expect(reply.statusCode).toBe(503);
    });

    it('but the failure stands when the answer was lost and the record is not what was asked', async () => {
      let armed = false;
      const t = await staffTenant(cs, {
        wrap: (client): CStorageClient => ({
          ...client,
          async putRecord(key, data, ifTag) {
            if (armed && ifTag) throw new CStorageError(null, 'c-storage did not answer a put');
            return await client.putRecord(key, data, ifTag);
          },
        }),
      });
      const held = await hold(t, LISTS[0], SEEDED);
      const before = await read(t.rootCall, held.id);
      armed = true;

      const reply = await t.rootCall.send('PUT', route(held.id), asked(before.version));

      expect(reply.statusCode).toBe(503);
      expect(await storedNow(t, held.id)).toEqual(held);
    });
  });

  it('row 4: whoever may see orders but not edit them cannot save: 403, and nothing written; whoever may not see them cannot read', async () => {
    const t = await staffTenant(cs);
    const held = await hold(t, LISTS[0], SEEDED);
    const version = (await read(t.rootCall, held.id)).version;
    const reader = await t.staff('READER', { own: { 'orders.canView': true } });
    const editor = await t.staff('EDITOR', { own: { 'orders.canEdit': true } });

    const refused = await reader.call.send('PUT', route(held.id), asked(version));

    expect(refused.statusCode).toBe(403);
    expect(await storedNow(t, held.id)).toEqual(held);
    expect((await reader.call.get(route(held.id))).statusCode).toBe(200);
    expect((await editor.call.get(route(held.id))).statusCode).toBe(403);
    expect((await editor.call.send('PUT', route(held.id), asked(version))).statusCode).toBe(200);
  });

  it('row 5: a save carrying a code, an id or an unknown field, or lacking its name or version, is refused and writes nothing', async () => {
    const t = await staffTenant(cs);
    const held = await hold(t, LISTS[0], SEEDED);
    const version = (await read(t.rootCall, held.id)).version;
    const bad = [
      asked(version, { code: 'KH-2' }),
      asked(version, { id: randomUUID() }),
      asked(version, { phone: '0901' }),
      asked(version, { name: '' }),
      asked(version, { name: 'x'.repeat(201) }),
      asked(version, { extra: 'text' }),
      asked(version, { version: 'not a tag' }),
      { name: 'Mai Linh', extra: {} },
    ];

    for (const body of bad) {
      const reply = await t.rootCall.send('PUT', route(held.id), body);
      expect(reply.statusCode, JSON.stringify(body)).toBe(400);
    }

    expect(await storedNow(t, held.id)).toEqual(held);
  });

  it('answers 500 for a stored customer that does not parse, naming the kind and not the key', async () => {
    const t = await staffTenant(cs);
    const id = randomUUID();
    await t.client.putRecord(customerKey(t, id), { id, nonsense: true });

    const reply = await t.rootCall.get(route(id));

    expect(reply.statusCode).toBe(500);
    expect(reply.body).not.toContain(id);
  });
});

describe('A product is read and saved on its own route, over the version it was read at', () => {
  const asked = (version: string, over: object = {}) => ({
    version,
    name: 'Xi măng PCB40',
    unit: 'tấn',
    price: 1850000,
    stocked: false,
    extra: { note: 'Giao tận nơi' },
    ...over,
  });
  const route = (id: string) => `${ROUTES.products}/${id}`;
  const storedNow = async (t: Tenant, id: string) =>
    (await t.client.getRecord(t.keys.product(id)))?.data;
  type Doc = {
    product: { id: string; code: string; name: string; unit: string; price: number };
    version: string;
  };
  const read = async (call: Tenant['rootCall'], id: string) =>
    (await call.get(route(id))).json<Doc>();
  const SEEDED = { extra: { note: 'Cũ', zalo: 'kept' } };

  it('reads one product with its version, and answers 404 to an id that is no id and to one the company lacks', async () => {
    const t = await staffTenant(cs);
    const held = await hold(t, LISTS[1], SEEDED);

    const doc = await read(t.rootCall, held.id);

    expect(doc.product).toEqual(held);
    expect(doc.version).toMatch(/^[0-9a-f]{64}$/);
    expect((await t.rootCall.get(route('nope'))).statusCode).toBe(404);
    expect((await t.rootCall.get(route(randomUUID()))).statusCode).toBe(404);
    expect((await t.rootCall.send('PUT', route(randomUUID()), asked(doc.version))).statusCode).toBe(
      404,
    );
  });

  it('row 1: stores the name, unit, price, stock and note over the version read, and answers the record with its new version', async () => {
    const t = await staffTenant(cs);
    const held = await hold(t, LISTS[1], SEEDED);
    const before = await read(t.rootCall, held.id);
    const extra = { note: 'Giao tận nơi', zalo: 'kept' };
    const next = { name: 'Xi măng PCB40', unit: 'tấn', price: 1850000, stocked: false, extra };

    const reply = await t.rootCall.send('PUT', route(held.id), asked(before.version, next));

    expect(reply.statusCode).toBe(200);
    const doc = reply.json<Doc>();
    expect(doc.product).toEqual({ ...held, ...next });
    expect(doc.version).not.toBe(before.version);
    expect(await read(t.rootCall, held.id)).toEqual(doc);
    expect(await storedNow(t, held.id)).toEqual({ ...held, ...next });
  });

  it('row 2: a version that moved writes nothing and answers 409 with the product as it is now', async () => {
    const t = await staffTenant(cs);
    const held = await hold(t, LISTS[1], SEEDED);
    const before = await read(t.rootCall, held.id);
    const theirs = { ...held, price: 77000, extra: {} };
    await t.client.putRecord(t.keys.product(held.id), theirs);

    const reply = await t.rootCall.send('PUT', route(held.id), asked(before.version));

    expect(reply.statusCode).toBe(409);
    const current = reply.json<{ current: Doc }>().current;
    expect(current.product).toEqual(theirs);
    expect(current.version).not.toBe(before.version);
    expect(await storedNow(t, held.id)).toEqual(theirs);
  });

  describe('row 3: a write that landed counts as saved, not as a conflict', () => {
    /** The real write lands, then the call goes wrong the way `lose` says; `reached` counts the
     * times the forced line ran, so a test that never gets there fails on that. */
    const forced = (lose: 'answer lost' | 'retried over its own tag', readsFail = false) => {
      const state = { reached: 0, down: false, armed: false };
      const wrap = (client: CStorageClient, keys: () => Keys): CStorageClient => ({
        ...client,
        async getRecord(key) {
          if (state.down && key.startsWith(keys().productPrefix)) {
            throw new CStorageError(503, 'down');
          }
          return await client.getRecord(key);
        },
        async putRecord(key, data, ifTag) {
          const saved = await client.putRecord(key, data, ifTag);
          if (!state.armed || !key.startsWith(keys().productPrefix) || !ifTag) return saved;
          state.reached++;
          if (lose === 'retried over its own tag') return 'moved';
          state.down = readsFail;
          throw new CStorageError(null, 'c-storage did not answer a put');
        },
      });
      return { state, wrap };
    };

    it.each(['retried over its own tag', 'answer lost'] as const)(
      'when the write landed and the failure was %s',
      async (lose) => {
        const { state, wrap } = forced(lose);
        const t = await staffTenant(cs, { wrap: (client) => wrap(client, () => t.keys) });
        const held = await hold(t, LISTS[1], SEEDED);
        const before = await read(t.rootCall, held.id);
        state.armed = true;

        const reply = await t.rootCall.send('PUT', route(held.id), asked(before.version));

        expect(state.reached).toBe(1);
        expect(reply.statusCode).toBe(200);
        expect(reply.json<Doc>().product.price).toBe(1850000);
        expect(reply.json<Doc>().version).not.toBe(before.version);
      },
    );

    it('but the failure stands when the answer was lost and the read after it fails too', async () => {
      const { state, wrap } = forced('answer lost', true);
      const t = await staffTenant(cs, { wrap: (client) => wrap(client, () => t.keys) });
      const held = await hold(t, LISTS[1], SEEDED);
      const before = await read(t.rootCall, held.id);
      state.armed = true;

      const reply = await t.rootCall.send('PUT', route(held.id), asked(before.version));
      state.down = false;

      expect(state.reached).toBe(1);
      expect(reply.statusCode).toBe(503);
    });

    it('but the failure stands when the answer was lost and the record is not what was asked', async () => {
      let armed = false;
      const t = await staffTenant(cs, {
        wrap: (client): CStorageClient => ({
          ...client,
          async putRecord(key, data, ifTag) {
            if (armed && ifTag) throw new CStorageError(null, 'c-storage did not answer a put');
            return await client.putRecord(key, data, ifTag);
          },
        }),
      });
      const held = await hold(t, LISTS[1], SEEDED);
      const before = await read(t.rootCall, held.id);
      armed = true;

      const reply = await t.rootCall.send('PUT', route(held.id), asked(before.version));

      expect(reply.statusCode).toBe(503);
      expect(await storedNow(t, held.id)).toEqual(held);
    });
  });

  it('row 4: whoever may see orders but not edit them cannot save: 403, and nothing written; whoever may not see them cannot read', async () => {
    const t = await staffTenant(cs);
    const held = await hold(t, LISTS[1], SEEDED);
    const version = (await read(t.rootCall, held.id)).version;
    const reader = await t.staff('READER', { own: { 'orders.canView': true } });
    const editor = await t.staff('EDITOR', { own: { 'orders.canEdit': true } });

    const refused = await reader.call.send('PUT', route(held.id), asked(version));
    // The permission is checked before the body is read: a body that is no body is 403 too.
    const unread = await reader.call.send('PUT', route(held.id), { nonsense: true });

    expect(refused.statusCode).toBe(403);
    expect(unread.statusCode).toBe(403);
    expect(await storedNow(t, held.id)).toEqual(held);
    expect((await reader.call.get(route(held.id))).statusCode).toBe(200);
    expect((await editor.call.get(route(held.id))).statusCode).toBe(403);
    expect((await editor.call.send('PUT', route(held.id), asked(version))).statusCode).toBe(200);
  });

  it('row 5: a save carrying a code, an id or an unknown field, or lacking its version, is refused and writes nothing', async () => {
    const t = await staffTenant(cs);
    const held = await hold(t, LISTS[1], SEEDED);
    const version = (await read(t.rootCall, held.id)).version;
    const { name: _name, ...noName } = asked(version);
    const bad = [
      asked(version, { code: 'SP-2' }),
      asked(version, { id: randomUUID() }),
      asked(version, { colour: 'red' }),
      asked(version, { version: 'not a tag' }),
      asked(version, { stocked: 'yes' }),
      asked(version, { name: '' }),
      asked(version, { extra: 'text' }),
      noName,
      { name: 'Xi măng', unit: 'bao', price: 95000, stocked: true, extra: {} },
    ];

    for (const body of bad) {
      const reply = await t.rootCall.send('PUT', route(held.id), body);
      expect(reply.statusCode, JSON.stringify(body)).toBe(400);
    }

    expect(await storedNow(t, held.id)).toEqual(held);
  });

  it('row 6: a price that is not whole and above zero, or an empty or over-long unit, is refused: 400, nothing written', async () => {
    const t = await staffTenant(cs);
    const held = await hold(t, LISTS[1], SEEDED);
    const version = (await read(t.rootCall, held.id)).version;
    const bad = [
      asked(version, { price: 0 }),
      asked(version, { price: -5 }),
      asked(version, { price: 95000.5 }),
      asked(version, { price: 10 ** 12 + 1 }),
      asked(version, { price: '95000' }),
      asked(version, { price: null }),
      asked(version, { unit: '' }),
      asked(version, { unit: '   ' }),
      asked(version, { unit: 'x'.repeat(21) }),
    ];

    for (const body of bad) {
      const reply = await t.rootCall.send('PUT', route(held.id), body);
      expect(reply.statusCode, JSON.stringify(body)).toBe(400);
    }

    expect(await storedNow(t, held.id)).toEqual(held);
    const top = await t.rootCall.send('PUT', route(held.id), asked(version, { price: 10 ** 12 }));
    expect(top.statusCode).toBe(200);
  });

  it('answers 500 for a stored product that does not parse, naming the kind and not the key', async () => {
    const t = await staffTenant(cs);
    const id = randomUUID();
    await t.client.putRecord(t.keys.product(id), { id, nonsense: true });

    const reply = await t.rootCall.get(route(id));

    expect(reply.statusCode).toBe(500);
    expect(reply.body).not.toContain(id);
  });
});

describe.each(LISTS)(
  'A clerk adds one $name on the list’s own route, as the import would add the row',
  (list) => {
    /** What an add answers: the record under the kind's name, and its version. */
    type Doc = Record<string, { id: string; code: string } | string>;
    const docOf = (reply: { json: <T>() => T }) => reply.json<Doc>();
    const noun = list.name === 'customers' ? 'customer' : 'product';
    const editor = async (t: Tenant) =>
      await t.staff('EDITOR', { own: { 'orders.canEdit': true } });

    /** A tenant whose store logs every write or removal asked of it. */
    async function watched() {
      const asks: string[] = [];
      let live = false;
      const t = await staffTenant(cs, {
        wrap: (client): CStorageClient => ({
          ...client,
          async putRecord(key, data, ifTag) {
            if (live && key.startsWith(list.prefix(t.keys))) asks.push(`put ${key}`);
            return await client.putRecord(key, data, ifTag);
          },
          async removeRecord(key, ifTag) {
            // a sign-in's clear of its wait is the sign-in's, not the list route's
            if (live && !key.includes('.signin-wait.')) asks.push(`remove ${key}`);
            return await client.removeRecord(key, ifTag);
          },
        }),
      });
      live = true;
      return { t, asks };
    }

    it('row 1: writes one record under a fresh id with its code in capitals, and answers it with the version it now holds', async () => {
      const { t, asks } = await watched();
      const clerk = await editor(t);

      const reply = await clerk.call.send('POST', list.route, list.row({ code: ' kh-9 ' }));

      expect(reply.statusCode).toBe(200);
      const doc = docOf(reply);
      const record = doc[noun] as { id: string; code: string };
      expect(record.code).toBe('KH-9');
      const kept = await t.client.getRecord(list.key(t.keys, record.id));
      expect(kept?.data).toEqual(record);
      expect(doc.version).toBe(kept?.tag);
      expect(asks).toEqual([`put ${list.key(t.keys, record.id)}`]);
      expect(await codesOf(t, list)).toEqual(['KH-9']);
    });

    it('row 1: puts the same record in the list as the import does for the same row, but for its id', async () => {
      const t = await staffTenant(cs);
      const clerk = await editor(t);
      const row = list.row({ extra: { phone: '0901', note: 'Gọi trước' } });

      const added = docOf(
        await clerk.call.send('POST', list.route, list.row({ ...row, code: 'a-1' })),
      );
      const [viaImport] = await imported(t, list, [list.row({ ...row, code: 'a-2' })]);

      const clerks = added[noun] as object;
      const imports = viaImport.kind === 'added' ? viaImport.record : (undefined as never);
      const without = (one: object) => ({ ...one, id: undefined, code: undefined });
      expect(without(clerks)).toEqual(without(imports));
    });

    it('row 2: a code the list holds, typed in any case, is refused 409 and nothing is written', async () => {
      const { t, asks } = await watched();
      const clerk = await editor(t);
      await hold(t, list, { code: 'HELD-1', name: 'Held' });
      asks.length = 0;

      const same = await clerk.call.send('POST', list.route, list.row({ code: 'HELD-1' }));
      const other = await clerk.call.send('POST', list.route, list.row({ code: ' held-1 ' }));

      expect([same.statusCode, other.statusCode]).toEqual([409, 409]);
      expect(asks).toEqual([]);
      expect(await codesOf(t, list)).toEqual(['HELD-1']);
    });

    it('row 3: whoever may see orders but not edit them cannot add: 403 before the body is read, nothing written; one not signed in, 401', async () => {
      const { t, asks } = await watched();
      const reader = await t.staff('READER', { own: { 'orders.canView': true } });

      const refused = await reader.call.send('POST', list.route, list.row());
      const unread = await reader.call.send('POST', list.route, { nonsense: true });
      const unsigned = await t.app.inject({
        method: 'POST',
        url: list.route,
        payload: list.row(),
        headers: { 'x-client': 'acme-co' },
      });

      expect([refused.statusCode, unread.statusCode, unsigned.statusCode]).toEqual([403, 403, 401]);
      expect(asks).toEqual([]);
      expect(await codesOf(t, list)).toEqual([]);
    });

    it('row 4: a body carrying an id, a version or an unknown field, or lacking what the import needs, is refused 400 and nothing is written', async () => {
      const { t, asks } = await watched();
      const clerk = await editor(t);
      const bad = [
        list.row({ id: randomUUID() }),
        list.row({ version: 'abc' }),
        list.row({ phone: '0901' }),
        list.row({ code: 'A' }),
        list.row({ name: '' }),
        ...list.required.map((field) => {
          const { [field]: _left, ...rest } = list.row() as Record<string, unknown>;
          return rest;
        }),
      ];

      for (const body of bad) {
        const reply = await clerk.call.send('POST', list.route, body);
        expect(reply.statusCode, JSON.stringify(body)).toBe(400);
      }

      expect(asks).toEqual([]);
      expect(await codesOf(t, list)).toEqual([]);
    });

    it('row 5: a write that landed with its answer lost answers the record, and no second record appears', async () => {
      let lose = false;
      const t = await staffTenant(cs, {
        wrap: (client): CStorageClient => ({
          ...client,
          async putRecord(key, data, ifTag) {
            const saved = await client.putRecord(key, data, ifTag);
            if (lose && key.startsWith(list.prefix(t.keys))) {
              throw new CStorageError(null, 'c-storage did not answer a put');
            }
            return saved;
          },
        }),
      });
      const clerk = await editor(t);
      lose = true;

      const reply = await clerk.call.send('POST', list.route, list.row({ code: 'A-1' }));
      lose = false;

      expect(reply.statusCode).toBe(200);
      const record = docOf(reply)[noun] as { id: string };
      expect((await t.client.listRecords(list.prefix(t.keys))).records).toHaveLength(1);
      expect((await t.client.getRecord(list.key(t.keys, record.id)))?.data).toEqual(record);
    });

    it('row 6: the root’s import still refuses whoever is not the root, even one holding every permission, and nothing is written', async () => {
      const { t, asks } = await watched();
      const all = await t.staff('ALLPERMS', {
        own: Object.fromEntries(PERMISSIONS.map((id) => [id, true])),
      });

      const refused = await all.call.send('POST', list.importRoute, { rows: [list.row()] });
      const added = await all.call.send('POST', list.route, list.row({ code: 'B-1' }));

      expect([refused.statusCode, added.statusCode]).toEqual([403, 200]);
      expect(asks).toHaveLength(1);
      expect(await codesOf(t, list)).toEqual(['B-1']);
      expect(
        (await imported(t, list, [list.row({ code: 'B-2' }), list.row({ code: 'b-1' })])).map(
          outcome,
        ),
      ).toEqual(['added', 'taken']);
    });

    it('answers 503 when the store could not take the write, and the same add then lands', async () => {
      let down = false;
      const t = await staffTenant(cs, {
        wrap: (client): CStorageClient => ({
          ...client,
          async putRecord(key, data, ifTag) {
            if (down && key.startsWith(list.prefix(t.keys))) throw new CStorageError(503, 'down');
            return await client.putRecord(key, data, ifTag);
          },
        }),
      });
      const clerk = await editor(t);
      down = true;
      const refused = await clerk.call.send('POST', list.route, list.row({ code: 'A-2' }));
      down = false;

      const again = await clerk.call.send('POST', list.route, list.row({ code: 'A-2' }));

      expect(refused.statusCode).toBe(503);
      expect(again.statusCode).toBe(200);
    });
  },
);
