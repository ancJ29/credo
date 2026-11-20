import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { themeOf } from '../../design-system/appTheme';
import { BrandBand } from './BrandBand';

const draw = (logo?: string) =>
  render(
    <MantineProvider theme={themeOf('#2f7d6d')} env="test">
      <BrandBand name="Acme" logo={logo} />
    </MantineProvider>,
  );

describe('BrandBand', () => {
  it('2: draws the tile beside the name, bold and centred on the brand’s palest shade with a brand-1 line beneath', () => {
    draw('/logo.png');

    const name = screen.getByText('Acme');
    expect(name.style.fontWeight).toBe('700');
    const band = name.parentElement!;
    expect(band.style.getPropertyValue('--group-justify')).toBe('center');
    expect(band.style.background).toBe('var(--credo-brand-tint)');
    expect(band.style.borderBottom).toBe('1px solid var(--credo-brand-tint-strong)');
    expect(band.style.padding).toBe('28px 40px');
    expect(band.firstElementChild).toBe(screen.getByRole('img', { name: 'Acme' }));
  });

  it('2: draws the name alone with no logo', () => {
    draw();

    expect(screen.getByText('Acme')).toBeDefined();
    expect(screen.queryByRole('img')).toBeNull();
  });
});
