import { type Language, STACK_ENV } from '@credo/shared';
import { AUTH_HEADER } from '@credo/shared';
import {
  DEMO_INVITED_NAME,
  DEMO_JOIN_TOKEN,
  DEMO_PASSKEYS,
  OPERATOR_NAME,
} from '@credo/shared/demo';
import { DICTIONARIES } from '@credo/ui/words';
import { expect, type Locator, type Page, test } from '@playwright/test';
import {
  gotoQuietly,
  reachedPath,
  readOperatorHandle,
  required,
  shot,
  virtualAuthenticator,
  WIDTHS,
} from '../support';

/**
 * The operator's passkeys walk: six screens, each in Vietnamese and in English at the three widths
 * (6 × 2 × 3 = 36). The `passkeys-fake` project runs it on `pnpm fake -- …`, the UI alone over the
 * data set, with a fake authenticator that answers as a passkey would, so no passkey is ever made
 * on the machine running it, and keeps the pictures as the full run's reference. Each screen opens
 * at an address of its own. The words come from the app's own dictionaries.
 *
 * The `passkeys-full` project runs it on a stack (`pnpm stack -- …`), with Chromium's virtual
 * authenticator in place of the fake, and compares the pictures with the bases, or with the fake
 * run's. The stack holds the data set's operators as the fake does: `operator`, signed in by a
 * handle the stack gives (no ceremony, so no passkey of theirs is stamped with today), and the
 * invited one with a link made by `operator`, which serves once. So the full walk meets its screens
 * in the order the link allows: the link unused, a passkey that is not given, one that no operator
 * holds, the join, the link spent, one's own passkeys, the sign-in ended.
 */

/** Where a screen opens: the address (a join link's token is in its fragment), whether the operator
 * is signed in, and the failure the fake answers once. */
type Opening = { path: string; operator?: true; cue?: string };

/** The link of the invited operator in the data set, as the operator is sent it. */
const JOIN_LINK = `/operator/join#${DEMO_JOIN_TOKEN}`;

/** Opens a screen on the fake: the address with `?fake` before any fragment, and the cue; the
 * language and the operator's handle are kept in the tab. */
