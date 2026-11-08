import { ROOT_NAME } from '@credo/bff/clients';
import { employeeRoutes, normaliseSignInName, recordKeys, tenantConfigSchema } from '@credo/shared';
import { describe, expect, it } from 'vitest';
import { applyCopy, HISTORY_DAYS, MAX_CATCH_UP } from './apply';
import { addDays, atMinute } from './days';
import { readLedger, SEED_BLOCKS } from './ledger';
import { staffAsOf } from './staff';
import {
  A1,
  A2,
  B1,
  fresh,
  make,
  tenantOf,
  staffOf,
  everything,
  standing,
  read,
  firstEvent,
  hooked,
  down,
  asRoot,
  TODAY,
  useCStorage,
} from './apply-support';

useCStorage();

describe('a copy brought up to yesterday', () => {
  it('row 5: a new copy holds its company and its staff as they stand, each day to yesterday applied, none after it', async () => {
    const storage = await fresh();
    await make(storage, B1);
    const lines: string[] = [];

    const report = await applyCopy(storage, B1, TODAY, (line) => lines.push(line));

    expect(report).toMatchObject({ code: B1.code, status: 'ok', filled: true, skipped: [] });
    expect(report.days).toHaveLength(HISTORY_DAYS);
    expect(report.days.at(-1)).toBe('2026-10-28');
    expect(read(await staffOf(storage, B1.code))).toEqual(standing(B1, TODAY));
    const id = await tenantOf(storage, B1.code);
    const config = tenantConfigSchema.parse(
      (await storage.getRecord(recordKeys.tenant(id).config))!.data,
    );
    expect(config.name).toBe(B1.company);
    expect((await readLedger(storage, id))!.ledger).toEqual({
      client: 'B',
      scenario: 'S2',
      firstDay: '2026-10-22',
      lastDay: '2026-10-28',
      filled: true,
      blocks: [...SEED_BLOCKS],
    });
    expect(lines.some((line) => line.includes('filled as of 2026-10-22'))).toBe(true);
  });

  it('row 16: each event is written with the BFF’s clock at its time, and no date is after yesterday', async () => {
    const storage = await fresh();
    await make(storage, B1);
    const { day, event } = firstEvent(B1, 'hire');
    if (event.kind !== 'hire') throw new Error('a hire');
    const today = addDays(day, 3);

    await applyCopy(storage, B1, today);

    const id = await tenantOf(storage, B1.code);
    const user = await storage.getRecord(
      recordKeys.tenant(id).user(normaliseSignInName(event.person.code)),
    );
    expect((user!.data as { passwordAt: number }).passwordAt).toBe(event.at);
    const people = await staffOf(storage, B1.code);
    const yesterday = addDays(today, -1);
    expect(people.every((p) => String(p.extra.started) <= yesterday)).toBe(true);
    expect((await readLedger(storage, id))!.ledger.lastDay).toBe(yesterday);
  });

  it('row 16: the first fill is written with the BFF’s clock at the morning of its first day', async () => {
    const storage = await fresh();
    await make(storage, B1);

    await applyCopy(storage, B1, TODAY);

    const id = await tenantOf(storage, B1.code);
    const [one] = staffAsOf('B', 'S2', addDays(TODAY, -7));
    const user = await storage.getRecord(recordKeys.tenant(id).user(normaliseSignInName(one.code)));
    expect((user!.data as { passwordAt: number }).passwordAt).toBe(
      atMinute(addDays(TODAY, -7), 6 * 60),
    );
  });

  it('row 17: a second run adds nothing, and a run after k missed days adds those k, in order', async () => {
    const storage = await fresh();
    await make(storage, B1);
    await applyCopy(storage, B1, TODAY);
    const before = JSON.stringify(await everything(storage, B1.code));

    const again = await applyCopy(storage, B1, TODAY);

    expect(again).toMatchObject({ status: 'ok', filled: false, days: [] });
    expect(JSON.stringify(await everything(storage, B1.code))).toBe(before);

    const later = await applyCopy(storage, B1, addDays(TODAY, 3));

    expect(later.days).toEqual(['2026-10-29', '2026-10-30', '2026-10-31']);
    expect(read(await staffOf(storage, B1.code))).toEqual(standing(B1, addDays(TODAY, 3)));
  });

  it('row 17: more than 30 missed days is reported and left, nothing applied', async () => {
    const storage = await fresh();
    await make(storage, A1);
    await applyCopy(storage, A1, TODAY);
    const before = JSON.stringify(await everything(storage, A1.code));

    const report = await applyCopy(storage, A1, addDays(TODAY, MAX_CATCH_UP + 1));

    expect(report).toMatchObject({ status: 'too-far', days: [] });
    expect(JSON.stringify(await everything(storage, A1.code))).toBe(before);
    const edge = await applyCopy(storage, A1, addDays(TODAY, MAX_CATCH_UP));
    expect(edge.status).toBe('ok');
    expect(edge.days).toHaveLength(MAX_CATCH_UP);
  });

  it('row 17: a run with a limit applies the oldest days up to it, says how many it left, and the next run goes on from the ledger', async () => {
    const storage = await fresh();
    await make(storage, B1);
    await applyCopy(storage, B1, TODAY);
    const id = await tenantOf(storage, B1.code);
    const lines: string[] = [];

    const first = await applyCopy(storage, B1, addDays(TODAY, 5), (l) => lines.push(l), 2);

    expect(first).toMatchObject({ status: 'ok', remaining: 3, days: ['2026-10-29', '2026-10-30'] });
    expect((await readLedger(storage, id))!.ledger.lastDay).toBe('2026-10-30');
    expect(lines.at(-1)).toBe(
      `${B1.code}: up to 2026-10-30, 3 days still behind 2026-11-02, left for the next runs`,
    );
    const second = await applyCopy(storage, B1, addDays(TODAY, 5), undefined, 2);
    expect(second).toMatchObject({ remaining: 1, days: ['2026-10-31', '2026-11-01'] });
    const last = await applyCopy(storage, B1, addDays(TODAY, 5), undefined, 2);
    expect(last).toMatchObject({ status: 'ok', remaining: 0, days: ['2026-11-02'] });
    expect(read(await staffOf(storage, B1.code))).toEqual(standing(B1, addDays(TODAY, 5)));
  });

  it('row 17: a run cut on the second of three missed days leaves the ledger on the first, and the next run applies the other two', async () => {
    const storage = await fresh();
    await make(storage, B1);
    await applyCopy(storage, B1, TODAY);
    const id = await tenantOf(storage, B1.code);
    let opens = 0;
    const cutting = hooked(storage, {
      // The days' opening sessions are the root's; a driver's or the office's is not a day's.
      beforePut: (key, data) =>
        key.startsWith(`tenant.${id}.session.`) &&
        (data as { user: string }).user === ROOT_NAME &&
        ++opens === 2
          ? Promise.reject(down())
          : Promise.resolve(),
    });
    await expect(applyCopy(cutting, B1, addDays(TODAY, 3))).rejects.toThrow();
    expect((await readLedger(storage, id))!.ledger.lastDay).toBe(TODAY);

    const report = await applyCopy(storage, B1, addDays(TODAY, 3));

    expect(report.days).toEqual([addDays(TODAY, 1), addDays(TODAY, 2)]);
  });

  it('row 1: two partners’ copies of one client are two clients, so what one does never shows in the other', async () => {
    const storage = await fresh();
    const one = await make(storage, A1);
    await make(storage, A2);
    await applyCopy(storage, A1, TODAY);
    await applyCopy(storage, A2, TODAY);
    expect(await tenantOf(storage, A1.code)).not.toBe(await tenantOf(storage, A2.code));
    const first = await staffOf(storage, A1.code);
    expect(read(first)).toEqual(read(await staffOf(storage, A2.code)));

    const root = await asRoot(storage, A1.code, one.password);
    const target = first.find((p) => !p.archived)!;
    const doc = (await root('GET', employeeRoutes.one(target.id))).json<{ version: string }>();
    expect(
      (await root('POST', employeeRoutes.archive(target.id), { version: doc.version })).statusCode,
    ).toBe(200);

    expect((await staffOf(storage, A1.code)).find((p) => p.code === target.code)!.archived).toBe(
      true,
    );
    expect((await staffOf(storage, A2.code)).find((p) => p.code === target.code)!.archived).toBe(
      false,
    );
  });
});
