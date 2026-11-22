import { Table } from '@mantine/core';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { draw } from '../../../tests/render';
import { WIDTHS } from '../../design-system/tokens';
import { TableScroll } from './TableScroll';

const table = (
  <Table>
    <Table.Tbody>
      <Table.Tr>
        <Table.Td>An Phat</Table.Td>
      </Table.Tr>
    </Table.Tbody>
  </Table>
);

describe('TableScroll', () => {
  it('222 case 14: its table keeps WIDTHS.table as its least width, the table scrolling inside it', () => {
    draw(
      <>
        <TableScroll>{table}</TableScroll>
        <div data-testid="reference">
          <Table.ScrollContainer minWidth={WIDTHS.table}>{table}</Table.ScrollContainer>
        </div>
      </>,
    );
    const frames = document.querySelectorAll('[style*="--table-min-width"]');
    expect(frames).toHaveLength(2);
    const minOf = (element: Element) =>
      /--table-min-width: ([^;]+);/.exec(element.getAttribute('style')!)?.[1];
    expect(minOf(frames[0])).toBe(minOf(frames[1]));
    expect(minOf(frames[0])).toContain('40rem');
    expect(screen.getAllByRole('table')).toHaveLength(2);
    expect(frames[0].contains(screen.getAllByRole('table')[0])).toBe(true);
  });
});
