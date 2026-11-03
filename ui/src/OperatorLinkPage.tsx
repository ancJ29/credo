import { Alert, Button, Group, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { ApiError, type Api } from './api';
import { CopyText } from './CopyText';
import { Loaded } from './Loaded';
import { refusal, useLoad } from './page';
import { PasskeyNotGiven, type Passkeys } from './passkeys';
import { touch } from './touch';

type Props = { api: Api; passkeys: Passkeys; onSignedOut: () => void };

type Problem = 'notGiven' | 'failed' | 'gone';

const PROBLEM = {
  notGiven: 'passkey.notGiven',
  failed: 'team.linkFailed',
  gone: 'team.unknown',
} as const;

const READ_ONLY = { input: { fontFamily: 'ui-monospace, monospace' } };

/**
 * A colleague's new link, at `/operator/operators/:id/link`: the page names them and says what the
 * link does (it replaces their last link; an active colleague's passkeys stop only when it is used),
 * then a fresh touch of the operator's own passkey, then the link shown once to copy and send. The
 * link is held in this page's state alone, so a reload or a step away loses it. Oneself, or one not
 * on the list, has no page.
 */
export function OperatorLinkPage({ api, passkeys, onSignedOut }: Props) {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const loaded = useLoad(() => api.listOperators(), { onSignedOut }, [api]);
  const colleague = loaded.data?.find((one) => one.id === id && !one.you);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  /** Set once the link is made: the full address to send. */
  const [made, setMade] = useState<string | null>(null);

  async function give() {
    setBusy(true);
    setProblem(null);
    try {
      const confirm = await touch(api, passkeys, 'operator-link');
      const reply = await api.newOperatorLink(id, { confirm });
      setMade(`${window.location.origin}${reply.link}`);
    } catch (error) {
      refusal(error, { onSignedOut });
      if (error instanceof ApiError && error.status === 404) setProblem('gone');
      else setProblem(error instanceof PasskeyNotGiven ? 'notGiven' : 'failed');
    }
    setBusy(false);
  }

  const back = (
    <Button component={Link} to="/operator/operators" variant={made ? 'filled' : 'default'}>
      {t('team.back')}
    </Button>
  );

  return (
    <Loaded status={loaded.status} onRetry={loaded.reload}>
      {!colleague || problem === 'gone' ? (
        <Stack align="flex-start">
          <Alert color="orange" role="alert" w="100%">
            {t('team.unknown')}
          </Alert>
          {back}
        </Stack>
      ) : made ? (
        <Stack gap="lg">
          <Title order={2}>{t('team.linkMadeTitle')}</Title>
          <Alert color="green" role="alert">
            {t('team.linkMadeIntro', { name: colleague.name })}
          </Alert>
          <Paper withBorder p="md">
            <TextInput
              label={t('team.link')}
              value={made}
              readOnly
              styles={READ_ONLY}
              rightSectionWidth={96}
              rightSection={
                <CopyText value={made} label={t('operator.copy')} about={t('team.link')} />
              }
            />
          </Paper>
          <Group>{back}</Group>
        </Stack>
      ) : (
        <Stack gap="lg">
          <div>
            <Title order={2}>{t('team.linkTitle', { name: colleague.name })}</Title>
            <Text c="dimmed">
              {t(colleague.state === 'active' ? 'team.linkIntroActive' : 'team.linkIntroInvited', {
                name: colleague.name,
              })}
            </Text>
          </div>
          {problem !== null && (
            <Alert color="red" role="alert">
              {t(PROBLEM[problem])}
            </Alert>
          )}
          <Paper withBorder p="md">
            <Stack gap="lg">
              <Text size="sm" c="dimmed">
                {t('team.linkTouch')}
              </Text>
              <Group>
                <Button loading={busy} onClick={() => void give()}>
                  {t('team.linkMake')}
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
