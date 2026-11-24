import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { draw } from '../../tests/render';
import { themeOf } from '../design-system/appTheme';
import { BrandPreview } from './BrandPreview';

const BRICK = '#b5472a';
const picture = (container: HTMLElement, which: 'header' | 'card') =>
  container.querySelector<HTMLElement>(`[data-preview="${which}"]`)!;

describe('the preview of the header and the sign-in card', () => {
  it('8: draws the coloured header, the white one and a card with no logo', () => {
    const coloured = draw(<BrandPreview name="An Phat" logo="/logo.png" brand={BRICK} />);
    const header = picture(coloured.container, 'header');
    expect(header.textContent).toContain('An Phat');
    expect(header.getAttribute('data-white')).toBeNull();
    expect(header.getAttribute('style')).toContain('var(--credo-header-gradient)');
    const card = picture(coloured.container, 'card');
    expect(card.textContent).toContain('An Phat');
    expect(card.textContent).toContain('Sign in to your account');
    expect(card.querySelector('img')?.getAttribute('src')).toBe('/logo.png');
    const scope = coloured.container.querySelector<HTMLElement>('[data-colour-scope]')!;
    expect(scope.style.getPropertyValue('--mantine-color-brand-7')).toBe(
      themeOf(BRICK).colors?.['brand']?.[7],
    );
    coloured.unmount();

    const white = draw(<BrandPreview name="An Phat" brand={BRICK} whiteHeader />);
    expect(picture(white.container, 'header').getAttribute('data-white')).toBe('true');
    expect(picture(white.container, 'header').getAttribute('style')).toBeNull();
    // no logo: the card draws no picture
    expect(picture(white.container, 'card').querySelector('img')).toBeNull();
  });

  it('hides both pictures from a reader and takes no focus: only the title and two captions are read', () => {
    const { container } = draw(<BrandPreview name="An Phat" logo="/logo.png" brand={BRICK} />);

    for (const which of ['header', 'card'] as const) {
      const shown = picture(container, which);
      expect(shown.getAttribute('aria-hidden')).toBe('true');
      expect(shown.hasAttribute('inert')).toBe(true);
    }
    expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
      'Preview',
    ]);
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(container.querySelector('header')).toBeNull();
    expect(screen.getByText("The header, as the company's people see it")).toBeDefined();
  });
});
