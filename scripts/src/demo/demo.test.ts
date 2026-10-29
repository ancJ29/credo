import {
  addEmployeeRequestSchema,
  clientCodeSchema,
  employeeSchema,
  saveEmployeeRequestSchema,
  staffSetupSchema,
  tenantConfigSchema,
} from '@credo/shared';
import { describe, expect, it } from 'vitest';
import { companyConfig, staffSetupOf } from './company';
import { addDays, atMinute, daysBetween, isSunday, vietnamToday } from './days';
import { allCopies, assertLedgerScenario, CLIENTS, copyOfCode, PARTNER_LABEL } from './mapping';
import { SCENARIO_IDS, SCENARIOS } from './scenarios';
import { ANCHOR, dayEvents, type Person, staffAsOf, uniqueName } from './staff';
import { streamOf } from './stream';

const FIRST_FILL = '2026-10-23';
const year = daysBetween(ANCHOR, addDays(ANCHOR, 365));
const everyone = (client: string, scenario: (typeof SCENARIO_IDS)[number]) => {
  const hires = year.flatMap((day) =>
    dayEvents(client, scenario, day).flatMap((e) => (e.kind === 'hire' ? [e.person] : [])),
  );
  return [...staffAsOf(client, scenario, ANCHOR), ...hires];
};

