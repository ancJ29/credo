import { Table } from '@mantine/core';
import type { ReactNode } from 'react';
import { WEIGHTS } from '../../design-system/tokens';
import { TableScroll } from './TableScroll';

/** A table of rows under headings, in a scrolling frame: numbers at the right, an optional total line in bold, every row lit under the pointer. It takes its words as props. */
export function DataTable({
  columns,
  rows,
  total,
}: {
  columns: Column[];
  rows: Row[];
  total?: ReactNode[];
}) {
  const side = (index: number) => (columns[index].number ? 'right' : undefined);
  return (
    <TableScroll>
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            {columns.map(({ heading, number }) => (
              <Table.Th key={heading} ta={number ? 'right' : undefined}>
                {heading}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map(({ key, cells }) => (
            <Table.Tr key={key}>
              {cells.map((cell, index) => (
                <Table.Td key={columns[index].heading} ta={side(index)}>
                  {cell}
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
        {total && (
          <Table.Tfoot>
            <Table.Tr fw={WEIGHTS.emphasis}>
              {total.map((cell, index) => (
                <Table.Td key={columns[index].heading} ta={side(index)}>
                  {cell}
                </Table.Td>
              ))}
            </Table.Tr>
          </Table.Tfoot>
        )}
      </Table>
    </TableScroll>
  );
}

/** A column: its heading, and whether it holds a number, which the part sets at the right. */
type Column = { heading: string; number?: boolean };

/** A row: its key, and one cell for each column, a name that opens a page being a link. */
type Row = { key: string; cells: ReactNode[] };
