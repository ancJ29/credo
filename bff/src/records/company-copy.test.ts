import { recordKeys } from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { type RunningCStorage, startCStorage, freshTenant } from '../../tests/c-storage';
import { compareCompany, copyCompany } from './company-copy';
import { type RecordStore, tenantStorage } from './records';

type Tenant = Awaited<ReturnType<typeof freshTenant>>;

/** The copied company, a company whose id begins with it, and a third. */
const COPIED = 'co-a1';
const NEIGHBOUR = 'co-a1x';
const OTHER = 'co-z';
const CUSTOMERS = 1300;
const PHOTOS = 120;
const NEIGHBOUR_RECORDS = 700;
const OTHER_RECORDS = 2500 - CUSTOMERS - PHOTOS - NEIGHBOUR_RECORDS;
/** About 40 KB a photo, so the company's photos alone pass one 4 MiB page. */
const photo = 'p'.repeat(40_000);

let from: RunningCStorage;
let to: RunningCStorage;
let source: Tenant;
beforeAll(async () => {
  from = await startCStorage(inject('cStorageBinary'));
  to = await startCStorage(inject('cStorageBinary'));
  source = await freshTenant(from);
  await seed(source.client, COPIED, CUSTOMERS, PHOTOS);
  await seed(source.client, NEIGHBOUR, NEIGHBOUR_RECORDS, 0);
  await seed(source.client, OTHER, OTHER_RECORDS, 0);
}, 120_000);
afterAll(async () => {
  await from.stop();
  await to.stop();
});

/** Customers `c0000…`, then photos, 50 writes at once. */
async function seed(store: RecordStore, id: string, customers: number, photos: number) {
  const keys = recordKeys.tenant(id);
  const writes = [
    ...Array.from({ length: customers }, (_, i) => {
      const n = String(i).padStart(4, '0');
      return () => store.putRecord(keys.customer(`c${n}`), { id: `c${n}`, name: `Khách ${n}` });
    }),
    ...Array.from({ length: photos }, (_, i) => {
      return () => store.putRecord(keys.deliveryPhoto('2026-11-11', `r${i}`), { photo });
    }),
  ];
  for (let at = 0; at < writes.length; at += 50)
    await Promise.all(writes.slice(at, at + 50).map((write) => write()));
}

/** Every record of a company with its tag, in key order. */
async function held(store: RecordStore, id: string) {
  const all: string[] = [];
  let after: string | undefined;
  for (;;) {
    const page = await store.listRecords(recordKeys.tenant(id).all, after);
    all.push(...page.records.map((r) => `${r.key}@${r.tag}`));
    if (!page.more) return all;
    after = page.records[page.records.length - 1].key;
  }
}

/** A fresh target holding two other companies: the copied one's neighbour, newer than the source's,
 * and one the source lacks. */
async function target() {
  const tenant = await freshTenant(to);
  await seed(tenant.client, NEIGHBOUR, 5, 0);
  await tenant.client.putRecord(recordKeys.tenant(NEIGHBOUR).customer('c0000'), {
    id: 'c0000',
    name: 'Mới hơn',
  });
  await seed(tenant.client, 'co-q', 3, 0);
  return tenant;
}

const pair = (t: Tenant) =>
  [tenantStorage(source.client, COPIED), tenantStorage(t.client, COPIED)] as const;

/** Copies until done, `bound` changes a call, from where the last call ended. */
async function copyAll(t: Tenant, bound?: number) {
  const [a, b] = pair(t);
  let after: string | undefined;
  let copied = 0;
  let removed = 0;
  for (;;) {
    const step = await copyCompany(a, b, { after, bound });
    copied += step.copied;
    removed += step.removed;
    after = step.after;
    if (step.done) return { copied, removed };
  }
}

