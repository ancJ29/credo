import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { draw } from '../../tests/render';
import { DetailCard, DetailColumns } from './DetailCards';

const columns = (container: HTMLElement) => [...container.querySelectorAll('.mantine-Grid-col')];
/** The width rules the grid's columns wrote: one block each, with its media queries. */
const widths = (container: HTMLElement) =>
  [...container.querySelectorAll('.mantine-Grid-inner > style')].map((block) => block.textContent);

describe('the frame of a detail page', () => {
  it('Without a side, the main column is the only one and takes the full width at every width', () => {
    const { container } = draw(<DetailColumns main={<p>Details</p>} />);

    expect(screen.getByText('Details')).toBeTruthy();
    expect(columns(container)).toHaveLength(1);
    // one span of 12 writes no media query: the column is the same at every width
    expect(widths(container)).toHaveLength(1);
    expect(widths(container)[0]).not.toContain('@media');
  });

  it('With a side, there are two columns, the details first, seven twelfths and five from 992', () => {
    const { container } = draw(<DetailColumns main={<p>Details</p>} side={<p>Actions</p>} />);

    const [first, second, ...rest] = columns(container);
    expect(rest).toHaveLength(0);
    expect(first?.textContent).toBe('Details');
    expect(second?.textContent).toBe('Actions');
    expect(widths(container).every((block) => block?.includes('@media(min-width: 62em)'))).toBe(
      true,
    );
  });

  it('9: with the side first, the side comes above the main below 992 and the main first without it', () => {
    const order = (container: HTMLElement) =>
      columns(container).map((column) => (column as HTMLElement).style.order);
    const without = draw(<DetailColumns main={<p>Details</p>} side={<p>Actions</p>} />);
    expect(without.container.querySelector('[style*="order"]')).toBeNull();
    expect(order(without.container)).toEqual(['', '']);
    without.unmount();

    const first = draw(<DetailColumns sideFirst main={<p>Details</p>} side={<p>Actions</p>} />);
    const [main, side] = columns(first.container);
    expect(main?.textContent).toBe('Details');
    expect(side?.textContent).toBe('Actions');
    // the phone's order puts the side first; from 992 the main is first again
    const rules = [...first.container.querySelectorAll('.mantine-Grid-inner > style')]
      .map((block) => block.textContent)
      .join('');
    expect(rules).toMatch(/--col-order:2/);
    expect(rules).toMatch(/--col-order:1/);
    expect((side as HTMLElement).querySelector('[class*="stuck"]')).not.toBeNull();
    expect((main as HTMLElement).querySelector('[class*="stuck"]')).toBeNull();
  });

  it.each([null, false, undefined])(
    'A side of %s counts as none: one column, no blank half',
    (side) => {
      const { container } = draw(<DetailColumns main={<p>Details</p>} side={side} />);

      expect(columns(container)).toHaveLength(1);
      expect(widths(container)[0]).not.toContain('@media');
    },
  );
});

describe('a section card', () => {
  it('12: shows its icon in a grey tile and its title small, bold, in capitals', () => {
    draw(
      <DetailCard icon={<svg data-testid="glyph" />} title="Basics">
        <p>Inside</p>
      </DetailCard>,
    );

    const tile = screen.getByTestId('section-icon');
    expect(tile.getAttribute('style')).toContain('var(--mantine-color-gray-');
    expect(tile.contains(screen.getByTestId('glyph'))).toBe(true);
    const title = screen.getByRole('heading', { name: 'Basics', level: 3 });
    expect(title.getAttribute('style')).toContain('text-transform: uppercase');
    expect(title.getAttribute('style')).toContain('--title-fz: var(--mantine-font-size-xs)');
    expect(title.getAttribute('style')).toContain('font-weight: 700');
    expect(screen.getByText('Inside')).toBeTruthy();
  });
});
