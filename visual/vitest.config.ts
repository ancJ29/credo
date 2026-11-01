import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['src/setup.ts'],
    // `cli.test.ts` draws every screen of every walk in both languages once, in its `beforeAll`
    // (about 38 s alone, about 140 s on GitHub's runner, and it grows with the screens); that hook
    // names its 240 s itself, and the budget below is the same 240 s for every test (open item 27).
    testTimeout: 240_000,
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
