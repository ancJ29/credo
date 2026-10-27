import { defineConfig, devices } from '@playwright/test';

/**
 * Piece 1's walk: the client's admin on a PC, 1280 pixels wide, in light. It runs against the
 * local stack and needs a browser, so it runs in the human's terminal: `pnpm stack -- …` brings
 * the stack up, runs this, and takes it down. The base images beside the spec carry the platform
 * in their names, so they are the machine they were made on; `retries` stays 0 (QA rule 6).
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
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixels: 0 },
  },
  projects: [{ name: 'chromium' }],
});
