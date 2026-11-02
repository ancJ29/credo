import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'site/**/*.test.ts'],
    environment: 'jsdom',
    setupFiles: ['src/setup.ts'],
    // The capture test draws screens of the walks on a DOM and builds the page's script and
    // styles with Vite (`capture.test.ts`); Decide 48 (a) keeps one 240 s for every test until open
    // item 37's finer budget.
    testTimeout: 240_000,
    coverage: {
      provider: 'v8',
      // untested: `run.mjs` is outside `include`, a bare entry: it starts a Vite server and calls
      // `report` in `src/capture.ts`, whose test holds everything the command does.
      // elsewhere: `site/styles.ts` is a bundler entry that holds only imports; `capture.test.ts`
      // builds it and reads the stylesheet it makes. `site/index.html` is the page's markup, which
      // `site/page.test.ts` loads whole.
      include: ['src/**/*.{ts,tsx}', 'site/**/*.ts'],
      exclude: ['**/*.test.{ts,tsx}', 'src/setup.ts', 'site/styles.ts'],
      reporter: [['text', { skipFull: true }]],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
