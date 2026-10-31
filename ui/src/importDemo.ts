import { type Language } from '@credo/shared';
import {
  DEMO_CUSTOMER_IMPORT_ROWS,
  DEMO_IMPORT_ROWS,
  DEMO_PRODUCT_IMPORT_ROWS,
  DEMO_STAFF_SETUP,
} from '@credo/shared/demo';
import { readFirstSheet, writeWorkbook } from './importFile';
import { columnsOf, headingOf } from './importSheet';
import {
  type Cells,
  type ColumnKey,
  headingOf as listHeadingOf,
  type ListKind,
  LISTS,
  readList,
} from './listSheet';

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
    const kind = which === 'products' ? 'products' : 'customers';
    return await listFile(
      kind,
      language,
      kind === 'products' ? DEMO_PRODUCT_IMPORT_ROWS : DEMO_CUSTOMER_IMPORT_ROWS,
      `${which}.xlsx`,
      which === 'customers-no-code' ? 'code' : undefined,
    );
  }
  const blob = await writeWorkbook([{ name: 'Staff', rows }]);
  return new File([blob], `${which}.xlsx`, { type: XLSX });
}

/** A list's Excel file in a language: its headings (without the column `drop` names, when one is) and
 * these rows by column. The demo files the presenter chooses are made with it. */
export async function listFile(
  kind: ListKind,
  language: Language,
  source: Cells[],
  name: string,
  drop?: ColumnKey,
) {
  const columns = LISTS[kind].columns.filter((key) => key !== drop);
  const rows = [
    columns.map((key) => listHeadingOf(key, language)),
    ...source.map((row) => columns.map((key) => row[key] ?? '')),
  ];
  const blob = await writeWorkbook([{ name: 'List', rows }]);
  return new File([blob], name, { type: XLSX });
}

/** What the import page would say of a list file, given the codes the list already holds: how many
 * rows hold, how many name a code already there, and how many are refused for any other reason. */
export async function readListFile(kind: ListKind, file: Blob, taken: ReadonlySet<string>) {
  const read = readList(kind, await readFirstSheet(file), taken);
  if (read.kind === 'failed') throw new Error(`the file is refused as a whole: ${read.reason}`);
  const held = read.rows.filter((row) => row.problems.length === 0).length;
  const already = read.rows.filter((row) =>
    row.problems.some((problem) => problem.kind === 'code-taken'),
  ).length;
  return { holds: held, taken: already, refused: read.rows.length - held - already };
}
