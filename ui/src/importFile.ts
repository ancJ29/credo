import type { Table } from './importSheet';

/** The two libraries are loaded here, on the import page and nowhere else, so the bundle every
 * other page loads holds neither. Both are the browser entries. */

/** The first sheet of an `.xlsx` file as rows of cells; rejects when it is not one. */
export async function readFirstSheet(file: Blob): Promise<Table> {
  const { readSheet } = await import('read-excel-file/browser');
  return (await readSheet(file)) as Table;
}

/** An `.xlsx` file of these sheets, every cell Text (`@`, the format write-excel-file's documentation
 * gives to stop Excel reading a text as a number or a date), the first row of each in bold. A
 * column's format cannot be set, only a cell's, so the cells a person fills in later are General. */
export async function writeWorkbook(sheets: { name: string; rows: string[][] }[]): Promise<Blob> {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  return await writeExcelFile(
    sheets.map(({ name, rows }) => ({
      sheet: name,
      data: rows.map((row, at) =>
        row.map((value) => ({
          value,
          type: String,
          format: '@',
          ...(at === 0 ? { fontWeight: 'bold' as const } : {}),
        })),
      ),
      columns: rows[0].map(() => ({ width: 28 })),
    })),
  ).toBlob();
}
