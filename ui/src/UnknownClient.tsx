import { Box, Center, Paper, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';

/**
 * Screen 9: a link with no code, a malformed one or one we do not know. It names no company and
 * wears credo's own colour, never another client's.
 */
export function UnknownClient() {
  const { t } = useTranslation();
  return (
    <Center mih="100vh" p="md">
      <Box maw={440} w="100%">
        <Paper withBorder p="xl" radius="md">
          <Stack>
            <Title order={1} size="h4">
              {t('unknownClient.title')}
            </Title>
            <Text>{t('unknownClient.text')}</Text>
          </Stack>
        </Paper>
      </Box>
    </Center>
  );
}
