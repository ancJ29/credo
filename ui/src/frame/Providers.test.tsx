import { globSync, readFileSync } from 'node:fs';
import { cleanup, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../tests/render';
import { ROLES } from '../design-system/tokens';
import { Providers } from './Providers';

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

  it("The roles are written with the tokens' values, every one a source or stylesheet reads", () => {
    draw(<p>the page</p>);
    const style = document.querySelector('style[data-mantine-styles]')?.textContent ?? '';
    const entries = Object.entries(ROLES);
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

describe('Providers, the page’s language', () => {
  it('2: marks the page in the language shown, and again when it changes', () => {
    const { rerender } = draw(<p>the page</p>, 'vi');
    expect(document.documentElement.getAttribute('lang')).toBe('vi');

    rerender(<p>the page</p>);
    expect(document.documentElement.getAttribute('lang')).toBe('vi');
    cleanup();
    draw(<p>the page</p>, 'en');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
  });

  it('2: marks the element that carries the colour scheme where it is not the page’s own', () => {
    const frame = document.createElement('div');
    document.body.append(frame);
    render(
      <Providers colour="#2f7d6d" language="en" root={() => frame} test>
        <p>the page</p>
      </Providers>,
    );

    expect(frame.getAttribute('lang')).toBe('en');
    frame.remove();
  });
});
