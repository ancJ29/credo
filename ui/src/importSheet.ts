import {
  type AddEmployeeRequest,
  type CustomField,
  employeeCodeIsValid,
  fieldValueIsValid,
  fieldValueToStore,
  IMPORT_MAX_ROWS,
  type Language,
  normaliseEmployeeCode,
  type StaffSetup,
  staffConfig,
} from '@credo/shared';
import { DICTIONARIES } from './i18n';

/** What a cell of an Excel sheet holds, as the reading library gives it. */
export type Cell = string | number | boolean | Date | null;
export type Table = Cell[][];

/** A column of the staff file: one of the form's built-in fields, or one of the company's own. */
export type Column =
  | {
      key: 'name' | 'code' | 'phone' | 'personalPhone' | 'department' | 'position' | 'note';
      field?: undefined;
    }
  | { key: string; field: CustomField };

/** The columns the add form shows for this company, in the form's order: the second phone only
 * while the company keeps it, then the company's own fields. */
export function columnsOf(setup: StaffSetup): Column[] {
  const { fields, customFields } = staffConfig(setup);
  return [
    { key: 'name' },
    { key: 'code' },
    { key: 'phone' },
    ...(fields.personalPhone ? [{ key: 'personalPhone' } as const] : []),
    { key: 'department' },
    { key: 'position' },
    { key: 'note' },
    ...customFields.map((field) => ({ key: field.key, field })),
  ];
}

/** Where a column is looked up: a company's own field apart from a built-in column of its key. */
const slot = (column: Column) => (column.field ? `own:${column.key}` : column.key);

/** A column's heading in a language: the form's own word for it, or the field's name. */
export const headingOf = (column: Column, language: Language) =>
  column.field ? column.field.label[language] : DICTIONARIES[language].addPerson[column.key];

/** Headings compared as a person types them: without accents, case, spacing or a required star. */
const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s*\*$/, '')
    .replace(/\s+/g, ' ')
    .trim();

/** A cell as the text a person typed: a date as year-month-day, empty as nothing. */
export const textOf = (cell: Cell | undefined) =>
  cell === null || cell === undefined
    ? ''
    : cell instanceof Date
      ? cell.toISOString().slice(0, 10)
      : String(cell).trim();

/** The template, as sheets of cells: the staff sheet (the headings and two sample rows with this
 * company's real departments, positions and fields) and a sheet that says what each column takes.
 * Every cell is text, so a phone keeps its leading zero. */
export function templateSheets(
  setup: StaffSetup,
  language: Language,
): { name: string; rows: string[][] }[] {
  const words = DICTIONARIES[language].import;
  const columns = columnsOf(setup);
  const unit = (units: StaffSetup['departments'], at: number) =>
    (units[at] ?? units[0])?.name ?? '';
  const sample = (column: Column, row: number) => {
    const field = column.field;
    if (field?.kind === 'choice') return (field.options[row] ?? field.options[0]).label[language];
    if (field) {
      return { text: words.sampleText, number: String(row + 1), date: `2026-0${row + 1}-15` }[
        field.kind as 'text' | 'number' | 'date'
      ];
    }
    return {
      name: row === 0 ? words.sampleName1 : words.sampleName2,
      code: '',
      phone: `0900 000 00${row + 1}`,
      personalPhone: `0900 111 00${row + 1}`,
      department: unit(setup.departments, row),
      position: unit(setup.positions, row),
      note: '',
    }[column.key as 'name'];
  };
  const names = (list: readonly { name: string }[]) => list.map((item) => item.name).join(', ');
  const write = (column: Column) => {
    if (column.field?.kind === 'choice') {
      return words.writeChoice.replace(
        '{{names}}',
        column.field.options.map((option) => option.label[language]).join(', '),
      );
    }
    if (column.field) {
      return { text: words.writeText, number: words.writeNumber, date: words.writeDate }[
        column.field.kind as 'text' | 'number' | 'date'
      ];
    }
    return {
      name: words.writeName,
      code: words.writeCode,
      phone: words.writePhone,
      personalPhone: words.writePhone,
      department: words.writeDepartment.replace('{{names}}', names(setup.departments)),
      position: words.writePosition.replace('{{names}}', names(setup.positions)),
      note: words.writeNote,
    }[column.key as 'name'];
  };
  return [
    {
      name: words.sheetStaff,
      rows: [
        columns.map((column) => headingOf(column, language)),
        ...[0, 1].map((row) => columns.map((column) => sample(column, row))),
      ],
    },
    {
      name: words.sheetNotes,
      rows: [
        [words.noteColumn, words.noteNeeded, words.noteWrite],
        ...columns.map((column) => [
          headingOf(column, language),
          column.key === 'name' ? words.needed : words.optional,
          write(column),
        ]),
      ],
    },
  ];
}

