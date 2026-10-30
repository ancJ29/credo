import { DEMO_EMPLOYEES, DEMO_STAFF_SETUP } from '@credo/shared/demo';
import { describe, expect, it } from 'vitest';
import { criteriaOf, folded, matches, paramsOf, wordsShown } from './staffFilter';

const none = { q: '', department: '', position: '', left: false, choices: {} };
const shown = {
  setup: DEMO_STAFF_SETUP,
  language: 'en' as const,
  columns: (DEMO_STAFF_SETUP.customFields ?? []).filter((field) => field.inList),
};
const named = (name: string) => DEMO_EMPLOYEES.find((person) => person.name === name)!;

describe('the staff list’s search and filters', () => {
  it('The address keeps both: what is set is written, what is not is left out, and an address read gives back what was written', () => {
    expect(paramsOf(none).toString()).toBe('');
    const set = {
      q: 'nguyen lan',
      department: 'd1',
      position: 'p1',
      left: true,
      choices: { licence: 'c', plate: '' },
    };
    const written = paramsOf(set);
    expect(written.toString()).toBe('q=nguyen+lan&department=d1&position=p1&left=1&f.licence=c');
    expect(criteriaOf(written)).toEqual({ ...set, choices: { licence: 'c' } });
    expect(criteriaOf(new URLSearchParams(''))).toEqual(none);
    // a choice with no value, and an address with anything else, are not criteria
    expect(criteriaOf(new URLSearchParams('f.licence=&other=1&left=0'))).toEqual(none);
  });

  it('folds case, accents and đ, so Vietnamese is found as it is typed with or without its marks', () => {
    expect(folded('Nguyễn Thị Đào')).toBe('nguyen thi dao');
    expect(folded('đặng')).toBe('dang');
    expect(folded('ĐẶNG')).toBe('dang');
    // a letter composed of two code points folds as one of one
    expect(folded('bảo')).toBe(folded('bảo'));
  });

  it('Search finds a person by any word the list shows: every typed word is among them, and a field not shown is not', () => {
    const driver = named('Võ Thanh Tùng');

    expect(wordsShown(driver, shown)).toEqual([
      'Võ Thanh Tùng',
      'EMP-0005',
      'Giao hàng',
      'Nhân viên',
      '0903 111 005',
      'Class C',
      '2023-08-21',
    ]);
    const finds = (q: string) => matches(driver, { ...none, q }, shown);
    expect(finds('')).toBe(true);
    expect(finds('  ')).toBe(true);
    expect(finds('vo tung giao')).toBe(true);
    expect(finds('tung xe')).toBe(false);
    // the vehicle plate is in the record and not in the list
    expect(finds('51c')).toBe(false);
  });

  it('The filters hold together, a person who left shows only with the filter, and a choice is the option’s key', () => {
    const driver = named('Võ Thanh Tùng');
    const left = named('Hoàng Gia Huy');
    const delivery = DEMO_STAFF_SETUP.departments[2].id;
    const trainee = DEMO_STAFF_SETUP.positions[2].id;
    const test = (person: typeof driver, narrowed: Partial<typeof none>) =>
      matches(person, { ...none, ...narrowed }, shown);

    expect(test(driver, { department: delivery })).toBe(true);
    expect(test(driver, { department: delivery, position: trainee })).toBe(false);
    expect(test(driver, { position: trainee })).toBe(false);
    expect(test(driver, { choices: { licence: 'c' } })).toBe(true);
    expect(test(driver, { choices: { licence: 'b2' } })).toBe(false);
    expect(test(left, {})).toBe(false);
    expect(test(left, { left: true })).toBe(true);
    // a person in no department is in no department's filter
    expect(test(named('Bùi Ngọc Anh'), { department: delivery })).toBe(false);
  });
});
