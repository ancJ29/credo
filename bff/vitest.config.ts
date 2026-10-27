import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // elsewhere: the process entry binds signals. scripts/src/main.test.ts and
      // scripts/src/stack.test.ts run it as a child of the stack and read it stop on SIGTERM;
      // startBff, which it calls, is tested in src/server.test.ts.
      exclude: ['src/**/*.test.ts', 'src/main.ts'],
      reporter: [['text', { skipFull: true }]],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
