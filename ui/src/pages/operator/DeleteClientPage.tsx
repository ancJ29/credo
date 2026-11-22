import { normaliseClientCode } from '@credo/shared';
import { Button, Group, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError, type Api } from '../../api';
import { Loaded } from '../../frame/Loaded';
import { refusal, useLoad } from '../../page';
import { PasskeyNotGiven, type Passkeys } from '../../passkeys';
import { touch } from '../../touch';
import { TYPE } from '../../design-system/tokens';
import { FormMessage } from '../../components/molecules/FormMessage';
import { ActionButton } from '../../components/atoms/ActionButton';

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
            <FormMessage kind="success">{t('operator.deleteClientFinished')}</FormMessage>
          ) : (
            <>
              <FormMessage kind="warning" standing>
                {t('operator.deleteClientUnfinished')}
              </FormMessage>
              {problem !== null && <FormMessage kind="error">{t(PROBLEM[problem])}</FormMessage>}
              {left !== null && (
                <FormMessage kind="info">
                  {t('operator.deleteClientLeft', { count: left })}
                </FormMessage>
              )}
              <ActionButton meaning="danger" busy={busy} onClick={() => void resume()}>
                {t('operator.deleteClientResume')}
              </ActionButton>
            </>
          )}
          {back}
        </Stack>
      ) : (
        <Stack gap="lg">
          <div>
            <Title {...TYPE.pageTitle}>
              {t('operator.deleteClientTitle', { name: client.name })}
            </Title>
          </div>
          <FormMessage kind="warning" standing title={client.code}>
            {t('operator.deleteClientIntro', { name: client.name })}
          </FormMessage>
          {problem !== null && <FormMessage kind="error">{t(PROBLEM[problem])}</FormMessage>}
          {left !== null && (
            <FormMessage kind="info">{t('operator.deleteClientLeft', { count: left })}</FormMessage>
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
                <Text {...TYPE.caption}>{t('operator.deleteClientTouch')}</Text>
                <Group>
                  <ActionButton meaning="danger" submit busy={busy}>
                    {t('operator.deleteClientMake')}
                  </ActionButton>
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
