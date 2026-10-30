import { defineConfig, devices } from '@playwright/test';

/**
 * The walks: piece 1's, the client's admin, and the operator's, each in light at the widths the
 * specs name. They run against the local stack and need a browser, so they run in the human's
 * terminal: `pnpm stack -- …` brings the stack up, runs this, and takes it down. Piece 2's spec has
 * two projects of its own: `fake` runs it on `pnpm fake -- …` and takes pictures only, `full` runs
 * it on the stack and compares them with its bases, or, with `CREDO_REFERENCE_DIR` set, with the
 * pictures the fake run took, which is the first comparison of a full run. The base images
 * beside the specs carry the platform in their names, so they are the machine they were made on; `retries` stays 0 (QA rule 6).
 * `threshold: 0` beside `maxDiffPixels: 0`: the default tolerates a colour shift a pixel at a time,
 * so a small shift in a brand colour would pass; here it is a red.
 */
/** The fake run's folder, when the full run is to be compared with it and not with its bases. */
const reference = process.env['CREDO_REFERENCE_DIR'];
/** The fake run's folder for its pictures, which the fake project writes as its base images. */
const fakeDir = process.env['CREDO_FAKE_DIR'];

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
  },
  expect: {
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixels: 0, threshold: 0 },
  },
  projects: [
    { name: 'chromium', testIgnore: ['piece-2.spec.ts', 'operator.spec.ts'] },
    {
      name: 'fake',
      testMatch: 'piece-2.spec.ts',
      ...(fakeDir ? { snapshotPathTemplate: `${fakeDir}/{arg}{ext}` } : {}),
    },
    {
      name: 'full',
      testMatch: 'piece-2.spec.ts',
      // A walk opens each of its screens on a client of its own, which the stack makes first: 15
      // openings, beyond the default budget of 30 seconds.
      timeout: 120_000,
      ...(reference ? { snapshotPathTemplate: `${reference}/{arg}{ext}` } : {}),
    },
    // The operator's walk, the same two ways: pictures only on the fake (taken into the same folder,
    // the settled way), and the full run on a stack of its own for each language and width, compared
    // with those pictures.
    {
      name: 'operator-fake',
      testMatch: 'operator.spec.ts',
      ...(fakeDir ? { snapshotPathTemplate: `${fakeDir}/{arg}{ext}` } : {}),
    },
    {
      name: 'operator-full',
      testMatch: 'operator.spec.ts',
      timeout: 120_000,
      ...(reference ? { snapshotPathTemplate: `${reference}/{arg}{ext}` } : {}),
    },
  ],
});
