import { describe, expect, it } from 'vitest';
import {
  PICTURE_KINDS,
  pictureKindSchema,
  storedConfigSchema,
  storedPictureSchema,
  isHexColour,
  languagesAreValid,
  logoIsValid,
  MAX_DESCRIPTION,
  MAX_FORMATTED_NAME,
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
    colour: '#2f7d6d',
    languages: ['vi', 'en'],
    defaultLanguage: 'vi',
  };

  const off = { whiteHeader: false, whiteMenu: false, menuIcons: false };
  const empty = { formattedName: '', description: '' };

  it('parses a whole config and trims the name', () => {
    expect(tenantConfigSchema.parse({ ...good, ...off, name: '  Công ty A ' })).toEqual({
      ...good,
      ...off,
      ...empty,
    });
  });

  it('reads a record stored before the frame switches with all three off', () => {
    expect(tenantConfigSchema.parse(good)).toEqual({ ...good, ...off, ...empty });
  });

  it('9: keeps the formatted name as typed and the description trimmed', () => {
    const typed = '  <b>Công</b><br> ty  ';
    const parsed = tenantConfigSchema.parse({
      ...good,
      formattedName: typed,
      description: '  Vật liệu  ',
    });
    expect(parsed.formattedName).toBe(typed);
    expect(parsed.description).toBe('Vật liệu');
  });

  it('9: reads a record stored before both existed as both empty', () => {
    const parsed = tenantConfigSchema.parse(good);
    expect([parsed.formattedName, parsed.description]).toEqual(['', '']);
  });

  it('10: refuses a formatted name past 1,000 characters and a description past 200, and keeps the bounds', () => {
    expect([MAX_FORMATTED_NAME, MAX_DESCRIPTION]).toEqual([1000, 200]);
    const long = (length: number) => 'a'.repeat(length);
    expect(
      tenantConfigSchema.safeParse({ ...good, formattedName: long(1000), description: long(200) })
        .success,
    ).toBe(true);
    expect(tenantConfigSchema.safeParse({ ...good, formattedName: long(1001) }).success).toBe(
      false,
    );
    expect(tenantConfigSchema.safeParse({ ...good, description: long(201) }).success).toBe(false);
    // the bound is on the trimmed description: spaces round it do not count
    expect(tenantConfigSchema.safeParse({ ...good, description: ` ${long(200)} ` }).success).toBe(
      true,
    );
  });

  it('refuses a blank name, a bad colour, a bad language set and a stray key', () => {
    for (const bad of [
      { ...good, name: '   ' },
      { ...good, colour: 'green' },
      { ...good, languages: [] },
      { ...good, languages: ['vi'], defaultLanguage: 'en' },
      { ...good, languages: ['fr'] },
      { ...good, extra: 1 },
      { ...good, logo: null },
      { ...good, logo: 'https://example.com/x.png' },
    ]) {
      expect(tenantConfigSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe('the company’s pictures', () => {
  it('10: names two kinds, and stores an image data URL within the bound alone', () => {
    expect(PICTURE_KINDS).toEqual(['logo', 'logo-on-colour']);
    expect(pictureKindSchema.safeParse('logo').success).toBe(true);
    expect(pictureKindSchema.safeParse('banner').success).toBe(false);
    expect(
      storedPictureSchema.safeParse({ picture: 'data:image/png;base64,iVBORw0KGgo=' }).success,
    ).toBe(true);
    expect(storedPictureSchema.safeParse({ picture: 'nope' }).success).toBe(false);
    expect(storedPictureSchema.safeParse({ picture: null }).success).toBe(false);
  });
});

describe('A settings record as an older company stored it', () => {
  const older = {
    name: 'Công ty A',
    colour: '#2f7d6d',
    languages: ['vi'],
    defaultLanguage: 'vi',
  };

  it('1: still holds its inline logo, a data URL or null, or none; a save never may', () => {
    expect(storedConfigSchema.safeParse({ ...older, logo: null }).success).toBe(true);
    expect(
      storedConfigSchema.safeParse({ ...older, logo: 'data:image/png;base64,iVBORw0KGgo=' })
        .success,
    ).toBe(true);
    expect(storedConfigSchema.safeParse(older).success).toBe(true);
    expect(
      storedConfigSchema.safeParse({ ...older, logo: 'https://example.com/x.png' }).success,
    ).toBe(false);
    expect(storedConfigSchema.safeParse({ ...older, languages: [] }).success).toBe(false);
    expect(tenantConfigSchema.safeParse({ ...older, logo: null }).success).toBe(false);
  });
});
