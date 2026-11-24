import { HOME_BOX, type MoveClientReply, type MoveClientRequest } from '@credo/shared';
import { Paper, Stack, Text } from '@mantine/core';
import { ActionRow } from '../../components/molecules/ActionRow';
import { type SubmitEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { type Api } from '../../api';
import { Loaded } from '../../frame/Loaded';
import { refusal, useLoad } from '../../page';
import { PasskeyNotGiven, type Passkeys } from '../../passkeys';
import { BoxChoice } from '../../parts/BoxChoice';
import { touch } from '../../touch';
import { TYPE } from '../../design-system/tokens';
import { FormMessage } from '../../components/molecules/FormMessage';
import { PageState } from '../../components/organisms/PageState';
import { ActionButton } from '../../components/atoms/ActionButton';
import { PageHeader } from '../../components/organisms/PageHeader';

type Props = {
  api: Api;
  passkeys: Passkeys;
  onSignedOut: () => void;
  /** How the page waits the seconds an answer names; the clock unless a test hands another. */
  wait?: (ms: number) => Promise<void>;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Problem = 'notGiven' | 'failed' | 'refused';

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
  /** How the copy ended, by the answer that said so: from then on the page offers no stop. */
  const [ended, setEnded] = useState<'switched' | 'stopped' | null>(null);
  const sweepOn = client?.move?.form === 'sweeping';
  const after = ended !== null || sweepOn;
  /** The box the copy goes to: the one picked, or the one a move found on the list carries. */
  const target = picked !== '' ? picked : client?.move?.form === 'copying' ? client.move.box : '';
  /** The box the company works on and the box being cleared, from the list for a sweep it carries
   * (the line's box is where the company works, the mark's the box to clear), else from how this
   * page's copy ended: a switch works on the new box, a stop on the old one. */
  const boxes =
    client?.move?.form === 'sweeping'
      ? { works: here, clearing: client.move.box }
      : ended === 'stopped'
        ? { works: here, clearing: target }
        : { works: target, clearing: here };

  /** Presses until the move is done; the caller has set the page busy. */
  async function press(first: MoveClientRequest) {
    let began = 'to' in first;
    try {
      for (let request = first; ; request = {}) {
        const answer = await api.moveClient(code, request);
        began = false;
        if (answer.phase === 'done') {
          void navigate('/operator/clients');
          return;
        }
        setReply(answer);
        if (answer.phase === 'switched' || answer.phase === 'stopped') setEnded(answer.phase);
        if ('seconds' in answer) await wait(answer.seconds * 1000);
      }
    } catch (error) {
      refusal(error, { onSignedOut });
      // A beginning that failed has no move this page knows to go on with or to stop.
      setProblem(began ? 'refused' : 'failed');
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
      setProblem(error instanceof PasskeyNotGiven ? 'notGiven' : 'refused');
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

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (picked !== '') void begin(picked);
  };

  const back = (
    <ActionButton meaning="other" to="/operator/clients">
      {t('operator.back')}
    </ActionButton>
  );

  const progress =
    reply === null
      ? null
      : reply.phase === 'waiting'
        ? t('operator.moveWait', { count: reply.seconds })
        : reply.phase === 'switched'
          ? t('operator.moveSwitched', { ...boxes, count: reply.seconds })
          : reply.phase === 'stopped'
            ? t('operator.moveStopped', { ...boxes, count: reply.seconds })
            : reply.phase === 'copying'
              ? t('operator.moveCopying')
              : t('operator.moveSweeping', { clearing: boxes.clearing, count: reply.left });

  return (
    <Loaded status={loaded.status} onRetry={loaded.reload}>
      {!client ? (
        <Stack align="flex-start" gap="lg">
          <PageState state="notFound">{t('operator.rootUnknown')}</PageState>
          {back}
        </Stack>
      ) : (
        <Stack gap="lg">
          <div>
            <PageHeader title={t('operator.moveTitle', { name: client.name })} />
            <Text c="dimmed">{t('operator.moveHere', { name: client.name, box: here })}</Text>
          </div>
          <FormMessage kind="warning" standing title={client.code}>
            {t('operator.moveIntro')}
          </FormMessage>
          {problem !== null && (
            <FormMessage kind="error">
              {problem === 'notGiven'
                ? t('passkey.notGiven')
                : problem === 'refused'
                  ? t('operator.moveRefused')
                  : after
                    ? t('operator.moveFailedAfter', boxes)
                    : t('operator.moveFailed')}
            </FormMessage>
          )}
          {progress !== null && <FormMessage kind="info">{progress}</FormMessage>}
          {client.move?.form === 'copying' && reply === null ? (
            <Stack align="flex-start">
              <Text>{t('operator.moveUnder', { box: client.move.box })}</Text>
              <ActionRow>
                <ActionButton meaning="main" busy={busy} onClick={() => go({})}>
                  {t('operator.moveGoOn')}
                </ActionButton>
                <ActionButton meaning="other" disabled={busy} onClick={() => go({ stop: true })}>
                  {t('operator.moveStop')}
                </ActionButton>
                {back}
              </ActionRow>
            </Stack>
          ) : reply !== null || sweepOn ? (
            problem === 'failed' && (
              <ActionRow>
                <ActionButton meaning="main" busy={busy} onClick={() => go({})}>
                  {t('operator.moveGoOn')}
                </ActionButton>
                {!after && (
                  <ActionButton meaning="other" disabled={busy} onClick={() => go({ stop: true })}>
                    {t('operator.moveStop')}
                  </ActionButton>
                )}
              </ActionRow>
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
                  <Text {...TYPE.caption}>{t('operator.moveTouch')}</Text>
                  <ActionRow>
                    <ActionButton meaning="main" submit busy={busy} disabled={picked === ''}>
                      {t('operator.moveMake')}
                    </ActionButton>
                    {back}
                  </ActionRow>
                </Stack>
              </Paper>
            </form>
          )}
        </Stack>
      )}
    </Loaded>
  );
}
