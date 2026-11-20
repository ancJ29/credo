import { describe, expect, it } from 'vitest';
import { themeOf, shadesOf } from './appTheme';
import { contrast, onBrand, todayOf, type Surface } from './onBrand';
import { PALETTES } from './palettes';

const SURFACES: Surface[] = ['filled', 'header', 'menu'];
const WHITE = '#ffffff';

const stock = PALETTES.map(({ name, shades }) => ({ name, shades: shadesOf(shades[7]) }));

/** The ratio of a pick's ink against each shade of its span, worked out here, never read from the pick. */
const ratiosOf = (colour: string, shades: readonly string[], span: readonly number[]) =>
  span.map((shade) => contrast(colour, shades[shade]));

describe('onBrand', () => {
  it('1: gives every surface of every stock colour a text at 4.5:1 or more against every shade of its span', () => {
    expect(stock).toHaveLength(9);
    for (const { name, shades } of stock) {
      for (const surface of SURFACES) {
        const pick = onBrand(shades, surface);
        const found = ratiosOf(pick.colour, shades, pick.span);
        expect(Math.min(...found), `${name} ${surface}`).toBeGreaterThanOrEqual(4.5);
        expect(pick.passes).toBe(true);
        expect(pick.least).toBe(Math.min(...found));
      }
    }
  });

  it('2: finds a pass on every surface for each of 4,096 typed colours and five named ones', () => {
    const steps = Array.from({ length: 16 }, (_, at) => at * 17);
    const typed = steps.flatMap((red) =>
      steps.flatMap((green) =>
        steps.map(
          (blue) => `#${[red, green, blue].map((n) => n.toString(16).padStart(2, '0')).join('')}`,
        ),
      ),
    );
    const named = ['#ffeb3b', '#00ffff', '#ffbf00', '#ff0000', '#808080'];
    expect(typed).toHaveLength(4096);
    const failed = [...typed, ...named].flatMap((colour) =>
      SURFACES.filter((surface) => !onBrand(shadesOf(colour), surface).passes).map(
        (surface) => `${colour} ${surface}`,
      ),
    );
    expect(failed).toEqual([]);
  });

  it('2: a colour no text can serve says so, with today’s white', () => {
    const grey = Array.from({ length: 10 }, () => '#777777') as unknown as ReturnType<
      typeof shadesOf
    >;
    const pick = onBrand(grey, 'filled');
    expect(pick.passes).toBe(false);
    expect(pick.ink).toBe('white');
    expect(pick.span).toEqual([6, 7]);
  });

  it('3: keeps white wherever it passes, so steel’s and forest’s spans are today’s', () => {
    for (const name of ['steel', 'forest']) {
      const shades = stock.find((each) => each.name === name)!.shades;
      for (const surface of SURFACES) {
        const pick = onBrand(shades, surface);
        expect(pick.ink, `${name} ${surface}`).toBe('white');
        expect(pick.span).toEqual(todayOf(shades, surface).span);
      }
    }
    // Emerald's header and menu stay white as today; only its buttons turn dark.
    const emerald = stock.find((each) => each.name === 'emerald')!.shades;
    expect(onBrand(emerald, 'header').ink).toBe('white');
    expect(onBrand(emerald, 'menu').ink).toBe('white');
    expect(onBrand(emerald, 'filled').ink).toBe('dark');
  });

  it('4: refuses white on autumn’s shade 6, the planted failing pair', () => {
    const autumn = stock.find((each) => each.name === 'autumn')!.shades;
    expect(contrast(WHITE, autumn[6])).toBeLessThan(4.5);
    const pick = onBrand(autumn, 'filled');
    expect(pick.ink).toBe('dark');
    expect(pick.span).toEqual([6, 5]);
    expect(contrast(pick.colour, autumn[6])).toBeGreaterThanOrEqual(4.5);
  });

  it('5: draws dark as the theme’s darkest grey, read from the theme', () => {
    const neutral = themeOf('#d97757').colors!['neutral'];
    const autumn = stock.find((each) => each.name === 'autumn')!.shades;
    expect(onBrand(autumn, 'filled').colour).toBe(neutral![9]);
    expect(onBrand(autumn, 'filled').colour).toBe('#111827');
  });
});
