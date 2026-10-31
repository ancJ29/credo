import { IMPORT_MAX_ROWS } from '@credo/shared';
import { describe, expect, it } from 'vitest';
import { headingOf, LISTS, readList, readPrice, templateSheets } from './listSheet';
import type { Table } from './importSheet';

const customers = (...rows: string[][]): Table => [['Code', 'Name', 'Phone', 'Address'], ...rows];
const products = (...rows: string[][]): Table => [['Code', 'Name', 'Unit', 'Price (VND)'], ...rows];
const none = new Set<string>();

const problems = (table: Table, kind: 'customers' | 'products' = 'customers', taken = none) => {
  const read = readList(kind, table, taken);
  if (read.kind === 'failed') throw new Error(read.reason);
  return read.rows.map((row) => row.problems.map((found) => found.kind));
};

describe('a price', () => {
  it('A price is a whole number of đồng above zero; typed with dots or commas between the thousands (95.000) it reads as 95000; a decimal, a negative or a word is refused', () => {
    for (const [typed, price] of [
      ['95000', 95000],
      ['95.000', 95000],
      ['95,000', 95000],
      ['1.650.000', 1650000],
      ['1', 1],
      ['1000000000000', 10 ** 12],
    ] as const) {
      expect(readPrice(typed), typed).toBe(price);
    }
    for (const typed of [
      '',
      '0',
      '-5',
      '95.5',
      '95,000.50',
      '1.5000',
      'thương lượng',
      '95k',
      '1000000000001',
      '9'.repeat(30),
    ]) {
      expect(readPrice(typed), typed).toBeNull();
    }
  });
});

describe('the template', () => {
  it('For each list the app gives a template in Vietnamese or English: its columns, two sample rows, and a sheet saying what each column takes', () => {
    for (const kind of ['customers', 'products'] as const) {
      for (const language of ['en', 'vi'] as const) {
        const [sheet, notes] = templateSheets(kind, language);
        const keys = LISTS[kind].columns;

        expect(sheet.rows[0]).toEqual(keys.map((key) => headingOf(key, language)));
        expect(sheet.rows).toHaveLength(3);
        expect(sheet.rows[1]?.[0]).toMatch(/^(KH|SP)-001$/);
        expect(notes.rows).toHaveLength(keys.length + 1);
        // every column says what to write, and whether the row needs it
        for (const [at, key] of keys.entries()) {
          const [heading, needed, write] = notes.rows[at + 1];
          expect(heading).toBe(headingOf(key, language));
          expect(write?.length).toBeGreaterThan(5);
          const must = (LISTS[kind].needed as readonly string[]).includes(key);
          expect(needed === notes.rows[1]?.[1], key).toBe(must);
        }
      }
    }
    // the products' second sample shows the dotted price, which reads
    const [products] = templateSheets('products', 'en');
    expect(products.rows[2]?.[3]).toBe('120.000');
    expect(readPrice(products.rows[2]?.[3])).toBe(120000);
    // the stocked column sits between the price and the note: the first sample Có, the second Không
    expect(products.rows[0]?.slice(3)).toEqual(['Price (VND)', 'Stocked', 'Note']);
    expect([products.rows[1]?.[4], products.rows[2]?.[4]]).toEqual(['Có', 'Không']);
  });
});

