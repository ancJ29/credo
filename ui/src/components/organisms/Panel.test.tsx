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
});
