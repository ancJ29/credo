import { globSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../tests/render';
import { FRAME_COLOURS } from '../design-system/tokens';

const scheme = () => document.documentElement.getAttribute('data-mantine-color-scheme');

describe('Providers', () => {
  it('The app is light whatever the device asks', () => {
    // A stored choice of dark, which only the force overrides.
    window.localStorage.setItem('mantine-color-scheme-value', 'dark');
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
      window.localStorage.removeItem('mantine-color-scheme-value');
    }
  });

  it("The frame's colours are written with the tokens' values, every one a source or stylesheet reads", () => {
    draw(<p>the page</p>);
    const style = document.querySelector('style[data-mantine-styles]')?.textContent ?? '';
    const entries = Object.entries(FRAME_COLOURS);
    expect(entries.length).toBeGreaterThan(1);
    for (const [name, value] of entries) expect(style).toContain(`--credo-${name}: ${value};`);

    // The names the frame reads, found in the files, not the names the tokens hold.
    const src = `${import.meta.dirname}/..`;
    const read = new Set<string>();
    for (const path of globSync('**/*.{css,ts,tsx}', { cwd: src })) {
      if (/\.test\.tsx?$/.test(path)) continue;
      for (const m of readFileSync(`${src}/${path}`, 'utf8').matchAll(
        /var\(--credo-([a-z0-9-]+)\)/g,
      ))
        read.add(m[1]);
    }
    expect(read.size).toBeGreaterThan(5);
    for (const name of read) expect(style).toContain(`--credo-${name}: `);
  });
});
