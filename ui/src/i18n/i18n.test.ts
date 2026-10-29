import { describe, expect, it } from 'vitest';
import { createI18n, DICTIONARIES } from './index';

/** Every key of a dictionary, by its dotted path. */
const keysOf = (group: object, at = ''): string[] =>
  Object.entries(group).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${at}${key}`] : keysOf(value as object, `${at}${key}.`),
  );

describe('the dictionaries', () => {
  it('Both dictionaries hold the same keys', () => {
    expect(keysOf(DICTIONARIES.vi).sort()).toEqual(keysOf(DICTIONARIES.en).sort());
  });
});

/** Every string of a dictionary by its dotted path. */
const entriesOf = (group: object, at = ''): [string, string][] =>
  Object.entries(group).flatMap(([key, value]) =>
    typeof value === 'string'
      ? [[`${at}${key}`, value] as [string, string]]
      : entriesOf(value as object, `${at}${key}.`),
  );

describe('the Vietnamese dictionary', () => {
  it('Every new screen reads fully in Vietnamese: no value is the English one left behind, but the three names that are the same in both', () => {
    const english = new Map(entriesOf(DICTIONARIES.en));
    const same = entriesOf(DICTIONARIES.vi)
      .filter(([key, value]) => english.get(key) === value)
      .map(([key]) => key);

    expect(same.sort()).toEqual(['app.name', 'nav.menu', 'settings.logo']);
  });
});

describe('createI18n', () => {
  it('speaks the language it starts in, each instance on its own', () => {
    const vi = createI18n('vi');
    const en = createI18n('en');

    expect(vi.t('auth.submit')).toBe('Đăng nhập');
    expect(en.t('auth.submit')).toBe('Sign In');
  });
});
