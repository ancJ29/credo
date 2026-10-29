import { type Language } from '@credo/shared';
import { DEMO_IMPORT_ROWS, DEMO_STAFF_SETUP } from '@credo/shared/demo';
import { writeWorkbook } from './importFile';
import { columnsOf, headingOf } from './importSheet';

/** An `.xlsx` file's media type. */
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** The staff file the demo company's root chooses, as an Excel file in a language: its headings
 * and the data set's rows (`import`), or the same without the name column (`import-no-name`). It
 * is what the walks page and the walk spec both put in the file picker. */
export async function demoImportFile(language: Language, which: 'import' | 'import-no-name') {
  const columns = columnsOf(DEMO_STAFF_SETUP).filter(
    (column) => which === 'import' || column.key !== 'name',
  );
  const blob = await writeWorkbook([
    {
      name: 'Staff',
      rows: [
        columns.map((column) => headingOf(column, language)),
        ...DEMO_IMPORT_ROWS.map((row) =>
          columns.map((column) => (row as Record<string, string | undefined>)[column.key] ?? ''),
        ),
      ],
    },
  ]);
  return new File([blob], `${which}.xlsx`, { type: XLSX });
}
