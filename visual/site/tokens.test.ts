// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const HTML = readFileSync(join(import.meta.dirname, 'index.html'), 'utf8');

const tokens = (block: string) =>
  Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((one) => [
      one[1],
      one[2].toLowerCase(),
    ]),
  );
const block = (pattern: RegExp) => tokens(HTML.match(pattern)![1]);

const LIGHT = block(/:root \{([\s\S]*?)\n\}/);
const DARK = block(/:root\[data-theme="dark"\] \{([\s\S]*?)\n\}/);
const DARK_BY_SYSTEM = block(/:root:not\(\[data-theme="light"\]\) \{([\s\S]*?)\n {2}\}/);

/** WCAG's relative luminance and contrast ratio. */
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const channel = parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
};

/** Each text token and the backgrounds the page puts it on. */
const TEXT_ON: [string, string][] = [
  ['ink', 'table'],
  ['ink', 'paper'],
  ['ink', 'soft'],
  ['ink', 'accent-soft'],
  ['muted', 'table'],
  ['muted', 'paper'],
  ['muted', 'soft'],
  ['accent-ink', 'accent'],
  ['accent-text', 'table'],
  ['accent-text', 'paper'],
  ['accent-text', 'soft'],
  ['accent-text', 'accent-soft'],
  ['hi-ink', 'hi'],
  ['yes-ink', 'yes'],
  ['no-ink', 'no'],
  ['yes', 'paper'],
  ['no', 'paper'],
];

describe('the walks page’s tokens', () => {
  it('reads each token pair of text on its background at 4.5:1 or more, light and dark', () => {
    for (const [name, theme] of [
      ['light', LIGHT],
      ['dark', DARK],
    ] as const) {
      for (const [text, background] of TEXT_ON) {
        expect(
          ratio(theme[text], theme[background]),
          `${name}: --${text} on --${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('holds the same dark tokens whether the system or the View menu chose them', () => {
    expect(DARK_BY_SYSTEM).toEqual(DARK);
    expect(Object.keys(DARK).sort()).toEqual(Object.keys(LIGHT).sort());
  });
});
