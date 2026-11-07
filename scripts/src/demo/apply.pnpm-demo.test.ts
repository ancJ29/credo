import { describe, expect, it } from 'vitest';
import { startDemo } from './apply';
import { readLedger } from './ledger';
import {
  A1,
  B1,
  fresh,
  tenantOf,
  staffOf,
  standing,
  read,
  hooked,
  TODAY,
  useCStorage,
} from './apply-support';

useCStorage();

describe('what pnpm demo makes', () => {
  it('row 22: the mapped copies are made by the operator’s create, filled to four days ago, then run three days', async () => {
    const storage = await fresh();

    const copies = await startDemo(storage, TODAY, 'p1');

    expect(copies.map((c) => c.code).sort()).toEqual([B1.code, A1.code].sort());
    for (const copy of copies) {
      expect(copy.rootPassword.length).toBeGreaterThan(8);
      const id = await tenantOf(storage, copy.code);
      expect((await readLedger(storage, id))!.ledger).toMatchObject({
        firstDay: '2026-10-19',
        lastDay: '2026-10-28',
        filled: true,
      });
      expect(read(await staffOf(storage, copy.code))).toEqual(standing(copy, TODAY));
    }
    await expect(startDemo(storage, TODAY, 'p1')).rejects.toThrow('already holds it');
    await expect(startDemo(storage, TODAY, 'nobody')).rejects.toThrow('no copy in the mapping');
  });

  it('row 22: a copy whose run is refused stops the start', async () => {
    const storage = await fresh();
    const rival = hooked(storage, {
      beforePut: async (key, _data, ifTag) => {
        if (key.endsWith('.seed') && ifTag === null)
          await storage.putRecord(key, { rival: true }, null);
      },
    });
    await expect(startDemo(rival, TODAY, 'p2')).rejects.toThrow('another run holds it');
  });
});
