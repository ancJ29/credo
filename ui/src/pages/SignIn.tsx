import type { Language } from '@credo/shared';
import { Box, Button, Checkbox, PasswordInput, Stack, TextInput } from '@mantine/core';
import { IconLock, IconUser } from '@tabler/icons-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Brand } from '../brand';
import { LANGUAGE_NAMES } from '../i18n';
import { BRAND_GRADIENT } from '../design-system/appTheme';
import { waitWords } from './waitWords';
import { DoorHeading } from '../components/atoms/DoorHeading';
import { DoorCard } from '../components/organisms/DoorCard';
import { DoorPage } from '../components/organisms/DoorPage';
import { FormMessage } from '../components/molecules/FormMessage';

type Props = {
  brand: Brand;
  /** Idle, waiting on the service, the last attempt refused, or the name made to wait. */
  status: 'idle' | 'busy' | 'refused' | 'wait';
  /** The seconds a 'wait' asks for. */
  waitSeconds?: number;
  /** What is already typed, for a mock of a half-filled form. */
  initial?: { username: string; password: string };
  /** What was typed, and whether the sign-in is kept on the device (the tick, which starts on). */
  onSubmit: (username: string, password: string, remember: boolean) => void;
  /** The languages the company offers, and the caller's handler for a chosen one. */
  languages?: readonly Language[];
  onLanguage?: (language: Language) => void;
};

type FrameProps = {
  brand: Brand;
  /** The heading over what the card holds. */
  title: string;
  /** The languages the caller offers; the header draws a switch only when there is more than one. */
  languages?: readonly Language[];
  /** The caller's own handler for a chosen language, the one the signed-in header calls. */
  onLanguage?: (language: Language) => void;
  children: ReactNode;
};

/**
 * What a door is drawn in: the brand's colour sweeping the whole screen, the language switch in its
 * corner, and the legacy's card centred on it (the band with the logo and the name, then the title
 * and what the caller gives), with no menu, bar or header. The sign-in, the QR landing, the
 * operators' sign-in and the join page share it.
 */
export function SignInFrame({ brand, title, languages = [], onLanguage, children }: FrameProps) {
  return (
    <DoorPage
      languages={languages.map((language) => ({ language, name: LANGUAGE_NAMES[language] }))}
      onLanguage={onLanguage}
    >
      <DoorCard name={brand.name} logo={brand.logo ?? undefined}>
        <DoorHeading title={title} />
        <Box mt="md">{children}</Box>
      </DoorCard>
    </DoorPage>
  );
}

/** The sign-in: a username and a password in the company's card. */
export function SignIn({
  brand,
  status,
  waitSeconds = 0,
  initial,
  onSubmit,
  languages,
  onLanguage,
}: Props) {
  const { t } = useTranslation();
  const [username, setUsername] = useState(initial?.username ?? '');
  const [password, setPassword] = useState(initial?.password ?? '');
  const [remember, setRemember] = useState(true);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(username, password, remember);
  };

  return (
    <SignInFrame
      brand={brand}
      title={t('auth.title')}
      languages={languages}
      onLanguage={onLanguage}
    >
      {status === 'wait' && <FormMessage kind="error">{waitWords(t, waitSeconds)}</FormMessage>}
      {status === 'refused' && <FormMessage kind="error">{t('auth.refused')}</FormMessage>}
      <form onSubmit={submit}>
        <Stack gap="lg">
          <TextInput
            size="md"
            label={t('auth.username')}
            placeholder={t('auth.usernamePlaceholder')}
            leftSection={<IconUser size={18} />}
            autoComplete="username"
            autoCapitalize="none"
            required
            withAsterisk={false}
            value={username}
            onChange={(event) => setUsername(event.currentTarget.value)}
          />
          <PasswordInput
            size="md"
            label={t('auth.password')}
            placeholder={t('auth.passwordPlaceholder')}
            leftSection={<IconLock size={18} />}
            autoComplete="current-password"
            required
            withAsterisk={false}
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
          <Checkbox
            label={t('auth.remember')}
            checked={remember}
            onChange={(event) => setRemember(event.currentTarget.checked)}
          />
          <Button
            type="submit"
            fullWidth
            size="md"
            loading={status === 'busy'}
            style={{ background: BRAND_GRADIENT, color: 'var(--credo-on-header)' }}
          >
            {t('auth.submit')}
          </Button>
        </Stack>
      </form>
    </SignInFrame>
  );
}
