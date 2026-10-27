import { describe, expect, it } from 'vitest';
import { isHexColour, languagesAreValid } from './config';

describe('isHexColour', () => {
  it('accepts #rrggbb in either case and nothing else', () => {
    expect(isHexColour('#2f7d6D')).toBe(true);
    expect(isHexColour('#2f7d6')).toBe(false);
    expect(isHexColour('2f7d6d')).toBe(false);
    expect(isHexColour('#2f7d6dff')).toBe(false);
  });
});

describe('languagesAreValid', () => {
  it('holds one language or both, each once, with the default among them', () => {
    expect(languagesAreValid({ languages: ['vi'], defaultLanguage: 'vi' })).toBe(true);
    expect(languagesAreValid({ languages: ['vi', 'en'], defaultLanguage: 'en' })).toBe(true);
  });

  it('refuses none, a repeat, or a default that is not offered', () => {
    expect(languagesAreValid({ languages: [], defaultLanguage: 'vi' })).toBe(false);
    expect(languagesAreValid({ languages: ['vi', 'vi'], defaultLanguage: 'vi' })).toBe(false);
    expect(languagesAreValid({ languages: ['vi'], defaultLanguage: 'en' })).toBe(false);
  });
});
