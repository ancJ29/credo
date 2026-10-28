import { LANGUAGES } from '@credo/shared';
import { SCREENS } from '@credo/ui/mock';
import { describe, expect, it } from 'vitest';
import { drawnWords, wordsOf } from './words';

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
