import { type Language } from '@credo/shared';
import {
  DEMO_CUSTOMER_IMPORT_ROWS,
  DEMO_IMPORT_ROWS,
  DEMO_PRODUCT_IMPORT_ROWS,
  DEMO_STAFF_SETUP,
} from '@credo/shared/demo';
import { writeWorkbook } from './importFile';
import { columnsOf, headingOf } from './importSheet';
import { headingOf as listHeadingOf, LISTS } from './listSheet';

/** An `.xlsx` file's media type. */
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** The files the demo company's root chooses: the staff file (`import`, or `import-no-name`
 * without the name column), the customers' (`customers`, or `customers-no-code` without the code
 * column) and the products'. */
export type DemoFile = 'import' | 'import-no-name' | 'customers' | 'customers-no-code' | 'products';

/** A demo file as an Excel file in a language: its headings and the data set's rows. It is what the
 * walks page and the walk spec both put in the file picker. */
export async function demoImportFile(language: Language, which: DemoFile) {
  let rows: string[][];
  let sheet = 'Staff';
  if (which === 'import' || which === 'import-no-name') {
    const columns = columnsOf(DEMO_STAFF_SETUP).filter(
      (column) => which === 'import' || column.key !== 'name',
    );
    rows = [
      columns.map((column) => headingOf(column, language)),
      ...DEMO_IMPORT_ROWS.map((row) =>
        columns.map((column) => (row as Record<string, string | undefined>)[column.key] ?? ''),
      ),
    ];
  } else {
    sheet = 'List';
    const kind = which === 'products' ? 'products' : 'customers';
    const columns = LISTS[kind].columns.filter(
      (key) => which !== 'customers-no-code' || key !== 'code',
    );
    const source = kind === 'products' ? DEMO_PRODUCT_IMPORT_ROWS : DEMO_CUSTOMER_IMPORT_ROWS;
    rows = [
      columns.map((key) => listHeadingOf(key, language)),
      ...source.map((row) => columns.map((key) => row[key] ?? '')),
    ];
  }
  const blob = await writeWorkbook([{ name: sheet, rows }]);
  return new File([blob], `${which}.xlsx`, { type: XLSX });
}
