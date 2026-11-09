import { type Language, STACK_ENV } from '@credo/shared';
import { DEMO_SERVICES } from '@credo/shared/demo';
import { DICTIONARIES } from '@credo/ui/words';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { gotoQuietly, required, shot, WIDTHS } from '../support';

/**
 * The operator's services status walk: five screens, each in Vietnamese and in English at the three
 * widths (5 × 2 × 3 = 30). The `services-fake` project runs it on `pnpm fake -- …`, the UI alone
 * over the data set, whose services, times and moment are fixed, and keeps the pictures as the
 * full run's reference. Each screen opens at an address of its own. The words come from the app's
 * own dictionaries.
 *
 * The `services-full` project runs it on a stack (`pnpm stack -- …`). The page's own call is the
 * real one, answered by the BFF over the stack's c-storage: the reply is read whole and passed on
 * with the builds and the time it took fixed to the fake's (the stack runs `dev` in two of its
 * three places, and a round trip is never the same twice), and the moment the page stamps is the
 * browser's clock, set so the call takes the fake's 42 milliseconds. The failures are stubbed at the
 * browser: the stack cannot stop c-storage under a running spec. The UI is built with the build
 * the fake shows (`walk/run.sh` gives it).
 */

/** Where a screen opens: the address, whether the operator is signed in, whether c-storage runs a
 * newer build, and the failure the fake answers once. */
type Opening = { path: string; operator?: true; drift?: true; cue?: string };

/** Opens a screen on the fake: the address with `?fake` and what the fake is told; the language and
 * the operator's handle are kept in the tab. */
async function open(page: Page, language: Language, { path, operator, drift, cue }: Opening) {
  await page.addInitScript(
    ([chosen, handle]) => {
      sessionStorage.setItem('credo.language', chosen);
      if (handle) sessionStorage.setItem('credo.operator', handle);
      else sessionStorage.removeItem('credo.operator');
    },
    [language, operator ? 'fake.operator' : ''],
  );
  await page.goto(`${path}?fake${drift ? '&drift' : ''}${cue ? `&cue=${cue}` : ''}`);
}

async function walk(page: Page, language: Language, width: number) {
  const at = (screen: string, mask: Locator[] = []) => shot(page, screen, language, width, mask);
  const words = DICTIONARIES[language];
  const title = (heading: string) => page.getByRole('heading', { level: 2, name: heading });
  const service = (name: string) => page.getByLabel(name, { exact: true });
  const press = (name: string) => page.getByRole('button', { name, exact: true }).click();
  // The "Check now" button's loader fades out in Mantine's 150 ms transition: the picture waits for it.
  const loaderGone = () => expect(page.locator('.mantine-Button-loader')).toHaveCount(0);

  // 1. All three answer, one build.
  await open(page, language, { path: '/operator/services', operator: true });
  await expect(title(words.nav.services)).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(words.services.oneBuild);
  await expect(service(words.services.storage).getByText(words.services.answers)).toBeVisible();
  await loaderGone();
  await at('sv-1-all-well');

  // 2. Two builds: c-storage runs the newer one.
  await open(page, language, { path: '/operator/services', operator: true, drift: true });
  await expect(page.getByRole('status')).toHaveText(words.services.twoBuilds);
  await expect(service(words.services.storage).getByText(words.services.differs)).toBeVisible();
  await loaderGone();
  await at('sv-2-two-builds');

  // 3. c-storage does not answer: the BFF's own 503.
  await open(page, language, {
    path: '/operator/services',
    operator: true,
    cue: 'operatorServices:503',
  });
  await expect(page.getByRole('alert')).toHaveText(words.services.storageDown);
  await expect(service(words.services.storage).getByText(words.services.silent)).toBeVisible();
  await loaderGone();
  await at('sv-3-storage-silent');

  // 4. The BFF does not answer: nothing comes back.
  await open(page, language, {
    path: '/operator/services',
    operator: true,
    cue: 'operatorServices:silent',
  });
  await expect(page.getByRole('alert')).toHaveText(words.services.bffDown);
  await expect(service(words.services.storage).getByText(words.services.unseen)).toBeVisible();
  await loaderGone();
  await at('sv-4-bff-silent');

  // 5. Before sign-in: the sign-in's options answer the BFF's 503.
  await open(page, language, { path: '/operator', cue: 'operatorPasskeyOptions:503' });
  await press(words.passkey.signInButton);
  await expect(page.getByRole('alert')).toHaveText(words.operator.unavailableStorage);
  await at('sv-5-unavailable');
}

const FULL = () => test.info().project.name === 'services-full';

/** Opens a screen on the stack: the language and the operator's handle kept on the device (the
 * handle taken off it when the screen is for no one signed in). */
async function openFull(page: Page, language: Language, handle: string | null, address: string) {
  await page.addInitScript(
    ([chosen, kept]) => {
      localStorage.setItem('credo.language', chosen);
      if (kept) localStorage.setItem('credo.operator', kept);
      else localStorage.removeItem('credo.operator');
    },
    [language, handle ?? ''],
  );
  await gotoQuietly(page, address);
}

