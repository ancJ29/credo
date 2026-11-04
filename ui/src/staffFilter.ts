import {
  type CustomField,
  type Employee,
  fieldValueShown,
  type Language,
  type StaffSetup,
} from '@credo/shared';
import { phoneOf, unitName } from './staffNames';

/** Who the list holds: people still working (the default), people who left, or everyone. */
export type Status = 'active' | 'inactive' | 'all';

/** What narrows the staff list: typed words, a department, a position, a status, and a choice for
 * each of the company's choice fields shown in the list. */
export type Criteria = {
  q: string;
  department: string;
  position: string;
  status: Status;
  /** The chosen option's key, by the field's key. */
  choices: Record<string, string>;
};

const CHOICE = 'f.';

/** The status an address names; an old link's `left=1` meant everyone, so it is All; anything else
 * is Active. */
const statusOf = (value: string | null, left: string | null): Status =>
  value === 'inactive' || value === 'all'
    ? value
    : value === null && left === '1'
      ? 'all'
      : 'active';

/** A name inside a sentence: its first letter lowered, unless its first word is an acronym
 * ("CCCD", "GPLX"), which stays as written. */
export function lowerFirst(name: string, language: Language) {
  const first = name.split(/\s+/)[0] ?? '';
  const acronym = first.length > 1 && first === first.toLocaleUpperCase(language);
  return acronym ? name : name.charAt(0).toLocaleLowerCase(language) + name.slice(1);
}

/** The criteria an address holds; anything it does not name is not set. */
export function criteriaOf(params: URLSearchParams): Criteria {
  return {
    q: params.get('q') ?? '',
    department: params.get('department') ?? '',
    position: params.get('position') ?? '',
    status: statusOf(params.get('status'), params.get('left')),
    choices: Object.fromEntries(
      [...params].flatMap(([key, value]) =>
        key.startsWith(CHOICE) && value ? [[key.slice(CHOICE.length), value]] : [],
      ),
    ),
  };
}

/** The address for criteria: a value is written only when it is set, so a list with nothing
 * narrowed has a bare address. */
export function paramsOf(criteria: Criteria) {
  const params = new URLSearchParams();
  if (criteria.q) params.set('q', criteria.q);
  if (criteria.department) params.set('department', criteria.department);
  if (criteria.position) params.set('position', criteria.position);
  if (criteria.status !== 'active') params.set('status', criteria.status);
  for (const [key, value] of Object.entries(criteria.choices)) {
    if (value) params.set(`${CHOICE}${key}`, value);
  }
  return params;
}

/** Text as it is searched: no case, no accents, `đ` as `d`, so Vietnamese is found as it is typed
 * with or without its marks. */
export const folded = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

type Shown = {
  setup: StaffSetup;
  language: Language;
  /** The company's own fields the list shows. */
  columns: readonly CustomField[];
};

/** Every word the list shows for a person: name, code, department, position, phone and the
 * company's own fields it shows, a choice by its name in the language. */
export function wordsShown(person: Employee, { setup, language, columns }: Shown) {
  return [
    person.name,
    person.code,
    unitName(person.department, setup.departments) ?? '',
    unitName(person.position, setup.positions) ?? '',
    phoneOf(person),
    ...columns.map((field) => fieldValueShown(field, person.extra[field.key], language)),
  ];
}

/** Whether a person stays on the list: every typed word is among the words shown, and each
 * narrowing holds. */
export function matches(person: Employee, criteria: Criteria, shown: Shown) {
  if (criteria.status === 'active' && person.archived) return false;
  if (criteria.status === 'inactive' && !person.archived) return false;
  if (criteria.department && person.department?.id !== criteria.department) return false;
  if (criteria.position && person.position?.id !== criteria.position) return false;
  for (const [key, value] of Object.entries(criteria.choices)) {
    if (person.extra[key] !== value) return false;
  }
  const text = folded(wordsShown(person, shown).join(' '));
  return folded(criteria.q)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
}
