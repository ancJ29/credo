import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // The tests build the UI in this process, and a build under `test` ships React's development
    // build, a third larger: past the bundle warning's 1000 kB, where the real build is about 700.
    env: { NODE_ENV: 'production' },
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
      // elsewhere: demo-main.ts is the same hand-off for `pnpm demo`: src/demo.test.ts runs
      // src/cli.ts's runDemo in this process, and src/main.test.ts runs the entry as a process.
      //
      // elsewhere: ridge-main.ts only binds runRidge to the process and to fd 3, the terminal ops/
      // operator.sh hands on. ops/test.sh runs ops/operator.sh whole under a pseudo-terminal and
      // reads the password on it and nowhere else; runRidge is tested in src/ridge.test.ts.
      //
      // elsewhere: walks-main.ts only reads stdin and binds src/walks.ts's walksCommand to the
      // process; src/walks.test.ts runs walksCommand with the same arguments, and walk/run.sh's
      // test (src/walk-run.test.ts) runs the entry as a process.
      //
      // elsewhere: demo-files-main.ts only finds the credo root from git and binds src/demo-files.ts's
      // writeDemoFiles to it; src/demo-files.test.ts runs writeDemoFiles on a temporary folder.
      exclude: [
        'src/walks-main.ts',
        'src/**/*.test.ts',
        'src/main.ts',
        'src/fake-main.ts',
        'src/ridge-main.ts',
        'src/demo-main.ts',
        'src/demo-files-main.ts',
      ],
      reporter: [['text', { skipFull: true }]],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
