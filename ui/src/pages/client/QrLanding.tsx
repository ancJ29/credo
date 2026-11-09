import type { Language } from '@credo/shared';
import { Button, Loader, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { Brand } from '../../brand';
import { SignInFrame } from '../SignIn';

type Props = {
  brand: Brand;
  /** Waiting on the BFF, or the code was refused: used before, or past its 15 minutes. */
  status: 'busy' | 'refused';
  /** Leaves the refused code for the password sign-in. */
  onPassword: () => void;
  /** The languages offered, and the caller's handler for a chosen one. */
  languages?: readonly Language[];
  onLanguage?: (language: Language) => void;
};

/** What a phone shows while a QR code's link signs it in, and when the code is refused: the company's
 * name, and for a refusal what to do next. */
export function QrLanding({ brand, status, onPassword, languages, onLanguage }: Props) {
  const { t } = useTranslation();
  const refused = status === 'refused';
  return (
    <SignInFrame
      brand={brand}
      title={t(refused ? 'qrSignIn.refusedTitle' : 'qrSignIn.busyTitle')}
      languages={languages}
      onLanguage={onLanguage}
    >
      <Stack gap="md" align="center" ta="center" role="status">
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
    </SignInFrame>
  );
}
