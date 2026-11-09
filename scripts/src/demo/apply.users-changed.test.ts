import { type CStorageClient, employeeRoutes, recordKeys, ROUTES } from '@credo/shared';
import { describe, expect, it } from 'vitest';
import { applyCopy } from './apply';
import { staffSetupOf } from './company';
import { addDays } from './days';
import { writeLedger } from './ledger';
import { staffAsOf } from './staff';
import {
  A1,
  B1,
  fresh,
  make,
  tenantOf,
  staffOf,
  standing,
  read,
  firstEvent,
  hooked,
  asRoot,
  TODAY,
  useCStorage,
} from './apply-support';

useCStorage();

describe('what its users changed', () => {
  it('row 6: a leaver its users archived first, or whose code they changed, is skipped and named, never forced', async () => {
    const { day, event } = firstEvent(A1, 'leave');
    if (event.kind !== 'leave') throw new Error('a leave');
    for (const change of ['archived', 'recoded'] as const) {
      const storage = await fresh();
      const made = await make(storage, A1);
      await applyCopy(storage, A1, day);
      const root = await asRoot(storage, A1.code, made.password);
      const person = (await staffOf(storage, A1.code)).find((p) => p.code === event.code)!;
      const { version } = (await root('GET', employeeRoutes.one(person.id))).json<{
        version: string;
      }>();
      const reply =
        change === 'archived'
          ? await root('POST', employeeRoutes.archive(person.id), { version })
          : await root('PUT', employeeRoutes.code(person.id), { version, code: 'ZZ-9999' });
      expect(reply.statusCode).toBe(200);
      const lines: string[] = [];

      const report = await applyCopy(storage, A1, addDays(day, 1), (line) => lines.push(line));

      expect(report.status).toBe('ok');
      expect(report.skipped).toEqual([
        change === 'archived'
          ? `${event.code} has already left`
          : `${event.code} is not in the list`,
      ]);
      expect(
        lines.some((line) => line.includes(event.code) && line.includes('left as it is')),
      ).toBe(true);
      const after = (await staffOf(storage, A1.code)).find((p) => p.id === person.id)!;
      expect(after.archived).toBe(change === 'archived');
      expect(after.code).toBe(change === 'archived' ? event.code : 'ZZ-9999');
    }
  });

  it('row 6: a leaver its users changed between the read and the archive is a skip too', async () => {
    const { day, event } = firstEvent(A1, 'leave');
    const storage = await fresh();
    await make(storage, A1);
    await applyCopy(storage, A1, day);
    const moving = hooked(storage, {
      beforePut: async (key, data) => {
        const record = data as { archived?: boolean };
        if (key.includes('.employee.') && record.archived === true) {
          const found = (await storage.getRecord(key))!;
          const changed = { ...(found.data as { name: string }), name: 'Đã đổi tên' };
          await storage.putRecord(key, changed, found.tag);
        }
      },
    });

    const report = await applyCopy(moving, A1, addDays(day, 1));

    expect(report.status).toBe('ok');
    expect(report.skipped).toEqual([
      `${(event as { code: string }).code} was changed by its users`,
    ]);
  });

  it('row 6: a leaver gone between the read and the archive, a 404, is a skip too', async () => {
    const { day, event } = firstEvent(A1, 'leave');
    if (event.kind !== 'leave') throw new Error('a leave');
    const storage = await fresh();
    await make(storage, A1);
    await applyCopy(storage, A1, day);
    const person = (await staffOf(storage, A1.code)).find((p) => p.code === event.code)!;
    const key = recordKeys.tenant(await tenantOf(storage, A1.code)).employee(person.id);
    let reads = 0;
    const vanishing: CStorageClient = {
      ...storage,
      getRecord: (wanted) =>
        wanted === key && ++reads > 1 ? Promise.resolve(null) : storage.getRecord(wanted),
    };

    const report = await applyCopy(vanishing, A1, addDays(day, 1));

    expect(report.status).toBe('ok');
    expect(report.skipped).toEqual([`${event.code} was changed by its users`]);
  });

  it('row 6: a hire whose code its users used first is left as they made it', async () => {
    const { day, event } = firstEvent(B1, 'hire');
    if (event.kind !== 'hire') throw new Error('a hire');
    const storage = await fresh();
    const made = await make(storage, B1);
    await applyCopy(storage, B1, day);
    const root = await asRoot(storage, B1.code, made.password);
    const added = await root('POST', ROUTES.employees, {
      name: 'Người Khác',
      code: event.person.code,
      extra: {},
    });
    expect(added.statusCode).toBe(201);

    const report = await applyCopy(storage, B1, addDays(day, 1));

    expect(report.skipped).toEqual([`${event.person.code} is already there`]);
    const mine = (await staffOf(storage, B1.code)).find((p) => p.code === event.person.code)!;
    expect(mine.name).toBe('Người Khác');
  });

  it('row 6: a first fill that stopped halfway is finished by the next run, what is there kept', async () => {
    const storage = await fresh();
    const made = await make(storage, A1);
    const root = await asRoot(storage, A1.code, made.password);
    const id = await tenantOf(storage, A1.code);
    const firstDay = addDays(TODAY, -7);
    const stopped = {
      client: 'A',
      scenario: 'S1' as const,
      firstDay,
      lastDay: addDays(firstDay, -1),
      filled: false,
    };
    expect(await writeLedger(storage, id, stopped, null)).not.toBeNull();
    const setup = (await root('GET', ROUTES.staffSetup)).json<{ version: string }>();
    expect(
      (await root('PUT', ROUTES.staffSetup, { setup: staffSetupOf('S1'), version: setup.version }))
        .statusCode,
    ).toBe(200);
    const [one] = staffAsOf('A', 'S1', firstDay);
    expect(
      (await root('POST', ROUTES.employees, { name: one.name, code: one.code, extra: {} }))
        .statusCode,
    ).toBe(201);

    const report = await applyCopy(storage, A1, TODAY);

    expect(report).toMatchObject({
      status: 'ok',
      filled: true,
      skipped: [`${one.code} is already there`],
    });
    expect(read(await staffOf(storage, A1.code))).toEqual(standing(A1, TODAY));
  });
});
