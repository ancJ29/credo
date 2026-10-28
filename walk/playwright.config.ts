import { defineConfig, devices } from '@playwright/test';

/**
 * The walks: piece 1's, the client's admin, and the operator's, each in light at the widths the
 * specs name. They run against the local stack and need a browser, so they run in the human's
 * terminal: `pnpm stack -- …` brings the stack up, runs this, and takes it down. The base images
 * beside the specs carry the platform in their names, so they are the machine they were made on; `retries` stays 0 (QA rule 6).
 * `threshold: 0` beside `maxDiffPixels: 0`: the default tolerates a colour shift a pixel at a time,
 * so a small shift in a brand colour would pass; here it is a red.
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
  },
  expect: {
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixels: 0, threshold: 0 },
  },
  projects: [{ name: 'chromium' }],
});