describe('reading a file', () => {
  it('A customer needs a code and a name; a product a code, a name, a unit and a price; a row missing one is refused, naming it', () => {
    expect(problems(customers(['KH-1', '', '0900'], ['', 'Có tên'], ['KH-3', 'Đủ']))).toEqual([
      ['name'],
      ['code-missing'],
      [],
    ]);
    expect(
      problems(
        products(
          ['SP-1', 'Thiếu đơn vị', '', '5000'],
          ['SP-2', 'Thiếu giá', 'bao', ''],
          ['SP-3', 'Đơn vị dài', 'x'.repeat(21), '5000'],
          ['SP-4', 'Đủ', 'bao', '5.000'],
        ),
        'products',
      ),
    ).toEqual([['unit'], ['price'], ['unit'], []]);
    expect(problems(customers(['KH-1', 'x'.repeat(201)]))).toEqual([['name']]);
  });

  it('A code is 2 to 20 letters, digits and hyphens, read in capitals, unique in its list; one already in the list, or twice in the file, is refused, and the one there stays as it was', () => {
    const read = readList(
      'customers',
      customers(
        ['kh-1', 'Chữ thường'],
        ['KH-1', 'Lặp trong tệp'],
        ['a b', 'Mã sai'],
        ['K', 'Mã ngắn'],
        ['KH-2', 'Đã có trong danh sách'],
        ['kh-9', 'Tiếp theo'],
      ),
      new Set(['KH-2']),
    );

    expect(read.kind === 'read' && read.rows.map((row) => row.problems)).toEqual([
      [],
      [{ kind: 'code-twice', code: 'KH-1' }],
      [{ kind: 'code-invalid', code: 'a b' }],
      [{ kind: 'code-invalid', code: 'K' }],
      [{ kind: 'code-taken', code: 'KH-2' }],
      [],
    ]);
    // the one that holds is read in capitals, and a refused row gives no code to a later one
    expect(read.kind === 'read' && read.rows.map((row) => row.request?.code)).toEqual([
      'KH-1',
      undefined,
      undefined,
      undefined,
      undefined,
      'KH-9',
    ]);
  });

  it('A customer’s phone, address and note, and a product’s note, are kept as typed and may be empty', () => {
    const table: Table = [
      ['Mã', 'Tên', 'Điện thoại', 'Địa chỉ', 'Ghi chú'],
      ['KH-1', 'Đủ', '0909 000 111', '1 Đường Một', 'Ghi chú'],
      ['KH-2', 'Trống', '', '', ''],
    ];
    const read = readList('customers', table, none);

    expect(read.kind === 'read' && read.rows.map((row) => row.request)).toEqual([
      {
        code: 'KH-1',
        name: 'Đủ',
        extra: { phone: '0909 000 111', address: '1 Đường Một', note: 'Ghi chú' },
      },
      { code: 'KH-2', name: 'Trống', extra: {} },
    ]);
    const noted = readList(
      'products',
      [
        ['Code', 'Name', 'Unit', 'Price (VND)', 'Note'],
        ['SP-1', 'Có chú thích', 'bao', '95.000', 'Bao 50 kg'],
        ['SP-2', 'Không', 'bao', '95000', ''],
      ],
      none,
    );
    expect(noted.kind === 'read' && noted.rows.map((row) => row.request)).toEqual([
      {
        code: 'SP-1',
        name: 'Có chú thích',
        unit: 'bao',
        price: 95000,
        stocked: true,
        extra: { note: 'Bao 50 kg' },
      },
      { code: 'SP-2', name: 'Không', unit: 'bao', price: 95000, stocked: true, extra: {} },
    ]);
  });

  it('A product says whether its stock is kept (Quản lý tồn kho / Stocked: Có or Không). An empty cell reads Có. Không, No, 0 or false read Không; Có, Yes, 1 or true read Có. Any other word refuses the row and names the column', () => {
    const typed = [
      '',
      'Có',
      'co',
      'Yes',
      '1',
      'TRUE',
      'Không',
      'khong',
      'No',
      '0',
      'false',
      'có thể',
    ];
    const table: Table = [
      ['Mã', 'Tên', 'Đơn vị tính', 'Giá (đồng)', 'Quản lý tồn kho'],
      ...typed.map((value, at) => [`P-${at}`, 'Hàng', 'bao', '5000', value]),
    ];
    const read = readList('products', table, none);

    expect(read.kind === 'read' && read.rows.map((row) => row.problems)).toEqual([
      ...typed.slice(0, 11).map(() => []),
      [{ kind: 'stocked', typed: 'có thể' }],
    ]);
    expect(
      read.kind === 'read' &&
        read.rows.slice(0, 11).map((row) => (row.request as { stocked: boolean }).stocked),
    ).toEqual([true, true, true, true, true, true, false, false, false, false, false]);
    // a file with no such column reads every product as stocked
    const without = readList('products', products(['SP-1', 'Một', 'bao', '5000']), none);
    expect(
      without.kind === 'read' && (without.rows[0]?.request as { stocked: boolean }).stocked,
    ).toBe(true);
  });

  it('A price is read from the file as a person typed it: a dotted price holds, and a word is refused with what was typed', () => {
    const read = readList(
      'products',
      products(
        ['SP-1', 'Có dấu chấm', 'bao', '88.000'],
        ['SP-2', 'Một chữ', 'bao', 'thương lượng'],
      ),
      none,
    );

    expect(read.kind === 'read' && read.rows.map((row) => row.problems)).toEqual([
      [],
      [{ kind: 'price', typed: 'thương lượng' }],
    ]);
    expect(read.kind === 'read' && read.rows[0]?.request).toMatchObject({ price: 88000 });
  });

  it('A file over 500 rows, or without its code or name column, is refused before any row is read, saying what to fix', () => {
    const reason = (table: Table) => {
      const read = readList('customers', table, none);
      return read.kind === 'failed' ? read.reason : 'read';
    };

    expect(reason([['Name'], ['Một']])).toBe('no-code');
    expect(reason([['Code'], ['KH-1']])).toBe('no-name');
    expect(reason([['Code', 'Name']])).toBe('no-rows');
    expect(reason([[], ['Code', 'Name'], [null, null]])).toBe('no-rows');
    expect(reason([])).toBe('no-code');
    expect(
      reason(
        customers(...Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, at) => [`K-${at}`, 'Tên'])),
      ),
    ).toBe('too-many');
    expect(
      reason(customers(...Array.from({ length: IMPORT_MAX_ROWS }, (_, at) => [`K-${at}`, 'Tên']))),
    ).toBe('read');
  });

  it('reads the headings in either language, any order, without accents or case, and a column the list lacks as empty', () => {
    const read = readList(
      'customers',
      [
        ['ĐỊA CHỈ', 'tên *', 'MA'],
        [' 5 Đường Năm ', 'Chữ lẫn', 'kh-5'],
        [new Date(Date.UTC(2026, 9, 1)), 'Ngày', 'KH-6'],
      ],
      none,
    );

    expect(read.kind === 'read' && read.rows.map((row) => row.cells)).toEqual([
      { code: 'kh-5', name: 'Chữ lẫn', phone: '', address: '5 Đường Năm', note: '' },
      { code: 'KH-6', name: 'Ngày', phone: '', address: '2026-10-01', note: '' },
    ]);
  });

  it('refuses a row whose details together are too long to save, as the add would', () => {
    expect(problems(customers(['KH-1', 'Dài', '0900', 'x'.repeat(9000)]))).toEqual([['row']]);
  });
});
