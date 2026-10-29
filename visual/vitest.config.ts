import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['src/setup.ts'],
    // The build tests run Vite's own build of the page, which takes seconds, and draw each scene of
    // piece 2 in both languages: they grow with its screens.
    testTimeout: 120_000,
    coverage: {
      provider: 'v8',
      // untested: `run.mjs` is outside `include`, a bare entry; what stays in it is reading stdin
      // or the file, resolving a relative path against `INIT_CWD`, dispatching to `cli.ts` (which
      // parses the arguments and holds the rest) and setting the exit status.
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/setup.ts'],
      reporter: [['text', { skipFull: true }]],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
