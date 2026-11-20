import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { themeOf } from '../../design-system/appTheme';
import { LogoTile } from './LogoTile';

const draw = (logo?: string) =>
  render(
    <MantineProvider theme={themeOf('#2f7d6d')} env="test">
      <LogoTile logo={logo} alt="Acme" />
    </MantineProvider>,
  );

describe('LogoTile', () => {
  it('1: draws the logo in a 44-px tile with corners of 10 and a brand-2 line', () => {
    draw('/logo.png');

    const tile = screen.getByRole('img', { name: 'Acme' });
    expect(tile.getAttribute('src')).toBe('/logo.png');
    expect(tile.style.width).toBe('44px');
    expect(tile.style.height).toBe('44px');
    expect(tile.style.borderRadius).toBe('10px');
    expect(tile.style.border).toBe('1px solid var(--credo-brand-line)');
  });

  it('1: draws nothing when there is no logo', () => {
    draw();

    expect(screen.queryByRole('img')).toBeNull();
  });

  it('1: draws nothing when the logo fails to load, and draws a new logo again', () => {
    const { rerender } = draw('/gone.png');
    fireEvent.error(screen.getByRole('img', { name: 'Acme' }));

    expect(screen.queryByRole('img')).toBeNull();

    rerender(
      <MantineProvider theme={themeOf('#2f7d6d')} env="test">
        <LogoTile logo="/back.png" alt="Acme" />
      </MantineProvider>,
    );
    expect(screen.getByRole('img', { name: 'Acme' }).getAttribute('src')).toBe('/back.png');
  });
});
