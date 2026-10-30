import {
  type CustomField,
  fieldValueIsValid,
  fieldValueToStore,
  fieldValueToText,
  type Language,
} from '@credo/shared';
import { NativeSelect, TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';

/** What a form holds for each of the company's own fields, as typed, by key. */
export type OwnTexts = Record<string, string>;

/** The words each kind's refusal is said in. */
export const INVALID = {
  text: 'fields.invalidText',
  number: 'fields.invalidNumber',
  date: 'fields.invalidDate',
  choice: 'fields.invalidChoice',
} as const;

/** The form's start: what the person already holds under each field's key. */
export const ownTextsOf = (fields: readonly CustomField[], extra: Record<string, unknown>) =>
  Object.fromEntries(fields.map((field) => [field.key, fieldValueToText(extra[field.key])]));

/** The fields whose typed value does not fit their kind. A value the person already holds is
 * never refused while it stands unchanged (`was`): a choice whose option was since removed, or a
 * value saved before the field changed kind, is theirs until someone types another. */
export const refusedFields = (
  fields: readonly CustomField[],
  texts: OwnTexts,
  was: OwnTexts = {},
) =>
  fields
    .filter((field) => {
      const typed = texts[field.key] ?? '';
      return typed !== (was[field.key] ?? '') && !fieldValueIsValid(field, typed);
    })
    .map((f) => f.key);

/** `extra` with what the form shows put in its place: every key the form shows is first taken
 * out, then kept when filled, so an emptied field removes its key and a key the form does not
 * show survives. */
export function mergeExtra(
  extra: Record<string, unknown>,
  shown: Record<string, string | number | undefined>,
) {
  const kept = Object.entries(extra).filter(([key]) => !(key in shown));
  const filled = Object.entries(shown).filter(([, value]) => value !== undefined);
  return Object.fromEntries([...kept, ...filled]);
}

/** What `extra` takes for the company's own fields as typed. A field left as it was keeps the
 * stored value itself (`held`): a value that no longer fits is not turned into something else. */
export const ownStored = (
  fields: readonly CustomField[],
  texts: OwnTexts,
  held?: { was: OwnTexts; extra: Record<string, unknown> },
) =>
  Object.fromEntries(
    fields.map((field) => [
      field.key,
      held && texts[field.key] === held.was[field.key]
        ? held.extra[field.key]
        : fieldValueToStore(field, texts[field.key] ?? ''),
    ]),
  );

type Props = {
  field: CustomField;
  value: string;
  /** Set once a value was refused: the field says why. */
  refused: boolean;
  readOnly: boolean;
  onChange: (value: string) => void;
};

/** One of the company's own fields, drawn by its kind and named in the language shown. */
export function OwnFieldInput({ field, value, refused, readOnly, onChange }: Props) {
  const { t, i18n } = useTranslation();
  const label = field.label[i18n.language as Language];
  const error = refused ? t(INVALID[field.kind]) : undefined;
  if (field.kind === 'choice') {
    return (
      <NativeSelect
        label={label}
        value={value}
        disabled={readOnly}
        error={error}
        onChange={(event) => onChange(event.currentTarget.value)}
        data={[
          { value: '', label: t('fields.noneChosen') },
          ...field.options.map((option) => ({
            value: option.value,
            label: option.label[i18n.language as Language],
          })),
          // A value kept on the person whose option was removed: listed as itself, so the select
          // shows what is stored and saving it unchanged is no change.
          ...(value !== '' && !field.options.some((option) => option.value === value)
            ? [{ value, label: value }]
            : []),
        ]}
      />
    );
  }
  return (
    <TextInput
      label={label}
      type={field.kind === 'date' ? 'date' : 'text'}
      inputMode={field.kind === 'number' ? 'decimal' : undefined}
      readOnly={readOnly}
      error={error}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
}
