import {
  type ActivityClient,
  type Product,
  employeeRoutes,
  listImportRoute,
  productRoutes,
  readEntriesByTarget,
  ROUTES,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { clientOf, type RunningAudit, startAudit } from './audit';
import { type RunningCStorage, startCStorage } from './c-storage';
import { personCalls, staffTenant } from './staff';

let cs: RunningCStorage;
let audit: RunningAudit;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
  audit = await startAudit(inject('auditBinary'));
});
afterAll(async () => {
  await cs.stop();
  await audit.stop();
});

const NOW = Date.UTC(2026, 9, 28, 9, 0, 0);
const product = (code: string) => ({
  code,
  name: `Cà phê ${code}`,
  unit: 'kg',
  price: 1000,
  stocked: true,
  extra: {},
});

/** A tenant whose BFF logs to the real audit service, counting each call it makes. */
async function setup() {
  const calls: number[] = [];
  const real = clientOf(audit);
  const counting: ActivityClient = {
    mintToken: (clientId) => real.mintToken(clientId),
    log: (entries) => {
      calls.push(entries.length);
      return real.log(entries);
    },
  };
  const t = await staffTenant(cs, { now: () => NOW, activity: counting });
  const entriesOf = async (targetId: string) => {
    const token = await real.mintToken(t.id);
    return readEntriesByTarget({ readUrl: audit.openUrl, token }, targetId);
  };
  return { t, calls, entriesOf };
}

describe('Every change writes its entry to the real audit service', () => {
  it('a create holds no before and the whole new record as after', async () => {
    const { t, entriesOf } = await setup();

    const reply = await t.rootCall.send('POST', ROUTES.products, product('SP-1'));

    expect(reply.statusCode).toBe(200);
    const made = reply.json<{ product: Product }>().product;
    const [entry] = await entriesOf(made.id);
    expect(entry).toMatchObject({
      clientId: t.id,
      actorId: 'root',
      action: 'product.create',
      targetId: made.id,
      createdAt: new Date(NOW).toISOString(),
      memo: { by: 'root', before: null, after: made, outcome: 'saved' },
    });
  });

  it('an import writes one entry for each record it created, in one call', async () => {
    const { t, calls, entriesOf } = await setup();

    const reply = await t.rootCall.send('POST', listImportRoute('products'), {
      rows: [product('SP-1'), { code: 'bad' }, product('SP-2')],
    });

    expect(reply.statusCode).toBe(200);
    const added = reply
      .json<{ results: { kind: string; record?: Product }[] }>()
      .results.flatMap((one) => (one.record ? [one.record] : []));
    expect(added).toHaveLength(2);
    expect(calls).toEqual([2]);
    for (const record of added) {
      const entries = await entriesOf(record.id);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        action: 'product.import',
        memo: { before: null, after: record, outcome: 'saved' },
      });
    }
  });

  it('a change refused once the person is known writes its outcome and no after', async () => {
    const { t, entriesOf } = await setup();
    const made = (await t.rootCall.send('POST', ROUTES.products, product('SP-1'))).json<{
      product: Product;
      version: string;
    }>();
    const clerk = await t.staff('CLERK');
    const route = productRoutes.one(made.product.id);

    const denied = await clerk.call.send('PUT', route, {
      name: 'X',
      unit: 'kg',
      price: 5,
      stocked: true,
      extra: {},
      version: made.version,
    });
    const badBody = await t.rootCall.send('PUT', route, {
      name: 'Y',
      unit: 'kg',
      price: 5,
      stocked: true,
      extra: {},
      version: 'not-the-version',
    });

    expect(denied.statusCode).toBe(403);
    expect(badBody.statusCode).toBe(400);
    const refused = (await entriesOf(made.product.id)).filter(
      (one) => one.action === 'product.save',
    );
    expect(refused).toHaveLength(2);
    for (const one of refused) {
      expect(one.memo).toMatchObject({ outcome: 'refused' });
      expect(one.memo).not.toHaveProperty('after');
    }
    expect(refused.map((one) => one.actorId).sort()).toEqual(
      ['root', `employee.${clerk.employee.id}`].sort(),
    );
  });

  it('a password change logs the act, never the password or its hash', async () => {
    const { t, entriesOf } = await setup();
    const {
      employee: { employee },
    } = await personCalls.added(t.rootCall);
    const secret = 'A-secret-pass-77!';

    const reply = await t.rootCall.send('PUT', employeeRoutes.password(employee.id), {
      password: secret,
    });

    expect(reply.statusCode).toBe(200);
    const entries = await entriesOf(employee.id);
    const word = entries.find((one) => one.action === 'employee.password');
    expect(word?.memo).toEqual({ by: 'root', before: null, after: null, outcome: 'saved' });
    const text = JSON.stringify(entries);
    expect(text).not.toContain(secret);
    expect(text.toLowerCase()).not.toContain('hash');
  });

  it('the staff setup and a person’s save each write theirs', async () => {
    const { t, entriesOf } = await setup();
    await t.setup({ departments: [{ name: 'Kho', permissions: {}, extra: {} }] });
    const {
      employee: { employee },
    } = await personCalls.added(t.rootCall);
    const doc = await personCalls.doc(t.rootCall, employee.id);

    const saved = await t.rootCall.send('PUT', employeeRoutes.one(employee.id), {
      version: doc.version,
      name: 'Mai Linh Tran',
      extra: {},
    });

    expect(saved.statusCode).toBe(200);
    expect((await entriesOf('setup')).map((one) => one.action)).toContain('staff.setup');
    const [entry] = (await entriesOf(employee.id)).filter((one) => one.action === 'employee.save');
    expect(entry?.memo).toMatchObject({
      before: { name: 'Mai Linh' },
      after: { name: 'Mai Linh Tran' },
    });
  });

  it('a call with no session writes nothing', async () => {
    const { t, calls } = await setup();

    const reply = await t.app.inject({
      method: 'POST',
      url: ROUTES.products,
      payload: product('SP-9'),
    });

    expect(reply.statusCode).toBe(401);
    expect(calls).toEqual([]);
  });
});
