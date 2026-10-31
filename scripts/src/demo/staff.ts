import type { PermissionLayer } from '@credo/shared';
import { addDays, atMinute, daysBetween, isSunday } from './days';
import { type DepartmentProfile, MANAGER, SCENARIOS, type ScenarioId } from './scenarios';
import { type Stream, streamOf } from './stream';

/** The first day any scenario's data can be asked for: the staff's start dates and leave dates are
 * laid out around it, so the same day gives the same events whenever the copy was made. */
export const ANCHOR = '2026-10-01';
/** Leavers of the base staff fall in this many days after the anchor. */
const LEAVE_WINDOW = 365;
/** A hire stays 270 to 459 days, about a year, so leavers go on after the base staff's year and
 * standing staff stay within a quarter of the size: each hire has a leave day of its own, drawn
 * apart from the hire's draws. */
const MIN_TENURE = 270;
const TENURE_SPREAD = 190;
/** A working day's hours, in minutes after midnight: 07:30 to 17:30. */
const FIRST_MINUTE = 7 * 60 + 30;
const WORKING_MINUTES = 10 * 60;

/** A person as the generator makes them: the department and position by name (the BFF mints their
 * ids), and what goes in `extra`. */
export type Person = {
  code: string;
  name: string;
  department: string;
  position: string;
  permissions: PermissionLayer;
  archived: boolean;
  extra: Record<string, unknown>;
};

export type StaffEvent =
  { at: number; kind: 'hire'; person: Person } | { at: number; kind: 'leave'; code: string };

const FAMILY = [
  'Nguyễn',
  'Trần',
  'Lê',
  'Phạm',
  'Hoàng',
  'Huỳnh',
  'Phan',
  'Vũ',
  'Võ',
  'Đặng',
  'Bùi',
  'Đỗ',
  'Hồ',
  'Ngô',
  'Dương',
  'Lý',
];
const MIDDLE = {
  m: ['Văn', 'Hữu', 'Minh', 'Quốc', 'Đức', 'Thanh', 'Gia', 'Công'],
  f: ['Thị', 'Ngọc', 'Thu', 'Mai', 'Kim', 'Hoài', 'Bích', 'Phương'],
};
const GIVEN = {
  m: [
    'Hải',
    'Dũng',
    'Tuấn',
    'Khoa',
    'Long',
    'Phúc',
    'Sơn',
    'Thắng',
    'Việt',
    'Hiếu',
    'Lộc',
    'Nghĩa',
    'Quân',
    'Trung',
    'Vinh',
  ],
  f: [
    'Hạnh',
    'Linh',
    'Oanh',
    'Thảo',
    'Vân',
    'Yến',
    'Trang',
    'Nhung',
    'Diệp',
    'Hương',
    'Lụa',
    'Ngân',
    'Quyên',
    'Thùy',
    'Xuân',
  ],
};
const NOTES = ['Làm ca sáng.', 'Có thể làm thêm cuối tuần.', 'Đã qua đào tạo an toàn lao động.'];

const digits = (s: Stream, n: number) => Array.from({ length: n }, () => s.int(10)).join('');
/** One invented phone range, `0600`, that no operator assigns. */
export const phone = (s: Stream) => `0600 ${digits(s, 3)} ${digits(s, 3)}`;
/** Invented plates: a province `00` that does not exist. */
const plate = (s: Stream, kind: 'car' | 'moto') =>
  kind === 'car'
    ? `00${s.pick(['C', 'D', 'F'])}-${digits(s, 3)}.${digits(s, 2)}`
    : `00-${s.pick(['X1', 'X2', 'Y1'])} ${digits(s, 3)}.${digits(s, 2)}`;

function personName(s: Stream) {
  const sex = s.chance(0.5) ? 'm' : 'f';
  return `${s.pick(FAMILY)} ${s.pick(MIDDLE[sex])} ${s.pick(GIVEN[sex])}`;
}

type Draw = {
  code: string;
  department: DepartmentProfile;
  manager: boolean;
  startedOn: string;
  archived: boolean;
};

/** A name not yet in `taken`, drawn again until it is; it is added. */
export function uniqueName(s: Stream, taken: Set<string>) {
  let name = personName(s);
  while (taken.has(name)) name = personName(s);
  taken.add(name);
  return name;
}

function makePerson(scenario: ScenarioId, s: Stream, taken: Set<string>, draw: Draw): Person {
  const { positions } = SCENARIOS[scenario].staff;
  const position = draw.manager
    ? positions.find((p) => p.name === MANAGER)!
    : s.weighted(positions.map((value) => ({ weight: value.weight, value })));
  const name = uniqueName(s, taken);
  const extra: Record<string, unknown> = { phone: phone(s), started: draw.startedOn };
  if (s.chance(0.3)) extra.personalPhone = phone(s);
  if (draw.department.licences.length > 0) extra.licence = s.pick(draw.department.licences);
  if (draw.department.plate) extra.plate = plate(s, draw.department.plate);
  extra.dependants = s.int(4);
  if (s.chance(0.1)) extra.note = s.pick(NOTES);
  return {
    code: draw.code,
    name,
    department: draw.department.name,
    position: position.name,
    permissions: {},
    archived: draw.archived,
    extra,
  };
}

/** The day, or an error if it is before the anchor: the staff before it are not laid out. */
function fromAnchor(date: string) {
  if (date < ANCHOR) throw new Error(`${date} is before the first day, ${ANCHOR}`);
}

type Base = { person: Person; leaves: string | null };

