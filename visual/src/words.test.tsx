import { LANGUAGES } from '@credo/shared';
import {
  DEMO_CODE,
  DEMO_CONFIG,
  DEMO_CUSTOMERS,
  DEMO_DELIVERIES,
  DEMO_EMPLOYEES,
  DEMO_INVITED_NAME,
  DEMO_PRODUCTS,
  DEMO_TODAY,
  OPERATOR_NAME,
} from '@credo/shared/demo';
import { SCREENS } from '@credo/ui/mock';
import { DICTIONARIES } from '@credo/ui/words';
import { describe, expect, it, vi } from 'vitest';
import { resolveDrawn, WALKS } from './walks';
import { drawnSceneWords, drawnWords, readWords, wordsOf } from './words';

/** A tree of elements built from markup, as the words reader meets one. */
const dom = (markup: string) => {
  const root = document.createElement('div');
  root.innerHTML = markup;
  return root;
};

/** Whether a record has a note the page draws: a text that is not empty, never an array index. */
const hasNote = (one: { extra: Record<string, unknown> }) =>
  typeof one.extra['note'] === 'string' && one.extra['note'] !== '';

const stateOf = (screen: number, state: string) =>
  SCREENS.find((s) => s.number === screen)!.states.find((s) => s.id === state)!;

describe('a screen’s words', () => {
  it('A screen’s words are its texts, accessible names, field values, placeholders and image alternatives in reading order, with their roles', () => {
    const root = dom(`
      <h1>Title</h1>
      <p>Some   spaced
         text</p>
      <button aria-label="Close"></button>
      <label for="a">Name</label><input id="a" value="Minh" placeholder="Your name">
      <img alt="A logo" src="x"><img alt="" src="y"><img src="z">
      <textarea aria-label="Notes"></textarea>
      <input aria-label="Tick" type="checkbox" checked>
      <input aria-label="Not ticked" type="checkbox">
      <input aria-label="Logo file" type="file">
      <input type="hidden" value="secret">
      <select aria-label="Pick"><option value="v" selected>Vee</option></select>`);

    expect(wordsOf(root)).toEqual([
      'heading: Title',
      'text: Some spaced text',
      'button: Close',
      'text: Name',
      'textbox "Name" = "Minh" placeholder "Your name"',
      'img: A logo',
      'textbox "Notes"',
      'checkbox "Tick" checked',
      'checkbox "Not ticked" unchecked',
      'input "Logo file"',
      'combobox "Pick" = "v"',
      'option: Vee',
    ]);
  });

  it('names a button once, by its text, and by its label only when the label says something else', () => {
    const root = dom(`<button>Save</button><button aria-label="Save">Go</button>`);

    expect(wordsOf(root)).toEqual(['button: Save', 'button: Save', 'button: Go']);
  });

  it('puts a text in the nearest role it sits in', () => {
    const root = dom(`<div role="alert"><div><span>Failed</span></div></div><span>Loose</span>`);

    expect(wordsOf(root)).toEqual(['alert: Failed', 'text: Loose']);
  });

  it('leaves out scripts, styles and anything that is not an element or a text', () => {
    const root = dom(`<script>var a = 1</script><style>p{}</style><!-- a note --><p>Kept</p>`);

    expect(wordsOf(root)).toEqual(['text: Kept']);
  });

  it('leaves out the menu’s navigation unless the walk marks the screen as about it', () => {
    const root = dom(`<nav aria-label="Menu"><a href="/s">Settings</a></nav><main>Page</main>`);

    expect(wordsOf(root)).toEqual(['main: Page']);
    expect(wordsOf(root, { navigation: true })).toEqual([
      'navigation: Menu',
      'link: Settings',
      'main: Page',
    ]);
  });
});

