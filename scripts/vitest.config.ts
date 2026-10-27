import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // The stack tests build and start the whole product, and wait for it to answer.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // elsewhere: the entry hands the command line to src/cli.ts, which src/stack.test.ts runs in
      // this process; src/main.test.ts runs the entry itself as a process and reads a SIGTERM take
      // the whole stack down.
      exclude: ['src/**/*.test.ts', 'src/main.ts'],
      reporter: [['text', { skipFull: true }]],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
