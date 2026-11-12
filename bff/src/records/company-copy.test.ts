import { recordKeys } from '@credo/shared';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { type RunningCStorage, startCStorage, freshTenant } from '../../tests/c-storage';
import { copyCompany } from './company-copy';
import { tenantStorage } from './records';

let from: RunningCStorage;
let to: RunningCStorage;
beforeAll(async () => {
  from = await startCStorage(inject('cStorageBinary'));
  to = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await from.stop();
  await to.stop();
});

/** Every record of a company with its tag, in key order. */
async function held(store: Awaited<ReturnType<typeof freshTenant>>['client'], id: string) {
  const all: string[] = [];
  let after: string | undefined;
  for (;;) {
    const page = await store.listRecords(recordKeys.tenant(id).all, after);
    all.push(...page.records.map((r) => `${r.key}@${r.tag}`));
    if (!page.more) return all;
    after = page.records[page.records.length - 1].key;
  }
}

describe('a company copied to a second store', () => {
  it('leaves the target holding the source’s records under the company’s prefix, each with its tag', async () => {
    const source = await freshTenant(from);
    const target = await freshTenant(to);
    const id = randomUUID();
    const keys = recordKeys.tenant(id);
    for (let at = 0; at < 2500; at += 50) {
      await Promise.all(
        Array.from({ length: 50 }, (_, i) => {
          const n = String(at + i).padStart(4, '0');
          return source.client.putRecord(keys.customer(`c${n}`), {
            id: `c${n}`,
            name: `Khách ${n}`,
          });
        }),
      );
    }

    const done = await copyCompany(
      tenantStorage(source.client, id),
      tenantStorage(target.client, id),
    );

    expect(done).toEqual({ copied: 2500 });
    const copy = await held(target.client, id);
    expect(copy).toHaveLength(2500);
    expect(copy).toEqual(await held(source.client, id));
  }, 60_000);
});