describe('the app’s own screens, drawn', () => {
  it('reads what a drawn screen says in each language, never a key', () => {
    const state = stateOf(3, 'save-failed');
    const [vi, en] = LANGUAGES.map((language) => drawnWords(state.screen, state.colour, language));

    expect(en).toContain(
      'alert: The settings were not saved. What you typed is still here: try again.',
    );
    expect(en).toContain('textbox "Company name" = "Minh Phát Sài Gòn"');
    expect(vi).toContain('heading: Cài đặt');
    expect(vi).not.toEqual(en);
    expect([...vi, ...en].filter((line) => /\b[a-z]+\.[a-zA-Z]+\b/.test(line))).toEqual([]);
  });

  it('gives the same words each time a screen is drawn', () => {
    for (const screen of SCREENS) {
      for (const state of screen.states) {
        for (const language of LANGUAGES) {
          expect(
            drawnWords(state.screen, state.colour, language),
            `${screen.number} ${state.id}`,
          ).toEqual(drawnWords(state.screen, state.colour, language));
        }
      }
    }
  });

  it('A change of look alone asks nothing: another brand colour reads the same words', () => {
    const state = stateOf(3, 'filled');

    expect(drawnWords(state.screen, '#b4532a', 'en')).toEqual(
      drawnWords(state.screen, state.colour, 'en'),
    );
  });

  it('leaves the menu of pages out of a screen’s words, and keeps it when the screen is about it', () => {
    const state = stateOf(3, 'filled');

    expect(drawnWords(state.screen, state.colour, 'en')).not.toContain('link: Settings');
    expect(drawnWords(state.screen, state.colour, 'en', { navigation: true })).toContain(
      'link: Settings',
    );
  });

  it('draws the open language menu of screen 5, which screen 3 lacks', () => {
    const open = drawnWords(stateOf(5, 'filled').screen, '#2f7d6d', 'en');
    const closed = drawnWords(stateOf(3, 'filled').screen, '#2f7d6d', 'en');

    expect(open).toContain('menuitem: Tiếng Việt');
    expect(closed).not.toContain('menuitem: Tiếng Việt');
  });

  it('leaves nothing drawn behind', () => {
    const before = document.body.childElementCount;
    drawnWords(stateOf(1, 'empty').screen, '#2f7d6d', 'en');

    expect(document.body.childElementCount).toBe(before);
  });
});

/** The driver the orders' scenes choose, by the id the fake's choice holds, and the request they cancel. */
const DRIVER_ID = DEMO_EMPLOYEES.find((person) => person.code === 'EMP-0005')!.id;
const WAITING = DEMO_DELIVERIES.find(
  (one) => one.day === DEMO_TODAY && one.state === 'waiting' && one.driver.code === 'EMP-0006',
)!;

/** The request the driver's scenes open, and the one the data set delivered, which the office's scenes open. */
const WAITING_OF_DRIVER = DEMO_DELIVERIES.find(
  (one) => one.day === DEMO_TODAY && one.state === 'waiting' && one.driver.code === 'EMP-0005',
)!;
const DELIVERED = DEMO_DELIVERIES.find(
  (one) => one.day === DEMO_TODAY && one.state === 'delivered',
)!;

/** A number as a language writes it, and an amount of đồng with the language's unit. */
const numberIn = (w: (typeof DICTIONARIES)['en'], amount: number) =>
  new Intl.NumberFormat(w === DICTIONARIES.vi ? 'vi' : 'en').format(amount);
const moneyIn = (w: (typeof DICTIONARIES)['en'], amount: number) =>
  w.orders.money.replace('{{amount}}', numberIn(w, amount));

