import {
  type CStorageClient,
  deliveryDocSchema,
  deliveryRoutes,
  employeeDocSchema,
  employeeRoutes,
  listImportRoute,
  orderDocSchema,
  orderRoutes,
  reconciliationRoutes,
  ROUTES,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { type RunningCStorage, startCStorage } from '../../tests/c-storage';
import {
  bffOn,
  ROOT,
  scoped,
  seedEmployee,
  seedTenant,
  signIn,
  withAuth,
} from '../../tests/tenant';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

const DAY = '2026-10-28';

/** Two companies in one service, as a shared box holds them, each with its root signed in; company
 * alpha with a customer, a product, a person, a draft order sent to a driver (so a request waits)
 * and the driver's day closed. Every write c-storage takes is logged, to prove nothing was written. */
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
  await seedTenant(t.client, 'beta');
  const alphaApp = scoped(t.app, 'alpha');
  const betaApp = scoped(t.app, 'beta');
  const as = (app: typeof alphaApp, authId: string) => ({
    get: (url: string) => app.inject({ method: 'GET', url, headers: withAuth(authId) }),
    send: (method: 'POST' | 'PUT', url: string, payload?: unknown) =>
      app.inject({ method, url, headers: withAuth(authId), payload: payload as object }),
  });
  const alpha = as(alphaApp, (await signIn(alphaApp)).body.authId);
  const beta = as(betaApp, (await signIn(betaApp, ROOT)).body.authId);

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
  const driver = await seedEmployee(t.client, alphaId, {
    code: 'DRV-1',
    permissions: { 'deliveries.canDeliver': true },
  });
  const person = await alpha.send('POST', ROUTES.employees, {
    name: 'Mai Linh',
    code: 'EMP-1',
    extra: {},
  });
  expect(person.statusCode).toBe(201);
  const personDoc = person.json<{ employee: { employee: { id: string }; version: string } }>()
    .employee;

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
    driverId: driver.employee.id,
    day: DAY,
  });
  expect(sent.statusCode).toBe(200);
  const order = orderDocSchema.parse(sent.json());
  const requestId = order.order.request!.id;
  const request = deliveryDocSchema.parse(
    (await alpha.get(deliveryRoutes.one(DAY, requestId))).json(),
  );
  const closed = await alpha.send('POST', reconciliationRoutes.close(DAY, driver.employee.id), {
    delivered: [],
    waiting: [requestId],
    handedIn: 0,
  });
  expect(closed.statusCode).toBe(200);

  writes.length = 0;
  return {
    ...t,
    alpha,
    beta,
    alphaId,
    customerId,
    productId,
    driverId: driver.employee.id,
    personId: personDoc.employee.id,
    personVersion: personDoc.version,
    order,
    request,
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
  it('answers 404 to company beta reading company alpha’s request by its id and its photo, and its day list shows none', async () => {
    const w = await twoCompanies();

    const read = await w.beta.get(deliveryRoutes.one(DAY, w.request.request.id));
    const photo = await w.beta.get(deliveryRoutes.photo(DAY, w.request.request.id));
    const list = await w.beta.get(deliveryRoutes.list(DAY));

    expect([read.statusCode, photo.statusCode]).toEqual([404, 404]);
    expect(list.statusCode).toBe(200);
    expect(list.json<{ deliveries: unknown[] }>().deliveries).toEqual([]);
    expect((await w.alpha.get(deliveryRoutes.one(DAY, w.request.request.id))).statusCode).toBe(200);
  });

  it('answers 404 to company beta cancelling company alpha’s request, and writes nothing', async () => {
    const w = await twoCompanies();
    const open = await w.alpha.send('POST', ROUTES.orders, {
      day: DAY,
      customerId: w.customerId,
      lines: [{ productId: w.productId, quantity: 1 }],
      extra: {},
    });
    const draft = orderDocSchema.parse(open.json());
    // The first driver's day is closed, so a second driver takes this one.
    const second = await seedEmployee(w.client, w.alphaId, {
      code: 'DRV-2',
      permissions: { 'deliveries.canDeliver': true },
    });
    const sent = orderDocSchema.parse(
      (
        await w.alpha.send('POST', orderRoutes.confirm(DAY, draft.order.id), {
          version: draft.version,
          driverId: second.employee.id,
          day: DAY,
        })
      ).json(),
    );
    const id = sent.order.request!.id;
    const before = deliveryDocSchema.parse((await w.alpha.get(deliveryRoutes.one(DAY, id))).json());
    w.writes.length = 0;

    const cancel = await w.beta.send('POST', deliveryRoutes.cancel(DAY, id), {
      version: before.version,
    });

    expect(cancel.statusCode).toBe(404);
    expect(w.writes).toEqual([]);
    expect(
      deliveryDocSchema.parse((await w.alpha.get(deliveryRoutes.one(DAY, id))).json()),
    ).toEqual(before);
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

  it('answers 404 to company beta saving over or archiving company alpha’s person, and writes nothing', async () => {
    const w = await twoCompanies();

    const save = await w.beta.send('PUT', employeeRoutes.one(w.personId), {
      version: w.personVersion,
      name: 'Taken over',
      extra: {},
    });
    const archive = await w.beta.send('POST', employeeRoutes.archive(w.personId), {
      version: w.personVersion,
    });

    expect([save.statusCode, archive.statusCode]).toEqual([404, 404]);
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

  it('answers 404 to company beta closing company alpha’s driver’s day, and writes nothing', async () => {
    const w = await twoCompanies();

    const close = await w.beta.send('POST', reconciliationRoutes.close(DAY, w.driverId), {
      delivered: [],
      waiting: [w.request.request.id],
      handedIn: 0,
    });

    expect(close.statusCode).toBe(404);
    expect(w.writes).toEqual([]);
  });
});
