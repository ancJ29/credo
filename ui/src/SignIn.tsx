import {
  Alert,
  Box,
  Button,
  Container,
  Group,
  Image,
  Paper,
  PasswordInput,
  Stack,
  TextInput,
  Title,
} from '@mantine/core';
import { IconLock, IconUser } from '@tabler/icons-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Brand } from './brand';
import { BRAND_GRADIENT } from './theme';

type Props = {
  brand: Brand;
  /** Idle, waiting on the service, or the last attempt refused. */
  status: 'idle' | 'busy' | 'refused';
  /** The heading over the form, where it is not "Sign in to your account": the operator's door. */
  title?: string;
  /** What is already typed, for a mock of a half-filled form. */
  initial?: { username: string; password: string };
  onSubmit: (username: string, password: string) => void;
};

/**
 * The sign-in, in the company's name and colours, drawn as the old app's: one card on a soft
 * grey ground, the brand's bar across its top, the logo and name in its tinted head, a title
 * over underlined fields, and a gradient button.
 */
export function SignIn({ brand, status, title, initial, onSubmit }: Props) {
  const { t } = useTranslation();
  const [username, setUsername] = useState(initial?.username ?? '');
  const [password, setPassword] = useState(initial?.password ?? '');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(username, password);
  };

  return (
    <Box
      mih="100vh"
      style={{
        display: 'flex',
        alignItems: 'center',
        background:
          'linear-gradient(135deg, var(--mantine-color-neutral-0) 0%, var(--mantine-color-neutral-1) 100%)',
      }}
    >
      <Container size={500} w="100%" px="sm" py="lg">
        <Paper
          shadow="xl"
          radius="md"
          style={{ border: '1px solid var(--mantine-color-neutral-3)', overflow: 'hidden' }}
        >
          <Box h={4} style={{ background: BRAND_GRADIENT }} />
          <Box px={40} pt={28} bg="brand.0">
            <Group gap="md" justify="center" wrap="nowrap">
              {brand.logo && (
                <Box
                  w={44}
                  h={44}
                  bd="1px solid var(--mantine-color-brand-2)"
                  style={{ borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}
                >
                  <Image src={brand.logo} alt="" h={44} w={44} fit="contain" />
                </Box>
              )}
              <Title order={1} fz="md" fw={700} lh={1.2}>
                {brand.name}
              </Title>
            </Group>
            <Box mt="md" h={1} bg="brand.1" />
          </Box>
          <Box p={40} pt={28}>
            <Title order={2} fw={700} ta="center" mb="md">
              {title ?? t('auth.title')}
            </Title>
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
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
