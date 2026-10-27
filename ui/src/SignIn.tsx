import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  Paper,
  PasswordInput,
  Stack,
  TextInput,
} from '@mantine/core';
import { IconLock, IconUser } from '@tabler/icons-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Brand } from './brand';
import { BrandMark } from './BrandMark';

type Props = {
  brand: Brand;
  /** Idle, waiting on the service, or the last attempt refused. */
  status: 'idle' | 'busy' | 'refused';
  /** What is already typed, for a mock of a half-filled form. */
  initial?: { username: string; password: string };
  onSubmit: (username: string, password: string) => void;
};

/** The sign-in, in the company's name and colours. */
export function SignIn({ brand, status, initial, onSubmit }: Props) {
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
      bg="var(--mantine-color-default-hover)"
      style={{ display: 'flex', alignItems: 'center' }}
    >
      <Container size={440} w="100%" px="sm" py="lg">
        <Paper shadow="md" withBorder radius="md" style={{ overflow: 'hidden' }}>
          <Box h={6} bg="brand.7" />
          <Stack p="xl" gap="lg">
            <BrandMark brand={brand} />
            <Divider />
            {status === 'refused' && (
              <Alert color="red" role="alert">
                {t('auth.refused')}
              </Alert>
            )}
            <form onSubmit={submit}>
              <Stack gap="md">
                <TextInput
                  size="md"
                  label={t('auth.username')}
                  leftSection={<IconUser size={18} />}
                  autoComplete="username"
                  autoCapitalize="none"
                  required
                  value={username}
                  onChange={(event) => setUsername(event.currentTarget.value)}
                />
                <PasswordInput
                  size="md"
                  label={t('auth.password')}
                  leftSection={<IconLock size={18} />}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                />
                <Button type="submit" size="md" fullWidth loading={status === 'busy'}>
                  {t('auth.submit')}
                </Button>
              </Stack>
            </form>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
