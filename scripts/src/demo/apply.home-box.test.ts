import { createClient } from '@credo/bff/clients';
import { type CStorageClient, recordKeys } from '@credo/shared';
import { describe, expect, it } from 'vitest';
import { Refused, setRootPasswords } from '../root-password';
import { applyCopy } from './apply';
import { A1, fresh, TODAY, useCStorage } from './apply-support';

useCStorage();

/** A copy whose line names the box `b2`, on a store whose every write is logged. */
async function onAnotherBox() {
  const base = await fresh();
  const writes: string[] = [];
  const storage: CStorageClient = {
    ...base,
    putRecord: (key, data, tag) => (writes.push(`put ${key}`), base.putRecord(key, data, tag)),
    removeRecord: (key, tag) => (writes.push(`remove ${key}`), base.removeRecord(key, tag)),
  };
  const made = await createClient(storage, {
    code: A1.code,
    name: A1.company,
    madeAt: Date.now(),
    box: { name: 'b2', storage },
  });
  if (made === 'taken') throw new Error('taken');
  writes.length = 0;
  return { storage, writes, id: made.id };
}

describe('Case 11: the seed and the root password script serve a home-box copy and refuse one on another box by name, writing nothing', () => {
  it('the seed leaves a copy whose line names b2, says which box, and writes nothing', async () => {
    const t = await onAnotherBox();
    const report = await applyCopy(t.storage, A1, TODAY);
    expect(report.status).toBe('refused');
    expect(report.note).toContain('box b2');
    expect(t.writes).toEqual([]);
    expect(await t.storage.getRecord(recordKeys.tenant(t.id).seed)).toBeNull();
  });

  it('the root password script refuses a copy whose line names b2, says which box, and writes nothing', async () => {
    const t = await onAnotherBox();
    const run = setRootPasswords(t.storage, [A1.code], 'New-Pass-1!x', {
      out: () => undefined,
      now: Date.now,
    });
    await expect(run).rejects.toThrow(Refused);
    await expect(run).rejects.toThrow(/box b2/);
    expect(t.writes).toEqual([]);
  });
});
