import { describe, expect, it } from 'vitest';
import {
  type CustomField,
  customFieldSchema,
  customFieldsSchema,
  DEFAULT_NUMBERING,
  fieldKeyIsValid,
  fieldValueIsValid,
  fieldValueShown,
  fieldValueToStore,
  fieldValueToText,
  nextCode,
  numberingSchema,
} from './fields';

const label = { vi: 'Nhãn', en: 'Label' };
const field = (kind: CustomField['kind'], more: Partial<CustomField> = {}): CustomField => ({
  key: 'k',
  label,
  kind,
  options: [],
  inList: false,
  ...more,
});
const choice = field('choice', {
  options: [
    { value: 'b2', label: { vi: 'Hạng B2', en: 'Class B2' } },
    { value: 'c', label: { vi: 'Hạng C', en: 'Class C' } },
  ],
});

describe('a company’s own fields', () => {
  it('A company’s own field’s key is 1 to 64 letters, digits and underscores, a letter first, unique, fixed once made, and never `phone`, `personalPhone` or `note`', () => {
    for (const good of ['a', 'licence', 'Plate_2', 'a'.repeat(64)]) {
      expect(fieldKeyIsValid(good), good).toBe(true);
    }
    for (const bad of ['', '1a', '_a', 'a-b', 'a b', 'đ', 'a'.repeat(65)]) {
      expect(fieldKeyIsValid(bad), bad).toBe(false);
    }
    // the built-in keys, and the names `extra` itself refuses
    for (const reserved of ['phone', 'personalPhone', 'note', 'constructor', 'prototype']) {
      expect(fieldKeyIsValid(reserved), reserved).toBe(false);
    }
    // unique in the list
    const one = { key: 'a', label, kind: 'text' };
    expect(customFieldsSchema.safeParse([one, { ...one, key: 'b' }]).success).toBe(true);
    expect(customFieldsSchema.safeParse([one, one]).success).toBe(false);
    expect(customFieldSchema.safeParse({ ...one, key: 'phone' }).success).toBe(false);
  });

  it('The root adds the company’s own fields to a person, each with a name in Vietnamese and English, a kind (text, number, date, or a choice from a list) and whether the list shows it', () => {
    const parsed = customFieldSchema.parse({ key: 'a', label, kind: 'text' });
    // the options and the list default to none and no
    expect(parsed).toEqual({ key: 'a', label, kind: 'text', options: [], inList: false });
    // a name in each language, and a kind from the four
    expect(
      customFieldSchema.safeParse({ key: 'a', label: { vi: 'x' }, kind: 'text' }).success,
    ).toBe(false);
    expect(customFieldSchema.safeParse({ key: 'a', label, kind: 'file' }).success).toBe(false);
    // a choice holds options, each once; no other kind holds any
    const option = { value: 'x', label };
    expect(customFieldSchema.safeParse({ key: 'a', label, kind: 'choice' }).success).toBe(false);
    expect(
      customFieldSchema.safeParse({ key: 'a', label, kind: 'choice', options: [option] }).success,
    ).toBe(true);
    expect(
      customFieldSchema.safeParse({ key: 'a', label, kind: 'choice', options: [option, option] })
        .success,
    ).toBe(false);
    expect(
      customFieldSchema.safeParse({ key: 'a', label, kind: 'text', options: [option] }).success,
    ).toBe(false);
  });

  it('A value is checked as its kind says: text, a number, a real date, or one of the choice’s options; an empty one is fine', () => {
    expect(fieldValueIsValid(field('text'), 'anything')).toBe(true);
    expect(fieldValueIsValid(field('text'), 'x'.repeat(500))).toBe(true);
    expect(fieldValueIsValid(field('text'), 'x'.repeat(501))).toBe(false);
    for (const good of ['3', '-3', '3.5', '3,5', ' 7 ']) {
      expect(fieldValueIsValid(field('number'), good), good).toBe(true);
    }
    for (const bad of ['abc', '3.', '.5', '1e3', '3 4']) {
      expect(fieldValueIsValid(field('number'), bad), bad).toBe(false);
    }
    expect(fieldValueIsValid(field('date'), '2026-10-29')).toBe(true);
    for (const bad of ['29/10/2026', '2026-13-01', '2026-02-30', '2026-1-1', 'today']) {
      expect(fieldValueIsValid(field('date'), bad), bad).toBe(false);
    }
    expect(fieldValueIsValid(choice, 'b2')).toBe(true);
    expect(fieldValueIsValid(choice, 'd')).toBe(false);
    for (const kind of ['text', 'number', 'date', 'choice'] as const) {
      expect(fieldValueIsValid(kind === 'choice' ? choice : field(kind), '  '), kind).toBe(true);
    }
  });

  it('keeps a number as a number and the rest as text, nothing for an empty value, and reads a kept value back for the form and the list', () => {
    expect(fieldValueToStore(field('number'), ' 3,5 ')).toBe(3.5);
    expect(fieldValueToStore(field('text'), ' hi ')).toBe('hi');
    expect(fieldValueToStore(field('date'), '2026-10-29')).toBe('2026-10-29');
    expect(fieldValueToStore(field('text'), '  ')).toBeUndefined();

    expect(fieldValueToText(3.5)).toBe('3.5');
    expect(fieldValueToText('x')).toBe('x');
    expect(fieldValueToText(undefined)).toBe('');
    expect(fieldValueToText({ nested: true })).toBe('');
    // a choice is shown by its name in the language, or as kept when its option is gone
    expect(fieldValueShown(choice, 'b2', 'vi')).toBe('Hạng B2');
    expect(fieldValueShown(choice, 'b2', 'en')).toBe('Class B2');
    expect(fieldValueShown(choice, 'gone', 'en')).toBe('gone');
    expect(fieldValueShown(field('number'), 4, 'en')).toBe('4');
  });
});

