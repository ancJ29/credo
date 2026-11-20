import { describe, expect, it } from 'vitest';
import { themeOf, shadesOf } from './appTheme';
import { credoVariables } from './cssVariables';
import { contrast, onBrand, onWhite, beforeOf, type Surface } from './onBrand';
import { PALETTES } from './palettes';

const SURFACES: Surface[] = ['filled', 'header', 'menu'];
const WHITE = '#ffffff';

const stock = PALETTES.map(({ name, shades }) => ({ name, shades: shadesOf(shades[7]) }));

/** The ratio of a pick's ink against each shade of its span, worked out here, never read from the pick. */
const ratiosOf = (colour: string, shades: readonly string[], span: readonly number[]) =>
  span.map((shade) => contrast(colour, shades[shade]));

describe('onBrand', () => {
  it('1: gives every surface of every stock colour a text at 4.5:1 or more against every shade of its span', () => {
    expect(stock).toHaveLength(6);
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

  it('2: a colour no text can serve says so, with the white from before the rule', () => {
    const grey = Array.from({ length: 10 }, () => '#777777') as unknown as ReturnType<
      typeof shadesOf
    >;
    const pick = onBrand(grey, 'filled');
    expect(pick.passes).toBe(false);
    expect(pick.ink).toBe('white');
    expect(pick.span).toEqual([6, 7]);
  });

  it('3: keeps white wherever it passes, so every stock colour but emerald’s buttons keeps its spans from before the rule', () => {
    for (const name of ['steel', 'brick', 'bronze', 'plum', 'indigo']) {
      const shades = stock.find((each) => each.name === name)!.shades;
      for (const surface of SURFACES) {
        const pick = onBrand(shades, surface);
        expect(pick.ink, `${name} ${surface}`).toBe('white');
        expect(pick.span).toEqual(beforeOf(shades, surface).span);
      }
    }
    // Emerald's header and menu stay white as before the rule; only its buttons turn dark.
    const emerald = stock.find((each) => each.name === 'emerald')!.shades;
    expect(onBrand(emerald, 'header').ink).toBe('white');
    expect(onBrand(emerald, 'menu').ink).toBe('white');
    expect(onBrand(emerald, 'filled').ink).toBe('dark');
  });

  it('4: refuses white on a light typed colour’s shade 6, the planted failing pair', () => {
    const light = shadesOf('#d97757');
    expect(contrast(WHITE, light[6])).toBeLessThan(4.5);
    const pick = onBrand(light, 'filled');
    expect(pick.ink).toBe('dark');
    expect(pick.span).toEqual([6, 5]);
    expect(contrast(pick.colour, light[6])).toBeGreaterThanOrEqual(4.5);
  });

  it('5: draws dark as the theme’s darkest grey, read from the theme', () => {
    const neutral = themeOf('#d97757').colors!['neutral'];
    const light = shadesOf('#d97757');
    expect(onBrand(light, 'filled').colour).toBe(neutral![9]);
    expect(onBrand(light, 'filled').colour).toBe('#111827');
  });

  const NAMED = ['#ffeb3b', '#00ffff', '#ffbf00', '#ff0000', '#808080', '#d97757', '#2f7d6d'];

  it('16: every stock and typed colour’s links and brand text reach 4.5:1 on white, amber by the dark grey', () => {
    const steps = Array.from({ length: 16 }, (_, at) => at * 17);
    const typed = steps.flatMap((red) =>
      steps.flatMap((green) =>
        steps.map(
          (blue) => `#${[red, green, blue].map((n) => n.toString(16).padStart(2, '0')).join('')}`,
        ),
      ),
    );
    expect(typed).toHaveLength(4096);
    const colours = [...stock.map(({ shades }) => shades), ...[...typed, ...NAMED].map(shadesOf)];
    expect(colours).toHaveLength(6 + 4096 + NAMED.length);
    const failed = colours.flatMap((shades, at) =>
      [6, 7]
        .filter((from) => {
          const link = onWhite(shades, from);
          // The ratio is worked out here from the colour taken, never read from the link.
          return (
            contrast(WHITE, link.colour) < 4.5 ||
            link.colour !== (link.shade === null ? '#111827' : shades[link.shade])
          );
        })
        .map((from) => `${at} from ${from}`),
    );
    expect(failed).toEqual([]);
    const amber = onWhite(shadesOf('#ffbf00'), 6);
    expect(amber.shade).toBeNull();
    expect(amber.colour).toBe(themeOf('#ffbf00').colors!['neutral']![9]);
  });

  it('16: Mantine’s links, brand text and outline, and the frame’s brand text, are written from the rule', () => {
    for (const colour of ['#047857', '#2f7d6d', '#ffbf00', '#3e618c']) {
      const shades = shadesOf(colour);
      const written = credoVariables(themeOf(colour) as never);
      const link = onWhite(shades, 6).value;
      for (const name of ['anchor', 'brand-text', 'brand-outline'])
        expect(written.light[`--mantine-color-${name}`], `${colour} ${name}`).toBe(link);
      expect(written.variables['--credo-brand-text']).toBe(onWhite(shades, 7).value);
    }
  });

  it('17: emerald’s shade 6 as a link is refused, the planted failing pair', () => {
    const emerald = stock.find((each) => each.name === 'emerald')!.shades;
    expect(contrast(WHITE, emerald[6])).toBeLessThan(4.5);
    const link = onWhite(emerald, 6);
    expect(link.shade).toBe(7);
    expect(contrast(WHITE, emerald[7])).toBeGreaterThanOrEqual(4.5);
    expect(link.ratio).toBe(contrast(WHITE, emerald[7]));
  });

  it('18: a start that passes is kept: the back link at 7, steel’s and brick’s links at 6', () => {
    for (const { name, shades } of stock) {
      expect(onWhite(shades, 7).shade, `${name} brand text`).toBe(7);
    }
    expect(onWhite(shadesOf('#2f7d6d'), 7).shade).toBe(7);
    for (const name of ['steel', 'brick']) {
      const shades = stock.find((each) => each.name === name)!.shades;
      expect(contrast(WHITE, shades[6])).toBeGreaterThanOrEqual(4.5);
      expect(onWhite(shades, 6).shade, `${name} link`).toBe(6);
    }
  });
});