async function open(page: Page, language: Language, { path, operator, cue }: Opening) {
  await page.addInitScript(
    ([chosen, handle]) => {
      sessionStorage.setItem('credo.language', chosen);
      if (handle) sessionStorage.setItem('credo.operator', handle);
      else sessionStorage.removeItem('credo.operator');
    },
    [language, operator ? 'fake.operator' : ''],
  );
  const [route, fragment] = path.split('#');
  await page.goto(`${route}?fake${cue ? `&cue=${cue}` : ''}${fragment ? `#${fragment}` : ''}`);
}

/** A label as a whole, the star of a required one allowed: a bare string matches any label that
 * holds it. */
const exactly = (label: string) =>
  new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\*?$`);

const FULL = () => test.info().project.name === 'passkeys-full';

async function walk(page: Page, language: Language, width: number) {
  const at = (screen: string, mask: Locator[] = []) => shot(page, screen, language, width, mask);
  const words = DICTIONARIES[language];
  const title = (heading: string) => page.getByRole('heading', { level: 2, name: heading });
  const field = (label: string) => page.getByRole('textbox', { name: exactly(label) });
  const press = (name: string) => page.getByRole('button', { name, exact: true }).click();
  const alert = (text: string) => expect(page.getByRole('alert')).toHaveText(text);

  // 1. A join link opened: whose it is, who made it, the button to make a passkey.
  await open(page, language, { path: JOIN_LINK });
  await expect(title(words.passkey.joinTitle)).toBeVisible();
  await expect(
    page.getByText(words.passkey.joinFor.replace('{{name}}', DEMO_INVITED_NAME)),
  ).toBeVisible();
  await expect(
    page.getByText(words.passkey.joinMadeBy.replace('{{name}}', OPERATOR_NAME)),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: words.passkey.makeButton, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('group', { name: words.user.language })).toBeVisible();
  await at('pk-1-join');

  // 2. One's own passkeys: when each was added and last used.
  await open(page, language, { path: '/operator/passkeys', operator: true });
  await expect(title(words.passkey.title)).toBeVisible();
  await expect(page.getByRole('cell', { name: words.passkey.never, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: words.passkey.add, exact: true })).toBeVisible();
  await at('pk-2-passkeys');

  // 3. The passkey not given: the fake authenticator is cued to refuse once.
  await open(page, language, { path: '/operator', cue: 'passkey:notGiven' });
  await expect(title(words.operator.signIn)).toBeVisible();
  await press(words.passkey.signInButton);
  await alert(words.passkey.notGiven);
  await at('pk-3-not-given');

  // 4. A passkey that opens nothing here: the sign-in answers a 401 once.
  await open(page, language, { path: '/operator', cue: 'operatorPasskeySignIn:401' });
  await expect(title(words.operator.signIn)).toBeVisible();
  await press(words.passkey.signInButton);
  await alert(words.passkey.refused);
  await at('pk-4-no-operator');

  // 5. A link used, too old or replaced: the opening answers a 404 once.
  await open(page, language, { path: JOIN_LINK, cue: 'operatorJoinOptions:404' });
  await alert(words.passkey.dead);
  await expect(page.getByRole('group', { name: words.user.language })).toBeVisible();
  await at('pk-5-link-dead');

  // 6. The sign-in ended mid-task: the make answers a 401 once, under the form that was typed.
  await open(page, language, {
    path: '/operator/clients/new',
    operator: true,
    cue: 'makeClient:401',
  });
  await expect(title(words.operator.newTitle)).toBeVisible();
  await field(words.operator.code).fill('minh-phat');
  await field(words.operator.companyName).fill('Minh Phát');
  await press(words.operator.make);
  await expect(page.getByRole('dialog', { name: words.passkey.endedTitle })).toBeVisible();
  await expect(field(words.operator.code)).toHaveValue('minh-phat');
  await at('pk-6-sign-in-ended');
}

/** Opens a screen on the stack (the full walk takes its pictures with `picture`, not `at`, which
 * the visual package reads as the fake walk's list of screens): the language kept on the device, and the operator's handle when the
 * screen is for one signed in, taken off the device when it is not. A script added for an earlier
 * screen runs first, so the last one added decides. */
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

async function walkFull(page: Page, language: Language, width: number) {
  const picture = (screen: string, mask: Locator[] = []) =>
    shot(page, screen, language, width, mask);
  const words = DICTIONARIES[language];
  const link = required(STACK_ENV.CREDO_OPERATOR_LINK);
  const title = (heading: string) => page.getByRole('heading', { level: 2, name: heading });
  const field = (label: string) => page.getByRole('textbox', { name: exactly(label) });
  const press = (name: string) => page.getByRole('button', { name, exact: true }).click();
  const alert = (text: string) => expect(page.getByRole('alert')).toHaveText(text);
  const authenticator = await virtualAuthenticator(page);
  const handle = required(STACK_ENV.CREDO_OPERATOR_HANDLE);

  // 1. The stack's link opened and not used: whose it is and who made it, as the fake's.
  await openFull(page, language, null, link);
  await expect(title(words.passkey.joinTitle)).toBeVisible();
  await expect(
    page.getByText(words.passkey.joinFor.replace('{{name}}', DEMO_INVITED_NAME)),
  ).toBeVisible();
  await expect(
    page.getByText(words.passkey.joinMadeBy.replace('{{name}}', OPERATOR_NAME)),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: words.passkey.makeButton, exact: true }),
  ).toBeVisible();
  await picture('pk-1-join');

  // 3. The passkey not given: the authenticator cannot verify the user, so the browser refuses.
  await authenticator.verified(false);
  await openFull(page, language, null, '/operator');
  await expect(title(words.operator.signIn)).toBeVisible();
  await press(words.passkey.signInButton);
  await alert(words.passkey.notGiven);
  await picture('pk-3-not-given');
  await authenticator.verified(true);

  // 4. A passkey that opens nothing here: the authenticator holds one no operator has.
  await authenticator.stranger();
  await openFull(page, language, null, '/operator');
  await expect(title(words.operator.signIn)).toBeVisible();
  await press(words.passkey.signInButton);
  await alert(words.passkey.refused);
  await picture('pk-4-no-operator');
  await authenticator.forget();

  // The join, which the walk shoots no picture of: the link's own button makes the invited
  // operator's passkey on the authenticator and spends the link.
  await openFull(page, language, null, link);
  await press(words.passkey.makeButton);
  await reachedPath(page, '/operator/clients');
  await expect(title(words.nav.clients)).toBeVisible();
  expect(
    await readOperatorHandle(page),
    'the join keeps the operator’s handle on the device',
  ).toBeTruthy();

  // 5. The link used: the same address again says it cannot be used.
  await openFull(page, language, null, link);
  await alert(words.passkey.dead);
  await picture('pk-5-link-dead');

  // The browser's answers, which no picture shows: Lan Anh signs in by the passkey the join made
  // (a real answer the stack checks: origin, rpID, signature, counter; it stamps her own last-used
  // day), then adds a second, asked for by a touch of the first. The second is made as on another
  // device: the route drops the exclusion from the options and nothing else.
  await openFull(page, language, null, '/operator');
  await expect(title(words.operator.signIn)).toBeVisible();
  await press(words.passkey.signInButton);
  await reachedPath(page, '/operator/clients');
  const hers = await readOperatorHandle(page);
  expect(hers, 'the sign-in keeps the operator’s handle on the device').toBeTruthy();
  await openFull(page, language, hers, '/operator/passkeys');
  await expect(title(words.passkey.title)).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(1 + 1);
  const addOptions = '**/api/operator/passkeys/options';
  await page.route(addOptions, async (route) => {
    const reply = await route.fetch();
    const body = (await reply.json()) as { options: Record<string, unknown> };
    delete body.options['excludeCredentials'];
    await route.fulfill({ response: reply, json: body });
  });
  await press(words.passkey.add);
  await expect(page.getByRole('row')).toHaveCount(1 + 2);
  await page.unroute(addOptions);

  // 2. One's own passkeys: the data set's two, at their fixed days, as the stack gave them.
  await openFull(page, language, handle, '/operator/passkeys');
  await expect(title(words.passkey.title)).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(1 + DEMO_PASSKEYS.length);
  await expect(page.getByRole('cell', { name: words.passkey.never, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: words.passkey.add, exact: true })).toBeVisible();
  await picture('pk-2-passkeys');

  // 6. The sign-in ended mid-task: the real API's sign-out ends the session under the typed form,
  // and the make is answered with a 401.
  await openFull(page, language, handle, '/operator/clients/new');
  await expect(title(words.operator.newTitle)).toBeVisible();
  await field(words.operator.code).fill('minh-phat');
  await field(words.operator.companyName).fill('Minh Phát');
  // A failed call is rethrown without Playwright's call log, which prints every request header,
  // the handle among them.
  const ended = await page.request
    .post('/api/operator/sign-out', { headers: { [AUTH_HEADER]: handle } })
    .catch(() => {
      throw new Error('the sign-out call failed (its headers are left out of the log)');
    });
  expect(ended.status(), 'the sign-out ends the session').toBe(204);
  await press(words.operator.make);
  await expect(page.getByRole('dialog', { name: words.passkey.endedTitle })).toBeVisible();
  await expect(field(words.operator.code)).toHaveValue('minh-phat');
  await picture('pk-6-sign-in-ended');
}

for (const [device, width] of Object.entries(WIDTHS)) {
  test.describe(`the operator's passkeys, on a ${device} (${width})`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const [language, name] of [
      ['vi', 'Vietnamese'],
      ['en', 'English'],
    ] as const) {
      test(`walks all six screens in ${name}`, async ({ page }) => {
        await (FULL() ? walkFull : walk)(page, language, width);
      });
    }
  });
}
