import { type CStorageClient, recordKeys } from '@credo/shared';
import { describe, expect, it } from 'vitest';
import { applyCopy } from './apply';
import { addDays } from './days';
import { parseLedger, readLedger, writeLedger } from './ledger';
import {
  A1,
  B1,
  fresh,
  make,
  tenantOf,
  staffOf,
  everything,
  standing,
  read,
  hooked,
  TODAY,
  useCStorage,
} from './apply-support';

useCStorage();

describe('the ledger and the run’s session', () => {
  it('row 19: the session is ended with the run, and nothing of a password is read, kept or printed', async () => {
    const storage = await fresh();
    const made = await make(storage, B1);
    const lines: string[] = [];

    await applyCopy(storage, B1, TODAY, (line) => lines.push(line));

    const id = await tenantOf(storage, B1.code);
    expect((await storage.listRecords(recordKeys.tenant(id).session(''))).records).toEqual([]);
    expect(lines.length).toBeGreaterThan(5);
    expect(lines.join('\n')).not.toContain(made.password);
    expect(JSON.stringify(await everything(storage, B1.code))).not.toContain(made.password);
    expect(lines.join('\n')).not.toMatch(/password|scrypt/i);
  });

  it('row 20: the ledger sits outside every list the BFF reads, and two runs at once leave one correct copy', async () => {
    const storage = await fresh();
    await make(storage, B1);

    const reports = await Promise.all([
      applyCopy(storage, B1, TODAY),
      applyCopy(storage, B1, TODAY),
    ]);

    const id = await tenantOf(storage, B1.code);
    const people = await staffOf(storage, B1.code);
    expect(new Set(people.map((p) => p.code)).size).toBe(people.length);
    expect(read(people)).toEqual(standing(B1, TODAY));
    expect((await readLedger(storage, id))!.ledger.lastDay).toBe('2026-10-28');
    expect(reports.some((r) => r.status === 'ok')).toBe(true);
    expect(await storage.getRecord(recordKeys.tenant(id).seed)).not.toBeNull();
  });

  it('row 20: a ledger another run wrote first stops this run, at the start, after the fill and after a day', async () => {
    const moveLedger = async (storage: CStorageClient, key: string, ifTag?: string | null) => {
      if (!key.endsWith('.seed')) return;
      if (ifTag === null) {
        await storage.putRecord(key, { rival: true }, null);
        return;
      }
      const found = (await storage.getRecord(key))!;
      await storage.putRecord(key, { ...(found.data as object), moved: true }, found.tag);
    };
    // at the start: the ledger is written by a rival between the read and the first write
    const first = await fresh();
    await make(first, A1);
    const atStart = hooked(first, {
      beforePut: (key, _data, ifTag) => moveLedger(first, key, ifTag),
    });
    expect(await applyCopy(atStart, A1, TODAY)).toMatchObject({
      status: 'refused',
      note: 'another run holds it, left',
    });

    // after the fill
    const second = await fresh();
    await make(second, A1);
    const afterFill = hooked(second, {
      beforePut: (key, _data, ifTag) =>
        ifTag === null ? Promise.resolve() : moveLedger(second, key, ifTag),
    });
    expect(await applyCopy(afterFill, A1, TODAY)).toMatchObject({
      status: 'refused',
      filled: false,
    });

    // after a day: the fill done, the rival moves the ledger as the first day finishes
    const third = await fresh();
    await make(third, A1);
    await applyCopy(third, A1, TODAY);
    const idThird = await tenantOf(third, A1.code);
    const before = (await readLedger(third, idThird))!.ledger.lastDay;
    const afterDay = hooked(third, {
      beforePut: (key, _data, ifTag) => moveLedger(third, key, ifTag),
    });
    const report = await applyCopy(afterDay, A1, addDays(TODAY, 1));
    expect(report).toMatchObject({ status: 'refused', days: [] });
    expect((await readLedger(third, idThird))!.ledger.lastDay).toBe(before);
  });

  it('reads a ledger that does not parse as an error, and a write read back as another’s as moved', async () => {
    expect(() => parseLedger(null)).toThrow('does not parse');
    expect(() =>
      parseLedger({
        client: 'A',
        scenario: 'S9',
        firstDay: '2026-10-01',
        lastDay: '2026-10-01',
        filled: true,
      }),
    ).toThrow('does not parse');
    expect(() =>
      parseLedger({
        client: 'A',
        scenario: 'S1',
        firstDay: 'x',
        lastDay: '2026-10-01',
        filled: true,
      }),
    ).toThrow('does not parse');
    expect(() =>
      parseLedger({
        client: 7,
        scenario: 'S1',
        firstDay: '2026-10-01',
        lastDay: '2026-10-01',
        filled: true,
      }),
    ).toThrow('does not parse');
    expect(() =>
      parseLedger({
        client: 'A',
        scenario: 'S1',
        firstDay: '2026-10-01',
        lastDay: '2026-10-01',
        filled: 'yes',
      }),
    ).toThrow('does not parse');
    const good = {
      client: 'A',
      scenario: 'S1' as const,
      firstDay: '2026-10-01',
      lastDay: '2026-10-02',
      filled: true,
    };
    expect(parseLedger(good)).toEqual(good);
    expect(parseLedger({ ...good, blocks: ['orders'] })).toEqual({ ...good, blocks: ['orders'] });
    expect(() => parseLedger({ ...good, blocks: ['stock'] })).toThrow('does not parse');
    expect(() => parseLedger({ ...good, blocks: 'orders' })).toThrow('does not parse');
    const storage = await fresh();
    const other = hooked(storage, {});
    const swapped: CStorageClient = {
      ...other,
      getRecord: () =>
        Promise.resolve({ data: { ...good, lastDay: '2026-10-09' }, tag: 'a'.repeat(64) }),
    };
    expect(await writeLedger(swapped, 'swapped', good, null)).toBeNull();
    expect(await writeLedger(storage, 'id', good, null)).toMatch(/^[0-9a-f]{64}$/);
    expect(await writeLedger(storage, 'id', good, null)).toBeNull();
  });
});
