import { Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { TYPE } from '../../design-system/tokens';

/** A page that is only words: a 403 page, or the page for someone no page is open to yet. */
export function Notice({ kind }: { kind: 'forbidden' | 'nothing' }) {
  const { t } = useTranslation();
  return (
    <Stack gap="xs" role="status">
      <Title {...TYPE.pageTitle}>
        {t(kind === 'forbidden' ? 'forbidden.title' : 'nothing.title')}
      </Title>
      <Text c="dimmed">{t(kind === 'forbidden' ? 'forbidden.text' : 'nothing.text')}</Text>
    </Stack>
  );
}
