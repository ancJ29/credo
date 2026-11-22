import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** The body of one rule in the gallery's stylesheet, by its exact selector. */
const ruleOf = (selector: string): string => {
  const css = readFileSync('src/design-system/Gallery.module.css', 'utf8');
  const start = css.indexOf(`\n${selector} {`);
  expect(start).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('}', start));
};

describe('232 step 2: the controls stay in view', () => {
  // jsdom draws no layout, so this reads the stylesheet's text: the rules that make the block stick.
  it('the controls block is sticky at the top of the right column, which is the scroller, with a white background', () => {
    expect(ruleOf('.side')).toMatch(/overflow:\s*auto/);
    const controls = ruleOf('.controls');
    expect(controls).toMatch(/position:\s*sticky/);
    expect(controls).toMatch(/top:\s*0;/);
    expect(controls).toMatch(/background:\s*var\(--mantine-color-white\)/);
    expect(controls).toMatch(/z-index:\s*1;/);
    expect(controls).toMatch(/border-bottom:\s*1px solid var\(--mantine-color-gray-3\)/);
  });

  it('the controls block has no negative top margin, so the notes start 18px below its bottom line', () => {
    expect(ruleOf('.controls')).not.toMatch(/margin:\s*-/);
    expect(ruleOf('.controls')).toMatch(/margin:\s*0 0 18px;/);
  });
});
