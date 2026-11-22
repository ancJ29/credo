import { Box, Center, Stack, Title } from '@mantine/core';
import { PageState } from '../components/organisms/PageState';
import { useTranslation } from 'react-i18next';
import type { Hop } from '../api';

type Props = {
  status: 'loading' | 'unavailable';
  /** Where the service failed, when the operator's console can tell: it names the hop. */
  hop?: Hop;
  onRetry: () => void;
};

const HOP_WORDS = {
  storage: 'operator.unavailableStorage',
  bff: 'operator.unavailableBff',
} as const;

/** What the app shows before it knows the company: waiting, or the service not answering, and
 * for the operator's console which part of it. */
export function Boot({ status, hop, onRetry }: Props) {
  const { t } = useTranslation();
  return (
    <Center mih="100vh" p="md">
      {status === 'loading' ? (
        <PageState state="loading" />
      ) : (
        <Box maw={440} w="100%">
          <Stack>
            <Title order={1} size="h4">
              {t('app.name')}
            </Title>
            <PageState state="failed" onRetry={onRetry}>
              {t(hop ? HOP_WORDS[hop] : 'common.unavailable')}
            </PageState>
          </Stack>
        </Box>
      )}
    </Center>
  );
}
