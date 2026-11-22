import { Stack, Text } from '@mantine/core';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/organisms/PageHeader';

/** A section nothing is built for yet: its name, and that it is coming. */
export function SoonPage({ label }: { label: ParseKeys }) {
  const { t } = useTranslation();
  return (
    <Stack gap="xs">
      <PageHeader title={t(label)} />
      <Text c="dimmed">{t('operator.soon')}</Text>
    </Stack>
  );
}
