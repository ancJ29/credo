import { randomUUID } from 'node:crypto';
import {
  type ActivityClient,
  type Customer,
  CLIENT_HEADER,
  customerSaveMemoSchema,
  readEntriesByTarget,
  recordKeys,
  ROUTES,
  customerRoutes,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { clientOf, type RunningAudit, startAudit } from './audit';
import { type RunningCStorage, startCStorage } from './c-storage';
import { staffTenant } from './staff';
import { seedTenant } from './tenant';

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

/** A tenant whose BFF logs to `activity`, a customer it holds, and the lines its request log wrote. */
async function setup(activity: ActivityClient | undefined, name = 'Mai Linh') {
  const lines: Record<string, unknown>[] = [];
  const t = await staffTenant(cs, {
    now: () => NOW,
    ...(activity === undefined ? {} : { activity }),
    logger: { stream: { write: (line: string) => void lines.push(JSON.parse(line) as never) } },
  });
  const customer: Customer = { id: randomUUID(), code: 'KH-1', name, extra: {} };
  await t.client.putRecord(recordKeys.tenant(t.id).customer(customer.id), customer);
  const save = async (to: string, headers: Record<string, string> = {}) => {
    const route = customerRoutes.one(customer.id);
    const doc = (await t.rootCall.get(route)).json<{ version: string }>();
    return t.app.inject({
      method: 'PUT',
      url: route,
      headers: { 'x-auth-id': t.root, ...headers },
      payload: { name: to, extra: {}, version: doc.version },
    });
  };
  const entriesOf = async (clientId: string, targetId = customer.id) => {
    const token = await clientOf(audit).mintToken(clientId);
    return readEntriesByTarget({ readUrl: audit.openUrl, token }, targetId);
  };
  return { t, customer, save, lines, entriesOf };
}

describe('One customer’s save writes one entry to the real audit service', () => {
  it('reads one entry back by the customer’s id: the client’s id, the root, customer.save, the record before and after, and the back end’s clock', async () => {
    const { t, customer, save, entriesOf } = await setup(clientOf(audit));

    const reply = await save('Mai Linh Tran');
    expect(reply.statusCode).toBe(200);

    const entries = await entriesOf(t.id);
    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry).toMatchObject({
      clientId: t.id,
      actorId: 'root',
      action: 'customer.save',
      targetId: customer.id,
      createdAt: new Date(NOW).toISOString(),
    });
    const memo = customerSaveMemoSchema.parse(entry?.memo);
    expect(memo.before?.name).toBe('Mai Linh');
    expect(memo.after?.name).toBe('Mai Linh Tran');
    expect(memo.before?.name).not.toBe(memo.after?.name);
    expect(memo.before).toEqual(customer);
    expect(memo.after).toEqual({ ...customer, name: 'Mai Linh Tran' });
  });

  it('names a person by employee.<id> and as shown, and never takes a client from the body', async () => {
    const { t, customer, entriesOf } = await setup(clientOf(audit));
    const clerk = await t.staff('CLERK', {
      own: { 'orders.canView': true, 'orders.canEdit': true },
    });
    const route = customerRoutes.one(customer.id);
    const version = (await clerk.call.get(route)).json<{ version: string }>().version;

    const reply = await t.app.inject({
      method: 'PUT',
      url: route,
      headers: { 'x-auth-id': clerk.authId },
      payload: { name: 'Mai L', extra: {}, version, clientId: 'someone-else' },
    });

    expect(reply.statusCode).toBeLessThan(500);
    const [entry] = await entriesOf(t.id);
    expect(entry).toMatchObject({ clientId: t.id, actorId: `employee.${clerk.employee.id}` });
    expect(customerSaveMemoSchema.parse(entry?.memo).by).toBe(clerk.employee.name);
    expect(await entriesOf('someone-else')).toEqual([]);
  });

  it('a session sent with another client’s code is a 401 and enters nothing under either client', async () => {
    const { t, customer, entriesOf } = await setup(clientOf(audit));
    const clerk = await t.staff('CLERK', {
      own: { 'orders.canView': true, 'orders.canEdit': true },
    });
    const other = await seedTenant(t.client, 'other-co');
    const route = customerRoutes.one(customer.id);
    const version = (await clerk.call.get(route)).json<{ version: string }>().version;

    const reply = await t.app.inject({
      method: 'PUT',
      url: route,
      headers: { 'x-auth-id': clerk.authId, [CLIENT_HEADER]: 'other-co' },
      payload: { name: 'Mai L', extra: {}, version },
    });

    expect(reply.statusCode).toBe(401);
    expect(await entriesOf(t.id)).toEqual([]);
    expect(await entriesOf(other)).toEqual([]);
  });

  it('is read by no other client’s token', async () => {
    const { t, save, entriesOf } = await setup(clientOf(audit));
    await save('Mai L');

    expect(await entriesOf(`${t.id}-other`)).toEqual([]);
    expect(await entriesOf(t.id)).toHaveLength(1);
  });

  it('writes no entry for a call with no session or a read, and a refusal writes its outcome alone', async () => {
    const { t, customer, entriesOf } = await setup(clientOf(audit));
    const route = customerRoutes.one(customer.id);

    const unsigned = await t.app.inject({ method: 'PUT', url: route, payload: {} });
    const { version } = (await t.rootCall.get(route)).json<{ version: string }>();
    await t.client.putRecord(recordKeys.tenant(t.id).customer(customer.id), {
      ...customer,
      name: 'Moved',
    });
    const stale = await t.app.inject({
      method: 'PUT',
      url: route,
      headers: { 'x-auth-id': t.root },
      payload: { name: 'X', extra: {}, version },
    });
    await t.rootCall.get(route);
    await t.rootCall.get(ROUTES.customers);

    expect(unsigned.statusCode).toBe(401);
    expect(stale.statusCode).toBe(409);
    const entries = await entriesOf(t.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.memo).toMatchObject({ by: 'root', outcome: 'refused' });
    expect(entries[0]?.memo).not.toHaveProperty('after');
  });
});

describe('A change is never refused because its entry could not be written', () => {
  it('saves and answers as usual, and the request log names the lost entry, when the service refuses the key', async () => {
    const wrong = clientOf({ ...audit, key: 'not-the-key' });
    const { customer, save, lines } = await setup(wrong);

    const reply = await save('Mai L');

    expect(reply.statusCode).toBe(200);
    expect(reply.json<{ customer: Customer }>().customer.name).toBe('Mai L');
    const lost = lines.filter((line) => line['msg'] === 'audit entry lost');
    expect(lost).toHaveLength(1);
    expect(lost[0]).toMatchObject({ action: 'customer.save', targetId: customer.id });
    expect(JSON.stringify(lines)).not.toContain('not-the-key');
  });

  it('saves and answers as usual, and logs the lost entry, when the service is down', async () => {
    const gone = await startAudit(inject('auditBinary'));
    const { customer, save, lines } = await setup(clientOf(gone));
    await gone.stop();

    const reply = await save('Mai L');

    expect(reply.statusCode).toBe(200);
    expect(lines.filter((line) => line['msg'] === 'audit entry lost')).toMatchObject([
      { action: 'customer.save', targetId: customer.id },
    ]);
  });

  it('saves and logs that the log is not configured when the BFF has no audit service', async () => {
    const { customer, save, lines } = await setup(undefined);

    const reply = await save('Mai L');

    expect(reply.statusCode).toBe(200);
    expect(
      lines.filter((line) => line['msg'] === 'audit entry lost: the log is not configured'),
    ).toMatchObject([{ action: 'customer.save', targetId: customer.id }]);
  });
});