/** A line only a scene whose steps ran can hold, for each piece-2 screen, in a language's words. */
const PROOF: Record<string, (w: (typeof DICTIONARIES)['en']) => string> = {
  'admin-staff-setup:setup-1-departments-positions': (w) => `heading: ${w.setup.title}`,
  // the field just added has no key yet; the saved ones show theirs
  'admin-staff-setup:setup-2-fields': (w) => `textbox "${w.setup.ownKey}"`,
  'admin-staff:staff-1-list': (w) => `heading: ${w.staff.title}`,
  'admin-staff:staff-2-add': (w) => `textbox "${w.addPerson.name}" = "Mai Linh"`,
  'admin-staff:staff-3-added': (w) => `textbox "${w.addPerson.firstPassword}" = "Fake-password-1!"`,
  'admin-staff:staff-4-person': (w) => `textbox "${w.person.phone}" = "0903 111 002"`,
  'admin-staff:staff-5-permissions': (w) => `radio "${w.permissions.allow}" checked`,
  'admin-staff:staff-6-password': (w) => `textbox "${w.person.passwordShown}" = "Fake-password-1!"`,
  'admin-staff:staff-7-archive': (w) =>
    `button: ${w.person.archiveConfirm.replace('{{name}}', 'Đặng Hoài Nam')}`,
  'admin-staff:staff-8-left': () => 'link: Hoàng Gia Huy',
  'admin-staff:staff-9-code-taken': (w) => `alert: ${w.addPerson.taken}`,
  'admin-staff:staff-10-save-conflict': (w) => `alert: ${w.person.conflict}`,
  'admin-staff:staff-11-save-failed': (w) => `alert: ${w.person.saveFailed}`,
  'admin-staff:staff-12-own-fields': (w) =>
    `textbox "${w.addPerson.personalPhone}" = "0909 555 666"`,
  'admin-staff:staff-13-photo': () => 'img: Lê Minh Châu',
  'admin-staff:staff-14-search': (w) =>
    `textbox "${w.staff.search}" = "phong" placeholder "${w.staff.searchPlaceholder}"`,
  'admin-staff:staff-15-code-changed': () => 'main: NV-12',
  'admin-staff:staff-16-field-refused': (w) => `region: ${w.fields.invalidNumber}`,
  'admin-staff:staff-19-import': (w) =>
    `main: ${w.import.chosen.replace('{{name}}', 'import.xlsx')}`,
  'admin-staff:staff-20-preview': (w) => `heading: ${w.import.previewTitle}`,
  'admin-staff:staff-21-imported': (w) => `heading: ${w.import.doneTitle}`,
  'admin-staff:staff-22-no-name': (w) =>
    `alert: ${w.import.noName.replaceAll('{{name}}', w.addPerson.name)}`,
  'admin-staff:staff-23-back-on': (w) => `button: ${w.person.archive}`,
  'office-staff:office-1-menu': (w) => `link: ${w.nav.staff}`,
  'office-staff:office-2-add': (w) => `region: ${w.person.signInNotYet}`,
  'office-staff:office-3-forbidden': (w) => `heading: ${w.forbidden.title}`,
  'office-staff:office-4-nothing': (w) => `heading: ${w.nothing.title}`,
  'office-staff:office-5-settings': (w) => `link: ${w.nav.settings}`,
  'admin-staff:staff-17-email': (w) =>
    `alert: ${w.person.emailChanged.replace('{{email}}', 'hung@minh-phat.example')}`,
  'admin-staff:staff-18-qr': (w) => `img: ${w.person.qrImage}`,
  'office-staff:office-6-password': (w) => `alert: ${w.ownPassword.changed}`,
  'office-staff:office-7-password-wrong': (w) => `alert: ${w.ownPassword.wrong}`,
  'phone-sign-in:phone-1-signed-in': (w) => `heading: ${w.staff.title}`,
  'phone-sign-in:phone-2-code-used': (w) => `heading: ${w.qrSignIn.refusedTitle}`,
  'admin-lists:lists-1-customers': (w) => `heading: ${w.nav.customers}`,
  'admin-lists:lists-2-customers-import': (w) =>
    `main: ${w.import.chosen.replace('{{name}}', 'customers.xlsx')}`,
  'admin-lists:lists-3-customers-preview': (w) => `heading: ${w.import.previewTitle}`,
  'admin-lists:lists-4-customers-added': (w) => `heading: ${w.lists.customers.doneTitle}`,
  'admin-lists:lists-5-no-code': (w) =>
    `alert: ${w.lists.noColumn.replaceAll('{{name}}', w.lists.columns.code)}`,
  'admin-lists:lists-6-products': (w) => `heading: ${w.nav.products}`,
  'admin-lists:lists-7-products-preview': (w) => `heading: ${w.import.previewTitle}`,
  'admin-lists:lists-8-products-added': (w) => `heading: ${w.lists.products.doneTitle}`,
  'admin-lists:lists-9-more': (w) => `heading: ${w.nav.more}`,
  'admin-lists:lists-10-customer': () => `heading: ${DEMO_CUSTOMERS.find(hasNote)!.name}`,
  'admin-lists:lists-11-customer-no-note': () =>
    `heading: ${DEMO_CUSTOMERS.find((one) => !hasNote(one))!.name}`,
  'admin-lists:lists-12-product': () => `heading: ${DEMO_PRODUCTS.find(hasNote)!.name}`,
  'admin-lists:lists-13-product-no-note': () =>
    `heading: ${DEMO_PRODUCTS.find((one) => !hasNote(one))!.name}`,
  'office-orders:orders-1-list': (w) => `heading: ${w.nav.orders}`,
  // the second line is the one added by the steps; the form's own list holds the product too, as an option
  'office-orders:orders-2-new': () => 'cell: Cát xây tô',
  'office-orders:orders-3-confirm': (w) => `combobox "${w.orders.driver}" = "${DRIVER_ID}"`,
  'office-orders:orders-4-confirmed': (w) =>
    `alert: ${w.orders.done.confirmed.replace('{{number}}', 'GH-00015')}`,
  'office-orders:orders-5-requests': (w) => `heading: ${w.nav.deliveries}`,
  'office-orders:orders-6-request': (w) =>
    `heading: ${w.orders.requestTitle.replace('{{number}}', WAITING.number)}`,
  'office-orders:orders-7-cancelled': (w) => `heading: ${w.orders.sendAgain}`,
  'office-orders:orders-8-conflict': (w) => `alert: ${w.orders.conflict}`,
  'office-orders:orders-9-confirm-failed': (w) => `alert: ${w.orders.stepFailed}`,
  'office-orders:orders-10-no-drivers': (w) => `alert: ${w.orders.noDrivers}`,
  'office-orders:orders-11-fulfilled': (w) =>
    `heading: ${w.orders.orderTitle.replace('{{number}}', DELIVERED.order.number)}`,
  'office-orders:orders-12-proof': (w) => `heading: ${w.orders.proofTitle}`,
  'driver-deliveries:driver-1-today': (w) => `heading: ${w.nav.myDeliveries}`,
  'driver-deliveries:driver-2-request': (w) =>
    `heading: ${w.orders.requestTitle.replace('{{number}}', WAITING_OF_DRIVER.number)}`,
  // the preview and its buttons exist only once the photo was chosen
  'driver-deliveries:driver-3-photo': (w) => `heading: ${w.myDeliveries.photoTitle}`,
  'driver-deliveries:driver-4-delivered': (w) => `alert: ${w.myDeliveries.done}`,
  'driver-deliveries:driver-5-send-failed': (w) => `alert: ${w.myDeliveries.sendFailed}`,
  'driver-deliveries:driver-6-cancelled': (w) => `alert: ${w.myDeliveries.cancelled}`,
  'office-reconcile:reconcile-1-requests': (w) =>
    `link: ${w.reconcile.openFor.replace('{{name}}', 'Võ Thanh Tùng')}`,
  'office-reconcile:reconcile-2-day': (w) => `heading: ${w.reconcile.waitingTitle}`,
  // the cash typed (the sum to collect less 20,000), as the language writes a number
  'office-reconcile:reconcile-3-cash': (w) =>
    `textbox "${w.reconcile.cash}" = "${numberIn(w, 47_380_000)}"`,
  // the button of the check exists only once Close the day was pressed
  'office-reconcile:reconcile-4-check': (w) => `button: ${w.reconcile.closeConfirm}`,
  'office-reconcile:reconcile-5-closed': (w) => `alert: ${w.reconcile.closedNow}`,
  'office-reconcile:reconcile-6-yesterday': (w) =>
    `main: ${w.reconcile.dayClosedGap.replace('{{gap}}', w.reconcile.gapShort.replace('{{amount}}', moneyIn(w, 20_000)))}`,
  'office-reconcile:reconcile-7-moved': (w) => `alert: ${w.reconcile.moved}`,
  'office-reconcile:reconcile-8-failed': (w) => `alert: ${w.reconcile.failed}`,
};

