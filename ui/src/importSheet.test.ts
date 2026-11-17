import { type CustomField, IMPORT_MAX_ROWS, type Language, type StaffSetup } from '@credo/shared';
import { DEMO_IMPORT_ROWS, DEMO_STAFF_SETUP } from '@credo/shared/demo';
import { describe, expect, it } from 'vitest';
import { DICTIONARIES } from './i18n';
import {
  type Cell,
  columnsOf,
  headingOf,
  readStaff,
  type ReadRow,
  type Table,
  templateSheets,
  textOf,
} from './importSheet';

/** The form's own word for each column, in each language: a file's headings. */
const HEAD = { en: DICTIONARIES.en.addPerson, vi: DICTIONARIES.vi.addPerson };
/** A word as a person types it without accents, the way a reader must forgive. */
const unaccented = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gi, 'd');

const W = DICTIONARIES.en.import;
const BARE: StaffSetup = { departments: [], positions: [], extra: {} };
const TAKEN = new Set(['EMP-0002']);

/** The demo company's file in a language: its headings, then one row for each of the rows given. */
const tableOf = (
  language: Language,
  rows: Record<string, string | undefined>[] = DEMO_IMPORT_ROWS,
  setup = DEMO_STAFF_SETUP,
): Table => {
  const columns = columnsOf(setup);
  return [
    columns.map((column) => headingOf(column, language)),
    ...rows.map((row) => columns.map((column) => row[column.key] ?? null)),
  ];
};

const read = (table: Table, setup = DEMO_STAFF_SETUP, taken: ReadonlySet<string> = TAKEN) => {
  const found = readStaff(table, setup, taken);
  if (found.kind !== 'read') throw new Error(`the file failed: ${found.reason}`);
  return found.rows;
};

const kinds = (row: ReadRow) => row.problems.map((problem) => problem.kind);

describe('the staff file’s columns', () => {
  it('are the form’s, in its order: the second phone only while the company keeps it, then its own fields', () => {
    expect(columnsOf(DEMO_STAFF_SETUP).map((column) => column.key)).toEqual([
      'name',
      'code',
      'phone',
      'personalPhone',
      'department',
      'position',
      'note',
      'licence',
      'started',
      'plate',
      'dependants',
    ]);
    expect(columnsOf(BARE).map((column) => column.key)).toEqual([
      'name',
      'code',
      'phone',
      'department',
      'position',
      'note',
    ]);
  });

  it('are headed by the form’s own words, or the field’s name, in the language', () => {
    const [name, , , , , , , licence] = columnsOf(DEMO_STAFF_SETUP);

    expect(headingOf(name, 'en')).toBe(HEAD.en.name);
    expect(headingOf(name, 'vi')).toBe(HEAD.vi.name);
    expect(headingOf(licence, 'en')).toBe('Driving licence');
    expect(headingOf(licence, 'vi')).toBe('Bằng lái xe');
  });

  it('read a cell as the text a person typed: a date as year-month-day, empty as nothing', () => {
    expect(textOf(null)).toBe('');
    expect(textOf(undefined)).toBe('');
    expect(textOf('  Lan ')).toBe('Lan');
    expect(textOf(907)).toBe('907');
    expect(textOf(true)).toBe('true');
    expect(textOf(new Date('2026-10-29T00:00:00Z'))).toBe('2026-10-29');
  });
});

