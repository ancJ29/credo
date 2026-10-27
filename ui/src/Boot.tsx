import { Alert, Box, Button, Center, Loader, Stack, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';

type Props = { status: 'loading' | 'unavailable'; onRetry: () => void };

/** What the app shows before it knows the company: waiting, or the service not answering. */
export function Boot({ status, onRetry }: Props) {
  const { t } = useTranslation();
  return (
    <Center mih="100vh" p="md">
      {status === 'loading' ? (
        <Loader aria-label={t('common.loading')} />
      ) : (
        <Box maw={440} w="100%">
          <Stack>
            <Title order={1} size="h4">
              {t('app.name')}
            </Title>
            <Alert color="orange" role="alert" title={t('boot.unavailableTitle')}>
              {t('boot.unavailable')}
            </Alert>
            <Button onClick={onRetry}>{t('common.retry')}</Button>
          </Stack>
        </Box>
      )}
    </Center>
  );
}
