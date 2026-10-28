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
      //
      // elsewhere: lambda-main.ts only binds the handler to the process environment, and
      // bundle-main.ts only names the bundle's file for `pnpm --filter @credo/bff bundle`. The
      // bundle test in src/bundle.test.ts builds the first into one file and runs it alone;
      // createLambdaHandler and bundleBff, which they call, are tested in src/lambda.test.ts and
      // there.
      exclude: ['src/**/*.test.ts', 'src/main.ts', 'src/lambda-main.ts', 'src/bundle-main.ts'],
      reporter: [['text', { skipFull: true }]],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
