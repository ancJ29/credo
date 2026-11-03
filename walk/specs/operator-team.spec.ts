import { type Language } from '@credo/shared';
import { DEMO_INVITED_NAME, DEMO_TEAM } from '@credo/shared/demo';
import { DICTIONARIES } from '@credo/ui/words';
import { expect, type Page, test } from '@playwright/test';
import { required, shot, virtualAuthenticator, WIDTHS } from '../support';

/**
 * The walk of the console's operators: four screens, each in Vietnamese and in English at the three
 * widths (4 × 2 × 3 = 24), numbered 1, 2, 3 and 6 as the plan names them. The `team-fake` project runs
 * it on `pnpm fake -- …`, the UI alone over the data set, whose fake authenticator and fake join link
 * are invented, and keeps the pictures as the full run's reference. Each screen opens at an address
 * of its own. The words come from the app's own dictionaries.
 *
 * The `team-full` project runs it on a stack of its own for each test (`pnpm stack -- …`), with
 * Chromium's virtual authenticator holding the passkey the stack hands over, so the touch the add
 * asks for is a real one that the BFF checks. The stack's join link is minted, so it is masked on
 * screen 3.
 */

const FULL = () => test.info().project.name === 'team-full';
const LIST = '/operator/operators';
const NEW = `${LIST}/new`;
const NAME = 'Thu Hà';

/** A label as a whole, the star of a required one allowed. */
const exactly = (label: string) =>
  new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\*?$`);

/** Opens the page. On the fake: the address with `?fake`, the language and the operator's handle
 * kept in the tab. On the stack: the language and the handle kept on the device. */
async function open(page: Page, language: Language, path: string) {
  if (!FULL()) {
    await page.addInitScript(
      ([chosen, handle]) => {
        sessionStorage.setItem('credo.language', chosen);
        sessionStorage.setItem('credo.operator', handle);
      },
      [language, 'fake.operator'],
    );
    await page.goto(`${path}?fake`);
    return;
  }
  await page.addInitScript(
    ([chosen, kept]) => {
      localStorage.setItem('credo.language', chosen);
      localStorage.setItem('credo.operator', kept);
    },
    [language, required('CREDO_OPERATOR_HANDLE')],
  );
  await page.goto(path);
}

async function walk(page: Page, language: Language, width: number) {
  const words = DICTIONARIES[language];
  const title = (heading: string) => page.getByRole('heading', { level: 2, name: heading });
  const nameBox = () => page.getByRole('textbox', { name: exactly(words.team.nameLabel) });
  const press = (name: string) => page.getByRole('button', { name, exact: true }).click();
  /** A form's heading is clicked, so no field is left focused for the picture. */
  const unfocus = () => page.getByRole('heading', { level: 2 }).click();
  const at = (screen: string, mask: Parameters<typeof shot>[4] = []) =>
    shot(page, screen, language, width, mask);

  // The stack's passkey is on the authenticator before the first touch.
  const authenticator = FULL() ? await virtualAuthenticator(page) : null;
  if (authenticator) {
    await authenticator.hold(
      JSON.parse(required('CREDO_OPERATOR_PASSKEY')) as Parameters<typeof authenticator.hold>[0],
    );
  }

  // 1. The operators: name, state, added by whom and when, passkeys, last sign-in; you marked.
  await open(page, language, LIST);
  await expect(title(words.nav.operators)).toBeVisible();
  await expect(page.getByRole('cell', { name: DEMO_INVITED_NAME })).toBeVisible();
  // The stack's three operators are the fake's: the colleague whose adder is deleted too.
  await expect(page.getByRole('cell', { name: DEMO_TEAM[1].name })).toBeVisible();
  await at('tm-1-list');

  // 2. Creating an operator: a name.
  await open(page, language, NEW);
  await expect(title(words.team.newTitle)).toBeVisible();
  await nameBox().fill(NAME);
  await unfocus();
  await at('tm-2-name');

  // 3. Added: the join link, once, to send. The stack's is minted, so masked.
  await open(page, language, NEW);
  await nameBox().fill(NAME);
  await press(words.team.make);
  await expect(title(words.team.addedTitle)).toBeVisible();
  await at('tm-3-added', [page.getByRole('textbox', { name: exactly(words.team.link) })]);

  // 6. The name taken, whatever its capitals: nothing added, the name kept.
  await open(page, language, NEW);
  await nameBox().fill(DEMO_INVITED_NAME.toLowerCase());
  await press(words.team.make);
  await expect(page.getByRole('alert')).toHaveText(words.team.taken);
  await expect(nameBox()).toHaveValue(DEMO_INVITED_NAME.toLowerCase());
  await unfocus();
  await at('tm-6-taken');
}

for (const [device, width] of Object.entries(WIDTHS)) {
  test.describe(`the console's operators, on a ${device} (${width})`, () => {
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
