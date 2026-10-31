import { randomUUID } from 'node:crypto';
import {
  CStorageError,
  type CStorageClient,
  IMPORT_CALL_ROWS,
  importCustomersReplySchema,
  importProductsReplySchema,
  listImportRoute,
  recordKeys,
  ROUTES,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { type RunningCStorage, startCStorage } from '../tests/c-storage';
import { staffTenant } from '../tests/staff';

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

describe.each(LISTS)('The $name: only the root reads the list and imports into it', (list) => {
  it('refuses a person who holds every staff permission, 403, and one not signed in, 401, on the list and on the import, and adds nothing', async () => {
    const t = await staffTenant(cs);
    const office = await t.staff('OFFICE', {
      own: { 'staff.canCreate': true, 'staff.canView': true, 'staff.canEdit': true },
    });

    const read = await office.call.get(list.route);
    const send = await office.call.send('POST', list.importRoute, { rows: [list.row()] });
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

    expect([read.statusCode, send.statusCode]).toEqual([403, 403]);
    expect([unsignedRead.statusCode, unsignedSend.statusCode]).toEqual([401, 401]);
    expect(await codesOf(t, list)).toEqual([]);
  });
});

describe.each(LISTS)('The $name list is the company’s own, in code order, never short', (list) => {
  it('lists every record of the company in code order, and none of another company’s', async () => {
    const t = await staffTenant(cs);
    const other = await staffTenant(cs);
    await hold(t, list, { code: 'B-2', name: 'Second' });
    await hold(t, list, { code: 'A-1', name: 'First' });
    await hold(other, list, { code: 'C-3' });

    expect(await codesOf(t, list)).toEqual(['A-1', 'B-2']);
  });

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
  },
);
