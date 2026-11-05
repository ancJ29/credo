import { normaliseClientCode } from '@credo/shared';
import { Alert, Button, Group, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError, type Api } from './api';
import { Loaded } from './Loaded';
import { refusal, useLoad } from './page';
import { PasskeyNotGiven, type Passkeys } from './passkeys';
import { touch } from './touch';

type Props = { api: Api; passkeys: Passkeys; onSignedOut: () => void };

type Problem = 'code' | 'notGiven' | 'failed';

const PROBLEM = {
  code: 'operator.rootCodeWrong',
  notGiven: 'passkey.notGiven',
  failed: 'operator.deleteClientFailed',
} as const;

/**
 * Deleting a client whole, at `/operator/clients/:code/delete`: the page names the company and says
 * that everything it owns goes and cannot come back, asks for the client's code typed, then a fresh
 * touch of the operator's own passkey. The route does a bounded part of the work and says how many
 * records are left; the page presses on, with the same touch, until none are, and the list comes
 * back without the client. One already gone (404) is the same list. A page opened for a client not
 * in the list offers to continue a deletion that may have stopped part way.
 */
export function DeleteClientPage({ api, passkeys, onSignedOut }: Props) {
  const { t } = useTranslation();
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const loaded = useLoad(() => api.listClients(), { onSignedOut }, [api]);
  const client = loaded.data?.find((item) => item.code === code);
  const [typed, setTyped] = useState('');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  /** The records the last press left, while the page presses on. */
  const [left, setLeft] = useState<number | null>(null);
  /** Set when a continued deletion found nothing left to continue. */
  const [finished, setFinished] = useState(false);

  async function give() {
    setBusy(true);
    try {
      const confirm = await touch(api, passkeys, 'delete-client');
      let reply = await api.deleteClient(code, { confirm });
      while (reply.left > 0) {
        setLeft(reply.left);
        reply = await api.deleteClient(code, { confirm });
      }
      void navigate('/operator/clients');
      return;
    } catch (error) {
      refusal(error, { onSignedOut });
      if (error instanceof ApiError && error.status === 404) {
        void navigate('/operator/clients');
        return;
      }
      setProblem(error instanceof PasskeyNotGiven ? 'notGiven' : 'failed');
    }
    setBusy(false);
  }

  /** The client is out of the list, so a deletion of it may have stopped part way: the route
   * continues one on the session alone, and answers 404 where there is none. */
  async function resume() {
    setBusy(true);
    setProblem(null);
    try {
      let reply = await api.deleteClient(code, null);
      while (reply.left > 0) {
        setLeft(reply.left);
        reply = await api.deleteClient(code, null);
      }
      void navigate('/operator/clients');
      return;
    } catch (error) {
      refusal(error, { onSignedOut });
      if (error instanceof ApiError && error.status === 404) setFinished(true);
      else setProblem('failed');
    }
    setBusy(false);
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setProblem(null);
    if (normaliseClientCode(typed) !== code) return setProblem('code');
    void give();
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
          {finished ? (
            <Alert color="green" role="status" w="100%">
              {t('operator.deleteClientFinished')}
            </Alert>
          ) : (
            <>
              <Alert color="orange" role="note" w="100%">
                {t('operator.deleteClientUnfinished')}
              </Alert>
              {problem !== null && (
                <Alert color="red" role="alert" w="100%">
                  {t(PROBLEM[problem])}
                </Alert>
              )}
              {left !== null && (
                <Alert color="orange" role="status" w="100%">
                  {t('operator.deleteClientLeft', { count: left })}
                </Alert>
              )}
              <Button color="red" variant="outline" loading={busy} onClick={() => void resume()}>
                {t('operator.deleteClientResume')}
              </Button>
            </>
          )}
          {back}
        </Stack>
      ) : (
        <Stack gap="lg">
          <div>
            <Title order={2}>{t('operator.deleteClientTitle', { name: client.name })}</Title>
          </div>
          <Alert color="red" role="note" title={client.code}>
            {t('operator.deleteClientIntro', { name: client.name })}
          </Alert>
          {problem !== null && (
            <Alert color="red" role="alert">
              {t(PROBLEM[problem])}
            </Alert>
          )}
          {left !== null && (
            <Alert color="orange" role="status">
              {t('operator.deleteClientLeft', { count: left })}
            </Alert>
          )}
          <form onSubmit={submit}>
            <Paper withBorder p="md">
              <Stack gap="lg">
                <TextInput
                  label={t('operator.deleteClientCodeLabel')}
                  description={t('operator.deleteClientCodeHint', { code: client.code })}
                  autoCapitalize="none"
                  autoComplete="off"
                  required
                  value={typed}
                  onChange={(event) => setTyped(event.currentTarget.value)}
                />
                <Text size="sm" c="dimmed">
                  {t('operator.deleteClientTouch')}
                </Text>
                <Group>
                  <Button type="submit" color="red" loading={busy}>
                    {t('operator.deleteClientMake')}
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
