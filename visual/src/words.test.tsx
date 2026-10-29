import { LANGUAGES } from '@credo/shared';
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

  it('draws the open user menu of screen 5, which screen 3 lacks', () => {
    const open = drawnWords(stateOf(5, 'filled').screen, '#2f7d6d', 'en');
    const closed = drawnWords(stateOf(3, 'filled').screen, '#2f7d6d', 'en');

    expect(open).toContain('menuitem: Sign out');
    expect(closed).not.toContain('menuitem: Sign out');
  });

  it('leaves nothing drawn behind', () => {
    const before = document.body.childElementCount;
    drawnWords(stateOf(1, 'empty').screen, '#2f7d6d', 'en');

    expect(document.body.childElementCount).toBe(before);
  });
});

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
  'admin-staff:staff-16-field-refused': (w) => `form: ${w.fields.invalidNumber}`,
  'office-staff:office-1-menu': (w) => `link: ${w.nav.staff}`,
  'office-staff:office-2-add': (w) => `main: ${w.person.signInNotYet}`,
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
};

describe('the app’s own scenes, drawn', () => {
  it('Each piece-2 walk screen is drawn on the walks page as a fake scene; a step that finds nothing stops the build, naming the walk, the screen and the step', async () => {
    const drawn = resolveDrawn(WALKS.slice(2), SCREENS);
    expect([...drawn.keys()].sort()).toEqual(Object.keys(PROOF).sort());

    for (const [key, what] of drawn) {
      for (const language of LANGUAGES) {
        const navigation = [
          'office-staff:office-1-menu',
          'office-staff:office-5-settings',
        ].includes(key);
        const words = await readWords(what, language, navigation);
        expect(words, `${key} ${language}`).toContain(PROOF[key](DICTIONARIES[language]));
        expect(
          words.filter((line) => /\b[a-z]+\.[a-zA-Z]+\b/.test(line)),
          key,
        ).toEqual([]);
      }
    }

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
