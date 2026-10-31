import { defineConfig, devices } from '@playwright/test';

/**
 * The walks: piece 1's, the client's admin, and the operator's, each in light at the widths the
 * specs name. They run against the local stack and need a browser, so they run in the human's
 * terminal, by `walk/run.sh`. Piece 2's spec and the operator's have two projects each: `fake` runs
 * on `pnpm fake -- …` and `full` on the stack; every project writes its pictures into
 * `CREDO_SHOTS_DIR` (`walk/support.ts`) and compares nothing: the run script counts the pixels that
 * moved between folders and against the committed base images, raw, with no tolerance. `retries`
 * stays 0 (QA rule 6).
 *
 * `--disable-partial-raster`: with the browser's default a tile is drawn in part, and the edge of a
 * rounded corner falls one of two ways, run by run, on a card's frame and on the logo. The
 * walk-steady probe took the same pictures five times under four settings, and only this one gave
 * one picture every time, in both sets ([the plan](../docs/plans/2026-10-31-walk-steady.md)).
 */
export default defineConfig({
  testDir: 'specs',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env['CREDO_URL'],
    colorScheme: 'light',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 800 },
    launchOptions: { args: ['--disable-partial-raster'] },
  },
  projects: [
    { name: 'chromium', testIgnore: ['piece-2.spec.ts', 'operator.spec.ts'] },
    // The fake takes the same screens as the full run, and each picture takes at least two shots.
    { name: 'fake', testMatch: 'piece-2.spec.ts', timeout: 120_000 },
    {
      name: 'full',
      testMatch: 'piece-2.spec.ts',
      // A walk opens each of its screens on a client of its own, which the stack makes first: 15
      // openings, beyond the default budget of 30 seconds.
      timeout: 120_000,
    },
    // The operator's walk, the same two ways: the fake, and the full run on a stack of its own for
    // each language and width.
    { name: 'operator-fake', testMatch: 'operator.spec.ts', timeout: 120_000 },
    {
      name: 'operator-full',
      testMatch: 'operator.spec.ts',
      timeout: 120_000,
    },
  ],
});
