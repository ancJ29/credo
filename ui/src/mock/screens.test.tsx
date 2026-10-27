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
  it('Every screen reads fully in each language', () => {
    const keys = keysOf(DICTIONARIES.en);
    for (const language of LANGUAGES) {
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
    }
  });

  it('numbers the six screens of the walk, in order', () => {
    expect(SCREENS.map((screen) => screen.number)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
