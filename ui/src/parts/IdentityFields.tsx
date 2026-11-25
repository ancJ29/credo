import { Stack, Text, Textarea, TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { BrandName } from '../components/atoms/BrandName';
import { TYPE, WEIGHTS } from '../design-system/tokens';

/** The fields of the Identity block: the company name, the name with formatting typed as HTML with its hint and a preview of it as the company draws it, and the short description for the sign-in card; each is told what was typed. */
export function IdentityFields({
  name,
  formattedName,
  description,
  onChange,
}: {
  name: string;
  formattedName: string;
  description: string;
  onChange: (field: 'name' | 'formattedName' | 'description', value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Stack gap="md">
      <TextInput
        label={t('settings.name')}
        required
        value={name}
        onChange={(event) => onChange('name', event.currentTarget.value)}
      />
      <Stack gap="xs">
        <Textarea
          label={t('settings.formattedName')}
          description={t('settings.formattedNameHint')}
          rows={2}
          value={formattedName}
          onChange={(event) => onChange('formattedName', event.currentTarget.value)}
        />
        <Text {...TYPE.caption}>{t('settings.formattedNamePreview')}</Text>
        <Text fw={WEIGHTS.title}>
          <BrandName name={name} formatted={formattedName} />
        </Text>
      </Stack>
      <TextInput
        label={t('settings.description')}
        description={t('settings.descriptionHint')}
        value={description}
        onChange={(event) => onChange('description', event.currentTarget.value)}
      />
    </Stack>
  );
}
