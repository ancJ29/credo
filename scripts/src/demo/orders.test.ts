import { describe, expect, it } from 'vitest';
import { addDays, atMinute, daysBetween, isSunday } from './days';
import { staffSetupOf } from './company';
import { customersOf, productsOf } from './lists';
import { nextWorkingDay, plannedDeliveries, plannedOrders, previousWorkingDay } from './orders';
import { closeOf } from './reconcile';
import { SCENARIO_IDS, SCENARIOS } from './scenarios';

const CLIENT_OF = { S1: 'A', S2: 'B' } as const;
const MONTH = daysBetween('2026-10-01', '2026-11-01');
const MINUTE = 60_000;
/** The minute of the day, Vietnam's, a moment falls on. */
const minuteOf = (day: string, at: number) => (at - atMinute(day, 0)) / MINUTE;

describe('the demo week’s orders', () => {
  it.each(SCENARIO_IDS)(
    'row 13: %s makes about its rate of orders every working day and none on a Sunday',
    (scenario) => {
      const client = CLIENT_OF[scenario];
      const { perDay } = SCENARIOS[scenario].orders;
      const counts = MONTH.filter((day) => !isSunday(day)).map(
        (day) => plannedOrders(client, scenario, day).length,
      );

      expect(counts.every((count) => count >= perDay * 0.8 && count <= perDay * 1.2)).toBe(true);
      const mean = counts.reduce((sum, count) => sum + count, 0) / counts.length;
      expect(Math.abs(mean - perDay)).toBeLessThan(perDay * 0.1);
      for (const day of MONTH.filter(isSunday)) {
        expect(plannedOrders(client, scenario, day)).toEqual([]);
      }
    },
  );

  it.each(SCENARIO_IDS)(
    'row 13: %s orders are made between 07:30 and 17:30 from its own customers and products, most sent, a few left drafts, a few cancelled',
    (scenario) => {
      const client = CLIENT_OF[scenario];
      const customers = new Set(customersOf(client, scenario).map((one) => one.code));
      const products = new Map(productsOf(client, scenario).map((one) => [one.code, one]));
      const all = MONTH.flatMap((day) =>
        plannedOrders(client, scenario, day).map((order) => ({ day, order })),
      );
      const share = (outcome: string) =>
        all.filter(({ order }) => order.outcome === outcome).length / all.length;

      for (const { day, order } of all) {
        expect(minuteOf(day, order.madeAt)).toBeGreaterThanOrEqual(7 * 60 + 30);
        expect(minuteOf(day, order.madeAt)).toBeLessThan(17 * 60 + 31);
        expect(customers.has(order.customer)).toBe(true);
        expect(new Set(order.lines.map((line) => line.product)).size).toBe(order.lines.length);
        for (const line of order.lines) {
          expect(products.has(line.product)).toBe(true);
          expect(line.quantity).toBeGreaterThanOrEqual(1);
        }
        expect(order.sendFor === day || order.sendFor === nextWorkingDay(day)).toBe(true);
        expect(isSunday(order.sendFor)).toBe(false);
      }
      expect(share('confirmed')).toBeGreaterThan(0.85);
      expect(share('draft')).toBeGreaterThan(0);
      expect(share('draft')).toBeLessThan(0.12);
      expect(share('cancelled')).toBeGreaterThan(0);
      expect(share('cancelled')).toBeLessThan(0.12);
    },
  );

  it('row 13: S1’s transport fee is a line on some of its orders, and S1’s big loads are a few units', () => {
    const lines = MONTH.flatMap((day) => plannedOrders('A', 'S1', day)).flatMap((one) => one.lines);
    const products = new Map(productsOf('A', 'S1').map((one) => [one.code, one]));

    expect(
      lines.some((line) => products.get(line.product)!.name === 'Cước vận chuyển theo chuyến'),
    ).toBe(true);
    for (const line of lines) {
      const { unit } = products.get(line.product)!;
      if (unit === 'tấn') expect(line.quantity).toBeLessThanOrEqual(5);
    }
  });

  it('row 13: the same client gives the same orders on a day, another client other ones', () => {
    expect(plannedOrders('A', 'S1', '2026-10-27')).toEqual(plannedOrders('A', 'S1', '2026-10-27'));
    expect(plannedOrders('A2', 'S1', '2026-10-27')).not.toEqual(
      plannedOrders('A', 'S1', '2026-10-27'),
    );
  });

  it('row 27: no day’s list of any scenario passes 500 within 365 days', () => {
    for (const scenario of SCENARIO_IDS) {
      const { perDay } = SCENARIOS[scenario].orders;
      expect(perDay + Math.ceil(perDay / 5)).toBeLessThan(500);
    }
  });

  it('row 13: working days skip Sundays', () => {
    expect(nextWorkingDay('2026-10-31')).toBe('2026-11-02');
    expect(nextWorkingDay('2026-10-28')).toBe('2026-10-29');
    expect(previousWorkingDay('2026-11-02')).toBe('2026-10-31');
    expect(previousWorkingDay('2026-10-28')).toBe('2026-10-27');
  });
});

