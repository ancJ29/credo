import { Alert, Button, Center, Loader, Stack } from '@mantine/core';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  status: 'loading' | 'failed' | 'ready';
  onRetry: () => void;
  children: ReactNode;
};

/** A page's data is one state: loading, failed with a way to retry, or ready. */
export function Loaded({ status, onRetry, children }: Props) {
  const { t } = useTranslation();
  if (status === 'loading') {
    return (
      <Center mih={240}>
        <Loader aria-label={t('common.loading')} />
      </Center>
    );
  }
  if (status === 'failed') {
    return (
      <Stack align="flex-start">
        <Alert color="red" role="alert" w="100%">
          {t('common.loadFailed')}
        </Alert>
        <Button variant="default" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      </Stack>
    );
  }
  return children;
}
