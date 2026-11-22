import { Center, Loader, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SPACING, TYPE } from '../../design-system/tokens';
import { ActionButton } from '../atoms/ActionButton';
import { FormMessage } from '../molecules/FormMessage';

/** What a whole page shows in the place of its body when its data is not a list or a record: loading, failed with a retry, forbidden, nothing, empty with an add, or not found. A failed load is an error message with a default-look retry under it, the rest a title over words, spoken as a status; the loader is named and with a least height. */
export function PageState({
  state,
  title,
  onRetry,
  add,
  children,
}: {
  state: 'loading' | 'failed' | 'forbidden' | 'nothing' | 'empty' | 'notFound';
  title?: string;
  onRetry?: () => void;
  add?: ReactNode;
  children?: string;
}) {
  const { t } = useTranslation();
  if (state === 'loading') {
    return (
      <Center mih={240}>
        <Loader aria-label={t('common.loading')} />
      </Center>
    );
  }
  if (state === 'failed') {
    return (
      <Stack align="flex-start">
        <FormMessage kind="error">{children ?? t('common.loadFailed')}</FormMessage>
        {onRetry && (
          <ActionButton meaning="other" onClick={onRetry}>
            {t('common.retry')}
          </ActionButton>
        )}
      </Stack>
    );
  }
  return (
    <Stack gap={SPACING.xs} role="status" align="flex-start">
      {title && <Title {...TYPE.pageTitle}>{title}</Title>}
      {children && <Text {...TYPE.caption}>{children}</Text>}
      {state === 'empty' && add}
    </Stack>
  );
}