const SERVICES = '**/api/operator/services*';

async function walkFull(page: Page, language: Language, width: number) {
  const picture = (screen: string) => shot(page, screen, language, width);
  const words = DICTIONARIES[language];
  const handle = required(STACK_ENV.CREDO_OPERATOR_HANDLE);
  const title = (heading: string) => page.getByRole('heading', { level: 2, name: heading });
  const service = (name: string) => page.getByLabel(name, { exact: true });
  const press = (name: string) => page.getByRole('button', { name, exact: true }).click();
  // The clock is paused, so Mantine's 150 ms loader transition on "Check now" never finishes by
  // itself: the clock runs on, and the picture waits for the loader to be gone.
  const settled = async () => {
    await page.clock.runFor(500);
    await expect(page.locator('.mantine-Button-loader')).toHaveCount(0);
  };

  // The browser's clock stands at the moment the call begins and moves only when told: the page
  // reads it before it sends and after the answer, so a call that took 42 milliseconds is the
  // fake's, and the moment it stamps is the fake's too (the page shows seconds, and the few checks
  // of a screen move the clock by well under one).
  // The clock runs from install until pauseAt, so install it a minute early: pauseAt only moves
  // forward and fails when a loaded Mac let more than the margin pass between the two calls.
  const began = new Date(DEMO_SERVICES.checkedAt - DEMO_SERVICES.bffMs);
  await page.clock.install({ time: new Date(began.getTime() - 60_000) });
  await page.clock.pauseAt(began);

  /** The real answer of the BFF, passed on with the builds c-storage and the BFF show and the time
   * c-storage took fixed, after the clock has moved the page's own 42 milliseconds. */
  async function answerReally(storageBuild: string) {
    await page.route(SERVICES, async (route) => {
      const reply = await route.fetch();
      const body = (await reply.json()) as {
        build: string;
        storage: { build: string; ms: number };
      };
      expect(Object.keys(body).sort(), 'the BFF answers its build and c-storage').toEqual([
        'build',
        'storage',
      ]);
      await page.clock.runFor(DEMO_SERVICES.bffMs);
      await route.fulfill({
        response: reply,
        json: {
          build: DEMO_SERVICES.build,
          storage: { build: storageBuild, ms: DEMO_SERVICES.storageMs },
        },
      });
    });
  }

  // 1. All three answer, one build.
  await answerReally(DEMO_SERVICES.build);
  await openFull(page, language, handle, '/operator/services');
  await expect(title(words.nav.services)).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(words.services.oneBuild);
  await expect(service(words.services.storage).getByText(words.services.answers)).toBeVisible();
  await settled();
  await picture('sv-1-all-well');
  await page.unroute(SERVICES);

  // 2. Two builds: c-storage runs the newer one.
  await answerReally(DEMO_SERVICES.driftBuild);
  await openFull(page, language, handle, '/operator/services');
  await expect(page.getByRole('status')).toHaveText(words.services.twoBuilds);
  await expect(service(words.services.storage).getByText(words.services.differs)).toBeVisible();
  await settled();
  await picture('sv-2-two-builds');
  await page.unroute(SERVICES);

  // 3. c-storage does not answer: the BFF's own 503.
  await page.route(SERVICES, (route) =>
    route.fulfill({ status: 503, json: { error: 'Service unavailable' } }),
  );
  await openFull(page, language, handle, '/operator/services');
  await expect(page.getByRole('alert')).toHaveText(words.services.storageDown);
  await expect(service(words.services.storage).getByText(words.services.silent)).toBeVisible();
  await settled();
  await picture('sv-3-storage-silent');
  await page.unroute(SERVICES);

  // 4. The BFF does not answer: nothing comes back.
  await page.route(SERVICES, (route) => route.abort('failed'));
  await openFull(page, language, handle, '/operator/services');
  await expect(page.getByRole('alert')).toHaveText(words.services.bffDown);
  await expect(service(words.services.storage).getByText(words.services.unseen)).toBeVisible();
  await settled();
  await picture('sv-4-bff-silent');
  await page.unroute(SERVICES);

  // 5. Before sign-in: the sign-in's options answer the BFF's 503.
  await page.route('**/api/operator/passkey/options', (route) =>
    route.fulfill({ status: 503, json: { error: 'Service unavailable' } }),
  );
  await openFull(page, language, null, '/operator');
  await press(words.passkey.signInButton);
  await expect(page.getByRole('alert')).toHaveText(words.operator.unavailableStorage);
  await settled();
  await picture('sv-5-unavailable');
}

for (const [device, width] of Object.entries(WIDTHS)) {
  test.describe(`the operator's services status, on a ${device} (${width})`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const [language, name] of [
      ['vi', 'Vietnamese'],
      ['en', 'English'],
    ] as const) {
      test(`walks all five screens in ${name}`, async ({ page }) => {
        await (FULL() ? walkFull : walk)(page, language, width);
      });
    }
  });
}
