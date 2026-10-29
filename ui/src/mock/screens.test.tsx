import { LANGUAGES } from '@credo/shared';
import { describe, expect, it } from 'vitest';
import { draw } from '../../tests/render';
import { DICTIONARIES } from '../i18n';
import { SCREENS } from './screens';

/** Every key of a dictionary, by its dotted path. */
const keysOf = (group: object, at = ''): string[] =>
  Object.entries(group).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${at}${key}`] : keysOf(value as object, `${at}${key}.`),
  );

describe('the walk’s screens', () => {
  // One case a language, each with its own time limit: all of them in one case took 10 s of 5 under
  // act's parallel jobs.
  it.each(LANGUAGES)('Every screen reads fully in %s', (language) => {
    const keys = keysOf(DICTIONARIES.en);
    for (const screen of SCREENS) {
      for (const state of screen.states) {
        const { container, unmount } = draw(state.screen, language);
        const shown = container.textContent;

        expect(
          keys.filter((key) => shown.includes(key)),
          `${screen.number} ${state.id} ${language}`,
        ).toEqual([]);
        expect(shown.length, `${screen.number} ${state.id}`).toBeGreaterThan(0);
        unmount();
      }
    }
  });

  it('Draws a refused save and a refused logo, each with its own words, in both languages', () => {
    const stateOf = (id: string) => SCREENS[2].states.find((state) => state.id === id)!.screen;
    const drawn = (id: string, language: 'en' | 'vi') => {
      const { container, unmount } = draw(stateOf(id), language);
      const shown = container.textContent;
      unmount();
      return shown;
    };

    for (const language of LANGUAGES) {
      const words = DICTIONARIES[language].settings;
      expect(drawn('refused', language)).toContain(words.saveRefused);
      expect(drawn('logo-too-large', language)).toContain(
        words.logoTooLarge.replace('{{max}}', '200'),
      );
      expect(drawn('logo-not-image', language)).toContain(words.logoNotImage);
    }
    expect(drawn('logo-too-large', 'en')).not.toContain(DICTIONARIES.en.settings.saveRefused);
  });

  it('numbers piece 1’s screens as its walk does, screen 9 after them, and draws no operator screen', () => {
    expect(SCREENS.map((screen) => screen.number)).toEqual([1, 2, 3, 4, 5, 6, 9]);
  });

  it('draws screen 9 in credo’s colour and in no company’s name', () => {
    const credo = '#3e618c';
    for (const number of [9]) {
      const found = SCREENS.find((screen) => screen.number === number)!;
      expect(
        found.states.map((state) => state.colour),
        `${number}`,
      ).toEqual(found.states.map(() => credo));
    }
    const unknown = draw(SCREENS.find((screen) => screen.number === 9)!.states[0].screen);

    expect(unknown.container.textContent).not.toContain('Minh Phát');
  });
});
