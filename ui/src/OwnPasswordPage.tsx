import { passwordIsValid, type SessionReply } from '@credo/shared';
import { Alert, Button, Paper, PasswordInput, Stack, Text, Title } from '@mantine/core';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type PageProps, refusal } from './page';

const OUTCOME_WORDS = {
  changed: 'ownPassword.changed',
  wrong: 'ownPassword.wrong',
  invalid: 'ownPassword.invalid',
  mismatch: 'ownPassword.mismatch',
  failed: 'ownPassword.failed',
} as const;

type Props = PageProps & {
  /** The session that replaces the one held: every other device is signed out. */
  onSession: (session: SessionReply) => void;
};

/** One's own password, for anyone signed in: the current one first, then the new one typed twice. */
export function OwnPasswordPage(props: Props) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState({ current: '', next: '', again: '' });
  const [outcome, setOutcome] = useState<keyof typeof OUTCOME_WORDS | null>(null);

  async function change(event: FormEvent) {
    event.preventDefault();
    if (typed.current === '') return setOutcome('wrong');
    if (!passwordIsValid(typed.next)) return setOutcome('invalid');
    if (typed.next !== typed.again) return setOutcome('mismatch');
    setOutcome(null);
    try {
      const result = await props.api.changePassword(typed.current, typed.next);
      if (result.kind === 'wrong') return setOutcome('wrong');
      setTyped({ current: '', next: '', again: '' });
      setOutcome('changed');
      props.onSession(result.session);
    } catch (error) {
      refusal(error, props);
      setOutcome('failed');
    }
  }

  return (
    <Stack gap="md" maw={560}>
      <Title order={2}>{t('ownPassword.title')}</Title>
      <Text c="dimmed">{t('ownPassword.text')}</Text>
      {outcome !== null && (
        <Alert color={outcome === 'changed' ? 'green' : 'red'} role="alert">
          {t(OUTCOME_WORDS[outcome])}
        </Alert>
      )}
      <Paper withBorder p="md">
        <form onSubmit={(event) => void change(event)}>
          <Stack gap="sm">
            <PasswordInput
              label={t('ownPassword.current')}
              autoComplete="current-password"
              value={typed.current}
              onChange={(event) => setTyped({ ...typed, current: event.currentTarget.value })}
            />
            <PasswordInput
              label={t('ownPassword.new')}
              description={t('person.passwordHint')}
              autoComplete="new-password"
              value={typed.next}
              onChange={(event) => setTyped({ ...typed, next: event.currentTarget.value })}
            />
            <PasswordInput
              label={t('ownPassword.again')}
              autoComplete="new-password"
              value={typed.again}
              onChange={(event) => setTyped({ ...typed, again: event.currentTarget.value })}
            />
            <Button type="submit" style={{ alignSelf: 'flex-start' }}>
              {t('ownPassword.submit')}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
