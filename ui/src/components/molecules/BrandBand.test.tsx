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

  it('241.1 step 2: draws the name as the first heading, the look unchanged', () => {
    draw();

    const name = screen.getByRole('heading', { level: 1, name: 'Acme' });
    expect(name.style.fontWeight).toBe('700');
    expect(name.style.getPropertyValue('--title-fz')).toBe('var(--mantine-font-size-md)');
    expect(name.style.lineHeight).toBe('var(--mantine-line-height-md)');
  });

  it('2: draws the name alone with no logo', () => {
    draw();

    expect(screen.getByText('Acme')).toBeDefined();
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('BrandBand, the formatted name and the description', () => {
  const drawn = (formatted?: string, description?: string) =>
    render(
      <MantineProvider theme={themeOf('#2f7d6d')} env="test">
        <BrandBand name="Acme" formatted={formatted} description={description} />
      </MantineProvider>,
    );

  it('3: draws the formatted name as the heading, read by the plain name', () => {
    const { container } = drawn('<b>Ac</b>me');

    expect(container.querySelector('h1 [aria-hidden="true"] b')?.textContent).toBe('Ac');
    expect(screen.getByRole('heading', { level: 1, name: 'Acme' })).toBeDefined();
  });

  it('4: draws the description in a caption under the name, and nothing where none is set', () => {
    const { unmount } = drawn(undefined, 'Building materials');
    const name = screen.getByRole('heading', { level: 1, name: 'Acme' });
    const caption = screen.getByText('Building materials');
    expect(name.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(name.parentElement).toBe(caption.parentElement);
    unmount();

    const bare = drawn(undefined, '');
    expect(bare.container.querySelectorAll('p')).toHaveLength(0);
  });
});
