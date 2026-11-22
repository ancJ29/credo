import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { draw } from '../../../tests/render';
import { ROLES, SPACING } from '../../design-system/tokens';
import { Panel } from './Panel';

describe('Panel', () => {
  it('231 case 7: a panel draws its edge and padding, its title over what it holds', () => {
    draw(
      <Panel title="Delivery">
        <p>Inside</p>
      </Panel>,
    );

    const heading = screen.getByRole('heading', { level: 3, name: 'Delivery' });
    const stack = heading.parentElement!;
    const panel = stack.parentElement!;
    expect(panel.getAttribute('data-with-border')).toBe('true');
    expect(panel.style.borderColor).toBe(ROLES.border);
    // Mantine writes 16px as 1rem in its scale.
    expect(SPACING.md).toBe('16px');
    expect(panel.style.padding).toBe('calc(1rem * var(--mantine-scale))');
    expect(stack.style.getPropertyValue('--stack-gap')).toBe('calc(1rem * var(--mantine-scale))');
    expect(stack.textContent).toBe('DeliveryInside');
    expect(heading.compareDocumentPosition(screen.getByText('Inside'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('231 case 7: with no title it draws no heading', () => {
    draw(
      <Panel>
        <p>Inside</p>
      </Panel>,
    );

    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByText('Inside')).toBeDefined();
  });

  it('236 case 4: a panel given an address is one link over the block, its words in their colour', () => {
    draw(
      <Panel title="Delivery" to="/my-deliveries/2026-11-23/r1">
        <p>Inside</p>
      </Panel>,
    );

    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/my-deliveries/2026-11-23/r1');
    expect(link.getAttribute('data-with-border')).toBe('true');
    expect(link.style.color).toBe('inherit');
    expect(link.style.textDecoration).toBe('none');
    expect(link.style.borderColor).toBe(ROLES.border);
    expect(link.style.padding).toBe('calc(1rem * var(--mantine-scale))');
    expect(link.contains(screen.getByRole('heading', { level: 3, name: 'Delivery' }))).toBe(true);
    expect(link.contains(screen.getByText('Inside'))).toBe(true);
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('236 case 4: with no address it is no link', () => {
    draw(
      <Panel>
        <p>Inside</p>
      </Panel>,
    );

    expect(screen.queryByRole('link')).toBeNull();
  });
});
