import { ROUTES, type StaffSetupDoc } from '@credo/shared';
import { describe, expect, it } from 'vitest';
import { applyCopy } from './apply';
import { staffSetupOf } from './company';
import { addDays } from './days';
import { writeLedger } from './ledger';
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
  down,
  asRoot,
  TODAY,
  useCStorage,
} from './apply-support';

useCStorage();

describe('what its users changed, after a cut or a rename', () => {
  it('row 6: a fill cut between a former person’s add and archive is finished by the next run, that person archived', async () => {
    const storage = await fresh();
    await make(storage, A1);
    let cut = false;
    const dying = hooked(storage, {
      beforePut: (key, data) => {
        if (!cut && key.includes('.employee.') && (data as { archived?: boolean }).archived) {
          cut = true;
          return Promise.reject(down());
        }
        return Promise.resolve();
      },
    });
    await expect(applyCopy(dying, A1, TODAY)).rejects.toThrow(/archive answered 5\d\d/);

    const report = await applyCopy(storage, A1, TODAY);

    expect(report.status).toBe('ok');
    expect(read(await staffOf(storage, A1.code))).toEqual(standing(A1, TODAY));
  });

  it('row 6: a hire into a department or position its users renamed is skipped and named, never added with none in silence', async () => {
    const { day, event } = firstEvent(B1, 'hire');
    if (event.kind !== 'hire') throw new Error('a hire');
    for (const unit of ['departments', 'positions'] as const) {
      const storage = await fresh();
      const made = await make(storage, B1);
      await applyCopy(storage, B1, day);
      const root = await asRoot(storage, B1.code, made.password);
      const doc = (await root('GET', ROUTES.staffSetup)).json<StaffSetupDoc>();
      const taken = unit === 'departments' ? event.person.department : event.person.position;
      const setup = {
        ...doc.setup,
        [unit]: doc.setup[unit].map((u) =>
          u.name === taken ? { ...u, name: `${u.name} mới` } : u,
        ),
      };
      expect(
        (await root('PUT', ROUTES.staffSetup, { setup, version: doc.version })).statusCode,
      ).toBe(200);
      const lines: string[] = [];

      const report = await applyCopy(storage, B1, addDays(day, 1), (line) => lines.push(line));

      expect(report.status).toBe('ok');
      expect(report.skipped).toEqual([
        `${event.person.code}: its department or position is no longer there`,
      ]);
      expect(lines.some((line) => line.includes(event.person.code) && line.includes('left'))).toBe(
        true,
      );
      expect((await staffOf(storage, B1.code)).some((p) => p.code === event.person.code)).toBe(
        false,
      );
    }
  });

  it('row 6: a staff setup its users changed before a cut fill is finished is kept, never saved over', async () => {
    const storage = await fresh();
    const made = await make(storage, A1);
    const root = await asRoot(storage, A1.code, made.password);
    const id = await tenantOf(storage, A1.code);
    const firstDay = addDays(TODAY, -7);
    await writeLedger(
      storage,
      id,
      {
        client: 'A',
        scenario: 'S1',
        firstDay,
        lastDay: addDays(firstDay, -1),
        filled: false,
      },
      null,
    );
    const doc = (await root('GET', ROUTES.staffSetup)).json<{ version: string }>();
    const own = staffSetupOf('S1');
    const mine = {
      ...own,
      departments: [...own.departments, { name: 'Phòng mới', permissions: {}, extra: {} }],
    };
    expect(
      (await root('PUT', ROUTES.staffSetup, { setup: mine, version: doc.version })).statusCode,
    ).toBe(200);

    expect((await applyCopy(storage, A1, TODAY)).status).toBe('ok');

    const after = (await root('GET', ROUTES.staffSetup)).json<StaffSetupDoc>();
    expect(after.setup.departments.map((u) => u.name)).toContain('Phòng mới');
  });
});