/** What each passkeys screen must say, in either language: the line that makes it that screen. */
const PASSKEY_PROOF: Record<string, (w: (typeof DICTIONARIES)['en']) => string[]> = {
  'operator-passkeys:pk-1-join': (w) => [
    `text: ${w.passkey.joinFor.replace('{{name}}', DEMO_INVITED_NAME)}`,
    `text: ${w.passkey.joinMadeBy.replace('{{name}}', OPERATOR_NAME)}`,
    `button: ${w.passkey.makeButton}`,
  ],
  'operator-passkeys:pk-2-passkeys': (w) => [
    `heading: ${w.passkey.title}`,
    `button: ${w.passkey.add}`,
    `cell: ${w.passkey.never}`,
  ],
  'operator-passkeys:pk-3-not-given': (w) => [
    `alert: ${w.passkey.notGiven}`,
    `button: ${w.passkey.signInButton}`,
  ],
  'operator-passkeys:pk-4-no-operator': (w) => [`alert: ${w.passkey.refused}`],
  'operator-passkeys:pk-5-link-dead': (w) => [`alert: ${w.passkey.dead}`],
  'operator-passkeys:pk-6-sign-in-ended': (w) => [
    `dialog: ${w.passkey.endedTitle}`,
    `dialog: ${w.passkey.endedText}`,
    `button: ${w.passkey.endedButton}`,
  ],
};