describe('numbering', () => {
  it('A code left empty is the next number under the company’s prefix and length (`EMP-` and 4 digits until the root sets them), counted past every code ever given, people who left included', () => {
    expect(DEFAULT_NUMBERING).toEqual({ prefix: 'EMP-', digits: 4 });
    expect(nextCode(DEFAULT_NUMBERING, [])).toBe('EMP-0001');
    // past the highest, not the count, and other codes are not numbers under this prefix
    expect(nextCode(DEFAULT_NUMBERING, ['EMP-0001', 'EMP-0007', 'EMP-0003', 'AB-9', 'EMP-X'])).toBe(
      'EMP-0008',
    );
    expect(nextCode({ prefix: 'NV', digits: 3 }, ['NV009', 'NV010'])).toBe('NV011');
    expect(nextCode({ prefix: '', digits: 2 }, ['09'])).toBe('10');
    // a number past the width grows
    expect(nextCode({ prefix: 'A-', digits: 1 }, ['A-9'])).toBe('A-10');
    // a prefix is a prefix: a longer one does not count
    expect(nextCode({ prefix: 'A-', digits: 2 }, ['A-B-05'])).toBe('A-01');
  });

  it('A prefix is up to 10 letters A to Z, digits and hyphens and the digits 1 to 8, so a code is at least 2 and at most 20 characters', () => {
    expect(numberingSchema.safeParse({ prefix: 'NV-', digits: 4 }).success).toBe(true);
    expect(numberingSchema.safeParse({ prefix: '', digits: 2 }).success).toBe(true);
    for (const bad of [
      { prefix: '', digits: 1 },
      { prefix: 'nv', digits: 4 },
      { prefix: 'A'.repeat(11), digits: 4 },
      { prefix: 'A', digits: 0 },
      { prefix: 'A', digits: 9 },
      { prefix: 'A', digits: 1.5 },
    ]) {
      expect(numberingSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });
});
