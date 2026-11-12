import type { Language } from '@credo/shared';
import {
  Alert,
  Box,
  Button,
  Flex,
  Group,
  Image,
  Paper,
  PasswordInput,
  Stack,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { IconBrandAdobe, IconLock, IconUser } from '@tabler/icons-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Brand } from '../brand';
import classes from '../frame/frame.module.css';
import { LANGUAGE_NAMES } from '../i18n';
import { BRAND_GRADIENT } from '../theme';
import { waitWords } from './waitWords';

/** The page's own ground behind a door's card, the grey the signed-in pages sit on. */
const GROUND = 'light-dark(var(--mantine-color-neutral-1), var(--mantine-color-body))';

/** The language switch's outline, white on the coloured header. */
const SWITCH = {
  border: '1px solid rgba(255, 255, 255, 0.55)',
  borderRadius: 6,
  overflow: 'hidden',
};

type Props = {
  brand: Brand;
  /** Idle, waiting on the service, the last attempt refused, or the name made to wait. */
  status: 'idle' | 'busy' | 'refused' | 'wait';
  /** The seconds a 'wait' asks for. */
  waitSeconds?: number;
  /** What is already typed, for a mock of a half-filled form. */
  initial?: { username: string; password: string };
  onSubmit: (username: string, password: string) => void;
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
 * What a door is drawn in: the app's own coloured header (gradient, logo, company name and, where
 * the caller offers more than one language, the language switch) with no menu, and the card on the
 * app's own ground beneath. The sign-in, the operator's and the join page share it.
 */
export function SignInFrame({ brand, title, languages = [], onLanguage, children }: FrameProps) {
  const { t, i18n } = useTranslation();
  return (
    <Box mih="100vh" style={{ display: 'flex', flexDirection: 'column' }}>
      <Group
        component="header"
        h={56}
        px="md"
        justify="space-between"
        wrap="nowrap"
        className={classes.header}
        style={{ background: BRAND_GRADIENT, flexShrink: 0 }}
      >
        <Group gap="sm" wrap="nowrap" className={classes.brand}>
          {brand.logo ? (
            <Image src={brand.logo} alt="" h={36} w={36} fit="contain" radius="sm" />
          ) : (
            <IconBrandAdobe size={36} stroke={1.5} aria-hidden />
          )}
          <Title order={1} size="h4" fw={600} c="inherit">
            {brand.name}
          </Title>
        </Group>
        {languages.length > 1 && onLanguage && (
          <Group gap={0} wrap="nowrap" role="group" aria-label={t('user.language')} style={SWITCH}>
            {languages.map((language) => (
              <UnstyledButton
                key={language}
                aria-label={LANGUAGE_NAMES[language]}
                aria-current={i18n.language === language}
                px={8}
                py={3}
                fz={12}
                fw={700}
                style={{
                  background: i18n.language === language ? 'rgba(255, 255, 255, 0.22)' : undefined,
                }}
                onClick={() => onLanguage(language)}
              >
                {language.toUpperCase()}
              </UnstyledButton>
            ))}
          </Group>
        )}
      </Group>
      <Flex
        flex={1}
        justify="center"
        align={{ base: 'flex-start', sm: 'center' }}
        px={{ base: 'sm', sm: 'md' }}
        py={{ base: 'md', sm: 24 }}
        style={{ background: GROUND }}
      >
        <Paper
          shadow="lg"
          radius="md"
          w="100%"
          maw={440}
          p={{ base: '24px 20px', sm: 32 }}
          style={{ border: '1px solid var(--mantine-color-default-border)' }}
        >
          <Title order={2} fw={700} ta="center" mb="md">
            {title}
          </Title>
          {children}
        </Paper>
      </Flex>
    </Box>
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

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(username, password);
  };

  return (
    <SignInFrame
      brand={brand}
      title={t('auth.title')}
      languages={languages}
      onLanguage={onLanguage}
    >
      {status === 'wait' && (
        <Alert color="red" role="alert" mb="md">
          {waitWords(t, waitSeconds)}
        </Alert>
      )}
      {status === 'refused' && (
        <Alert color="red" role="alert" mb="md">
          {t('auth.refused')}
        </Alert>
      )}
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
          <Button
            type="submit"
            fullWidth
            size="md"
            loading={status === 'busy'}
            style={{ background: BRAND_GRADIENT }}
          >
            {t('auth.submit')}
          </Button>
        </Stack>
      </form>
    </SignInFrame>
  );
}