describe('the passkeys walk, drawn', () => {
  it('Each passkeys screen is drawn as a fake scene saying what its question asks about, in both languages, never a key', async () => {
    const drawn = resolveDrawn(WALKS.slice(2, 3), SCREENS);
    expect([...drawn.keys()].sort()).toEqual(Object.keys(PASSKEY_PROOF).sort());

    for (const [key, what] of drawn) {
      for (const language of LANGUAGES) {
        const words = await readWords(what, language, false);
        for (const line of PASSKEY_PROOF[key](DICTIONARIES[language])) {
          expect(words, `${key} ${language}`).toContain(line);
        }
        expect(
          words.filter((line) => /\b[a-z]+\.[a-zA-Z]+\b/.test(line)),
          key,
        ).toEqual([]);
      }
    }
  });

  it('The ended sign-in keeps what was typed beneath the prompt', async () => {
    const drawn = resolveDrawn(WALKS.slice(2, 3), SCREENS);
    const words = await readWords(drawn.get('operator-passkeys:pk-6-sign-in-ended')!, 'en', false);

    expect(words.some((line) => line.startsWith('textbox "Client code" = "minh-phat"'))).toBe(true);
    expect(words.some((line) => line.startsWith('textbox "Company name" = "Minh Phát"'))).toBe(
      true,
    );
  });
});

/** What each services screen must say, in either language: the line that makes it that screen. */
const SERVICES_PROOF: Record<string, (w: (typeof DICTIONARIES)['en']) => string[]> = {
  'operator-services:sv-1-all-well': (w) => [`status: ${w.services.oneBuild}`],
  'operator-services:sv-2-two-builds': (w) => [`status: ${w.services.twoBuilds}`],
  'operator-services:sv-3-storage-silent': (w) => [`alert: ${w.services.storageDown}`],
  'operator-services:sv-4-bff-silent': (w) => [`alert: ${w.services.bffDown}`],
  'operator-services:sv-5-unavailable': (w) => [`alert: ${w.operator.unavailableStorage}`],
};

describe('the services walk, drawn', () => {
  it('C: Each services screen is drawn as a fake scene saying what its question asks about, in both languages, never a key', async () => {
    const drawn = resolveDrawn(WALKS.slice(3, 4), SCREENS);
    expect([...drawn.keys()].sort()).toEqual(Object.keys(SERVICES_PROOF).sort());

    for (const [key, what] of drawn) {
      for (const language of LANGUAGES) {
        const words = await readWords(what, language, false);
        for (const line of SERVICES_PROOF[key](DICTIONARIES[language])) {
          expect(words, `${key} ${language}`).toContain(line);
        }
        expect(
          words.filter((line) => /\b[a-z]+\.[a-zA-Z]+\b/.test(line)),
          key,
        ).toEqual([]);
      }
    }
  });
});

/** What each root password screen must say, in either language: the line that makes it that screen. */
const ROOT_PROOF: Record<string, (w: (typeof DICTIONARIES)['en']) => string[]> = {
  'operator-root-password:rp-1-form': (w) => [
    `heading: ${w.operator.rootTitle.replace('{{name}}', DEMO_CONFIG.name)}`,
    `textbox "${w.operator.rootCodeLabel}" = "${DEMO_CODE}"`,
  ],
  'operator-root-password:rp-2-rule': (w) => [`alert: ${w.person.passwordInvalid}`],
  'operator-root-password:rp-3-made': (w) => [`heading: ${w.operator.rootMadeTitle}`],
  'operator-root-password:rp-4-failed': (w) => [`alert: ${w.operator.rootFailed}`],
};

