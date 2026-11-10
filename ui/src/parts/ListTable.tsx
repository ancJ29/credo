import type { Language } from '@credo/shared';
import { Anchor, Table } from '@mantine/core';
import { Link } from 'react-router';
import { type ColumnKey, headingOf, type ListKind, type Shown } from '../listSheet';

type Columns = readonly ColumnKey[];

/** One row of a kind's list, drawn from the columns that kind shows; the name links to its page. */
function ListRow({ kind, shown, row }: { kind: ListKind; shown: Columns; row: Shown }) {
  return (
    <Table.Tr>
      {shown.map((key) => (
        <Table.Td key={key} ta={key === 'price' ? 'right' : undefined}>
          {key === 'name' ? (
            <Anchor component={Link} to={`/${kind}/${row.id}`}>
              {row.name}
            </Anchor>
          ) : (
            row[key]
          )}
        </Table.Td>
      ))}
    </Table.Tr>
  );
}

/** A kind's list as a table: its headings, then one row for each record. */
export function ListTable({
  kind,
  shown,
  rows,
  language,
}: {
  kind: ListKind;
  shown: Columns;
  rows: readonly Shown[];
  language: Language;
}) {
  return (
    <Table.ScrollContainer minWidth={640}>
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            {shown.map((key) => (
              <Table.Th key={key} ta={key === 'price' ? 'right' : undefined}>
                {headingOf(key, language)}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <ListRow key={row.code} kind={kind} shown={shown} row={row} />
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
