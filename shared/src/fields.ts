import { z } from 'zod';
import { type Language } from './config';

/** What a company's own field may hold, and how each kind is checked, kept and shown. The BFF
 * stores the field list and never reads a value: values live in a person's `extra`. */
export const FIELD_KINDS = ['text', 'number', 'date', 'choice'] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

/** The keys a company's own field never takes: the built-in keys of `extra`, and the names
 * `extra` refuses as a key. */
const RESERVED_KEYS = ['phone', 'personalPhone', 'note', 'constructor', 'prototype'];
const FIELD_KEY = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

/** 1 to 64 letters, digits and underscores, a letter first, and not a reserved key. */
export const fieldKeyIsValid = (key: string) => FIELD_KEY.test(key) && !RESERVED_KEYS.includes(key);

const label = z.strictObject({
  vi: z.string().trim().min(1).max(200),
  en: z.string().trim().min(1).max(200),
}) satisfies z.ZodType<Record<Language, string>>;

const optionSchema = z.strictObject({
  value: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  label,
});

/** One of a company's own fields on a person: a key fixed once made, its name in each language,
 * its kind, the options of a choice, and whether the list shows it. */
export const customFieldSchema = z
  .strictObject({
    key: z.string().refine(fieldKeyIsValid, 'a field key'),
    label,
    kind: z.enum(FIELD_KINDS),
    options: z.array(optionSchema).max(50).default([]),
    inList: z.boolean().default(false),
  })
  .refine(
    (field) =>
      field.kind === 'choice'
        ? field.options.length > 0 &&
          new Set(field.options.map((option) => option.value)).size === field.options.length
        : field.options.length === 0,
    { path: ['options'], error: 'a choice holds options, each once, and no other kind holds any' },
  );
export type CustomField = z.output<typeof customFieldSchema>;

/** Up to 30 fields, each key once. */
export const customFieldsSchema = z
  .array(customFieldSchema)
  .max(30)
  .refine((fields) => new Set(fields.map((field) => field.key)).size === fields.length, {
    error: 'each key once',
  });

/** The person's optional fields the root switches on; off until turned on. */
export const staffFieldsSchema = z.strictObject({
  personalPhone: z.boolean().default(false),
  photo: z.boolean().default(false),
  /** The email is a second sign-in name; the QR switch lets the root show a person a QR code.
   * Both are absent from a setup saved before they existed, and read as off. */
  email: z.boolean().optional(),
  qr: z.boolean().optional(),
});
export type StaffFields = z.output<typeof staffFieldsSchema>;

/** How a code is numbered when it is left empty: a prefix and the digits after it. */
export const numberingSchema = z
  .strictObject({
    prefix: z.string().regex(/^[A-Z0-9-]{0,10}$/),
    digits: z.number().int().min(1).max(8),
  })
  // a code is at least two characters
  .refine(({ prefix, digits }) => prefix.length + digits >= 2, { error: 'a code of 2 or more' });
export type Numbering = z.output<typeof numberingSchema>;
export const DEFAULT_NUMBERING: Numbering = { prefix: 'EMP-', digits: 4 };

/** The code after every code given: the highest number under the prefix, plus one. Codes of
 * people who left count, so a code is never issued twice. */
export function nextCode({ prefix, digits }: Numbering, codes: Iterable<string>) {
  const mine = new RegExp(`^${prefix}(\\d+)$`);
  let highest = 0;
  for (const code of codes) highest = Math.max(highest, Number(mine.exec(code)?.[1] ?? 0));
  return `${prefix}${String(highest + 1).padStart(digits, '0')}`;
}

/** The last number given under each prefix, kept so that a number freed by a code change is never
 * given again. */
export const storedNumberingSchema = z.strictObject({
  given: z.record(z.string(), z.number().int().min(0)),
});
export type StoredNumbering = z.output<typeof storedNumberingSchema>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER = /^-?\d+([.,]\d+)?$/;
const MAX_TEXT = 500;

/** Whether what was typed fits the field's kind. An empty field is fine: it is not kept. */
export function fieldValueIsValid(field: CustomField, raw: string) {
  const text = raw.trim();
  if (text === '') return true;
  if (field.kind === 'number') return NUMBER.test(text);
  if (field.kind === 'date') {
    const day = new Date(`${text}T00:00:00Z`);
    return DATE.test(text) && !Number.isNaN(day.getTime()) && day.toISOString().startsWith(text);
  }
  if (field.kind === 'choice') return field.options.some((option) => option.value === text);
  return text.length <= MAX_TEXT;
}

/** What goes into `extra` for what was typed: a number as a number, the rest as text; nothing for
 * an empty field, so an emptied field removes its key. Call it for a value that is valid. */
export function fieldValueToStore(field: CustomField, raw: string) {
  const text = raw.trim();
  if (text === '') return undefined;
  return field.kind === 'number' ? Number(text.replace(',', '.')) : text;
}

/** What the form shows for what `extra` holds. */
export const fieldValueToText = (stored: unknown) =>
  typeof stored === 'string' ? stored : typeof stored === 'number' ? String(stored) : '';

/** What the list and the person's page show: a choice by its name in the language, the rest as
 * kept. */
export function fieldValueShown(field: CustomField, stored: unknown, language: Language) {
  const text = fieldValueToText(stored);
  if (field.kind !== 'choice') return text;
  return field.options.find((option) => option.value === text)?.label[language] ?? text;
}