/** Why a row will not be added. */
export type Problem =
  | { kind: 'name' }
  | { kind: 'code-invalid'; code: string }
  | { kind: 'code-taken'; code: string }
  | { kind: 'code-twice'; code: string }
  | { kind: 'department'; name: string }
  | { kind: 'position'; name: string }
  | { kind: 'field'; field: CustomField };

/** A row of the file, read: what it says, why it is refused if it is, and the add it would be. */
export type ReadRow = {
  /** Its line in the sheet, counting the headings. */
  line: number;
  name: string;
  code: string;
  department: string;
  position: string;
  problems: Problem[];
  /** Set when the row holds. */
  request: AddEmployeeRequest | null;
};

export type ReadResult =
  | { kind: 'read'; rows: ReadRow[] }
  | { kind: 'failed'; reason: 'no-name' | 'no-rows' | 'too-many' };

const NAME_MAX = 200;

/**
 * The sheet's first row is its headings, in either language and any order; every row after is a
 * person unless it is empty. A column the company does not keep is ignored. The file fails as a
 * whole when it has no name column, no row, or more than 500 rows. Otherwise each row is checked as
 * the add by hand checks it, and as far as the browser can know: only the name is needed; an empty
 * code is numbered when added; a code taken in the company (`taken`, in capitals), or given by an
 * earlier row that holds, is refused; so is a department, a position or a field's value that does
 * not fit.
 */
export function readStaff(table: Table, setup: StaffSetup, taken: ReadonlySet<string>): ReadResult {
  const columns = columnsOf(setup);
  // A line is counted in the sheet, blank lines in between included.
  const filled = table
    .map((row, index) => ({ row, line: index + 1 }))
    .filter(({ row }) => row.some((cell) => textOf(cell) !== ''));
  const headings = filled[0]?.row ?? [];
  const body = filled.slice(1);
  const where = new Map<string, number>();
  headings.forEach((cell, index) => {
    for (const column of columns) {
      for (const language of Object.keys(DICTIONARIES) as Language[]) {
        if (plain(headingOf(column, language)) === plain(textOf(cell))) {
          if (!where.has(slot(column))) where.set(slot(column), index);
        }
      }
    }
  });
  if (!where.has('name')) return { kind: 'failed', reason: 'no-name' };
  if (body.length === 0) return { kind: 'failed', reason: 'no-rows' };
  if (body.length > IMPORT_MAX_ROWS) return { kind: 'failed', reason: 'too-many' };

  const given = new Set<string>();
  const rows = body.map(({ row, line }): ReadRow => {
    const cell = (key: string) => textOf(row[where.get(key) ?? -1]);
    const problems: Problem[] = [];
    const name = cell('name');
    if (name === '' || name.length > NAME_MAX) problems.push({ kind: 'name' });
    const typedCode = cell('code');
    const code = normaliseEmployeeCode(typedCode);
    if (typedCode !== '') {
      if (!employeeCodeIsValid(typedCode)) problems.push({ kind: 'code-invalid', code: typedCode });
      else if (taken.has(code)) problems.push({ kind: 'code-taken', code });
      else if (given.has(code)) problems.push({ kind: 'code-twice', code });
    }
    const unitIn = (units: StaffSetup['departments'], key: 'department' | 'position') => {
      const typed = cell(key);
      const found = units.find((unit) => plain(unit.name) === plain(typed));
      if (typed !== '' && !found) problems.push({ kind: key, name: typed });
      return found?.id ?? null;
    };
    const departmentId = unitIn(setup.departments, 'department');
    const positionId = unitIn(setup.positions, 'position');
    const extra: Record<string, unknown> = {};
    const keep = (key: string, value: string | number | undefined) => {
      if (value !== undefined && value !== '') extra[key] = value;
    };
    keep('phone', cell('phone'));
    keep('personalPhone', cell('personalPhone'));
    keep('note', cell('note'));
    for (const column of columns) {
      const field = column.field;
      if (!field) continue;
      const typed = cell(slot(column));
      const value = field.kind === 'choice' ? choiceValue(field, typed) : typed;
      if (fieldValueIsValid(field, value)) keep(field.key, fieldValueToStore(field, value));
      else problems.push({ kind: 'field', field });
    }
    if (problems.length === 0 && code !== '') given.add(code);
    const request: AddEmployeeRequest | null =
      problems.length > 0
        ? null
        : { name, ...(code === '' ? {} : { code }), extra, departmentId, positionId };
    return { line, name, code: typedCode, department: cell('department'), position: cell('position'), problems, request };
  });
  return { kind: 'read', rows };
}

/** What a choice cell holds as the option it names, by its key or its name in either language;
 * what names none stays as typed, and fails the field's check. */
function choiceValue(field: CustomField, typed: string) {
  const found = field.options.find(
    (option) =>
      plain(option.value) === plain(typed) ||
      plain(option.label.vi) === plain(typed) ||
      plain(option.label.en) === plain(typed),
  );
  return found?.value ?? typed;
}