/** The staff every copy of a client starts from: its people by department, the manager first, and
 * those who have since left, with the day each leaves. A function of the client and scenario. */
function baseStaff(client: string, scenario: ScenarioId): Base[] {
  const { staff } = SCENARIOS[scenario];
  const s = streamOf(client, scenario, 'base');
  const taken = new Set<string>();
  const total = staff.departments.reduce((sum, d) => sum + d.share, 0);
  const candidates = staff.headcount - staff.departments.length;
  const leaveChance = Math.min(1, (LEAVE_WINDOW * 6) / 7 / staff.leaveEvery / candidates);
  const base: Base[] = [];
  let number = 0;
  for (const department of staff.departments) {
    const count = Math.round((department.share / total) * staff.headcount);
    for (let i = 0; i < count; i++) {
      number += 1;
      const startedOn = addDays(ANCHOR, -(30 + s.int(8 * 365)));
      const person = makePerson(scenario, s, taken, {
        code: code(scenario, number),
        department,
        manager: i === 0,
        startedOn,
        archived: false,
      });
      let leaves: string | null = null;
      if (i > 0 && s.chance(leaveChance)) {
        leaves = addDays(ANCHOR, s.int(LEAVE_WINDOW));
        if (isSunday(leaves)) leaves = addDays(leaves, 1);
      }
      base.push({ person, leaves });
    }
  }
  for (let i = 0; i < staff.former; i++) {
    number += 1;
    const department = s.pick(staff.departments);
    const person = makePerson(scenario, s, taken, {
      code: code(scenario, number),
      department,
      manager: false,
      startedOn: addDays(ANCHOR, -(400 + s.int(1000))),
      archived: true,
    });
    base.push({ person, leaves: addDays(ANCHOR, -(10 + s.int(300))) });
  }
  return base;
}

function code(scenario: ScenarioId, number: number) {
  const { prefix, digits: width } = SCENARIOS[scenario].staff.numbering;
  return `${prefix}${String(number).padStart(width, '0')}`;
}

const hireCode = (scenario: ScenarioId, date: string) =>
  `${SCENARIOS[scenario].staff.numbering.prefix}H${date.slice(2).replaceAll('-', '')}`;

/** The hire of a day, if any: never on a Sunday; the code names the day, so it is unique. */
function hireOf(
  client: string,
  scenario: ScenarioId,
  date: string,
): { at: number; person: Person } | null {
  const { staff } = SCENARIOS[scenario];
  const s = streamOf(client, scenario, 'hire', date);
  if (isSunday(date) || !s.chance(1 / staff.hireEvery)) return null;
  const department = s.weighted(staff.departments.map((value) => ({ weight: value.share, value })));
  const person = makePerson(scenario, s, new Set(), {
    code: hireCode(scenario, date),
    department,
    manager: false,
    startedOn: date,
    archived: false,
  });
  return { at: atMinute(date, FIRST_MINUTE + s.int(WORKING_MINUTES)), person };
}

/** The day the hire of `date` leaves, never a Sunday, or null if that day has no hire. */
function hireLeaves(client: string, scenario: ScenarioId, date: string) {
  if (
    isSunday(date) ||
    !streamOf(client, scenario, 'hire', date).chance(1 / SCENARIOS[scenario].staff.hireEvery)
  )
    return null;
  const leaves = addDays(
    date,
    MIN_TENURE + streamOf(client, scenario, 'tenure', date).int(TENURE_SPREAD),
  );
  return isSunday(leaves) ? addDays(leaves, 1) : leaves;
}

/** What happens on a day: a hire, and the base staff and earlier hires who leave that day, in time
 * order. A pure function of the client, the scenario and the day. */
export function dayEvents(client: string, scenario: ScenarioId, date: string): StaffEvent[] {
  fromAnchor(date);
  const events: StaffEvent[] = [];
  const hire = hireOf(client, scenario, date);
  if (hire) events.push({ ...hire, kind: 'hire' });
  const leavers = baseStaff(client, scenario).flatMap(({ person, leaves }) =>
    leaves === date ? [person.code] : [],
  );
  // A hire leaves at least MIN_TENURE days on, at most one more for a Sunday.
  const earliest = addDays(date, -(MIN_TENURE + TENURE_SPREAD));
  for (const hired of daysBetween(
    earliest < ANCHOR ? ANCHOR : earliest,
    addDays(date, -MIN_TENURE + 1),
  )) {
    if (hireLeaves(client, scenario, hired) === date) leavers.push(hireCode(scenario, hired));
  }
  for (const code of leavers) {
    const s = streamOf(client, scenario, 'leave', code);
    events.push({ at: atMinute(date, FIRST_MINUTE + s.int(WORKING_MINUTES)), kind: 'leave', code });
  }
  return events.sort((a, b) => a.at - b.at);
}

/** The people as they stood on the morning of `from`: the base staff, those who left before it
 * archived, and everyone hired from the anchor up to it, those whose tenure ended before it archived. */
export function staffAsOf(client: string, scenario: ScenarioId, from: string): Person[] {
  fromAnchor(from);
  const people = baseStaff(client, scenario).map(({ person, leaves }) => ({
    ...person,
    archived: leaves !== null && leaves < from,
  }));
  for (const date of daysBetween(ANCHOR, from)) {
    const hire = hireOf(client, scenario, date);
    if (!hire) continue;
    const leaves = hireLeaves(client, scenario, date);
    people.push({ ...hire.person, archived: leaves !== null && leaves < from });
  }
  return people;
}