describe('the template', () => {
  it('The app gives a template in Vietnamese or English with the columns the form shows, the company’s own fields included, and sample rows with its real departments and positions', () => {
    for (const language of ['en', 'vi'] as const) {
      const [staff, notes] = templateSheets(DEMO_STAFF_SETUP, language);
      const headings = columnsOf(DEMO_STAFF_SETUP).map((column) => headingOf(column, language));

      expect(staff?.rows[0]).toEqual(headings);
      expect(staff?.rows).toHaveLength(3);
      expect(notes?.rows.map((row) => row[0])).toEqual([
        DICTIONARIES[language].import.noteColumn,
        ...headings,
      ]);
      // every cell is text, so a phone keeps its leading zero
      for (const row of [...(staff?.rows ?? []), ...(notes?.rows ?? [])]) {
        expect(row.every((cell) => typeof cell === 'string')).toBe(true);
      }
    }

    const [staff, notes] = templateSheets(DEMO_STAFF_SETUP, 'en');
    const [first, second] = staff.rows.slice(1);
    expect(first).toEqual([
      W.sampleName1,
      '',
      '0900 000 001',
      '0900 111 001',
      'Kho',
      'Quản lý',
      '',
      'Class B2',
      '2026-01-15',
      W.sampleText,
      '1',
    ]);
    expect(second?.slice(4, 6)).toEqual(['Văn phòng', 'Nhân viên']);
    expect(second?.slice(7)).toEqual(['Class C', '2026-02-15', W.sampleText, '2']);
    expect(staff?.name).toBe(W.sheetStaff);
    expect(notes?.name).toBe(W.sheetNotes);
  });

  it('says on its second sheet what each column takes, and which is needed', () => {
    const rows = templateSheets(DEMO_STAFF_SETUP, 'en')[1].rows;
    const of = (heading: string) => rows.find((row) => row[0] === heading);

    expect(rows[0]).toEqual([W.noteColumn, W.noteNeeded, W.noteWrite]);
    expect(of(HEAD.en.name)?.slice(1)).toEqual([W.needed, W.writeName]);
    expect(of(HEAD.en.code)?.[1]).toBe(W.optional);
    expect(of(HEAD.en.department)?.[2]).toBe(
      W.writeDepartment.replaceAll('{{names}}', 'Kho, Văn phòng, Giao hàng'),
    );
    expect(of(HEAD.en.position)?.[2]).toBe(
      W.writePosition.replaceAll('{{names}}', 'Quản lý, Nhân viên, Thực tập'),
    );
    expect(of(HEAD.en.phone)?.[2]).toBe(W.writePhone);
    expect(of(HEAD.en.personalPhone)?.[2]).toBe(W.writePhone);
    expect(of(HEAD.en.note)?.[2]).toBe(W.writeNote);
    expect(of('Driving licence')?.[2]).toBe(
      W.writeChoice.replaceAll('{{names}}', 'Class B2, Class C'),
    );
    expect(of('Contract date')?.[2]).toBe(W.writeDate);
    expect(of('Vehicle plate')?.[2]).toBe(W.writeText);
    expect(of('Dependants')?.[2]).toBe(W.writeNumber);
  });

  it('fills every {{names}} of a word that names the options twice', () => {
    const words = DICTIONARIES.en.import as Record<string, string>;
    const was = { ...words };
    try {
      for (const key of ['writeChoice', 'writeDepartment', 'writePosition']) {
        words[key] = 'Of: {{names}}. Again: {{names}}.';
      }
      const rows = templateSheets(DEMO_STAFF_SETUP, 'en')[1].rows;
      const of = (heading: string) => rows.find((row) => row[0] === heading)?.[2];
      expect(of(HEAD.en.department)).toBe(
        'Of: Kho, Văn phòng, Giao hàng. Again: Kho, Văn phòng, Giao hàng.',
      );
      expect(of(HEAD.en.position)).toBe(
        'Of: Quản lý, Nhân viên, Thực tập. Again: Quản lý, Nhân viên, Thực tập.',
      );
      expect(of('Driving licence')).toBe('Of: Class B2, Class C. Again: Class B2, Class C.');
    } finally {
      Object.assign(words, was);
    }
  });

  it('is still a template for a company that keeps nothing besides: no unit to name, a choice of one option sampled twice', () => {
    const choice: CustomField = {
      key: 'size',
      label: { vi: 'Cỡ', en: 'Size' },
      kind: 'choice',
      options: [{ value: 'm', label: { vi: 'Vừa', en: 'Medium' } }],
      inList: false,
    };
    const [staff, notes] = templateSheets({ ...BARE, customFields: [choice] }, 'vi');

    expect(staff?.rows[0]).toEqual([
      HEAD.vi.name,
      HEAD.vi.code,
      HEAD.vi.phone,
      HEAD.vi.department,
      HEAD.vi.position,
      HEAD.vi.note,
      'Cỡ',
    ]);
    expect(staff?.rows[1]?.slice(4)).toEqual(['', '', 'Vừa']);
    expect(staff?.rows[2]?.slice(6)).toEqual(['Vừa']);
    expect(notes?.rows.at(-1)).toEqual([
      'Cỡ',
      DICTIONARIES.vi.import.optional,
      DICTIONARIES.vi.import.writeChoice.replaceAll('{{names}}', 'Vừa'),
    ]);
  });
});

