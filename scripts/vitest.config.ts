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
      //
      // elsewhere: fake-main.ts is the same hand-off for `pnpm fake`: src/fake.test.ts runs
      // src/cli.ts's runFake in this process, and src/main.test.ts runs the entry as a process and
      // reads its command served the page and nothing left listening.
      //
      // elsewhere: ridge-main.ts only binds runRidge to the process and to fd 3, the terminal ops/
      // operator.sh hands on. ops/test.sh runs ops/operator.sh whole under a pseudo-terminal and
      // reads the password on it and nowhere else; runRidge is tested in src/ridge.test.ts.
      exclude: ['src/**/*.test.ts', 'src/main.ts', 'src/fake-main.ts', 'src/ridge-main.ts'],
      reporter: [['text', { skipFull: true }]],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
