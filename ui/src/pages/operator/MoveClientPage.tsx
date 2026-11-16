import { HOME_BOX, type MoveClientReply, type MoveClientRequest } from '@credo/shared';
import { Alert, Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { type Api } from '../../api';
import { Loaded } from '../../frame/Loaded';
import { refusal, useLoad } from '../../page';
import { PasskeyNotGiven, type Passkeys } from '../../passkeys';
import { BoxChoice } from '../../parts/BoxChoice';
import { touch } from '../../touch';

type Props = {
  api: Api;
  passkeys: Passkeys;
  onSignedOut: () => void;
  /** How the page waits the seconds an answer names; the clock unless a test hands another. */
  wait?: (ms: number) => Promise<void>;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Problem = 'notGiven' | 'failed';

/**
 * Moving a company to another box, at `/operator/clients/:code/move`: the page names the company
 * and its box and lists the other boxes with their free disk, then asks for a fresh touch of the
 * operator's passkey. The route does one step a press and says where the move is: the page waits
 * the seconds it names, presses on, and says what is left, until it is done and the list comes
 * back. A step that fails leaves the company whole on its old box, or working on its new one, and
 * the page offers to go on, or before the switch to stop. A page opened on a move begun offers
 * the same; one opened on a sweep not finished presses it on to its end.
 */
export function MoveClientPage({ api, passkeys, onSignedOut, wait = sleep }: Props) {
  const { t } = useTranslation();
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const loaded = useLoad(
    () => Promise.all([api.listClients(), api.operatorBoxes()]),
    { onSignedOut },
    [api],
  );
  const client = loaded.data?.[0].find((item) => item.code === code);
  const here = client?.box ?? HOME_BOX;
  const others = (loaded.data?.[1] ?? []).filter((item) => item.name !== here);
  const [picked, setPicked] = useState('');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  /** What the last press answered, while the page presses on. */
  const [reply, setReply] = useState<Exclude<MoveClientReply, { phase: 'done' }> | null>(null);
  /** The switch or a stop was made: from then on the page offers no stop. */
  const [switched, setSwitched] = useState(false);
  const sweepOn = client?.move?.form === 'sweeping';
  const after = switched || sweepOn;

  /** Presses until the move is done; the caller has set the page busy. */
  async function press(first: MoveClientRequest) {
    try {
      for (let request = first; ; request = {}) {
        const answer = await api.moveClient(code, request);
        if (answer.phase === 'done') {
          void navigate('/operator/clients');
          return;
        }
        setReply(answer);
        if (answer.phase !== 'waiting' && answer.phase !== 'copying') setSwitched(true);
        if ('seconds' in answer) await wait(answer.seconds * 1000);
      }
    } catch (error) {
      refusal(error, { onSignedOut });
      setProblem('failed');
    }
    setBusy(false);
  }

  /** A press the operator asked for, after a failure or on a page opened mid-move. */
  function go(first: MoveClientRequest) {
    setBusy(true);
    setProblem(null);
    void press(first);
  }

  async function begin(to: string) {
    setBusy(true);
    setProblem(null);
    try {
      const confirm = await touch(api, passkeys, 'move-client');
      await press({ to, confirm });
    } catch (error) {
      refusal(error, { onSignedOut });
      setProblem(error instanceof PasskeyNotGiven ? 'notGiven' : 'failed');
      setBusy(false);
    }
  }

  /** A sweep not finished is pressed on at once, when the list says so. */
  useEffect(() => {
    if (!sweepOn) return;
    // After the effect, so the page is drawn first and the press sets state from a promise.
    void Promise.resolve().then(() => press({}));
    // `press` is this render's, and only the list's word starts it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sweepOn]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (picked !== '') void begin(picked);
  };

  const back = (
    <Button component={Link} to="/operator/clients" variant="default">
      {t('operator.back')}
    </Button>
  );

  const progress =
    reply === null
      ? null
      : 'seconds' in reply
        ? t('operator.moveWait', { count: reply.seconds })
        : reply.phase === 'copying'
          ? t('operator.moveCopying', { count: reply.left })
          : t('operator.moveSweeping', { count: reply.left });

  return (
    <Loaded status={loaded.status} onRetry={loaded.reload}>
      {!client ? (
        <Stack align="flex-start">
          <Alert color="orange" role="note" w="100%">
            {t('operator.rootUnknown')}
          </Alert>
          {back}
        </Stack>
      ) : (
        <Stack gap="lg">
          <div>
            <Title order={2}>{t('operator.moveTitle', { name: client.name })}</Title>
            <Text c="dimmed">{t('operator.moveHere', { name: client.name, box: here })}</Text>
          </div>
          <Alert color="orange" role="note" title={client.code}>
            {t('operator.moveIntro')}
          </Alert>
          {problem !== null && (
            <Alert color="red" role="alert">
              {problem === 'notGiven'
                ? t('passkey.notGiven')
                : after
                  ? t('operator.moveFailedAfter')
                  : t('operator.moveFailed')}
            </Alert>
          )}
          {progress !== null && (
            <Alert color="orange" role="status">
              {progress}
            </Alert>
          )}
          {client.move?.form === 'copying' && reply === null ? (
            <Stack align="flex-start">
              <Text>{t('operator.moveUnder', { box: client.move.box })}</Text>
              <Group>
                <Button loading={busy} onClick={() => go({})}>
                  {t('operator.moveGoOn')}
                </Button>
                <Button
                  variant="outline"
                  color="red"
                  disabled={busy}
                  onClick={() => go({ stop: true })}
                >
                  {t('operator.moveStop')}
                </Button>
                {back}
              </Group>
            </Stack>
          ) : reply !== null || sweepOn ? (
            problem === 'failed' && (
              <Group>
                <Button loading={busy} onClick={() => go({})}>
                  {t('operator.moveGoOn')}
                </Button>
                {!after && (
                  <Button
                    variant="outline"
                    color="red"
                    disabled={busy}
                    onClick={() => go({ stop: true })}
                  >
                    {t('operator.moveStop')}
                  </Button>
                )}
              </Group>
            )
          ) : others.length === 0 ? (
            <Stack align="flex-start">
              <Text c="dimmed">{t('operator.moveNoBox')}</Text>
              {back}
            </Stack>
          ) : (
            <form onSubmit={submit}>
              <Paper withBorder p="md">
                <Stack gap="lg">
                  <BoxChoice
                    label={t('operator.moveBox')}
                    description={t('operator.moveBoxHint')}
                    boxes={others}
                    value={picked}
                    onChange={setPicked}
                  />
                  <Text size="sm" c="dimmed">
                    {t('operator.moveTouch')}
                  </Text>
                  <Group>
                    <Button type="submit" loading={busy} disabled={picked === ''}>
                      {t('operator.moveMake')}
                    </Button>
                    {back}
                  </Group>
                </Stack>
              </Paper>
            </form>
          )}
        </Stack>
      )}
    </Loaded>
  );
}
