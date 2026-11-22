import { readFileSync } from 'node:fs';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IconSettings } from '@tabler/icons-react';
import { useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../../tests/render';
import { ICON_SIZES, SPACING } from '../../design-system/tokens';
import { MenuRow } from './MenuRow';

/** The path the router is at. */
function Here() {
  return <p data-testid="here">{useLocation().pathname}</p>;
}

/** The stylesheet without its comments, and one rule of it. */
const css = readFileSync(`${import.meta.dirname}/MenuRow.module.css`, 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);
const rule = (selector: string) => css.slice(css.indexOf(`\n${selector} {`)).split('}')[0];

describe('MenuRow', () => {
  it('231 case 9: a row draws its icon, its words and the arrow, and opens its address', async () => {
    draw(
      <>
        <MenuRow icon={IconSettings} to="/settings/more">
          Settings
        </MenuRow>
        <Here />
      </>,
    );

    const row = screen.getByRole('link', { name: 'Settings' });
    expect(row.getAttribute('href')).toBe('/settings/more');
    expect(row.children).toHaveLength(3);
    expect(row.children[0].tagName.toLowerCase()).toBe('svg');
    expect(row.children[0].getAttribute('width')).toBe('20');
    expect(row.children[1].textContent).toBe('Settings');
    const arrow = row.children[2];
    expect(arrow.tagName.toLowerCase()).toBe('svg');
    expect(arrow.getAttribute('width')).toBe(String(ICON_SIZES.field));
    expect(arrow.getAttribute('class')).toContain('go');

    await userEvent.click(row);
    expect(screen.getByTestId('here').textContent).toBe('/settings/more');
  });

  it('231 case 9: a row with no address acts when pressed, with no arrow and no icon where none is given', async () => {
    const act = vi.fn();
    draw(<MenuRow onClick={act}>Sign out</MenuRow>);

    const row = screen.getByRole('button', { name: 'Sign out' });
    expect(row.children).toHaveLength(1);
    expect(row.querySelector('svg')).toBeNull();
    await userEvent.click(row);
    expect(act).toHaveBeenCalledTimes(1);
  });

  it('231 case 9: its padding, gap and size, the line between rows and its hover are the stylesheet’s', () => {
    expect(SPACING.sm).toBe('12px');
    expect(SPACING.md).toBe('16px');
    const row = rule('.row');
    expect(row).toContain(`gap: ${SPACING.sm};`);
    expect(row).toContain(`padding: ${SPACING.sm} ${SPACING.md};`);
    expect(row).toContain('font-size: var(--credo-menu-size);');
    expect(rule('.row + .row')).toContain(
      'border-top: 1px solid var(--mantine-color-default-border);',
    );
    expect(rule('.row:hover')).toContain('background: var(--mantine-color-default-hover);');
    expect(rule('.go')).toContain('margin-left: auto;');
  });
});
