import { describe, expect, it } from 'vitest';
import { DEMO_DELIVERIES, DEMO_EMPLOYEES, DEMO_RECONCILIATIONS, DEMO_TODAY } from './demo';
import { addDays, type DeliveryRequest, TOTAL_MAX } from './orders';
import {
  closeDayRequestSchema,
  closeRequestFor,
  driverDay,
  gapOf,
  handedInSchema,
  reconciliationListReplySchema,
  reconciliationSchema,
  sameIds,
} from './reconciliations';
import { recordKeys } from './records';
import { reconciliationRoutes } from './wire';

const driver = (code: string) => DEMO_EMPLOYEES.find((one) => one.code === code)!;
const today = DEMO_DELIVERIES.filter((one) => one.day === DEMO_TODAY);

describe('a driver’s day', () => {
  it('A driver’s day opened lists the requests they delivered that day, and the sum to collect; those still waiting are listed apart, with nothing to collect; a cancelled one is left out', () => {
    const day = driverDay(today, driver('EMP-0005').id);

    expect(day.delivered.map((one) => one.state)).toEqual(['delivered']);
    expect(day.waiting.map((one) => one.state)).toEqual(['waiting']);
    expect(today.filter((one) => one.driver.code === 'EMP-0005')).toHaveLength(3);
    const all = [...day.delivered, ...day.waiting].map((one) => one.number);
    expect(all).not.toContain(
      today.find((one) => one.driver.code === 'EMP-0005' && one.state === 'cancelled')!.number,
    );
    // the waiting one adds nothing to collect
    expect(day.toCollect).toBe(day.delivered[0].total);
    expect(day.waiting[0].total).toBeGreaterThan(0);
    expect(day.tooLarge).toBe(false);
  });

  it('The sum to collect is made from the delivered requests’ totals, never typed: the close names the requests and the cash, and no sum', () => {
    const tens = (count: number): DeliveryRequest[] =>
      [...Array(count).keys()].map((index) => ({
        ...today[0],
        id: `00000000-0000-4000-8000-0000000009${String(index).padStart(2, '0')}`,
        number: `GH-000${90 + index}`,
        state: 'delivered' as const,
        total: 10_000 + index,
      }));
    const waiting: DeliveryRequest = {
      ...today[0],
      id: '00000000-0000-4000-8000-000000000990',
      number: 'GH-00990',
      state: 'waiting',
    };
    const day = driverDay([...tens(3), waiting], today[0].driver.id);

    expect(day.toCollect).toBe(10_000 + 10_001 + 10_002);
    const asked = closeRequestFor(day, 30_000);
    expect(asked).toEqual({
      delivered: day.delivered.map((one) => one.id),
      waiting: [waiting.id],
      handedIn: 30_000,
    });
    // a sum typed beside them is refused: the app makes it
    expect(closeDayRequestSchema.safeParse({ ...asked, toCollect: 30_003 }).success).toBe(false);
    expect(closeDayRequestSchema.safeParse(asked).success).toBe(true);
  });

  it('A driver’s day is summed in one place, whoever asks: another driver’s requests never enter it, and a day past TOTAL_MAX cannot close', () => {
    const other = driverDay(today, driver('EMP-0006').id);

    expect(other.delivered).toEqual([]);
    expect(other.waiting).toHaveLength(2);
    expect(other.toCollect).toBe(0);
    const big = { ...today.find((one) => one.state === 'delivered')!, total: TOTAL_MAX };
    const twice = [big, { ...big, id: '00000000-0000-4000-8000-000000000998', number: 'GH-00998' }];

    expect(driverDay(twice, big.driver.id)).toMatchObject({
      toCollect: 2 * TOTAL_MAX,
      tooLarge: true,
    });
    expect(driverDay([big], big.driver.id).tooLarge).toBe(false);
  });
});

