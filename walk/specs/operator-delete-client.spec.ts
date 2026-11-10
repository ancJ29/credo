import { type Language, STACK_ENV } from '@credo/shared';
import { DEMO_CLIENTS } from '@credo/shared/demo';
import { DICTIONARIES } from '@credo/ui/words';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { required, shot, virtualAuthenticator, WIDTHS } from '../support';

/**
 * The walk of a client deleted whole: four screens, each in Vietnamese and in English at the three
 * widths (4 × 2 × 3 = 24). The `delete-client-fake` project runs it on `pnpm fake -- …`, the UI
 * alone over the data set, whose fake authenticator is invented, and keeps the pictures as the full
 * run's reference. Each screen opens at an address of its own. The words come from the app's own
 * dictionaries.
 *
 * The `delete-client-full` project runs it on a stack of its own for each test (`pnpm stack -- …`):
 * the walk deletes the data set's second client, which only its own stack loses. Chromium's virtual
 * authenticator holds the passkey the stack hands over, so the touch the act asks for is a real one
 * that the BFF checks. The failure of screen 3 is stubbed at the browser. The spec reads nothing by
 * the API: that a deleted client's own sign-in is refused is held by
 * bff/src/routes/clients-delete.route.test.ts, case 5.
 */

const FULL = () => test.info().project.name === 'delete-client-full';
const CODE = 'hoa-sen';
const PATH = `/operator/clients/${CODE}/delete`;

/** A label as a whole, the star of a required one allowed. */
const exactly = (label: string) =>
  new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\*?$`);

/** Opens the page. On the fake: the address with `?fake` and the cue, the language and the
 * operator's handle kept in the tab. On the stack: the language and the handle kept on the device,
 * a failure stubbed when the screen asks for one. */
async function open(page: Page, language: Language, { cue }: { cue?: string } = {}) {
  if (!FULL()) {
    await page.addInitScript(
      ([chosen, handle]) => {
        sessionStorage.setItem('credo.language', chosen);
        sessionStorage.setItem('credo.operator', handle);
      },
      [language, 'fake.operator'],
    );
    await page.goto(`${PATH}?fake${cue ? `&cue=${cue}` : ''}`);
    return;
  }
  // A failure stubbed for an earlier screen is not this one's.
  await page.unrouteAll();
  await page.addInitScript(
    ([chosen, kept]) => {
      localStorage.setItem('credo.language', chosen);
      localStorage.setItem('credo.operator', kept);
    },
    [language, required(STACK_ENV.CREDO_OPERATOR_HANDLE)],
  );
  if (cue) {
    await page.route(`**/api/operator/clients/${CODE}`, (route) =>
      route.request().method() === 'DELETE'
        ? route.fulfill({ status: 503, json: { error: 'Service unavailable' } })
        : route.fallback(),
    );
  }
  await page.goto(PATH);
}

async function walk(page: Page, language: Language, width: number) {
  const words = DICTIONARIES[language];
  const company = DEMO_CLIENTS.find((client) => client.code === CODE)!.name;
  const title = (heading: string) => page.getByRole('heading', { level: 2, name: heading });
  const form = title(words.operator.deleteClientTitle.replace('{{name}}', company));
  const code = () =>
    page.getByRole('textbox', { name: exactly(words.operator.deleteClientCodeLabel) });
  const press = (name: string) => page.getByRole('button', { name, exact: true }).click();
  /** A form's heading is clicked, so no field is left focused for the picture. */
  const unfocus = () => page.getByRole('heading', { level: 2 }).click();
  const at = (screen: string, mask: Locator[] = []) => shot(page, screen, language, width, mask);

  // The stack's passkey is on the authenticator before the first touch.
  const authenticator = FULL() ? await virtualAuthenticator(page) : null;
  if (authenticator) {
    await authenticator.hold(
      JSON.parse(required(STACK_ENV.CREDO_OPERATOR_PASSKEY)) as Parameters<
        typeof authenticator.hold
      >[0],
    );
  }

  // 1. The page before anything is pressed: the company, what goes, the code to type, the red button.
  await open(page, language);
  await expect(form).toBeVisible();
  await expect(page.getByRole('button', { name: words.operator.deleteClientMake })).toBeVisible();
  await at('dc-1-page');

  // 2. The wrong code typed: refused on the page, nothing sent.
  await open(page, language);
  await expect(form).toBeVisible();
  await code().fill('binh-an');
  await press(words.operator.deleteClientMake);
  await expect(page.getByRole('alert')).toHaveText(words.operator.rootCodeWrong);
  await unfocus();
  await at('dc-2-code');

  // 3. The service failed: the client may not be fully deleted.
  await open(page, language, { cue: 'deleteClient:503' });
  await expect(form).toBeVisible();
  await code().fill(CODE);
  await press(words.operator.deleteClientMake);
  await expect(page.getByRole('alert')).toHaveText(words.operator.deleteClientFailed);
  await expect(code()).toHaveValue(CODE);
  await unfocus();
  await at('dc-3-failed');

  // 4. Deleted: the list comes back without the client.
  await open(page, language);
  await expect(form).toBeVisible();
  await code().fill(CODE);
  await press(words.operator.deleteClientMake);
  await expect(title(words.nav.clients)).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Bình An', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: company, exact: true })).toHaveCount(0);
  await at('dc-4-gone');
}

for (const [device, width] of Object.entries(WIDTHS)) {
  test.describe(`the operator's client deleted, on a ${device} (${width})`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const [language, name] of [
      ['vi', 'Vietnamese'],
      ['en', 'English'],
    ] as const) {
      test(`walks all four screens in ${name}`, async ({ page }) => {
        await walk(page, language, width);
      });
    }
  });
}
