import {
  type AddCustomerRequest,
  addCustomerRequestSchema,
  type AddProductRequest,
  addProductRequestSchema,
  employeeCodeIsValid,
  IMPORT_MAX_ROWS,
  type Language,
  normaliseEmployeeCode,
  priceSchema,
  UNIT_MAX,
} from '@credo/shared';
import { DICTIONARIES } from './i18n';
import { plain, type Table, textOf } from './importSheet';
import type { Api } from './api';

/** The two lists the root imports from Excel, and the columns of their files. */
export type ListKind = 'customers' | 'products';
export type ColumnKey =
  'code' | 'name' | 'phone' | 'address' | 'unit' | 'price' | 'stocked' | 'note';
export type Cells = Partial<Record<ColumnKey, string>>;
/** A record of a list as the page shows it: the code is always there. */
export type Shown = Cells & { code: string };
export type ListRequest = AddCustomerRequest | AddProductRequest;

/** What each list shows and takes: the columns of its file in the template's order, the ones every
 * row needs, the ones the page shows and the preview shows beside the code and the name. `load`
 * reads the list as the cells the page shows; `send` is the list's import call. */
export const LISTS = {
  customers: {
    columns: ['code', 'name', 'phone', 'address', 'note'],
    needed: ['code', 'name'],
    shown: ['code', 'name', 'phone', 'address'],
    preview: ['phone'],
    load: async (api: Api): Promise<Shown[]> =>
      (await api.listCustomers()).map(({ code, name, extra }) => ({
        code,
        name,
        phone: textIn(extra['phone']),
        address: textIn(extra['address']),
      })),
    send: (api: Api, rows: ListRequest[]) => api.importCustomers(rows),
  },
  products: {
    columns: ['code', 'name', 'unit', 'price', 'stocked', 'note'],
    needed: ['code', 'name', 'unit', 'price'],
    shown: ['code', 'name', 'unit', 'price', 'stocked'],
    preview: ['unit', 'price', 'stocked'],
    load: async (api: Api, language: Language): Promise<Shown[]> =>
      (await api.listProducts()).map(({ code, name, unit, price, stocked }) => ({
        code,
        name,
        unit,
        price: new Intl.NumberFormat(language).format(price),
        stocked: DICTIONARIES[language].lists[stocked ? 'yes' : 'no'],
      })),
    send: (api: Api, rows: ListRequest[]) => api.importProducts(rows as AddProductRequest[]),
  },
} as const;

const textIn = (value: unknown) => (typeof value === 'string' ? value : '');

/** A column's heading in a language. */
export const headingOf = (key: ColumnKey, language: Language) =>
  DICTIONARIES[language].lists.columns[key];

/** The stocked cell: empty, Có, Yes, 1 or true read yes; Không, No, 0 or false read no, in any case
 * and without accents. Any other word is not one (null). */
function readStocked(typed: string): boolean | null {
  const word = plain(typed);
  if (['', 'co', 'yes', '1', 'true'].includes(word)) return true;
  if (['khong', 'no', '0', 'false'].includes(word)) return false;
  return null;
}

/** A price as a person types it: whole đồng, the thousands set apart by dots or commas (95.000,
 * 95,000) or not at all. A decimal, a negative, a word, zero or more than the schema takes is not
 * a price. */
export function readPrice(typed: string): number | null {
  if (!/^(\d{1,3}([.,]\d{3})+|\d+)$/.test(typed)) return null;
  const price = Number(typed.replace(/[.,]/g, ''));
  return priceSchema.safeParse(price).success ? price : null;
}

/** The template, as sheets of cells: the list's sheet (the headings and two sample rows) and a
 * sheet that says what each column takes. Every sample is text. */
export function templateSheets(
  kind: ListKind,
  language: Language,
): { name: string; rows: string[][] }[] {
  const words = DICTIONARIES[language];
  const columns = LISTS[kind].columns;
  const samples: Record<ListKind, Cells[]> = {
    customers: [
      { code: 'KH-001', name: words.import.sampleName1, phone: '0900 000 001' },
      { code: 'KH-002', name: words.import.sampleName2, phone: '0900 000 002' },
    ].map((row) => ({ ...row, address: words.lists.sampleAddress })),
    products: [
      { code: 'SP-001', name: words.lists.sampleProduct1, price: '95000', stocked: 'Có' },
      { code: 'SP-002', name: words.lists.sampleProduct2, price: '120.000', stocked: 'Không' },
    ].map((row) => ({ ...row, unit: words.lists.sampleUnit })),
  };
  const write: Record<ColumnKey, string> = {
    ...words.lists.write,
    phone: words.import.writePhone,
    note: words.import.writeNote,
  };
  return [
    {
      name: words.lists[kind].sheet,
      rows: [
        columns.map((key) => headingOf(key, language)),
        ...samples[kind].map((sample) => columns.map((key) => sample[key] ?? '')),
      ],
    },
    {
      name: words.import.sheetNotes,
      rows: [
        [words.import.noteColumn, words.import.noteNeeded, words.import.noteWrite],
        ...columns.map((key) => [
          headingOf(key, language),
          (LISTS[kind].needed as readonly ColumnKey[]).includes(key)
            ? words.import.needed
            : words.import.optional,
          write[key],
        ]),
      ],
    },
  ];
}

