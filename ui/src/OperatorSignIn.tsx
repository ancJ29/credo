import { Alert, Button, Stack, Text } from '@mantine/core';
import { IconFingerprint } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { CREDO_BRAND } from './brand';
import { SignInFrame } from './SignIn';
import { BRAND_GRADIENT } from './theme';

type Props = {
  /** Idle, waiting on the device, the passkey not given, or a passkey that opens nothing here. */
  status: 'idle' | 'busy' | 'notGiven' | 'refused';
  onSubmit: () => void;
};

/** Credo's own door: one button and the device's touch, in credo's name, titled so it is never
 * taken for a client's. */
export function OperatorSignIn({ status, onSubmit }: Props) {
  const { t } = useTranslation();
  return (
    <SignInFrame brand={CREDO_BRAND} title={t('operator.signIn')}>
      <Stack gap="lg">
        {(status === 'notGiven' || status === 'refused') && (
          <Alert color="red" role="alert">
            {t(status === 'notGiven' ? 'passkey.notGiven' : 'passkey.refused')}
          </Alert>
        )}
        <Text c="dimmed" ta="center">
          {t('passkey.signInHint')}
        </Text>
        <Button
          fullWidth
          size="md"
          loading={status === 'busy'}
          leftSection={<IconFingerprint size={20} />}
          style={{ background: BRAND_GRADIENT }}
          onClick={onSubmit}
        >
          {t('passkey.signInButton')}
        </Button>
      </Stack>
    </SignInFrame>
  );
}
