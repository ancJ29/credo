import { describe, expect, it } from 'vitest';
import {
  isHexColour,
  languagesAreValid,
  logoIsValid,
  MAX_LOGO_BYTES,
  tenantConfigSchema,
} from './config';

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

const imageOf = (bytes: number, type = 'png') => {
  // A base64 payload of exactly `bytes` decoded bytes: groups of 3 bytes are 4 characters.
  const full = 'A'.repeat(Math.floor(bytes / 3) * 4);
  const rest = bytes % 3;
  return `data:image/${type};base64,${full}${rest === 0 ? '' : rest === 1 ? 'AA==' : 'AAA='}`;
};

describe('A logo is an image of at most 200 KB; anything else is refused', () => {
  it('accepts an image of exactly 200 KB, any image type, with its padding counted', () => {
    expect(logoIsValid(imageOf(MAX_LOGO_BYTES))).toBe(true);
    expect(logoIsValid(imageOf(MAX_LOGO_BYTES - 1, 'svg+xml'))).toBe(true);
    expect(logoIsValid(imageOf(MAX_LOGO_BYTES - 2, 'webp'))).toBe(true);
  });

  it('refuses an image one byte over 200 KB', () => {
    expect(logoIsValid(imageOf(MAX_LOGO_BYTES + 1))).toBe(false);
    expect(logoIsValid(imageOf(MAX_LOGO_BYTES + 2))).toBe(false);
    expect(logoIsValid(imageOf(MAX_LOGO_BYTES + 3))).toBe(false);
  });

  it('refuses what is not a base64 image data URL', () => {
    expect(logoIsValid('https://example.com/logo.png')).toBe(false);
    expect(logoIsValid('data:text/html;base64,AAAA')).toBe(false);
    expect(logoIsValid('data:image/png;base64,')).toBe(false);
    expect(logoIsValid('data:image/png;base64,AAA')).toBe(false);
    expect(logoIsValid('data:image/png;utf8,<svg/>')).toBe(false);
  });
});

describe('A config that does not parse is refused on save and stops the boot', () => {
  const good = {
    name: 'Công ty A',
    logo: null,
    colour: '#2f7d6d',
    languages: ['vi', 'en'],
    defaultLanguage: 'vi',
  };

  it('parses a whole config and trims the name', () => {
    expect(tenantConfigSchema.parse({ ...good, name: '  Công ty A ' })).toEqual(good);
  });

  it('refuses a blank name, a bad colour, a bad language set and a stray key', () => {
    for (const bad of [
      { ...good, name: '   ' },
      { ...good, colour: 'green' },
      { ...good, languages: [] },
      { ...good, languages: ['vi'], defaultLanguage: 'en' },
      { ...good, languages: ['fr'] },
      { ...good, extra: 1 },
      { ...good, logo: 'https://example.com/x.png' },
    ]) {
      expect(tenantConfigSchema.safeParse(bad).success).toBe(false);
    }
  });
});
