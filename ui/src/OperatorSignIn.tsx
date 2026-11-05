import type { Language } from '@credo/shared';
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
  /** The languages offered, and the caller's handler for a chosen one. */
  languages?: readonly Language[];
  onLanguage?: (language: Language) => void;
};

/** Credo's own door: one button and the device's touch, in credo's name, titled so it is never
 * taken for a client's. */
export function OperatorSignIn({ status, onSubmit, languages, onLanguage }: Props) {
  const { t } = useTranslation();
  return (
    <SignInFrame
      brand={CREDO_BRAND}
      title={t('operator.signIn')}
      languages={languages}
      onLanguage={onLanguage}
    >
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
