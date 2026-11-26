import { Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { CREDO_BRAND } from '../../brand';
import { DoorCard } from '../../components/organisms/DoorCard';
import { DoorPage } from '../../components/organisms/DoorPage';

/**
 * A company that signed itself up and waits for a credo operator's approval: its address says so, in
 * credo's own colour and name, with no form and nothing to press, since nothing signs in until
 * approval.
 */
export function WaitingClient() {
  const { t } = useTranslation();
  return (
    <DoorPage>
      <DoorCard name={CREDO_BRAND.name}>
        <Stack gap="md">
          <Title order={2} size="h4">
            {t('signUp.waitingTitle')}
          </Title>
          <Text>{t('signUp.waitingText')}</Text>
        </Stack>
      </DoorCard>
    </DoorPage>
  );
}
