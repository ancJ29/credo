import { Box, Button, Container, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { Brand } from './brand';

type Props = {
  brand: Brand;
  /** Waiting on the BFF, or the code was refused: used before, or past its 15 minutes. */
  status: 'busy' | 'refused';
  /** Leaves the refused code for the password sign-in. */
  onPassword: () => void;
};

/** What a phone shows while a QR code's link signs it in, and when the code is refused: the company's
 * name, and for a refusal what to do next. */
export function QrLanding({ brand, status, onPassword }: Props) {
  const { t } = useTranslation();
  const refused = status === 'refused';
  return (
    <Box mih="100vh" bg="neutral.0" style={{ display: 'flex', alignItems: 'center' }}>
      <Container size={500} w="100%" px="sm" py="lg">
        <Paper withBorder radius="md" p="xl" role="status">
          <Stack gap="md" align="center" ta="center">
            <Text fw={700}>{brand.name}</Text>
            <Title order={2}>{t(refused ? 'qrSignIn.refusedTitle' : 'qrSignIn.busyTitle')}</Title>
            {refused ? (
              <>
                <Text c="dimmed">{t('qrSignIn.refusedText')}</Text>
                <Button onClick={onPassword}>{t('qrSignIn.password')}</Button>
              </>
            ) : (
              <>
                <Loader size="sm" />
                <Text c="dimmed">{t('qrSignIn.busyText')}</Text>
              </>
            )}
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
