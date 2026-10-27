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

describe('createI18n', () => {
  it('speaks the language it starts in, each instance on its own', () => {
    const vi = createI18n('vi');
    const en = createI18n('en');

    expect(vi.t('auth.submit')).toBe('Đăng nhập');
    expect(en.t('auth.submit')).toBe('Sign In');
  });
});
