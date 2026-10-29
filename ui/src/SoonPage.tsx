import { Stack, Text, Title } from '@mantine/core';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';

/** A section nothing is built for yet: its name, and that it is coming. */
export function SoonPage({ label }: { label: ParseKeys }) {
  const { t } = useTranslation();
  return (
    <Stack gap="xs">
      <Title order={2}>{t(label)}</Title>
      <Text c="dimmed">{t('operator.soon')}</Text>
    </Stack>
  );
}
