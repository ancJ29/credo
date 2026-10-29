import { describe, expect, it } from 'vitest';
import {
  addEmployeeRequestSchema,
  employeeCodeIsValid,
  employeeSchema,
  normaliseEmployeeCode,
  passwordIsValid,
  saveStaffSetupRequestSchema,
  setPasswordRequestSchema,
  staffSetupSchema,
} from './staff';

const ID = '7f0c9a52-5b2e-4a39-9d5f-0c6a8e1b2d34';
const person = {
  id: ID,
  code: 'EMP-0001',
  name: 'Lan',
  department: null,
  position: null,
};

describe('staff', () => {
  it('A code is 2 to 20 of the letters A to Z, digits and hyphens, unique in the company in any case, among people who left too, and is the person’s sign-in name; a code already taken is refused, and its holder is unchanged', () => {
    for (const good of ['EMP-0001', 'ab', 'a-1', 'A'.repeat(20), ' emp-7 ']) {
      expect(employeeCodeIsValid(good), good).toBe(true);
    }
    for (const bad of ['', 'A', 'A'.repeat(21), 'EMP 1', 'EMP_1', 'EMP.1', 'Đức']) {
      expect(employeeCodeIsValid(bad), bad).toBe(false);
    }
    // in any case is one code, kept in capitals
    expect(normaliseEmployeeCode(' emp-0001 ')).toBe('EMP-0001');
    expect(addEmployeeRequestSchema.safeParse({ name: 'x', code: 'emp-1' }).success).toBe(true);
    expect(addEmployeeRequestSchema.safeParse({ name: 'x', code: 'e' }).success).toBe(false);
  });

  it('The root gives a person a password, typed twice or made by the app, of at least 8 characters with a capital, a small letter, a digit and one of `@$!%*?&`', () => {
    expect(passwordIsValid('Abcdef1!')).toBe(true);
    for (const bad of ['Abcde1!', 'abcdef1!', 'ABCDEF1!', 'Abcdefg!', 'Abcdefg1', 'Abcdef1#']) {
      expect(passwordIsValid(bad), bad).toBe(false);
    }
    expect(setPasswordRequestSchema.safeParse({ password: 'Abcdef1!' }).success).toBe(true);
    expect(setPasswordRequestSchema.safeParse({ password: null }).success).toBe(true);
    expect(setPasswordRequestSchema.safeParse({ password: 'weak' }).success).toBe(false);
  });

  it('A person’s id, code, name, email, department and position links, permissions and archive are typed; their phone, second phone, note and the company’s own fields are in `extra`', () => {
    const read = employeeSchema.safeParse({ ...person, extra: { phone: '0901', note: 'n' } }).data;
    expect(read).toEqual({
      ...person,
      permissions: {},
      archived: false,
      extra: { phone: '0901', note: 'n' },
    });
    // a record written before a field existed still parses, each default at the reader
    expect(employeeSchema.safeParse(person).data?.extra).toEqual({});
    // the typed fields are checked, and nothing unknown rides along beside them
    expect(employeeSchema.safeParse({ ...person, phone: '0901' }).success).toBe(false);
    expect(employeeSchema.safeParse({ ...person, name: '  ' }).success).toBe(false);
    expect(employeeSchema.safeParse({ ...person, code: 'x' }).success).toBe(false);
    expect(
      employeeSchema.safeParse({ ...person, department: { id: ID, name: 'Kho' } }).success,
    ).toBe(true);
    expect(
      employeeSchema.safeParse({ ...person, permissions: { 'staff.canFire': true } }).success,
    ).toBe(false);
  });

  it('The root keeps the company’s departments and positions, adding, renaming and removing them; a person names theirs by its id, so a rename follows them, and a removed one shows on them as it was saved', () => {
    const unit = { id: ID, name: 'Kho', permissions: { 'staff.canView': true }, extra: {} };
    expect(
      staffSetupSchema.safeParse({ departments: [unit], positions: [], extra: {} }).success,
    ).toBe(true);
    expect(
      staffSetupSchema.safeParse({ departments: [{ id: ID, name: 'Kho' }], positions: [] }).data,
    ).toEqual({
      departments: [{ id: ID, name: 'Kho', permissions: {}, extra: {} }],
      positions: [],
      extra: {},
    });
    // a unit saved with no id is new; one with a blank name is refused
    const save = (departments: unknown[], version = '') =>
      saveStaffSetupRequestSchema.safeParse({
        setup: { departments, positions: [], extra: {} },
        version,
      }).success;
    expect(save([{ name: 'Mới' }])).toBe(true);
    expect(save([{ name: ' ' }])).toBe(false);
    expect(save([{ id: 'not-an-id', name: 'x' }])).toBe(false);
    // the version is a tag c-storage sent, or '' for a company that never saved a setup
    expect(save([], 'a'.repeat(64))).toBe(true);
    expect(save([], 'v1')).toBe(false);
    // a person's link holds the id and the name as saved
    expect(
      employeeSchema.safeParse({ ...person, department: { id: ID, name: 'Kho cũ' } }).data
        ?.department,
    ).toEqual({
      id: ID,
      name: 'Kho cũ',
    });
  });
});
