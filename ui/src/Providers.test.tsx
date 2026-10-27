import { describe, expect, it, vi } from 'vitest';
import { draw } from '../tests/render';

const scheme = () => document.documentElement.getAttribute('data-mantine-color-scheme');

describe('Providers', () => {
  it('Light and dark as the system says', () => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = vi.fn((query: string) => ({
      ...original(query),
      matches: query.includes('dark'),
    }));
    try {
      draw(<p>the page</p>);
      expect(scheme()).toBe('dark');
    } finally {
      window.matchMedia = original;
    }

    draw(<p>the page</p>);
    expect(scheme()).toBe('light');
  });
});
