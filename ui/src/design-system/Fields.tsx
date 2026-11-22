import {
  Group,
  NativeSelect,
  NumberInput,
  PasswordInput,
  Stack,
  Textarea,
  TextInput,
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SAMPLES, useLanguage } from './samples';

/** One kind of field, drawn three ways under its label: with a hint, with an error, and read-only. */
function threeWays(
  draw: (extra: Record<string, unknown>) => ReactNode,
  hint: string,
  error: string,
) {
  return (
    <Stack w={394} maw="100%">
      {draw({ description: hint })}
      {draw({ error })}
      {draw({ readOnly: true })}
    </Stack>
  );
}

/** The five kinds of field, worded by the dictionary where a screen says it, and the staff list's filter bar. */
export const FieldStates: { name: string; node: ReactNode }[] = [
  { name: 'Text', node: <TextField /> },
  { name: 'Password', node: <PasswordField /> },
  { name: 'Number', node: <NumberField /> },
  { name: 'Long text', node: <LongTextField /> },
  { name: 'Drop-down', node: <DropDownField /> },
  { name: 'Filter bar', node: <FilterBar /> },
];

/** A text field: the staff code, its rule as the hint and its refusal as the error. */
function TextField() {
  const { t } = useTranslation();
  const words = SAMPLES[useLanguage()];
  return threeWays(
    (extra) => <TextInput label={t('addPerson.code')} defaultValue={words.codeValue} {...extra} />,
    t('addPerson.codeHint'),
    t('addPerson.codeInvalid'),
  );
}

/** A password field, with the sign-in's label and its refusal. */
function PasswordField() {
  const { t } = useTranslation();
  const words = SAMPLES[useLanguage()];
  return threeWays(
    (extra) => (
      <PasswordInput label={t('auth.password')} defaultValue={words.secretValue} {...extra} />
    ),
    words.passwordHint,
    t('auth.refused'),
  );
}

/** A number field: a product's price, its rule as the hint and its refusal as the error. */
function NumberField() {
  const { t } = useTranslation();
  return threeWays(
    (extra) => <NumberInput label={t('lists.columns.price')} defaultValue={150000} {...extra} />,
    t('lists.write.price'),
    t('lists.products.priceInvalid'),
  );
}

/** A long text field: a product's note. */
function LongTextField() {
  const { t } = useTranslation();
  return threeWays(
    (extra) => <Textarea label={t('lists.columns.note')} {...extra} />,
    t('import.writeNote'),
    t('lists.products.noteTooLong'),
  );
}

/** A drop-down: a person's department. */
function DropDownField() {
  const { t } = useTranslation();
  const words = SAMPLES[useLanguage()];
  return threeWays(
    (extra) => (
      <NativeSelect
        label={t('addPerson.department')}
        data={[t('addPerson.noneChosen'), words.departmentValue]}
        {...extra}
      />
    ),
    words.departmentHint,
    words.departmentError,
  );
}

/** The staff list's filter bar: the search and its three drop-downs, in the list's own words. */
function FilterBar() {
  const { t } = useTranslation();
  return (
    <Group align="flex-end" w={760} maw="100%">
      <TextInput
        label={t('staff.search')}
        leftSection={<IconSearch size={16} />}
        placeholder={t('staff.searchPlaceholder')}
        w={240}
      />
      <NativeSelect
        label={t('staff.status')}
        data={[t('staff.statusActive'), t('staff.statusInactive'), t('staff.statusAll')]}
        w={155}
      />
      <NativeSelect
        label={t('staff.filterDepartment')}
        data={[t('staff.filterAllDepartments')]}
        w={155}
      />
      <NativeSelect
        label={t('staff.filterPosition')}
        data={[t('staff.filterAllPositions')]}
        w={155}
      />
    </Group>
  );
}
