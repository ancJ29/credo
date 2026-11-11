import {
  type CStorageClient,
  closeRequestFor,
  customerRoutes,
  deliveryDocSchema,
  deliveryListReplySchema,
  deliveryPhotoReplySchema,
  deliveryRoutes,
  driverDay,
  employeeDocSchema,
  employeeRoutes,
  listImportRoute,
  orderDocSchema,
  orderRoutes,
  productRoutes,
  reconciliationRoutes,
  recordKeys,
  ROUTES,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { type RunningCStorage, startCStorage } from '../../tests/c-storage';
import { DAY } from '../../tests/orders';
import { bffOn, scoped, seedEmployee, seedTenant, signIn, withAuth } from '../../tests/tenant';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

const PHOTO = `data:image/png;base64,${Buffer.alloc(10, 1).toString('base64')}`;

/** Two companies in one service, as a shared box holds them, each with its root signed in; company
 * alpha with a customer, a product, a person, two drivers, a request delivered with its photo and
 * its driver's day closed, and a second driver's request still waiting. Every write c-storage takes
 * is logged, to prove nothing was written. */
async function twoCompanies() {
  const writes: string[] = [];
  const t = await bffOn(cs, {
    wrap: (client): CStorageClient => ({
      ...client,
      async putRecord(key, data, ifTag) {
        writes.push(`put ${key}`);
        return await client.putRecord(key, data, ifTag);
      },
      async removeRecord(key, tag) {
        writes.push(`remove ${key}`);
        return await client.removeRecord(key, tag);
      },
    }),
  });
  const alphaId = await seedTenant(t.client, 'alpha');
  const betaId = await seedTenant(t.client, 'beta');
  const alphaApp = scoped(t.app, 'alpha');
  const betaApp = scoped(t.app, 'beta');
  const as = (app: typeof alphaApp, authId: string) => ({
    get: (url: string) => app.inject({ method: 'GET', url, headers: withAuth(authId) }),
    send: (method: 'POST' | 'PUT', url: string, payload?: unknown) =>
      app.inject({ method, url, headers: withAuth(authId), payload: payload as object }),
  });
  const alpha = as(alphaApp, (await signIn(alphaApp)).body.authId);
  const beta = as(betaApp, (await signIn(betaApp)).body.authId);

  const imported = async (route: 'customers' | 'products', row: object) => {
    const reply = await alpha.send('POST', listImportRoute(route), { rows: [row] });
    expect(reply.statusCode).toBe(200);
    return reply.json<{ results: { record: { id: string } }[] }>().results[0].record.id;
  };
  const customerId = await imported('customers', { code: 'KH-1', name: 'Anh Hùng', extra: {} });
  const productId = await imported('products', {
    code: 'VT-1',
    name: 'Xi măng',
    unit: 'bao',
    price: 95000,
    stocked: true,
    extra: {},
  });
  const driver = async (code: string) =>
    (
      await seedEmployee(t.client, alphaId, {
        code,
        permissions: { 'deliveries.canDeliver': true },
      })
    ).employee;
  const first = await driver('DRV-1');
  const second = await driver('DRV-2');
  const person = await alpha.send('POST', ROUTES.employees, {
    name: 'Mai Linh',
    code: 'EMP-1',
    extra: {},
  });
  expect(person.statusCode).toBe(201);
  const personDoc = person.json<{ employee: { employee: { id: string }; version: string } }>()
    .employee;

  /** A draft of alpha's, sent to a driver: the request that waits. */
  const sentTo = async (to: { id: string }) => {
    const made = await alpha.send('POST', ROUTES.orders, {
      day: DAY,
      customerId,
      lines: [{ productId, quantity: 10 }],
      extra: {},
    });
    expect(made.statusCode).toBe(201);
    const draft = orderDocSchema.parse(made.json());
    const sent = await alpha.send('POST', orderRoutes.confirm(DAY, draft.order.id), {
      version: draft.version,
      driverId: to.id,
      day: DAY,
    });
    expect(sent.statusCode).toBe(200);
    const order = orderDocSchema.parse(sent.json());
    const request = deliveryDocSchema.parse(
      (await alpha.get(deliveryRoutes.one(DAY, order.order.request!.id))).json(),
    );
    return { order, request };
  };
  const delivered = await sentTo(first);
  const driverCall = as(
    alphaApp,
    (await signIn(alphaApp, { name: 'DRV-1', password: 'Staff-pass-1!' })).body.authId,
  );
  const done = await driverCall.send(
    'POST',
    deliveryRoutes.deliver(DAY, delivered.request.request.id),
    {
      version: delivered.request.version,
      photo: PHOTO,
    },
  );
  expect(done.statusCode).toBe(200);
  const day = deliveryListReplySchema.parse((await alpha.get(deliveryRoutes.list(DAY))).json());
  const closed = await alpha.send(
    'POST',
    reconciliationRoutes.close(DAY, first.id),
    closeRequestFor(driverDay(day.deliveries, first.id), 0),
  );
  expect(closed.statusCode).toBe(200);
  const waiting = await sentTo(second);

  writes.length = 0;
  return {
    ...t,
    alpha,
    beta,
    alphaId,
    betaId,
    customerId,
    productId,
    secondDriverId: second.id,
    personId: personDoc.employee.id,
    personVersion: personDoc.version,
    order: delivered.order,
    delivered: delivered.request,
    waiting,
    writes,
  };
}

describe('Orders: a second company cannot reach the first one’s', () => {
  it('answers 404 to company beta reading company alpha’s order by its id, and its list shows none', async () => {
    const w = await twoCompanies();

    const read = await w.beta.get(orderRoutes.one(DAY, w.order.order.id));
    const list = await w.beta.get(orderRoutes.list(DAY, DAY));

    expect(read.statusCode).toBe(404);
    expect(list.statusCode).toBe(200);
    expect(list.json<{ orders: unknown[] }>().orders).toEqual([]);
    expect((await w.alpha.get(orderRoutes.one(DAY, w.order.order.id))).statusCode).toBe(200);
  });

  it('answers 404 to company beta saving over or cancelling company alpha’s order, and writes nothing', async () => {
    const w = await twoCompanies();
    const draft = await w.alpha.send('POST', ROUTES.orders, {
      day: DAY,
      customerId: w.customerId,
      lines: [{ productId: w.productId, quantity: 1 }],
      extra: {},
    });
    const doc = orderDocSchema.parse(draft.json());
    w.writes.length = 0;

    const save = await w.beta.send('PUT', orderRoutes.one(DAY, doc.order.id), {
      version: doc.version,
      day: DAY,
      customerId: w.customerId,
      lines: [{ productId: w.productId, quantity: 99 }],
      extra: {},
    });
    const cancel = await w.beta.send('POST', orderRoutes.cancel(DAY, doc.order.id), {
      version: doc.version,
    });

    expect([save.statusCode, cancel.statusCode]).toEqual([404, 404]);
    expect(w.writes).toEqual([]);
    expect(
      orderDocSchema.parse((await w.alpha.get(orderRoutes.one(DAY, doc.order.id))).json()),
    ).toEqual(doc);
  });
});

describe('Deliveries: a second company cannot reach the first one’s', () => {
  it('answers 404 to company beta reading company alpha’s request by its id, and its day list and drivers list show none', async () => {
    const w = await twoCompanies();
    const id = w.delivered.request.id;

    const read = await w.beta.get(deliveryRoutes.one(DAY, id));
    const list = await w.beta.get(deliveryRoutes.list(DAY));
    const drivers = await w.beta.get(ROUTES.drivers);

    expect(read.statusCode).toBe(404);
    expect(list.json<{ deliveries: unknown[] }>().deliveries).toEqual([]);
    expect(drivers.statusCode).toBe(200);
    expect(drivers.json<{ drivers: unknown[] }>().drivers).toEqual([]);
    expect((await w.alpha.get(deliveryRoutes.one(DAY, id))).statusCode).toBe(200);
    expect((await w.alpha.get(ROUTES.drivers)).json<{ drivers: unknown[] }>().drivers).toHaveLength(
      2,
    );
  });

  it('answers 404 to company beta reading company alpha’s delivered request’s photo, 200 to alpha', async () => {
    const w = await twoCompanies();
    const id = w.delivered.request.id;

    const own = await w.alpha.get(deliveryRoutes.photo(DAY, id));
    const other = await w.beta.get(deliveryRoutes.photo(DAY, id));

    expect(own.statusCode).toBe(200);
    expect(deliveryPhotoReplySchema.parse(own.json())).toEqual({ photo: PHOTO });
    expect(other.statusCode).toBe(404);
  });

  it('answers 404 to company beta reading the photo of a delivered request of its own that has none, though alpha’s request has the same id and a photo', async () => {
    const w = await twoCompanies();
    const id = w.delivered.request.id;
    // The request is found under beta's key, so only the photo's own key can send beta to alpha's.
    const held = await w.client.getRecord(recordKeys.tenant(w.alphaId).delivery(DAY, id));
    await w.client.putRecord(recordKeys.tenant(w.betaId).delivery(DAY, id), held!.data, null);

    const own = await w.beta.get(deliveryRoutes.one(DAY, id));
    const photo = await w.beta.get(deliveryRoutes.photo(DAY, id));

    expect(own.statusCode).toBe(200);
    expect(photo.statusCode).toBe(404);
  });

  it('answers 404 to company beta cancelling company alpha’s request, and writes nothing', async () => {
    const w = await twoCompanies();
    const id = w.waiting.request.request.id;
    w.writes.length = 0;

    const cancel = await w.beta.send('POST', deliveryRoutes.cancel(DAY, id), {
      version: w.waiting.request.version,
    });

    expect(cancel.statusCode).toBe(404);
    expect(w.writes).toEqual([]);
    expect(
      deliveryDocSchema.parse((await w.alpha.get(deliveryRoutes.one(DAY, id))).json()),
    ).toEqual(w.waiting.request);
  });
});

describe('Staff: a second company cannot reach the first one’s', () => {
  it('answers 404 to company beta reading company alpha’s person by id, and its list shows none', async () => {
    const w = await twoCompanies();

    const read = await w.beta.get(employeeRoutes.one(w.personId));
    const list = await w.beta.get(ROUTES.employees);

    expect(read.statusCode).toBe(404);
    expect(list.json<{ employees: unknown[] }>().employees).toEqual([]);
    expect(
      employeeDocSchema.parse((await w.alpha.get(employeeRoutes.one(w.personId))).json()).employee
        .id,
    ).toBe(w.personId);
  });

  it('answers 404 to company beta saving over, archiving or setting the password of company alpha’s person, and writes nothing', async () => {
    const w = await twoCompanies();

    const save = await w.beta.send('PUT', employeeRoutes.one(w.personId), {
      version: w.personVersion,
      name: 'Taken over',
      extra: {},
    });
    const archive = await w.beta.send('POST', employeeRoutes.archive(w.personId), {
      version: w.personVersion,
    });
    const password = await w.beta.send('PUT', employeeRoutes.password(w.personId), {
      password: null,
    });

    expect([save.statusCode, archive.statusCode, password.statusCode]).toEqual([404, 404, 404]);
    expect(password.body).not.toContain('"password"');
    expect(w.writes).toEqual([]);
    const after = employeeDocSchema.parse(
      (await w.alpha.get(employeeRoutes.one(w.personId))).json(),
    );
    expect(after.employee).toMatchObject({ name: 'Mai Linh', archived: false });
    expect(after.version).toBe(w.personVersion);
  });
});

describe('Closed days: a second company cannot reach the first one’s', () => {
  it('lists none of company alpha’s closed days to company beta', async () => {
    const w = await twoCompanies();

    const own = await w.alpha.get(reconciliationRoutes.list(DAY));
    const other = await w.beta.get(reconciliationRoutes.list(DAY));

    expect(own.json<{ reconciliations: unknown[] }>().reconciliations).toHaveLength(1);
    expect(other.statusCode).toBe(200);
    expect(other.json<{ reconciliations: unknown[] }>().reconciliations).toEqual([]);
  });

  it('answers 404 to company beta closing the open day of company alpha’s driver, and writes nothing', async () => {
    const w = await twoCompanies();

    const close = await w.beta.send('POST', reconciliationRoutes.close(DAY, w.secondDriverId), {
      delivered: [],
      waiting: [w.waiting.request.request.id],
      handedIn: 0,
    });

    expect(close.statusCode).toBe(404);
    expect(w.writes).toEqual([]);
    expect(
      (await w.alpha.get(reconciliationRoutes.list(DAY))).json<{ reconciliations: unknown[] }>()
        .reconciliations,
    ).toHaveLength(1);
  });
});

describe('The customer and product lists: a second company cannot reach the first one’s', () => {
  it.each([
    { name: 'customer', list: ROUTES.customers, one: customerRoutes.one, key: 'customers' },
    { name: 'product', list: ROUTES.products, one: productRoutes.one, key: 'products' },
  ] as const)(
    'answers 404 to company beta reading or saving over company alpha’s $name by its id, shows none in its list, and writes nothing',
    async ({ list, one, key }) => {
      const w = await twoCompanies();
      const id = key === 'customers' ? w.customerId : w.productId;
      const doc = (await w.alpha.get(one(id))).json<{ version: string }>();
      w.writes.length = 0;

      const read = await w.beta.get(one(id));
      const save = await w.beta.send('PUT', one(id), {
        version: doc.version,
        name: 'Taken over',
        extra: {},
        ...(key === 'products' ? { unit: 'bao', price: 1, stocked: true } : {}),
      });
      const listed = await w.beta.get(list);

      expect([read.statusCode, save.statusCode]).toEqual([404, 404]);
      expect(listed.statusCode).toBe(200);
      expect(listed.json<Record<string, unknown[]>>()[key]).toEqual([]);
      expect(w.writes).toEqual([]);
      expect((await w.alpha.get(one(id))).json<{ version: string }>().version).toBe(doc.version);
    },
  );
});
