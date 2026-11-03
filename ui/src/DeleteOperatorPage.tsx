import { Alert, Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError, type Api } from './api';
import { Loaded } from './Loaded';
import { refusal, useLoad } from './page';
import { PasskeyNotGiven, type Passkeys } from './passkeys';
import { touch } from './touch';

type Props = { api: Api; passkeys: Passkeys; onSignedOut: () => void };

type Problem = 'notGiven' | 'failed';

const PROBLEM = { notGiven: 'passkey.notGiven', failed: 'team.deleteFailed' } as const;

/**
 * Deleting a colleague, at `/operator/operators/:id/delete`: the page names them and says what goes
 * and that they are signed out at their next step, then a fresh touch of the operator's own
 * passkey, and the list comes back without them. One already gone (404) is the same list. Oneself,
 * or one not on the list, has no page.
 */
export function DeleteOperatorPage({ api, passkeys, onSignedOut }: Props) {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const loaded = useLoad(() => api.listOperators(), { onSignedOut }, [api]);
  const colleague = loaded.data?.find((one) => one.id === id && !one.you);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);

  async function give() {
    setBusy(true);
    setProblem(null);
    try {
      const confirm = await touch(api, passkeys, 'delete-operator');
      await api.deleteOperator(id, { confirm });
      void navigate('/operator/operators');
      return;
    } catch (error) {
      refusal(error, { onSignedOut });
      if (error instanceof ApiError && error.status === 404) {
        void navigate('/operator/operators');
        return;
      }
      setProblem(error instanceof PasskeyNotGiven ? 'notGiven' : 'failed');
    }
    setBusy(false);
  }

  const back = (
    <Button component={Link} to="/operator/operators" variant="default">
      {t('team.back')}
    </Button>
  );

  return (
    <Loaded status={loaded.status} onRetry={loaded.reload}>
      {!colleague ? (
        <Stack align="flex-start">
          <Alert color="orange" role="alert" w="100%">
            {t('team.unknown')}
          </Alert>
          {back}
        </Stack>
      ) : (
        <Stack gap="lg">
          <div>
            <Title order={2}>{t('team.deleteTitle', { name: colleague.name })}</Title>
            <Text c="dimmed">{t('team.deleteIntro', { name: colleague.name })}</Text>
          </div>
          {problem !== null && (
            <Alert color="red" role="alert">
              {t(PROBLEM[problem])}
            </Alert>
          )}
          <Paper withBorder p="md">
            <Stack gap="lg">
              <Text size="sm" c="dimmed">
                {t('team.deleteTouch')}
              </Text>
              <Group>
                <Button color="red" loading={busy} onClick={() => void give()}>
                  {t('team.deleteMake')}
                </Button>
                {back}
              </Group>
            </Stack>
          </Paper>
        </Stack>
      )}
    </Loaded>
  );
}