describe('the stream and the days', () => {
  it('draws the same numbers for the same parts, other numbers for other parts', () => {
    const draws = (...parts: string[]) => {
      const s = streamOf(...parts);
      return [s.next(), s.next(), s.next()];
    };
    expect(draws('A', 'S1')).toEqual(draws('A', 'S1'));
    expect(draws('A', 'S1')).not.toEqual(draws('A', 'S2'));
    expect(draws('A', 'S1').every((n) => n >= 0 && n < 1)).toBe(true);
  });

  it('chooses within bounds and by weight, the last item when the draw runs past', () => {
    const s = streamOf('x');
    for (let i = 0; i < 50; i++) expect(s.int(3)).toBeLessThan(3);
    expect(s.pick(['only'])).toBe('only');
    expect(
      s.weighted([
        { weight: 0, value: 'never' },
        { weight: 1, value: 'always' },
      ]),
    ).toBe('always');
    expect(s.chance(0)).toBe(false);
    expect(s.chance(1)).toBe(true);
    expect(streamOf('w').weighted([{ weight: 0, value: 'last' }])).toBe('last');
  });

  it('reads days as Vietnam written them, and refuses what is not a day', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(isSunday('2026-11-01')).toBe(true);
    expect(isSunday('2026-11-02')).toBe(false);
    expect(daysBetween('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
    expect(new Date(atMinute('2026-10-30', 450)).toISOString()).toBe('2026-10-30T00:30:00.000Z');
    expect(vietnamToday(Date.parse('2026-10-28T16:59:00Z'))).toBe('2026-10-28');
    expect(vietnamToday(Date.parse('2026-10-28T17:00:00Z'))).toBe('2026-10-29');
    expect(() => addDays('2026-02-30', 1)).toThrow('not a day');
    expect(() => addDays('30/10/2026', 1)).toThrow('not a day');
  });
});

describe('the scenarios', () => {
  it('row 3: S1 is building materials with drivers on class C, S2 drinks wholesale with routes and vans', () => {
    const s1 = staffAsOf('A', 'S1', FIRST_FILL);
    const s2 = staffAsOf('B', 'S2', FIRST_FILL);
    expect(new Set(s1.map((p) => p.department))).toEqual(
      new Set(SCENARIOS.S1.staff.departments.map((d) => d.name)),
    );
    expect(
      s1.filter((p) => p.department === 'Lái xe tải').every((p) => p.extra.licence === 'c'),
    ).toBe(true);
    expect(
      s2
        .filter((p) => p.department === 'Kinh doanh tuyến')
        .every((p) => String(p.extra.plate).includes('-X') || String(p.extra.plate).includes('-Y')),
    ).toBe(true);
    expect(s2.some((p) => p.department === 'Giao hàng' && p.extra.licence === 'b2')).toBe(true);
    const live = (people: Person[]) => people.filter((p) => !p.archived).length;
    expect(live(s1)).toBeGreaterThanOrEqual(40);
    expect(live(s1)).toBeLessThanOrEqual(50);
    expect(live(s2)).toBeGreaterThanOrEqual(54);
    expect(live(s2)).toBeLessThanOrEqual(66);
  });

  it('row 4: a copy starts as its people stood, start dates spread over the years before, and a week of days after', () => {
    const people = staffAsOf('A', 'S1', FIRST_FILL);
    const started = people.map((p) => String(p.extra.started)).sort();
    expect(started[0] < addDays(ANCHOR, -365 * 3)).toBe(true);
    expect(started.filter((d) => d < ANCHOR).length).toBeGreaterThan(people.length - 5);
    expect(people.some((p) => p.archived)).toBe(true);
    expect(people.every((p) => p.code.length > 0)).toBe(true);
    const week = daysBetween(addDays(FIRST_FILL, -7), FIRST_FILL).flatMap((d) =>
      dayEvents('A', 'S1', d),
    );
    expect(week.length).toBeLessThanOrEqual(7);
  });

  it('row 4: the last week of events falls inside the first fill, without a Sunday', () => {
    const days = daysBetween(ANCHOR, addDays(ANCHOR, 120));
    for (const scenario of SCENARIO_IDS) {
      const events = days.flatMap((d) => dayEvents('A', scenario, d).map((e) => ({ d, e })));
      expect(events.length).toBeGreaterThan(0);
      for (const { d, e } of events) {
        expect(isSunday(d)).toBe(false);
        const minutes = (e.at - atMinute(d, 0)) / 60_000;
        expect(minutes).toBeGreaterThanOrEqual(450);
        expect(minutes).toBeLessThanOrEqual(1050);
      }
    }
  });

  it('events come in time order, and a leaver is a code already in the list', () => {
    const codes = new Set(everyone('A', 'S1').map((p) => p.code));
    let leavers = 0;
    for (const d of year) {
      const events = dayEvents('A', 'S1', d);
      expect(events.map((e) => e.at)).toEqual([...events.map((e) => e.at)].sort((a, b) => a - b));
      for (const e of events)
        if (e.kind === 'leave') {
          leavers += 1;
          expect(codes.has(e.code)).toBe(true);
        }
    }
    expect(leavers).toBeGreaterThan(5);
  });

  it('a name already in the company is drawn again', () => {
    const first = uniqueName(streamOf('q'), new Set());
    const taken = new Set([first]);
    const second = uniqueName(streamOf('q'), taken);
    expect(second).not.toBe(first);
    expect(taken).toEqual(new Set([first, second]));
  });

  it('a day before the first day is refused', () => {
    expect(() => dayEvents('A', 'S1', '2026-09-30')).toThrow('before the first day');
    expect(() => staffAsOf('A', 'S1', '2026-09-30')).toThrow('before the first day');
  });
});

describe('determinism', () => {
  it('row 12: the same client, scenario and day give the same events, another day or client others', () => {
    const day = (client: string, scenario: 'S1' | 'S2', date: string) =>
      JSON.stringify(dayEvents(client, scenario, date));
    const days = daysBetween(ANCHOR, addDays(ANCHOR, 60));
    const all = (client: string, scenario: 'S1' | 'S2') =>
      days.map((d) => day(client, scenario, d));
    expect(all('A', 'S1')).toEqual(all('A', 'S1'));
    expect(all('A', 'S1')).not.toEqual(all('B', 'S1'));
    expect(all('A', 'S1')).not.toEqual(all('A', 'S2'));
    expect(new Set(all('A', 'S1').filter((s) => s !== '[]')).size).toBeGreaterThan(1);
    const hired = days.flatMap((d) =>
      dayEvents('A', 'S2', d).flatMap((e) => (e.kind === 'hire' ? [e.person.name] : [])),
    );
    expect(hired.length).toBeGreaterThan(2);
    expect(new Set(hired).size).toBeGreaterThan(1);
    expect(JSON.stringify(staffAsOf('A', 'S1', FIRST_FILL))).toBe(
      JSON.stringify(staffAsOf('A', 'S1', FIRST_FILL)),
    );
    expect(JSON.stringify(staffAsOf('A', 'S1', FIRST_FILL))).not.toBe(
      JSON.stringify(staffAsOf('B', 'S1', FIRST_FILL)),
    );
  });

  it('row 2: a company is a function of its client, never of a copy', () => {
    expect(companyConfig('A', CLIENTS.A.company)).toEqual(companyConfig('A', CLIENTS.A.company));
    expect(companyConfig('A', 'Vật liệu Quảng Tín Đạt').colour).toBe(
      companyConfig('A', 'Vật liệu Khác').colour,
    );
    expect(companyConfig('A', 'Vật liệu Quảng Tín Đạt').logo).not.toBe(
      companyConfig('A', 'Vật liệu Khác').logo,
    );
    expect(staffSetupOf('S1')).toEqual(staffSetupOf('S1'));
    expect(staffSetupOf('S1')).not.toEqual(staffSetupOf('S2'));
  });
});

describe('the schemas', () => {
  const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

  it('row 13: every scenario, 365 days, parses under the schemas the BFF reads it with', () => {
    for (const scenario of SCENARIO_IDS) {
      const config = companyConfig('A', 'Vật liệu Quảng Tín Đạt');
      expect(tenantConfigSchema.safeParse(config).success).toBe(true);
      const draft = staffSetupOf(scenario);
      const setup = {
        ...draft,
        departments: draft.departments.map((u, i) => ({ ...u, id: uuid(i + 1) })),
        positions: draft.positions.map((u, i) => ({ ...u, id: uuid(i + 11) })),
      };
      expect(staffSetupSchema.safeParse(setup).success).toBe(true);
      const departments = new Map(setup.departments.map((u) => [u.name, u.id]));
      const positions = new Map(setup.positions.map((u) => [u.name, u.id]));
      const check = (person: Person, n: number) => {
        expect(departments.has(person.department)).toBe(true);
        expect(positions.has(person.position)).toBe(true);
        const add = {
          name: person.name,
          code: person.code,
          extra: person.extra,
          departmentId: departments.get(person.department),
          positionId: positions.get(person.position),
        };
        expect(addEmployeeRequestSchema.safeParse(add).success).toBe(true);
        expect(
          saveEmployeeRequestSchema.safeParse({
            version: 'a'.repeat(64),
            name: person.name,
            extra: person.extra,
            permissions: person.permissions,
          }).success,
        ).toBe(true);
        expect(
          employeeSchema.safeParse({
            id: uuid(1000 + n),
            code: person.code,
            name: person.name,
            department: { id: add.departmentId, name: person.department },
            position: { id: add.positionId, name: person.position },
            permissions: person.permissions,
            archived: person.archived,
            extra: person.extra,
          }).success,
        ).toBe(true);
      };
      everyone('A', scenario).forEach(check);
    }
  });

  it('row 15: no list passes 500 records within 365 days, and codes are never repeated', () => {
    for (const scenario of SCENARIO_IDS) {
      const people = everyone('B', scenario);
      expect(people.length).toBeLessThan(500);
      expect(new Set(people.map((p) => p.code)).size).toBe(people.length);
    }
  });
});

describe('invented data only', () => {
  it('row 9: phones in one invented range, plates in a province that does not exist, no email', () => {
    for (const scenario of SCENARIO_IDS) {
      for (const person of everyone('A', scenario)) {
        expect(String(person.extra.phone)).toMatch(/^0600 \d{3} \d{3}$/);
        if (person.extra.personalPhone) expect(person.extra.personalPhone).toMatch(/^0600 /);
        if (person.extra.plate)
          expect(person.extra.plate).toMatch(/^00(\w-\d{3}\.\d{2}|-\w\d \d{3}\.\d{2})$/);
        expect(JSON.stringify(person)).not.toMatch(/@/);
      }
    }
    expect(JSON.stringify(companyConfig('B', 'x'))).not.toMatch(/@/);
  });
});

describe('the mapping', () => {
  it('row 14: codes are valid and unique, each scenario named exists, labels follow the walks rule', () => {
    const copies = allCopies();
    expect(copies).toHaveLength(6);
    expect(new Set(copies.map((c) => c.code)).size).toBe(copies.length);
    for (const copy of copies) {
      expect(clientCodeSchema.safeParse(copy.code).success).toBe(true);
      expect(SCENARIO_IDS).toContain(copy.scenario);
      expect(copy.partner).toMatch(PARTNER_LABEL);
    }
    expect(new Set(copies.map((c) => c.partner))).toEqual(new Set(['p1', 'p2', 'p3']));
    for (const client of Object.values(CLIENTS)) {
      expect(new Set(client.copies.map((c) => c.partner)).size).toBe(client.copies.length);
    }
    expect(PARTNER_LABEL.test('P1')).toBe(false);
    expect(PARTNER_LABEL.test('a@b')).toBe(false);
    expect(PARTNER_LABEL.test('a'.repeat(21))).toBe(false);
  });

  it('row 10: a code never shows a partner label, and is the company without marks and a number', () => {
    const labels = allCopies().map((c) => c.partner);
    const slug = (name: string) =>
      name
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .replaceAll(' ', '-');
    for (const copy of allCopies()) {
      for (const label of labels) expect(copy.code).not.toContain(label);
      expect(copy.code).toMatch(new RegExp(`^${slug(copy.company)}-[0-9]$`));
    }
  });

  it('row 1: two partners naming one client hold two copies of the same company', () => {
    const a = allCopies().filter((c) => c.client === 'A');
    expect(a).toHaveLength(3);
    expect(new Set(a.map((c) => c.code)).size).toBe(3);
    expect(new Set(a.map((c) => c.company)).size).toBe(1);
    expect(new Set(a.map((c) => c.scenario)).size).toBe(1);
  });

  it('row 21: a ledger naming another scenario than the mapping is refused, never switched', () => {
    expect(copyOfCode('vat-lieu-quang-tin-dat-1')?.scenario).toBe('S1');
    expect(copyOfCode('acme')).toBeUndefined();
    expect(() => assertLedgerScenario('vat-lieu-quang-tin-dat-1', 'S1')).not.toThrow();
    expect(() => assertLedgerScenario('vat-lieu-quang-tin-dat-1', 'S2')).toThrow(
      'the ledger names S2',
    );
    expect(() => assertLedgerScenario('check-1', 'S1')).toThrow('not in the mapping');
  });
});
