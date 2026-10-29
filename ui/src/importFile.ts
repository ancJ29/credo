import type { Table } from './importSheet';

/** The two libraries are loaded here, on the import page and nowhere else, so the bundle every
 * other page loads holds neither. Both are the browser entries. */

/** The first sheet of an `.xlsx` file as rows of cells; rejects when it is not one. */
export async function readFirstSheet(file: Blob): Promise<Table> {
  const { readSheet } = await import('read-excel-file/browser');
  return (await readSheet(file)) as Table;
}

/** An `.xlsx` file of these sheets, every cell text, the first row of each in bold. */
export async function writeWorkbook(sheets: { name: string; rows: string[][] }[]): Promise<Blob> {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  return await writeExcelFile(
    sheets.map(({ name, rows }) => ({
      sheet: name,
      data: rows.map((row, at) =>
        row.map((value) => ({ value, type: String, ...(at === 0 ? { fontWeight: 'bold' as const } : {}) })),
      ),
      columns: rows[0].map(() => ({ width: 28 })),
    })),
  ).toBlob();
}

/** Hands a file to the person's browser to save. */
export function saveAs(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
