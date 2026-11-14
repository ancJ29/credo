import { type Language, STACK_ENV } from '@credo/shared';
import { DICTIONARIES } from '@credo/ui/words';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { required, shot, WIDTHS } from '../support';

/**
 * The operator's walk: ten screens, each in Vietnamese and in English at the three widths
 * (10 × 2 × 3 = 60). The `operator-fake` project runs it on `pnpm fake -- …`, the UI alone over the
 * data set, and keeps the pictures as the full run's reference; the `operator-full` project runs it
 * on a stack (`pnpm stack -- …`) and compares them with the bases, or with the fake run's pictures.
 * Each screen opens at an address of its own, so a screen never meets what an earlier one made. The
 * words come from the app's own dictionaries. The full run's operator is the one the stack gives,
 * signed in by its handle (`CREDO_OPERATOR_HANDLE`) on the device; the join by a link is the
 * passkeys walk's.
 */

/** Where a screen opens: the address, whether the operator is signed in, and the failure the fake
 * answers once, which the full run provokes in its own way. */
type Opening = { path: string; operator?: true; cue?: string };

const FULL = () => test.info().project.name === 'operator-full';

/** Makes the call a cue names answer its status, as the stack would if it failed: the list is a
 * `GET` of the clients' route and making one a `POST` to it. */
async function provoke(page: Page, cue: string) {
  const [call, status] = cue.split(':');
  const method = call === 'listClients' ? 'GET' : 'POST';
  await page.route('**/api/operator/clients', (route) =>
    route.request().method() === method
      ? route.fulfill({ status: Number(status), json: { error: 'Service unavailable' } })
      : route.fallback(),
  );
}

/** Opens a screen. On the fake: the address with `?fake`, and the cue; the language and the
 * operator's handle are kept in the tab. On the stack: the language and the handle kept on the
 * device, a failure stubbed when the screen asks for one, and the address as it is. */
async function open(page: Page, language: Language, { path, operator, cue }: Opening) {
  if (!FULL()) {
    await page.addInitScript(
      ([chosen, handle]) => {
        sessionStorage.setItem('credo.language', chosen);
        if (handle) sessionStorage.setItem('credo.operator', handle);
        else sessionStorage.removeItem('credo.operator');
      },
      [language, operator ? 'fake.operator' : ''],
    );
    await page.goto(`${path}?fake${cue ? `&cue=${cue}` : ''}`);
    return;
  }
  // A failure stubbed for an earlier screen is not this one's.
  await page.unrouteAll();
  const handle = operator ? required(STACK_ENV.CREDO_OPERATOR_HANDLE) : '';
  await page.addInitScript(
    ([chosen, kept]) => {
      localStorage.setItem('credo.language', chosen);
      if (kept) localStorage.setItem('credo.operator', kept);
      else localStorage.removeItem('credo.operator');
    },
    [language, handle],
  );
  if (cue) await provoke(page, cue);
  await page.goto(path);
}

/** A label as a whole, the star of a required one allowed: a bare string matches any label that
 * holds it (`Link` also names the button `Copy: Link`). */
