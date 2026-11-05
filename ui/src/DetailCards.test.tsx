import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { draw } from '../tests/render';
import { DetailColumns } from './DetailCards';

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
});