describe('a company copied to a second store', () => {
  it('leaves the target holding the source’s records, each with its tag, the other companies as they were and the source unread-only', async () => {
    const t = await target();
    const total = CUSTOMERS + PHOTOS;
    const sourceBefore = [
      await held(source.client, COPIED),
      await held(source.client, NEIGHBOUR),
      await held(source.client, OTHER),
    ];
    const neighbourBefore = await held(t.client, NEIGHBOUR);
    const otherBefore = await held(t.client, 'co-q');

    const done = await copyAll(t);

    expect(done).toEqual({ copied: total, removed: 0 });
    expect(await held(t.client, COPIED)).toHaveLength(total);
    expect(await held(t.client, COPIED)).toEqual(sourceBefore[0]);
    expect(await held(t.client, NEIGHBOUR)).toEqual(neighbourBefore);
    expect(await held(t.client, 'co-q')).toEqual(otherBefore);
    expect(await held(t.client, OTHER)).toEqual([]);
    expect([
      await held(source.client, COPIED),
      await held(source.client, NEIGHBOUR),
      await held(source.client, OTHER),
    ]).toEqual(sourceBefore);
  }, 120_000);

  it('run again after a stop halfway ends equal, the compare naming how many differ until then', async () => {
    const t = await target();
    const [a, b] = pair(t);
    const total = CUSTOMERS + PHOTOS;

    const first = await copyCompany(a, b, { bound: 700 });
    expect(first).toMatchObject({ copied: 700, removed: 0, done: false });
    expect(await compareCompany(a, b)).toEqual({ records: total, differ: total - 700 });

    const second = await copyCompany(a, b, { after: first.after, bound: total });
    console.info(`a second run copied ${second.copied} of ${total} records`);
    expect(second).toMatchObject({ copied: total - 700, removed: 0, done: true });
    expect(await compareCompany(a, b)).toEqual({ records: total, differ: 0 });
    expect(await copyCompany(a, b)).toMatchObject({ copied: 0, removed: 0, done: true });
  }, 120_000);

  it('removes what the source lacks and puts back what changed, the neighbours keeping their newer records', async () => {
    const t = await target();
    const [a, b] = pair(t);
    const keys = recordKeys.tenant(COPIED);
    await t.client.putRecord(keys.customer('c0003'), { id: 'c0003', name: 'Cũ' });
    await t.client.putRecord(keys.customer('c0004'), { id: 'c0004', name: 'Cũ' });
    await t.client.putRecord(keys.customer('c9998'), { id: 'c9998', name: 'Thừa' });
    await t.client.putRecord(keys.customer('c9999'), { id: 'c9999', name: 'Thừa' });
    await t.client.putRecord(keys.deliveryPhoto('2026-11-11', 'rzz'), { photo: 'thừa' });
    const neighbour = await held(t.client, NEIGHBOUR);

    const done = await copyAll(t);

    expect(done).toEqual({ copied: CUSTOMERS + PHOTOS, removed: 3 });
    expect(await compareCompany(a, b)).toEqual({ records: CUSTOMERS + PHOTOS, differ: 0 });
    expect(await t.client.getRecord(keys.customer('c9998'))).toBeNull();
    expect(await held(t.client, NEIGHBOUR)).toEqual(neighbour);
  }, 120_000);

  it('stops on a record changed in the target after its walk, naming its kind, and never writes over it', async () => {
    const t = await target();
    const [a, b] = pair(t);
    const key = recordKeys.tenant(COPIED).customer('c0001');
    await t.client.putRecord(key, { id: 'c0001', name: 'Cũ' });
    const listed: RecordStore = {
      ...b,
      async listRecords(prefix, after) {
        const page = await b.listRecords(prefix, after);
        await t.client.putRecord(key, { id: 'c0001', name: 'Mới hơn' });
        return page;
      },
    };

    await expect(
      copyCompany(a, { ...b, ...listed, tenantId: b.tenantId }, { bound: 5000 }),
    ).rejects.toThrow('a customer record changed in the target during the copy');

    expect((await t.client.getRecord(key))?.data).toEqual({ id: 'c0001', name: 'Mới hơn' });
  }, 120_000);

  it('stops on an extra record changed in the target after its walk, and never removes it', async () => {
    const t = await target();
    const [a, b] = pair(t);
    const key = recordKeys.tenant(COPIED).customer('c9999');
    await t.client.putRecord(key, { id: 'c9999', name: 'Thừa' });
    const listed: RecordStore = {
      ...b,
      async listRecords(prefix, after) {
        const page = await b.listRecords(prefix, after);
        await t.client.putRecord(key, { id: 'c9999', name: 'Thừa, mới hơn' });
        return page;
      },
    };

    await expect(
      copyCompany(a, { ...b, ...listed, tenantId: b.tenantId }, { bound: 5000 }),
    ).rejects.toThrow('a customer record changed in the target');

    expect((await t.client.getRecord(key))?.data).toEqual({ id: 'c9999', name: 'Thừa, mới hơn' });
  }, 120_000);

  it('compares without writing, and a source record changed after its copy turns it red', async () => {
    const t = await target();
    const [a, b] = pair(t);
    await copyAll(t);
    const targetBefore = await held(t.client, COPIED);

    expect(await compareCompany(a, b)).toEqual({ records: CUSTOMERS + PHOTOS, differ: 0 });
    const key = recordKeys.tenant(COPIED).customer('c0007');
    const original = await source.client.getRecord(key);
    await source.client.putRecord(key, { id: 'c0007', name: 'Đổi sau khi chép' });
    try {
      expect(await compareCompany(a, b)).toEqual({ records: CUSTOMERS + PHOTOS, differ: 1 });
      expect(await held(t.client, COPIED)).toEqual(targetBefore);
      await t.client.putRecord(recordKeys.tenant(COPIED).customer('c9999'), { id: 'c9999' });
      expect(await compareCompany(a, b)).toEqual({ records: CUSTOMERS + PHOTOS, differ: 2 });
    } finally {
      await source.client.putRecord(key, original?.data);
    }
  }, 120_000);
});
