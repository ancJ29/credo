import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { draw } from '../../../tests/render';
import { TOKENS, WEIGHTS } from '../../design-system/tokens';
import { DataTable } from './DataTable';

const columns = [{ heading: 'Product' }, { heading: 'Quantity', number: true }];
const rows = [
  { key: 'rice', cells: ['Sticky rice', 12] },
  { key: 'tea', cells: ['Jasmine tea', 3] },
];

/** The path the router is at. */
function Here() {
  return <p data-testid="here">{useLocation().pathname}</p>;
}

describe('DataTable', () => {
  it('231 case 6: a number column and the total sit at the right, and every row lights under the pointer', () => {
    draw(<DataTable columns={columns} rows={rows} total={['Total', 15]} />);

    const sideOf = (element: HTMLElement) => element.style.textAlign;
    expect(sideOf(screen.getByRole('columnheader', { name: 'Product' }))).toBe('');
    expect(sideOf(screen.getByRole('columnheader', { name: 'Quantity' }))).toBe('right');
    for (const [text, side] of [
      ['Sticky rice', ''],
      ['12', 'right'],
      ['Jasmine tea', ''],
      ['3', 'right'],
      ['Total', ''],
      ['15', 'right'],
    ]) {
      expect(sideOf(screen.getByRole('cell', { name: text })), text).toBe(side);
    }
    const totalRow = screen.getByRole('cell', { name: 'Total' }).closest('tr')!;
    expect(totalRow.style.fontWeight).toBe(String(WEIGHTS.emphasis));
    expect(totalRow.closest('tfoot')).not.toBeNull();
    expect(within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row')).toHaveLength(2);

    const table = screen.getByRole('table');
    for (const name of ['Sticky rice', 'Jasmine tea']) {
      expect(
        screen.getByRole('cell', { name }).closest('tr')!.hasAttribute('data-hover'),
        name,
      ).toBe(true);
    }
    expect(table.getAttribute('style')).toContain(TOKENS.rowHover);
    expect(table.closest('[style*="--table-min-width"]')).not.toBeNull();
  });

  it('231 case 6: with no total it draws no total line', () => {
    draw(<DataTable columns={columns} rows={rows} />);

    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(document.querySelector('tfoot')).toBeNull();
  });

  it('231 case 6: a name that is a link in a cell opens its page', async () => {
    draw(
      <>
        <DataTable
          columns={[{ heading: 'Name' }]}
          rows={[{ key: 'an', cells: [<Link to="/customers/1">An Nguyen</Link>] }]}
        />
        <Here />
      </>,
    );

    expect(screen.getByTestId('here').textContent).toBe('/settings');
    await userEvent.setup().click(screen.getByRole('link', { name: 'An Nguyen' }));
    expect(screen.getByTestId('here').textContent).toBe('/customers/1');
  });
});
