import { describe, expect, it } from 'vitest';
import { marksOf, numberOf, priceOf } from './number';

/** What the data set holds: its prices (whole dong, in the thousands and millions), quantities and totals. */
const VALUES = [0, 1, 7, 12, 999, 1000, 12500, 85000, 123456, 1250000, 18400500, 0.5, 1000.5];

/** The text the screens wrote before, by hand, in each language. */
const BY_HAND = (value: number, language: string) => new Intl.NumberFormat(language).format(value);

describe('a number, a price and a number’s marks', () => {
  it('16: a number reads as the screens wrote it, in both languages, for each value of the data set', () => {
    for (const language of ['vi', 'en'] as const)
      for (const value of VALUES) expect(numberOf(value, language)).toBe(BY_HAND(value, language));
  });

  it('16: a price reads as a number does, and a thousand is 1.000 in Vietnamese and 1,000 in English', () => {
    for (const language of ['vi', 'en'] as const)
      for (const value of VALUES) expect(priceOf(value, language)).toBe(numberOf(value, language));
    expect(priceOf(1250000, 'vi')).toBe('1.250.000');
    expect(priceOf(1250000, 'en')).toBe('1,250,000');
  });

  it('16: the marks are the thousands mark and the decimal mark of the language', () => {
    expect(marksOf('vi')).toEqual({ group: '.', decimal: ',' });
    expect(marksOf('en')).toEqual({ group: ',', decimal: '.' });
  });
});