describe('the root password walk, drawn', () => {
  it('D: Each root password screen is drawn as a fake scene saying what its question asks about, in both languages, never a key', async () => {
    const drawn = resolveDrawn(WALKS.slice(12, 13), SCREENS);
    expect([...drawn.keys()].sort()).toEqual(Object.keys(ROOT_PROOF).sort());

    for (const [key, what] of drawn) {
      for (const language of LANGUAGES) {
        const words = await readWords(what, language, false);
        for (const line of ROOT_PROOF[key](DICTIONARIES[language])) {
          expect(words, `${key} ${language}`).toContain(line);
        }
        expect(
          words.filter((line) => /\b[a-z]+\.[a-zA-Z]+\b/.test(line)),
          key,
        ).toEqual([]);
      }
    }
  });
});

/** What each operators screen must say, in either language: the line that makes it that screen. */
const TEAM_PROOF: Record<string, (w: (typeof DICTIONARIES)['en']) => string[]> = {
  'operator-team:tm-1-list': (w) => [
    `heading: ${w.nav.operators}`,
    `columnheader: ${w.team.colAddedBy}`,
    `cell: ${DEMO_INVITED_NAME}`,
  ],
  'operator-team:tm-2-name': (w) => [
    `heading: ${w.team.newTitle}`,
    `textbox "${w.team.nameLabel}" = "Thu Hà"`,
  ],
  'operator-team:tm-3-added': (w) => [`heading: ${w.team.addedTitle}`],
  'operator-team:tm-4-link': (w) => [`heading: ${w.team.linkMadeTitle}`],
  'operator-team:tm-5-delete': (w) => [
    `heading: ${w.team.deleteTitle.replace('{{name}}', 'Minh Quân')}`,
    `button: ${w.team.deleteMake}`,
  ],
  'operator-team:tm-6-taken': (w) => [`alert: ${w.team.taken}`],
};

/** What each client delete screen must say, in either language: the line that makes it that screen. */
const DELETE_PROOF: Record<string, (w: (typeof DICTIONARIES)['en']) => string[]> = {
  'operator-delete-client:dc-1-page': (w) => [
    `heading: ${w.operator.deleteClientTitle.replace('{{name}}', 'Hoa Sen')}`,
    `button: ${w.operator.deleteClientMake}`,
  ],
  'operator-delete-client:dc-2-code': (w) => [`alert: ${w.operator.rootCodeWrong}`],
  'operator-delete-client:dc-3-failed': (w) => [`alert: ${w.operator.deleteClientFailed}`],
  'operator-delete-client:dc-4-gone': (w) => [`heading: ${w.nav.clients}`, `cell: Bình An`],
};

describe('the client delete walk, drawn', () => {
  it('Each client delete screen is drawn as a fake scene saying what its question asks about, in both languages, never a key', async () => {
    const drawn = resolveDrawn(WALKS.slice(14, 15), SCREENS);
    expect([...drawn.keys()].sort()).toEqual(Object.keys(DELETE_PROOF).sort());

    for (const [key, what] of drawn) {
      for (const language of LANGUAGES) {
        const words = await readWords(what, language, false);
        for (const line of DELETE_PROOF[key](DICTIONARIES[language])) {
          expect(words, `${key} ${language}`).toContain(line);
        }
        expect(
          words.filter((line) => /\b[a-z]+\.[a-zA-Z]+\b/.test(line)),
          key,
        ).toEqual([]);
      }
    }
  });
});

describe('the operators walk, drawn', () => {
  it('B1: Each operators screen is drawn as a fake scene saying what its question asks about, in both languages, never a key', async () => {
    const drawn = resolveDrawn(WALKS.slice(13, 14), SCREENS);
    expect([...drawn.keys()].sort()).toEqual(Object.keys(TEAM_PROOF).sort());

    for (const [key, what] of drawn) {
      for (const language of LANGUAGES) {
        const words = await readWords(what, language, false);
        for (const line of TEAM_PROOF[key](DICTIONARIES[language])) {
          expect(words, `${key} ${language}`).toContain(line);
        }
        expect(
          words.filter((line) => /\b[a-z]+\.[a-zA-Z]+\b/.test(line)),
          key,
        ).toEqual([]);
      }
    }
  });
});

