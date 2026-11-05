import { dayIsValid, fieldValueToText, type StaffFields } from '@credo/shared';
import { TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { FieldPair } from './DetailCards';

/** The three values a person may hold beside the company's own fields, kept in `extra` under
 * these names while the company's setup switches them on. */
const KEYS = ['startDate', 'birthDate', 'address'] as const;
type Key = (typeof KEYS)[number];
export type PersonalTexts = Record<Key, string>;

export const NO_PERSONAL: PersonalTexts = { startDate: '', birthDate: '', address: '' };

/** The form's start: what the person already holds. */
export const personalTextsOf = (extra: Record<string, unknown>): PersonalTexts => ({
  startDate: fieldValueToText(extra.startDate),
  birthDate: fieldValueToText(extra.birthDate),
  address: fieldValueToText(extra.address),
});

/** The dates, switched on, whose typed value is not a real day. A value the person already holds
 * is never refused while it stands unchanged (`was`). */
export const refusedPersonal = (
  fields: Required<StaffFields>,
  texts: PersonalTexts,
  was: PersonalTexts = NO_PERSONAL,
): Key[] =>
  (['startDate', 'birthDate'] as const).filter(
    (key) =>
      fields[key] &&
      texts[key] !== was[key] &&
      texts[key].trim() !== '' &&
      !dayIsValid(texts[key].trim()),
  );

/** What `extra` takes for the values the setup switches on: the typed text, trimmed; undefined for
 * an empty one, which removes the key. A switch off leaves the key out, so what is stored stays. */
export const personalStored = (fields: Required<StaffFields>, texts: PersonalTexts) =>
  Object.fromEntries(
    KEYS.filter((key) => fields[key]).map((key) => [key, texts[key].trim() || undefined]),
  );

type Props = {
  fields: Required<StaffFields>;
  texts: PersonalTexts;
  refused: readonly Key[];
  readOnly: boolean;
  onChange: (next: Partial<PersonalTexts>) => void;
};

/** The start date and the birth date in one row, the address full width below, each only while the
 * company keeps it. */
export function PersonalFields({ fields, texts, refused, readOnly, onChange }: Props) {
  const { t } = useTranslation();
  const date = (key: 'startDate' | 'birthDate') => (
    <TextInput
      label={t(`fields.${key}`)}
      type="date"
      readOnly={readOnly}
      error={refused.includes(key) ? t('fields.invalidDate') : undefined}
      value={texts[key]}
      onChange={(event) => onChange({ [key]: event.currentTarget.value })}
    />
  );
  return (
    <>
      {(fields.startDate || fields.birthDate) && (
        <FieldPair>
          {fields.startDate && date('startDate')}
          {fields.birthDate && date('birthDate')}
        </FieldPair>
      )}
      {fields.address && (
        <TextInput
          label={t('fields.address')}
          readOnly={readOnly}
          value={texts.address}
          onChange={(event) => onChange({ address: event.currentTarget.value })}
        />
      )}
    </>
  );
}
