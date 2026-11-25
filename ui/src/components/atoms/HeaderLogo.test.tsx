import { cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { draw } from '../../../tests/render';
import { HeaderLogo } from './HeaderLogo';

const LOGO = '/logo.png';
const ON_COLOUR = '/logo-on-colour.png';

afterEach(cleanup);

/** What the header's mark is: the address of the picture it draws, its tile, or the stand-in. */
function seen(white: boolean, logo?: string, logoOnColour?: string) {
  const { container, unmount } = draw(
    <HeaderLogo logo={logo} logoOnColour={logoOnColour} white={white} />,
  );
  const image = container.querySelector('img');
  const found = {
    src: image?.getAttribute('src') ?? null,
    tile: image?.style.backgroundColor ?? '',
    standIn: container.querySelector('svg.tabler-icon-brand-adobe') !== null,
  };
  unmount();
  return found;
}

describe('HeaderLogo, which logo where', () => {
  it('14: on the coloured header the coloured header’s logo is drawn bare where both are set', () => {
    expect(seen(false, LOGO, ON_COLOUR)).toEqual({ src: ON_COLOUR, tile: '', standIn: false });
  });

  it('14: on the coloured header the one logo alone sits on a white tile', () => {
    const found = seen(false, LOGO, undefined);

    expect(found.src).toBe(LOGO);
    expect(found.tile).toContain('white');
    expect(found.standIn).toBe(false);
  });

  it('14: on the coloured header the coloured header’s logo alone is drawn bare', () => {
    expect(seen(false, undefined, ON_COLOUR)).toEqual({ src: ON_COLOUR, tile: '', standIn: false });
  });

  it('14: on the coloured header with no logo the stand-in is drawn', () => {
    expect(seen(false)).toEqual({ src: null, tile: '', standIn: true });
  });

  it('14: on the white header the logo is drawn, with or without the coloured header’s', () => {
    expect(seen(true, LOGO, ON_COLOUR)).toEqual({ src: LOGO, tile: '', standIn: false });
    expect(seen(true, LOGO, undefined)).toEqual({ src: LOGO, tile: '', standIn: false });
  });

  it('14: on the white header the coloured header’s logo alone is not drawn, nor is none', () => {
    expect(seen(true, undefined, ON_COLOUR)).toEqual({ src: null, tile: '', standIn: true });
    expect(seen(true)).toEqual({ src: null, tile: '', standIn: true });
  });

  it('14: the picture fills the stand-in’s 36-pixel square, contained, with an empty alt', () => {
    const { container } = draw(<HeaderLogo logo={LOGO} white />);
    const image = container.querySelector('img')!;

    expect(image.getAttribute('alt')).toBe('');
    expect(image.style.width).toBe('36px');
    expect(image.style.height).toBe('36px');
    expect(image.style.objectFit).toBe('contain');
  });
});

describe('HeaderLogo, a logo that fails to load', () => {
  it('15: draws the stand-in, and draws a new address again', () => {
    const { container, rerender } = draw(<HeaderLogo logo="/gone.png" white />);
    fireEvent.error(container.querySelector('img')!);

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg.tabler-icon-brand-adobe')).not.toBeNull();

    rerender(<HeaderLogo logo="/back.png" white />);

    expect(container.querySelector('img')?.getAttribute('src')).toBe('/back.png');
    expect(container.querySelector('svg.tabler-icon-brand-adobe')).toBeNull();
  });
});