describe('the app’s own scenes, drawn', () => {
  // One test a screen: the cost of a screen is its own, so a walk added never moves another test
  // toward its budget, and a red names the screen.
  const DRAWN = resolveDrawn(WALKS.slice(4, 12), SCREENS);

  it('The piece-2 walks hold exactly the screens the proofs below name', () => {
    expect([...DRAWN.keys()].sort()).toEqual(Object.keys(PROOF).sort());
  });

  it.each(Object.keys(PROOF))(
    'Each piece-2 walk screen is drawn on the walks page as a fake scene, in both languages, and again the same: %s',
    async (key) => {
      const what = DRAWN.get(key)!;
      for (const language of LANGUAGES) {
        const navigation = [
          'office-staff:office-1-menu',
          'office-staff:office-5-settings',
        ].includes(key);
        const words = await readWords(what, language, navigation);
        expect(words, `${key} ${language}`).toContain(PROOF[key](DICTIONARIES[language]));
        // Drawn again from a fresh start, a screen reads the same: an answer is kept by the
        // fingerprint of these words, so one that changes between builds can never stay answered.
        expect(await readWords(what, language, navigation), `${key} ${language} again`).toEqual(
          words,
        );
        // A leaked dictionary key reads `word.Word`; an email's domain reads the same, so emails are
        // taken out of a line before it is looked at.
        expect(
          // a dictionary key left showing; the demo file's name is not one
          words.filter((line) =>
            /\b[a-z]+\.[a-zA-Z]+\b/.test(
              line.replaceAll(/[\w-]+\.xlsx/g, '').replace(/\S+@\S+/g, ''),
            ),
          ),
          key,
        ).toEqual([]);
      }
    },
  );

  it('a step that finds nothing stops the build, naming the walk, the screen and the step', async () => {
    const lacking = {
      id: 'x-1-nothing',
      walk: 'a-walk',
      scene: { path: '/staff', steps: [{ press: 'staff.empty' }] },
    };
    await expect(
      drawnSceneWords(lacking, 'en', { limits: { findFor: 100, stillFor: 10, stillAtMost: 50 } }),
    ).rejects.toThrow(
      'walk a-walk, screen x-1-nothing: step 1 ({"press":"staff.empty"}): found no button, link or choice named “No one is on the list yet.”',
    );
  });

  it('gives the same words each time a scene is drawn, and leaves nothing drawn behind', async () => {
    const before = document.body.childElementCount;
    const drawn = { id: 's', walk: 'w', scene: { path: '/staff', as: 'EMP-0001' } };

    const first = await drawnSceneWords(drawn, 'en');
    const second = await drawnSceneWords(drawn, 'en');

    expect(first).toEqual(second);
    expect(document.body.childElementCount).toBe(before);
  });

  it('keeps the menu of pages out of a scene’s words unless the screen is about it', async () => {
    const drawn = { id: 's', walk: 'w', scene: { path: '/staff', as: 'EMP-0001' } };

    expect(await drawnSceneWords(drawn, 'en')).not.toContain('link: Staff');
    expect(await drawnSceneWords(drawn, 'en', { navigation: true })).toContain('link: Staff');
  });

  it('stops a build whose scene never ends, naming it, and not one that crashes the app', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    // React reports the app's crash to the window, which would stop the test run
    const swallow = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener('error', swallow);
    // `EMP-9999` is no one of the data set: the scene's parts cannot be made, and nothing draws
    const crashing = { id: 'x-2-crash', walk: 'a-walk', scene: { path: '/staff', as: 'EMP-9999' } };

    await expect(drawnSceneWords(crashing, 'en', { endsIn: 200 })).rejects.toThrow(
      'walk a-walk, screen x-2-crash: the scene did not end in 200 ms',
    );
    window.removeEventListener('error', swallow);
    error.mockRestore();
  });

  it('reads a mock’s state as before, through the one reader the page and the answers use', async () => {
    const state = stateOf(3, 'save-failed');

    expect(await readWords(state, 'en', false)).toEqual(
      drawnWords(state.screen, state.colour, 'en'),
    );
  });
});