describe('the staff file, read', () => {
  it('Before anything is saved, the root sees each row read and the reason for any refused: only the name is required, an empty code is numbered, and a code already taken, in the company or twice in the file, is refused', () => {
    for (const language of ['en', 'vi'] as const) {
      const rows = read(tableOf(language));

      expect(rows.map((row) => row.line)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
      expect(rows.map(kinds)).toEqual([
        [],
        [],
        [],
        ['code-taken'],
        ['name'],
        ['department'],
        ['code-twice'],
        ['field'],
      ]);
      expect(rows.map((row) => row.request !== null)).toEqual([
        true,
        true,
        true,
        false,
        false,
        false,
        false,
        false,
      ]);
    }
  });

  it('turns a row that holds into the add by hand: the code in capitals or left out, the units by id, the phone, the note and the company’s own fields in extra', () => {
    const [numbered, given, own] = read(tableOf('en'));

    expect(numbered?.request).toEqual({
      name: 'Mai Linh',
      extra: { phone: '0909 123 456', note: 'Mới vào làm.' },
      departmentId: DEMO_STAFF_SETUP.departments[0]?.id,
      positionId: DEMO_STAFF_SETUP.positions[1]?.id,
    });
    expect(given?.request).toEqual({
      name: 'Ngô Thu Hà',
      code: 'EMP-0100',
      extra: { phone: '0909 777 888', licence: 'b2', started: '2026-10-01' },
      departmentId: DEMO_STAFF_SETUP.departments[1]?.id,
      positionId: DEMO_STAFF_SETUP.positions[2]?.id,
    });
    expect(own?.request?.extra).toEqual({ plate: '51C-678.90', dependants: 3 });
    expect(own?.request?.departmentId).toBe(DEMO_STAFF_SETUP.departments[2]?.id);
  });

  it('reads headings in either language, in any order, without accents, case or a required star, and a department or a choice by its name', () => {
    const table: Table = [
      [
        unaccented(HEAD.vi.note).toLowerCase(),
        `${HEAD.en.position.toUpperCase()} *`,
        HEAD.vi.name.toLowerCase(),
        'Driving licence',
        unaccented(HEAD.vi.department),
        unaccented(HEAD.vi.code),
      ],
      ['một ghi chú', 'nhan vien', 'Lê Văn', 'hạng c', 'KHO', 'nv-1'],
      ['', '', 'Hạ', 'Class B2', '', ''],
    ];

    const [first, second] = read(table);

    expect(first?.request).toEqual({
      name: 'Lê Văn',
      code: 'NV-1',
      extra: { note: 'một ghi chú', licence: 'c' },
      departmentId: DEMO_STAFF_SETUP.departments[0]?.id,
      positionId: DEMO_STAFF_SETUP.positions[1]?.id,
    });
    expect(second?.request?.extra).toEqual({ licence: 'b2' });
    expect(second?.request?.departmentId).toBeNull();
  });

  it('takes the first of two columns headed alike', () => {
    const [row] = read([
      [HEAD.vi.name, HEAD.en.name, HEAD.vi.code],
      ['Hạ', 'Bình', 'nv-9'],
    ]);

    expect(row?.name).toBe('Hạ');
  });

  it('skips empty rows but counts them in the line, and ignores a column the company does not keep', () => {
    const table: Table = [
      [],
      [HEAD.en.name, HEAD.en.personalPhone, HEAD.en.phone],
      [null, null, null],
      ['Lan', '0900', 7],
      ['   ', '', ''],
      ['Hà', null, new Date('2026-10-29T00:00:00Z')],
    ];

    const rows = read(table, BARE);

    expect(rows.map((row) => row.line)).toEqual([4, 6]);
    expect(rows[0]?.request?.extra).toEqual({ phone: '7' });
    expect(rows[1]?.request?.extra).toEqual({ phone: '2026-10-29' });
  });

  it('refuses a code that is not a code, a name over 200 characters, and a position the company lacks', () => {
    const table: Table = [
      [HEAD.en.name, HEAD.en.code, HEAD.en.position],
      ['A', 'a b', ''],
      ['x'.repeat(201), '', ''],
      ['C', '', 'Giám đốc'],
      ['D', '', 'thực tập'],
    ];

    const rows = read(table);

    expect(rows.map(kinds)).toEqual([['code-invalid'], ['name'], ['position'], []]);
    expect(rows[0]?.problems[0]).toEqual({ kind: 'code-invalid', code: 'a b' });
    expect(rows[2]?.problems[0]).toEqual({ kind: 'position', name: 'Giám đốc' });
  });

  it('gives a code to the first row that holds it: a row refused for another reason does not claim it, and a code is the same in any case', () => {
    const table: Table = [
      [HEAD.en.name, HEAD.en.code, HEAD.en.department],
      ['A', 'nv-1', 'Nowhere'],
      ['B', 'NV-1', ''],
      ['C', 'nv-1', ''],
      ['D', 'emp-0002', ''],
    ];

    const rows = read(table);

    expect(rows.map(kinds)).toEqual([['department'], [], ['code-twice'], ['code-taken']]);
    expect(rows[2]?.problems[0]).toEqual({ kind: 'code-twice', code: 'NV-1' });
    expect(rows[3]?.problems[0]).toEqual({ kind: 'code-taken', code: 'EMP-0002' });
  });

  it('looks a company’s own field up apart from a built-in column of its key', () => {
    const field: CustomField = {
      key: 'department',
      label: { vi: 'Bộ phận cũ', en: 'Old part' },
      kind: 'text',
      options: [],
      inList: false,
    };
    const setup = { ...DEMO_STAFF_SETUP, customFields: [field] };

    const [row] = read(
      [
        [HEAD.en.name, HEAD.en.department, 'Old part'],
        ['Lan', 'Kho', 'x'],
      ],
      setup,
    );

    expect(row?.request).toMatchObject({
      departmentId: DEMO_STAFF_SETUP.departments[0]?.id,
      extra: { department: 'x' },
    });
  });

  it('fails as a whole when the name column is missing, there is no row, or there are more than 500', () => {
    const rows = (count: number): Cell[][] => Array.from({ length: count }, () => ['Lan']);

    expect(readStaff([[HEAD.en.code], ['A-1']], BARE, TAKEN)).toEqual({
      kind: 'failed',
      reason: 'no-name',
    });
    expect(readStaff([], BARE, TAKEN)).toEqual({ kind: 'failed', reason: 'no-name' });
    expect(readStaff([[HEAD.en.name]], BARE, TAKEN)).toEqual({ kind: 'failed', reason: 'no-rows' });
    expect(readStaff([[HEAD.en.name], ...rows(IMPORT_MAX_ROWS)], BARE, TAKEN).kind).toBe('read');
    expect(readStaff([[HEAD.en.name], ...rows(IMPORT_MAX_ROWS + 1)], BARE, TAKEN)).toEqual({
      kind: 'failed',
      reason: 'too-many',
    });
  });
});
