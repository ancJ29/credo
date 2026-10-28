import { Alert, Button, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  /** Idle, waiting on the service, the last attempt failed, or the code was already taken. */
  status: 'idle' | 'busy' | 'failed' | 'taken';
  /** What is already typed, for a mock of a half-filled form. */
  initial?: { code: string; name: string };
  onSubmit: (code: string, name: string) => void;
};

/** The operator's form: a code and the company's name, and nothing else a client needs to start. */
export function NewClient({ status, initial, onSubmit }: Props) {
  const { t } = useTranslation();
  const [code, setCode] = useState(initial?.code ?? '');
  const [name, setName] = useState(initial?.name ?? '');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(code, name);
  };

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>{t('operator.newTitle')}</Title>
        <Text c="dimmed">{t('operator.newIntro')}</Text>
      </div>
      {status === 'failed' && (
        <Alert color="red" role="alert">
          {t('operator.failed')}
        </Alert>
      )}
      {status === 'taken' && (
        <Alert color="orange" role="alert">
          {t('operator.taken')}
        </Alert>
      )}
      <form onSubmit={submit}>
        <Paper withBorder p="md">
          <Stack gap="lg">
            <TextInput
              label={t('operator.code')}
              description={t('operator.codeHint')}
              placeholder={t('operator.codePlaceholder')}
              autoCapitalize="none"
              autoComplete="off"
              required
              error={status === 'taken'}
              value={code}
              onChange={(event) => setCode(event.currentTarget.value)}
            />
            <TextInput
              label={t('operator.companyName')}
              required
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <Button type="submit" loading={status === 'busy'}>
              {t('operator.make')}
            </Button>
          </Stack>
        </Paper>
      </form>
    </Stack>
  );
}
