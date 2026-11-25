import { Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { CREDO_BRAND } from '../../brand';
import { ActionButton } from '../../components/atoms/ActionButton';
import { DoorCard } from '../../components/organisms/DoorCard';
import { DoorPage } from '../../components/organisms/DoorPage';

/**
 * Screen 9: a link with no code, a malformed one or one we do not know. It names no company and
 * wears credo's own colour and name, never another client's, and leads to the sign-up page.
 */
export function UnknownClient() {
  const { t } = useTranslation();
  return (
    <DoorPage>
      <DoorCard name={CREDO_BRAND.name}>
        <Stack gap="md">
          <Title order={2} size="h4">
            {t('unknownClient.title')}
          </Title>
          <Text>{t('unknownClient.text')}</Text>
          <ActionButton meaning="other" to="/sign-up">
            {t('signUp.title')}
          </ActionButton>
        </Stack>
      </DoorCard>
    </DoorPage>
  );
}
