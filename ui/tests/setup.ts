import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// A test file that sets `@vitest-environment node` (the demo file made as the walk spec makes it)
// has no window to prepare.
if (typeof window !== 'undefined') {
  // jsdom has no layout: Mantine reads the colour scheme through matchMedia, and its controls
  // watch sizes and scroll options into view.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = () => {};
}

afterEach(cleanup);
