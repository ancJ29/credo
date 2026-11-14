import { defineConfig } from 'vitest/config';
import { TableShardSequencer } from './src/shard-sequencer';
import { TimesReporter } from './src/shard-times';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // A shard's files are split by their time in src/shard-times.json, not by vitest's path hash (src/shard-sequencer.ts).
    // `pnpm times` (SCRIPTS_WRITE_TIMES set) writes that table after a green local run.
    sequence: { sequencer: TableShardSequencer },
    // Vitest's own default list stays unless the table is to be written (then `default` beside the writer).
    ...(process.env.SCRIPTS_WRITE_TIMES ? { reporters: ['default', new TimesReporter()] } : {}),
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
      // reads the operator's link on it and nowhere else; runRidge is tested in src/ridge.test.ts.
      //
      // elsewhere: walks-main.ts only reads stdin and binds src/walks.ts's walksCommand to the
      // process; src/walks.test.ts runs walksCommand with the same arguments, and walk/run.sh's
      // test (src/walk-run.test.ts) runs the entry as a process.
      //
      // elsewhere: demo-files-main.ts only finds the credo root from git and binds src/demo-files.ts's
      // writeDemoFiles to it; src/demo-files.test.ts runs writeDemoFiles on a temporary folder.
      //
      // elsewhere: counts-main.ts only binds src/counts.ts's runCounts to the process and to the
      // repository root; src/counts.test.ts runs runCounts and repoIo, on made-up repositories and on this one.
      //
      // elsewhere: local-main.ts only binds src/local.ts's runLocal to the process, to git's answer for
      // the credo root and to the signals; src/local.test.ts runs runLocal with the same io, on fakes.
      // The detached stack it leaves standing is read by a person, in their own terminal.
      //
      // elsewhere: src/demo/apply-support.ts is what the ten src/demo/apply.*.test.ts files share, the
      // helpers that used to sit at the top of one test file (which this list leaves out already). Its
      // guards ('taken', a sort's other side) are the test's own and only a failing setup reaches them.
      exclude: [
        'src/walks-main.ts',
        'src/**/*.test.ts',
        'src/main.ts',
        'src/fake-main.ts',
        'src/ridge-main.ts',
        'src/demo-main.ts',
        'src/demo-files-main.ts',
        'src/counts-main.ts',
        'src/local-main.ts',
        'src/demo/apply-support.ts',
      ],
      reporter: [['text', { skipFull: true }]],
      // A shard on GitHub (SCRIPTS_SHARD set by the workflow) sees a third of the files, so it holds no
      // threshold; the job that merges the shards' blobs does, and sets nothing.
      thresholds: process.env.SCRIPTS_SHARD
        ? {}
        : { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