describe('the demo week’s deliveries', () => {
  it.each(SCENARIO_IDS)(
    'row 9: every %s request is delivered on its day, after it was sent and by 17:30',
    (scenario) => {
      const client = CLIENT_OF[scenario];
      for (const day of MONTH.filter((one) => !isSunday(one))) {
        const planned = plannedDeliveries(client, scenario, day);
        for (const order of planned) {
          expect(order.outcome).toBe('confirmed');
          expect(order.sendFor).toBe(day);
          expect(order.deliverAt).toBeGreaterThan(order.sentAt);
          expect(minuteOf(day, order.deliverAt)).toBeLessThan(17 * 60 + 31);
          expect(minuteOf(day, order.deliverAt)).toBeGreaterThanOrEqual(7 * 60 + 30);
        }
        expect(planned.map((one) => one.deliverAt)).toEqual(
          planned.map((one) => one.deliverAt).sort((a, b) => a - b),
        );
      }
    },
  );

  it('row 9: a day’s requests come from its own orders and the working day before’s, and none on a Sunday', () => {
    const monday = '2026-10-26';
    const fromSaturday = plannedOrders('A', 'S1', addDays(monday, -2)).filter(
      (one) => one.outcome === 'confirmed' && one.sendFor === monday,
    );
    const fromMonday = plannedOrders('A', 'S1', monday).filter(
      (one) => one.outcome === 'confirmed' && one.sendFor === monday,
    );

    expect(plannedDeliveries('A', 'S1', monday)).toHaveLength(
      fromSaturday.length + fromMonday.length,
    );
    expect(fromSaturday.length).toBeGreaterThan(0);
    expect(plannedDeliveries('A', 'S1', addDays(monday, -1))).toEqual([]);
  });
});

describe('the demo week’s closed days', () => {
  it('row 9: most drivers hand in exactly the sum, about one in five is short by 5,000 to 50,000 in steps of 5,000, some are over, never below 0, and the close falls after 17:45', () => {
    const days = MONTH.filter((day) => !isSunday(day));
    const closes = days.flatMap((day) =>
      ['EMP-1', 'EMP-2', 'EMP-3', 'EMP-4', 'EMP-5', 'EMP-6', 'EMP-7', 'EMP-8'].map((driver) => ({
        day,
        ...closeOf('A', 'S1', day, driver, 3_000_000),
      })),
    );
    const gaps = closes.map(({ handedIn }) => handedIn - 3_000_000);
    const short = gaps.filter((gap) => gap < 0);
    const over = gaps.filter((gap) => gap > 0);

    expect(gaps.filter((gap) => gap === 0).length / gaps.length).toBeGreaterThan(0.65);
    expect(short.length / gaps.length).toBeGreaterThan(0.1);
    expect(short.length / gaps.length).toBeLessThan(0.3);
    expect(over.length).toBeGreaterThan(0);
    expect(short.every((gap) => gap >= -50000 && gap % 5000 === 0)).toBe(true);
    expect(over.every((gap) => gap <= 20000 && gap % 5000 === 0)).toBe(true);
    for (const { day, at } of closes) {
      expect(minuteOf(day, at)).toBeGreaterThanOrEqual(17 * 60 + 45);
      expect(minuteOf(day, at)).toBeLessThan(18 * 60 + 15);
    }
    expect(closeOf('A', 'S1', '2026-10-27', 'EMP-1', 3_000_000)).toEqual(
      closeOf('A', 'S1', '2026-10-27', 'EMP-1', 3_000_000),
    );
  });

  it('row 9: a driver whose sum is small is never short past it', () => {
    for (const day of MONTH) {
      const { handedIn } = closeOf('B', 'S2', day, 'EMP-9', 10_000);
      expect(handedIn).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('the rights the orders block sets', () => {
  it.each(SCENARIO_IDS)(
    'row 1: %s’s office may see and make orders, its drivers may deliver, and the root may show a person their QR code',
    (scenario) => {
      const setup = staffSetupOf(scenario);
      const { closer } = SCENARIOS[scenario].reconciliation;
      const office = setup.departments.find((one) => one.name === closer)!;
      const drivers = SCENARIOS[scenario].staff.departments.filter((one) => one.plate === 'car');

      expect(office.permissions).toMatchObject({ 'orders.canView': true, 'orders.canEdit': true });
      expect(drivers.length).toBeGreaterThan(0);
      for (const one of drivers) {
        expect(setup.departments.find((unit) => unit.name === one.name)!.permissions).toEqual({
          'deliveries.canDeliver': true,
        });
      }
      expect(setup.fields?.qr).toBe(true);
    },
  );
});
