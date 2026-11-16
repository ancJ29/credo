import { globSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** A colour written as a literal: a hex value, or a function that makes one. */
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|hsl)a?\(/;

const SRC = `${import.meta.dirname}/..`;

describe('The stylesheets', () => {
  it('7: No stylesheet outside the design system writes a colour of its own', () => {
    const all = globSync('**/*.module.css', { cwd: SRC });
    // A glob that found nothing, or a folder moved, would quiet the check below.
    expect(all.length).toBeGreaterThanOrEqual(4);
    const own = all.filter((path) => !path.startsWith('design-system/'));
    expect(own.length).toBeGreaterThanOrEqual(1);
    const written = own.filter((path) => COLOUR.test(readFileSync(`${SRC}/${path}`, 'utf8')));
    expect(written).toEqual([]);
  });
});
