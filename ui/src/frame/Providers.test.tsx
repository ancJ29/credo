import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../tests/render';
import { FRAME_COLOURS } from '../design-system/tokens';

const scheme = () => document.documentElement.getAttribute('data-mantine-color-scheme');

describe('Providers', () => {
  it('The app is light whatever the device asks', () => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = vi.fn((query: string) => ({
      ...original(query),
      matches: query.includes('dark'),
    }));
    try {
      draw(<p>the page</p>);
      expect(scheme()).toBe('light');
    } finally {
      window.matchMedia = original;
    }
  });

  it("The frame's colours are written with the tokens' values", () => {
    draw(<p>the page</p>);
    const style = document.querySelector('style[data-mantine-styles]')?.textContent ?? '';
    const entries = Object.entries(FRAME_COLOURS);
    expect(entries.length).toBeGreaterThan(5);
    for (const [name, value] of entries) expect(style).toContain(`--credo-${name}: ${value};`);
  });
});
