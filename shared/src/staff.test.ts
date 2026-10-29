import { describe, expect, it } from 'vitest';
import {
  addEmployeeRequestSchema,
  changeCodeRequestSchema,
  byCode,
  employeeCodeIsValid,
  employeeSchema,
  normaliseEmployeeCode,
  passwordIsValid,
  saveEmployeeRequestSchema,
  saveStaffSetupRequestSchema,
  setPasswordRequestSchema,
  staffConfig,
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
    expect(
      addEmployeeRequestSchema.safeParse({ name: 'x', code: 'emp-1', extra: {} }).success,
    ).toBe(true);
    expect(addEmployeeRequestSchema.safeParse({ name: 'x', code: 'e', extra: {} }).success).toBe(
      false,
    );
  });

  it('The root gives a person a password, typed twice or made by the app, of at least 8 characters with a capital, a small letter, a digit and one of `@$!%*?&`', () => {
    expect(passwordIsValid('Abcdef1!')).toBe(true);
    for (const bad of ['Abcde1!', 'abcdef1!', 'ABCDEF1!', 'Abcdefg!', 'Abcdefg1', 'Abcdef1#']) {
      expect(passwordIsValid(bad), bad).toBe(false);
    }
    // any printable character is allowed beside the four it needs, up to 128; no control character
    for (const good of ['Another-1!', 'Two words 1!', 'Mật khẩu 1!', `Aa1!${'x'.repeat(124)}`]) {
      expect(passwordIsValid(good), good).toBe(true);
    }
    for (const bad of [
      'Abcdef1!\n',
      'Abc\tdef1!',
      'Abcdef1!\u0000',
      `Aa1!${'x'.repeat(125)}`,
      // a format character is not printable either: zero width, and the byte order mark
      'Abc\u200Bdef1!',
      '\uFEFFAbcdef1!',
      // a space at either end is invisible where the password is shown
      ' Abcdef1!',
      'Abcdef1! ',
      'Abcdef1!\u00A0',
    ]) {
      expect(passwordIsValid(bad), JSON.stringify(bad)).toBe(false);
    }
    expect(setPasswordRequestSchema.safeParse({ password: 'Abcdef1!' }).success).toBe(true);
    expect(setPasswordRequestSchema.safeParse({ password: null }).success).toBe(true);
    expect(setPasswordRequestSchema.safeParse({ password: 'weak' }).success).toBe(false);
  });

  it('The staff list is in code order, by one comparison the BFF and the fake share', () => {
    const codes = ['EMP-0010', 'A-1', 'EMP-0002', '10', 'EMP-0001'];
    expect(
      codes
        .map((code) => ({ code }))
        .sort(byCode)
        .map((person) => person.code),
    ).toEqual(['10', 'A-1', 'EMP-0001', 'EMP-0002', 'EMP-0010']);
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
    const own = { permissions: {}, extra: {} };
    const save = (departments: unknown[], version = '') =>
      saveStaffSetupRequestSchema.safeParse({
        setup: { departments, positions: [], extra: {} },
        version,
      }).success;
    expect(save([{ name: 'Mới', ...own }])).toBe(true);
    expect(save([{ name: ' ', ...own }])).toBe(false);
    expect(save([{ id: 'not-an-id', name: 'x', ...own }])).toBe(false);
    // a write names what it replaces: a unit with no permissions or `extra`, or a setup with no
    // `extra`, is refused and never erases what is stored
    expect(save([{ name: 'Mới', permissions: {} }])).toBe(false);
    expect(save([{ name: 'Mới', extra: {} }])).toBe(false);
    expect(
      saveStaffSetupRequestSchema.safeParse({
        setup: { departments: [], positions: [] },
        version: '',
      }).success,
    ).toBe(false);
    expect(
      saveEmployeeRequestSchema.safeParse({ version: 'a'.repeat(64), name: 'x' }).success,
    ).toBe(false);
    expect(
      saveEmployeeRequestSchema.safeParse({ version: 'a'.repeat(64), name: 'x', extra: {} })
        .success,
    ).toBe(true);
    expect(addEmployeeRequestSchema.safeParse({ name: 'x', code: 'emp-1' }).success).toBe(false);
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

  it('The root chooses which optional fields the company keeps on a person, all off until turned on, and the setup keeps the company’s own fields and its numbering', () => {
    const label = { vi: 'Nhãn', en: 'Label' };
    const own = { key: 'plate', label, kind: 'text' };
    const bare = { departments: [], positions: [], extra: {} };

    // a setup saved before these existed has none, and reads as the defaults
    expect(staffSetupSchema.safeParse(bare).success).toBe(true);
    expect(staffConfig(bare)).toEqual({
      fields: { personalPhone: false, photo: false },
      customFields: [],
      numbering: { prefix: 'EMP-', digits: 4 },
    });
    // a switch left out is off
    const set = {
      ...bare,
      fields: { photo: true },
      customFields: [own],
      numbering: { prefix: 'NV', digits: 3 },
    };
    expect(staffSetupSchema.safeParse(set).success).toBe(true);
    expect(staffConfig(staffSetupSchema.parse(set))).toEqual({
      fields: { personalPhone: false, photo: true },
      customFields: [{ ...own, options: [], inList: false }],
      numbering: { prefix: 'NV', digits: 3 },
    });
    // a switch the app does not know, a field of no known kind and a repeated key are refused
    expect(staffSetupSchema.safeParse({ ...bare, fields: { fax: true } }).success).toBe(false);
    expect(
      staffSetupSchema.safeParse({ ...bare, customFields: [{ ...own, kind: 'file' }] }).success,
    ).toBe(false);
    expect(staffSetupSchema.safeParse({ ...bare, customFields: [own, own] }).success).toBe(false);
    // a save carries them the same
    const save = (setup: object) =>
      saveStaffSetupRequestSchema.safeParse({ setup, version: '' }).success;
    expect(save(set)).toBe(true);
    expect(save({ ...set, numbering: { prefix: 'nv', digits: 3 } })).toBe(false);
    expect(save({ ...set, customFields: [{ ...own, key: 'note' }] })).toBe(false);
  });

  it('The root changes a person’s code: a new code is a valid code over the version read', () => {
    const version = 'a'.repeat(64);

    expect(changeCodeRequestSchema.safeParse({ version, code: 'nv-12' }).success).toBe(true);
    expect(changeCodeRequestSchema.safeParse({ version, code: 'x' }).success).toBe(false);
    expect(changeCodeRequestSchema.safeParse({ version: 'v', code: 'NV-12' }).success).toBe(false);
    expect(changeCodeRequestSchema.safeParse({ code: 'NV-12' }).success).toBe(false);
  });
});