describe('the cash handed in', () => {
  it('The cash is whole đồng from 0, and the difference is handed in minus to collect: exact, short or over; nothing is rounded', () => {
    expect(handedInSchema.safeParse(0).success).toBe(true);
    expect(handedInSchema.safeParse(TOTAL_MAX).success).toBe(true);
    for (const bad of [-1, 1.5, 100_000.4, TOTAL_MAX + 1, Number.NaN, '100000']) {
      expect(handedInSchema.safeParse(bad).success, String(bad)).toBe(false);
    }
    expect(gapOf(150_000, 150_000)).toBe(0);
    expect(gapOf(150_000, 130_000)).toBe(-20_000);
    expect(gapOf(150_000, 150_001)).toBe(1);
  });

  it('Every amount is an integer of đồng: a record with a fractional amount is refused', () => {
    const record = DEMO_RECONCILIATIONS[0];

    expect(reconciliationSchema.safeParse(record).success).toBe(true);
    for (const field of ['toCollect', 'handedIn', 'difference'] as const) {
      expect(reconciliationSchema.safeParse({ ...record, [field]: 0.5 }).success, field).toBe(
        false,
      );
    }
    expect(
      reconciliationSchema.safeParse({
        ...record,
        requests: [{ ...record.requests[0], total: 10.5 }],
      }).success,
    ).toBe(false);
  });
});

describe('a closed day', () => {
  it('A closed day is one record built by recordKeys, a day’s are one prefix read, and the routes name the day and the driver', () => {
    const keys = recordKeys.tenant('t1');

    expect(keys.reconciliation('2026-11-03', 'd1')).toBe('tenant.t1.reconciliation.2026-11-03.d1');
    expect(
      keys
        .reconciliation('2026-11-03', 'd1')
        .startsWith(keys.reconciliationDayPrefix('2026-11-03')),
    ).toBe(true);
    expect(keys.reconciliationDayPrefix('2026-11-03')).toBe('tenant.t1.reconciliation.2026-11-03.');
    expect(reconciliationRoutes.list('2026-11-03')).toBe('/api/reconciliations?day=2026-11-03');
    expect(reconciliationRoutes.close('2026-11-03', 'd1')).toBe(
      '/api/reconciliations/2026-11-03/d1/close',
    );
    expect(
      reconciliationListReplySchema.safeParse({ reconciliations: DEMO_RECONCILIATIONS }).success,
    ).toBe(true);
    // a record keeps no field the schema does not name
    expect(reconciliationSchema.safeParse({ ...DEMO_RECONCILIATIONS[0], note: 'x' }).success).toBe(
      false,
    );
  });

  it('Two lists name the same requests whatever their order', () => {
    expect(sameIds(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameIds(['a', 'b'], ['a', 'c'])).toBe(false);
    expect(sameIds(['a'], ['a', 'a'])).toBe(false);
    expect(sameIds([], [])).toBe(true);
  });

  it('The data set closes every driver’s day before today at 17:45 by EMP-0001, exact but yesterday’s EMP-0006, short 20,000 đồng; today’s are open', () => {
    const manager = driver('EMP-0001');

    expect(DEMO_RECONCILIATIONS.every((one) => one.day < DEMO_TODAY)).toBe(true);
    expect(new Set(DEMO_RECONCILIATIONS.map((one) => one.closedBy.code))).toEqual(
      new Set(['EMP-0001']),
    );
    expect(DEMO_RECONCILIATIONS.every((one) => one.closedBy.id === manager.id)).toBe(true);
    const short = DEMO_RECONCILIATIONS.filter((one) => one.difference !== 0);
    expect(short.map((one) => [one.day, one.driver.code, one.difference])).toEqual([
      [addDays(DEMO_TODAY, -1), 'EMP-0006', -20_000],
    ]);
    // each closed day is its driver's delivered requests of that day, summed
    for (const one of DEMO_RECONCILIATIONS) {
      const mine = driverDay(
        DEMO_DELIVERIES.filter((request) => request.day === one.day),
        one.driver.id,
      );
      expect(one.requests.map((request) => request.id)).toEqual(
        mine.delivered.map((request) => request.id),
      );
      expect(one.toCollect).toBe(mine.toCollect);
      expect(one.difference).toBe(gapOf(one.toCollect, one.handedIn));
      expect(new Date(one.closedAt).toISOString()).toBe(`${one.day}T10:45:00.000Z`);
    }
    // one a driver a day
    const keys = DEMO_RECONCILIATIONS.map((one) => `${one.day}.${one.driver.id}`);
    expect(new Set(keys).size).toBe(keys.length);
    // every driver who had a request on a past day has it closed, a cancelled-only day with 0
    const asked = new Set(
      DEMO_DELIVERIES.filter((one) => one.day < DEMO_TODAY).map(
        (one) => `${one.day}.${one.driver.id}`,
      ),
    );
    expect(new Set(keys)).toEqual(asked);
    expect(
      DEMO_RECONCILIATIONS.some((one) => one.requests.length === 0 && one.toCollect === 0),
    ).toBe(true);
  });
});
