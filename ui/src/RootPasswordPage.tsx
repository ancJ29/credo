import { normaliseClientCode, passwordIsValid } from '@credo/shared';
import {
  Alert,
  Button,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import type { Api } from './api';
import { CopyText } from './CopyText';
import { Loaded } from './Loaded';
import { refusal, useLoad } from './page';
import { PasskeyNotGiven, type Passkeys } from './passkeys';
import { touch } from './touch';

type Props = { api: Api; passkeys: Passkeys; onSignedOut: () => void };

type Problem = 'code' | 'invalid' | 'mismatch' | 'notGiven' | 'failed';

const PROBLEM = {
  code: 'operator.rootCodeWrong',
  invalid: 'person.passwordInvalid',
  mismatch: 'person.passwordMismatch',
  notGiven: 'passkey.notGiven',
  failed: 'operator.rootFailed',
} as const;

const READ_ONLY = { input: { fontFamily: 'ui-monospace, monospace' } };

/**
 * A client's root password set anew, at `/operator/clients/:code/root-password`: the page names the
 * company and what the act ends, asks for the client's code typed, then a password twice under the
 * staff rule, or none for the app to make one, and a fresh touch of the operator's passkey. What
 * the app made is held in this page's state alone and shown once; a typed one is never shown.
 */
export function RootPasswordPage({ api, passkeys, onSignedOut }: Props) {
  const { t } = useTranslation();
  const { code = '' } = useParams();
  const loaded = useLoad(() => api.listClients(), { onSignedOut }, [api]);
  const client = loaded.data?.find((item) => item.code === code);
  const [typed, setTyped] = useState({ code: '', first: '', again: '' });
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  /** Set once the act went through: the password the app made, or null for a typed one. */
  const [done, setDone] = useState<{ made: string | null } | null>(null);

  async function give(password: string | null) {
    setBusy(true);
    try {
      const confirm = await touch(api, passkeys, 'root-password');
      const reply = await api.setRootPassword(code, { password, confirm });
      setTyped({ code: '', first: '', again: '' });
      setDone(reply);
    } catch (error) {
      refusal(error, { onSignedOut });
      setProblem(error instanceof PasskeyNotGiven ? 'notGiven' : 'failed');
    }
    setBusy(false);
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setProblem(null);
    const none = typed.first === '' && typed.again === '';
    if (normaliseClientCode(typed.code) !== code) return setProblem('code');
    if (!none && !passwordIsValid(typed.first)) return setProblem('invalid');
    if (typed.first !== typed.again) return setProblem('mismatch');
    void give(none ? null : typed.first);
  };

  const back = (
    <Button component={Link} to="/operator/clients" variant="default">
      {t('operator.back')}
    </Button>
  );

  return (
    <Loaded status={loaded.status} onRetry={loaded.reload}>
      {!client ? (
        <Stack align="flex-start">
          <Alert color="orange" role="alert" w="100%">
            {t('operator.rootUnknown')}
          </Alert>
          {back}
        </Stack>
      ) : done ? (
        <Stack gap="lg">
          <Title order={2}>
            {t(done.made === null ? 'operator.rootDoneTitle' : 'operator.rootMadeTitle')}
          </Title>
          <Alert color="green" role="alert">
            {t(done.made === null ? 'operator.rootDoneIntro' : 'operator.rootMadeIntro')}
          </Alert>
          {done.made !== null && (
            <Paper withBorder p="md">
              <TextInput
                label={t('operator.rootMadePassword')}
                value={done.made}
                readOnly
                styles={READ_ONLY}
                rightSectionWidth={96}
                rightSection={
                  <CopyText
                    value={done.made}
                    label={t('operator.copy')}
                    about={t('operator.rootMadePassword')}
                  />
                }
              />
            </Paper>
          )}
          <Group>{back}</Group>
        </Stack>
      ) : (
        <Stack gap="lg">
          <div>
            <Title order={2}>{t('operator.rootTitle', { name: client.name })}</Title>
            <Text c="dimmed">{t('operator.rootIntro', { name: client.name })}</Text>
          </div>
          {problem !== null && (
            <Alert color="red" role="alert">
              {t(PROBLEM[problem])}
            </Alert>
          )}
          <form onSubmit={submit}>
            <Paper withBorder p="md">
              <Stack gap="lg">
                <TextInput
                  label={t('operator.rootCodeLabel')}
                  description={t('operator.rootCodeHint', { code: client.code })}
                  autoCapitalize="none"
                  autoComplete="off"
                  required
                  value={typed.code}
                  onChange={(event) => setTyped({ ...typed, code: event.currentTarget.value })}
                />
                <PasswordInput
                  label={t('person.passwordNew')}
                  description={t('person.passwordHint')}
                  autoComplete="new-password"
                  value={typed.first}
                  onChange={(event) => setTyped({ ...typed, first: event.currentTarget.value })}
                />
                <PasswordInput
                  label={t('person.passwordAgain')}
                  autoComplete="new-password"
                  value={typed.again}
                  onChange={(event) => setTyped({ ...typed, again: event.currentTarget.value })}
                />
                <Text size="sm" c="dimmed">
                  {t('operator.rootEmptyHint')} {t('operator.rootTouch')}
                </Text>
                <Group>
                  <Button type="submit" loading={busy}>
                    {t('operator.rootSet')}
                  </Button>
                  {back}
                </Group>
              </Stack>
            </Paper>
          </form>
        </Stack>
      )}
    </Loaded>
  );
}
