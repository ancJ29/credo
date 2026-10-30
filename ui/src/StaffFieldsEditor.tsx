import {
  type CustomField,
  customFieldsSchema,
  FIELD_KINDS,
  nextCode,
  type Numbering,
  numberingSchema,
  type StaffFields,
  type StaffSetup,
  staffConfig,
} from '@credo/shared';
import {
  Button,
  Checkbox,
  Group,
  NativeSelect,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';

type OptionDraft = { key: number; value: string; vi: string; en: string };

/** One of the company's own fields being edited; `fixed` once it was saved, since its key is. */
type OwnDraft = {
  key: number;
  fixed: boolean;
  id: string;
  vi: string;
  en: string;
  kind: CustomField['kind'];
  inList: boolean;
  options: OptionDraft[];
};

/** What the person's fields, the company's own fields and the numbering are while being edited:
 * every input as typed. */
export type FieldsDraft = {
  fields: Required<StaffFields>;
  own: OwnDraft[];
  prefix: string;
  digits: string;
};

/** The draft a saved setup starts from. */
export function draftOf(setup: StaffSetup): FieldsDraft {
  const { fields, customFields, numbering } = staffConfig(setup);
  let key = 0;
  return {
    fields,
    own: customFields.map((field) => ({
      key: key++,
      fixed: true,
      id: field.key,
      vi: field.label.vi,
      en: field.label.en,
      kind: field.kind,
      inList: field.inList,
      options: field.options.map((option) => ({
        key: key++,
        value: option.value,
        vi: option.label.vi,
        en: option.label.en,
      })),
    })),
    prefix: numbering.prefix,
    digits: String(numbering.digits),
  };
}

/** The numbering as typed, when it is one the BFF would take. */
const numberingOf = ({ prefix, digits }: FieldsDraft) =>
  numberingSchema.safeParse({ prefix: prefix.trim().toUpperCase(), digits: Number(digits) });

/** What a draft saves as, or which of its two parts is refused. */
export function savedFrom(draft: FieldsDraft) {
  const customFields = customFieldsSchema.safeParse(
    draft.own.map((field) => ({
      key: field.id.trim(),
      label: { vi: field.vi.trim(), en: field.en.trim() },
      kind: field.kind,
      options:
        field.kind === 'choice'
          ? field.options.map((option) => ({
              value: option.value.trim(),
              label: { vi: option.vi.trim(), en: option.en.trim() },
            }))
          : [],
      inList: field.inList,
    })),
  );
  const numbering = numberingOf(draft);
  if (!customFields.success) return { refused: 'fields' } as const;
  if (!numbering.success) return { refused: 'numbering' } as const;
  return { fields: draft.fields, customFields: customFields.data, numbering: numbering.data };
}

type Props = {
  draft: FieldsDraft;
  onChange: (draft: FieldsDraft) => void;
  nextKey: () => number;
};

const KIND_WORDS = {
  text: 'setup.ownKindText',
  number: 'setup.ownKindNumber',
  date: 'setup.ownKindDate',
  choice: 'setup.ownKindChoice',
} as const;

/** The person's optional fields, the company's own fields and how codes are numbered: the
 * staff setup's second half, all the root's choices about a person's record. */
export function FieldsEditor({ draft, onChange, nextKey }: Props) {
  const { t } = useTranslation();
  const change = (next: Partial<FieldsDraft>) => onChange({ ...draft, ...next });
  const changeField = (key: number, next: Partial<OwnDraft>) =>
    change({ own: draft.own.map((field) => (field.key === key ? { ...field, ...next } : field)) });
  const numbering = numberingOf(draft);
  const example = (given: Numbering) => nextCode(given, []);

  return (
    <Stack gap="xl">
      <Stack gap="sm">
        <div>
          <Title order={3}>{t('setup.fieldsTitle')}</Title>
          <Text c="dimmed" size="sm">
            {t('setup.fieldsIntro')}
          </Text>
        </div>
        <Checkbox
          label={t('setup.fieldPersonalPhone')}
          checked={draft.fields.personalPhone}
          onChange={(event) =>
            change({ fields: { ...draft.fields, personalPhone: event.currentTarget.checked } })
          }
        />
        <Checkbox
          label={t('setup.fieldPhoto')}
          checked={draft.fields.photo}
          onChange={(event) =>
            change({ fields: { ...draft.fields, photo: event.currentTarget.checked } })
          }
        />
      </Stack>

      <Stack gap="sm">
        <div>
          <Title order={3}>{t('setup.signInsTitle')}</Title>
          <Text c="dimmed" size="sm">
            {t('setup.signInsIntro')}
          </Text>
        </div>
        <Checkbox
          label={t('setup.fieldEmail')}
          checked={draft.fields.email}
          onChange={(event) =>
            change({ fields: { ...draft.fields, email: event.currentTarget.checked } })
          }
        />
        <Checkbox
          label={t('setup.fieldQr')}
          checked={draft.fields.qr}
          onChange={(event) =>
            change({ fields: { ...draft.fields, qr: event.currentTarget.checked } })
          }
        />
      </Stack>

      <Stack gap="md">
        <div>
          <Title order={3}>{t('setup.ownTitle')}</Title>
          <Text c="dimmed" size="sm">
            {t('setup.ownIntro')}
          </Text>
        </div>
        {draft.own.length === 0 && <Text c="dimmed">{t('setup.none')}</Text>}
        {draft.own.map((field) => (
          <Paper key={field.key} withBorder p="md">
            <Stack gap="sm">
              <Group align="flex-end" wrap="nowrap">
                <TextInput
                  label={t('setup.ownKey')}
                  description={field.fixed ? undefined : t('setup.ownKeyHint')}
                  required
                  flex={1}
                  readOnly={field.fixed}
                  value={field.id}
                  onChange={(event) => changeField(field.key, { id: event.currentTarget.value })}
                />
                <Button
                  variant="default"
                  aria-label={`${t('setup.remove')} ${field.id || t('setup.ownKey')}`}
                  onClick={() =>
                    change({ own: draft.own.filter((other) => other.key !== field.key) })
                  }
                >
                  {t('setup.remove')}
                </Button>
              </Group>
              <TextInput
                label={t('setup.ownNameVi')}
                required
                value={field.vi}
                onChange={(event) => changeField(field.key, { vi: event.currentTarget.value })}
              />
              <TextInput
                label={t('setup.ownNameEn')}
                required
                value={field.en}
                onChange={(event) => changeField(field.key, { en: event.currentTarget.value })}
              />
              <NativeSelect
                label={t('setup.ownKind')}
                value={field.kind}
                onChange={(event) =>
                  changeField(field.key, { kind: event.currentTarget.value as OwnDraft['kind'] })
                }
                data={FIELD_KINDS.map((kind) => ({ value: kind, label: t(KIND_WORDS[kind]) }))}
              />
              {field.kind === 'choice' && (
                <Stack gap="xs" role="group" aria-label={`${t('setup.ownOptions')}: ${field.id}`}>
                  <Text size="sm" fw={500}>
                    {t('setup.ownOptions')}
                  </Text>
                  {field.options.map((option) => {
                    const changeOption = (next: Partial<OptionDraft>) =>
                      changeField(field.key, {
                        options: field.options.map((other) =>
                          other.key === option.key ? { ...other, ...next } : other,
                        ),
                      });
                    return (
                      <Group key={option.key} align="flex-end" wrap="wrap">
                        <TextInput
                          label={t('setup.ownOptionValue')}
                          value={option.value}
                          onChange={(event) => changeOption({ value: event.currentTarget.value })}
                        />
                        <TextInput
                          label={t('setup.ownOptionVi')}
                          value={option.vi}
                          onChange={(event) => changeOption({ vi: event.currentTarget.value })}
                        />
                        <TextInput
                          label={t('setup.ownOptionEn')}
                          value={option.en}
                          onChange={(event) => changeOption({ en: event.currentTarget.value })}
                        />
                        <Button
                          variant="subtle"
                          color="gray"
                          size="xs"
                          aria-label={`${t('setup.ownOptionRemove')} ${option.value}`}
                          onClick={() =>
                            changeField(field.key, {
                              options: field.options.filter((other) => other.key !== option.key),
                            })
                          }
                        >
                          {t('setup.ownOptionRemove')}
                        </Button>
                      </Group>
                    );
                  })}
                  <Button
                    variant="default"
                    size="xs"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() =>
                      changeField(field.key, {
                        options: [...field.options, { key: nextKey(), value: '', vi: '', en: '' }],
                      })
                    }
                  >
                    {t('setup.ownOptionAdd')}
                  </Button>
                </Stack>
              )}
              <Checkbox
                label={t('setup.ownInList')}
                checked={field.inList}
                onChange={(event) =>
                  changeField(field.key, { inList: event.currentTarget.checked })
                }
              />
            </Stack>
          </Paper>
        ))}
        <Button
          variant="default"
          style={{ alignSelf: 'flex-start' }}
          onClick={() =>
            change({
              own: [
                ...draft.own,
                {
                  key: nextKey(),
                  fixed: false,
                  id: '',
                  vi: '',
                  en: '',
                  kind: 'text',
                  inList: false,
                  options: [],
                },
              ],
            })
          }
        >
          {t('setup.ownAdd')}
        </Button>
      </Stack>

      <Stack gap="sm">
        <div>
          <Title order={3}>{t('setup.numberingTitle')}</Title>
          <Text c="dimmed" size="sm">
            {t('setup.numberingIntro')}
          </Text>
        </div>
        <Group align="flex-start">
          <TextInput
            label={t('setup.numberingPrefix')}
            value={draft.prefix}
            onChange={(event) => change({ prefix: event.currentTarget.value })}
          />
          <TextInput
            label={t('setup.numberingDigits')}
            inputMode="numeric"
            value={draft.digits}
            onChange={(event) => change({ digits: event.currentTarget.value })}
          />
        </Group>
        {numbering.success && (
          <Text c="dimmed" size="sm">
            {t('setup.numberingExample', { code: example(numbering.data) })}
          </Text>
        )}
      </Stack>
    </Stack>
  );
}
