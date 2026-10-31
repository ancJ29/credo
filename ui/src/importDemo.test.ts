import { describe, expect, it } from 'vitest';
import { listFile, readListFile } from './importDemo';
import { readFirstSheet } from './importFile';

describe('a list file made from rows', () => {
  it('has the list’s headings in the language and the rows by column, and the page reads it: rows that hold, a code already there, a row refused', async () => {
    const file = await listFile(
      'products',
      'en',
      [
        { code: 'SP-101', name: 'Cement', unit: 'bag', price: '95.000' },
        { code: 'sp-102', name: 'Sand', unit: 'm³', price: '180000', stocked: 'No' },
        { code: 'SP-002', name: 'Held', unit: 'bag', price: '1000' },
        { code: 'SP-103', name: 'Rebar', unit: 'bar', price: 'negotiable' },
      ],
      'p.xlsx',
    );

    const table = await readFirstSheet(file);
    const checked = await readListFile('products', file, new Set(['SP-002']));

    expect(file.name).toBe('p.xlsx');
    expect(table[0]).toEqual(['Code', 'Name', 'Unit', 'Price (VND)', 'Stocked', 'Note']);
    expect(checked).toEqual({ holds: 2, taken: 1, refused: 1 });
  });

  it('leaves out the column it is told to, and a file that is refused as a whole is an error naming why', async () => {
    const file = await listFile('customers', 'en', [{ code: 'KH-1', name: 'A' }], 'c.xlsx', 'code');

    await expect(readListFile('customers', file, new Set())).rejects.toThrow(
      'refused as a whole: no-code',
    );
  });
});