const exactly = (label: string) =>
  new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\*?$`);

async function walk(page: Page, language: Language, width: number) {
  const at = (screen: string, mask: Locator[] = []) => shot(page, screen, language, width, mask);
  const words = DICTIONARIES[language];
  const title = (heading: string) => page.getByRole('heading', { level: 2, name: heading });
  const field = (label: string) => page.getByRole('textbox', { name: exactly(label) });
  const typed = (label: string, text: string) => field(label).fill(text);
  const press = (name: string) => page.getByRole('button', { name, exact: true }).click();
  /** A form's heading is clicked, so no field is left focused for the picture. */
  const unfocus = () => page.getByRole('heading', { level: 2 }).click();
  /** The add form's list of boxes, which the stack gives two of: each line holds the box's free disk and
   * its companies, which are real on a stack and invented on the fake, so the picture covers the list
   * and the walk reads the list's words. Held by bff/src/routes/boxes.route.test.ts (case 8) and
   * ui/src/parts/NewClientBoxes.test.tsx ("C9: The form lists each box with its free disk and its
   * companies, the home box chosen"). */
  const boxes = () => page.getByRole('radiogroup', { name: words.operator.box });
  const fillClient = async () => {
    await typed(words.operator.code, 'minh-phat');
    await typed(words.operator.companyName, 'Minh Phát');
  };

  // 1. The operator's own door, in credo's name.
  await open(page, language, { path: '/operator' });
  await expect(page.getByRole('heading', { level: 1, name: 'Credo' })).toBeVisible();
  await expect(title(words.operator.signIn)).toBeVisible();
  await at('op-1-sign-in');

  // Screens 5, 6 and 7 are shot before the walk makes a client (screen 3), or the dashboard on a
  // stack lists the new client beside the data set's three, where the fake lists three.
  // 5. The dashboard: the five sections, who is signed in, the clients newest first.
  await open(page, language, { path: '/operator/clients', operator: true });
  await expect(title(words.nav.clients)).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Bình An', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: words.nav.menu })).toBeVisible();
  await at('op-5-dashboard');

  // 6. A section coming soon: the four unbuilt ones are one page.
  await open(page, language, { path: '/operator/usage', operator: true });
  await expect(title(words.nav.usage)).toBeVisible();
  await expect(page.getByText(words.operator.soon, { exact: true })).toBeVisible();
  await at('op-6-coming-soon');

  // 7. The list could not be loaded: the fake answers the list with a 503 once; on the stack the
  // list is stubbed to a 503.
  await open(page, language, {
    path: '/operator/clients',
    operator: true,
    cue: 'listClients:503',
  });
  await expect(page.getByRole('alert')).toHaveText(words.common.loadFailed);
  await at('op-7-list-failed');

  // 2. A new client: its code and the company's name, in the frame.
  await open(page, language, { path: '/operator/clients/new', operator: true });
  await expect(title(words.operator.newTitle)).toBeVisible();
  await fillClient();
  await expect(boxes()).toBeVisible();
  await unfocus();
  await at('op-2-new-client', [boxes()]);

  // 3. Made: the link, the root's name and its first password, once. The link's address and the
  // password differ between the fake and the stack, so both are masked (QA rule 7). Held by
  // bff/src/operator.route.test.ts: "answers the link’s path, the root’s name and a first password
  // that signs the root in", and bff/src/calling/password.test.ts: "holds a capital, a small letter, a digit
  // and one of @$!%*?& in 12 characters, and differs each time".
  await open(page, language, { path: '/operator/clients/new', operator: true });
  await fillClient();
  await press(words.operator.make);
  await expect(title(words.operator.madeTitle)).toBeVisible();
  await expect(field(words.operator.rootName)).toHaveValue('root');
  await at('op-3-made', [field(words.operator.link), field(words.operator.firstPassword)]);

  // 4. A code already taken: the data set holds hoa-sen.
  await open(page, language, { path: '/operator/clients/new', operator: true });
  await typed(words.operator.code, 'hoa-sen');
  await typed(words.operator.companyName, 'Hoa Sen');
  await press(words.operator.make);
  await expect(page.getByRole('alert')).toHaveText(words.operator.taken);
  await expect(boxes()).toBeVisible();
  await unfocus();
  await at('op-4-code-taken', [boxes()]);

  // 8. A code not in the form, said on its field before anything is sent.
  await open(page, language, { path: '/operator/clients/new', operator: true });
  await typed(words.operator.code, 'minh phat');
  await typed(words.operator.companyName, 'Minh Phát');
  await press(words.operator.make);
  await expect(page.getByText(words.operator.codeInvalid, { exact: true })).toBeVisible();
  await expect(boxes()).toBeVisible();
  await unfocus();
  await at('op-8-code-invalid', [boxes()]);

  // 9. A client not made: the fake answers the make with a 503 once; on the stack it is stubbed.
  await open(page, language, {
    path: '/operator/clients/new',
    operator: true,
    cue: 'makeClient:503',
  });
  await fillClient();
  await press(words.operator.make);
  await expect(page.getByRole('alert')).toHaveText(words.operator.failed);
  await expect(field(words.operator.code)).toHaveValue('minh-phat');
  await expect(boxes()).toBeVisible();
  await unfocus();
  await at('op-9-make-failed', [boxes()]);

  // 10. The second box chosen, which the stack runs as `b2`: its line is picked by its name, since
  // its free disk is the machine's own, and the client is made on it.
  // A stack keeps what screen 3 made, so this client's code and name differ from `fillClient`'s.
  await open(page, language, { path: '/operator/clients/new', operator: true });
  await typed(words.operator.code, 'minh-phat-b2');
  await typed(words.operator.companyName, 'Minh Phát B2');
  await boxes().getByRole('radio', { name: /^b2:/ }).check();
  await unfocus();
  await at('op-10-box-chosen', [boxes()]);
  await press(words.operator.make);
  await expect(title(words.operator.madeTitle)).toBeVisible();
}

for (const [device, width] of Object.entries(WIDTHS)) {
  test.describe(`the operator's dashboard, on a ${device} (${width})`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const [language, name] of [
      ['vi', 'Vietnamese'],
      ['en', 'English'],
    ] as const) {
      test(`walks all ten screens in ${name}`, async ({ page }) => {
        await walk(page, language, width);
      });
    }
  });
}