/** Why a row will not be added. */
export type Problem =
  | { kind: 'name' }
  | { kind: 'code-missing' }
  | { kind: 'code-invalid'; code: string }
  | { kind: 'code-taken'; code: string }
  | { kind: 'code-twice'; code: string }
  | { kind: 'unit' }
  | { kind: 'price'; typed: string }
  | { kind: 'stocked'; typed: string }
  /** Every cell fits, but the row as a whole is no add (its details together are too long). */
  | { kind: 'row' };

/** A row of the file, read: what it says, why it is refused if it is, and the add it would be. */
export type ReadRow = {
  /** Its line in the sheet, counting the headings. */
  line: number;
  /** The cells as typed, a column the file lacks being empty. */
  cells: Cells;
  problems: Problem[];
  /** What the stocked cell reads as; null for a customer, or a word that is not one. */
  stocked: boolean | null;
  /** Set when the row holds. */
  request: ListRequest | null;
};

export type ReadResult =
  | { kind: 'read'; rows: ReadRow[] }
  | { kind: 'failed'; reason: 'no-code' | 'no-name' | 'no-rows' | 'too-many' };

const NAME_MAX = 200;

/**
 * The sheet's first row is its headings, in either language and any order; every row after is a
 * record unless it is empty. The file fails as a whole when it has no code column or no name
 * column, no row, or more than 500 rows. Otherwise each row is checked as the BFF checks an add,
 * as far as the browser can know: every column the list needs is needed; a code taken in the list
 * (`taken`, in capitals) or given by an earlier row that holds is refused, and so is a unit or a
 * price that does not fit.
 */
export function readList(kind: ListKind, table: Table, taken: ReadonlySet<string>): ReadResult {
  const keys = LISTS[kind].columns;
  const filled = table
    .map((row, index) => ({ row, line: index + 1 }))
    .filter(({ row }) => row.some((cell) => textOf(cell) !== ''));
  const headings = filled[0]?.row ?? [];
  const body = filled.slice(1);
  const where = new Map<ColumnKey, number>();
  headings.forEach((cell, index) => {
    for (const key of keys) {
      for (const language of Object.keys(DICTIONARIES) as Language[]) {
        if (plain(headingOf(key, language)) === plain(textOf(cell)) && !where.has(key)) {
          where.set(key, index);
        }
      }
    }
  });
  if (!where.has('code')) return { kind: 'failed', reason: 'no-code' };
  if (!where.has('name')) return { kind: 'failed', reason: 'no-name' };
  if (body.length === 0) return { kind: 'failed', reason: 'no-rows' };
  if (body.length > IMPORT_MAX_ROWS) return { kind: 'failed', reason: 'too-many' };

  const given = new Set<string>();
  const rows = body.map(({ row, line }): ReadRow => {
    const cells: Cells = Object.fromEntries(
      keys.map((key) => [key, textOf(row[where.get(key) ?? -1])]),
    );
    const cell = (key: ColumnKey) => cells[key] ?? '';
    const problems: Problem[] = [];
    if (cell('name') === '' || cell('name').length > NAME_MAX) problems.push({ kind: 'name' });
    const typed = cell('code');
    const code = normaliseEmployeeCode(typed);
    if (typed === '') problems.push({ kind: 'code-missing' });
    else if (!employeeCodeIsValid(typed)) problems.push({ kind: 'code-invalid', code: typed });
    else if (taken.has(code)) problems.push({ kind: 'code-taken', code });
    else if (given.has(code)) problems.push({ kind: 'code-twice', code });
    const extra: Record<string, unknown> = {};
    for (const key of ['phone', 'address', 'note'] as const) {
      if (cell(key) !== '') extra[key] = cell(key);
    }
    let asked: ListRequest;
    let stocked: boolean | null = null;
    if (kind === 'customers') {
      asked = { code, name: cell('name'), extra };
    } else {
      if (cell('unit') === '' || cell('unit').length > UNIT_MAX) problems.push({ kind: 'unit' });
      const price = readPrice(cell('price'));
      if (price === null) problems.push({ kind: 'price', typed: cell('price') });
      stocked = readStocked(cell('stocked'));
      if (stocked === null) problems.push({ kind: 'stocked', typed: cell('stocked') });
      asked = {
        code,
        name: cell('name'),
        unit: cell('unit'),
        price: price ?? 0,
        stocked: stocked ?? true,
        extra,
      };
    }
    // The row as the add reads it, so no row that the add would refuse is offered.
    const schema = kind === 'customers' ? addCustomerRequestSchema : addProductRequestSchema;
    if (problems.length === 0 && !schema.safeParse(asked).success) problems.push({ kind: 'row' });
    if (problems.length === 0) given.add(code);
    return { line, cells, problems, stocked, request: problems.length > 0 ? null : asked };
  });
  return { kind: 'read', rows };
}
