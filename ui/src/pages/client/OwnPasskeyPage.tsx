import { Stack, Text } from '@mantine/core';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OptionsReply } from '@credo/shared';
import { ApiError } from '../../api';
import { ActionButton } from '../../components/atoms/ActionButton';
import { ActionRow } from '../../components/molecules/ActionRow';
import { FormMessage } from '../../components/molecules/FormMessage';
import { PageHeader } from '../../components/organisms/PageHeader';
import { Loaded } from '../../frame/Loaded';
import { type PageProps, refusal, useLoad } from '../../page';
import { PasskeyAlreadyHere, PasskeyNotGiven, type Passkeys } from '../../passkeys';

/** How long the page keeps the options it asked on opening: a challenge lives five minutes at the
 * BFF, so options older than four are asked again inside the press. */
const OPTIONS_LIFE = 4 * 60_000;

const FAILURE_WORDS = {
  notGiven: 'passkey.notGiven',
  alreadyHere: 'passkey.alreadyHere',
  tooOld: 'ownPasskey.tooOld',
  failed: 'passkey.addFailed',
} as const;

type Props = PageProps & {
  /** The device's passkeys: the browser's, or the fake that answers as one would. */
  passkeys: Passkeys;
};

/** The options the page asked as it opened, with the time they were asked. */
type Held = { reply: OptionsReply; at: number };

/** One's own passkey, for anyone signed in: what a passkey is and that the password stays, and one
 * button that makes it on this device. The options are asked as the page opens and one ceremony
 * runs a press, so the touch still counts as the press's own. Where the company has passkeys
 * switched off the options come as a 404, and the page says so, with no button. */
export function OwnPasskeyPage({ api, passkeys, onSignedOut }: Props) {
  const { t } = useTranslation();
  const loaded = useLoad<Held | null>(
    async () => {
      try {
        return { reply: await api.ownPasskeyOptions(), at: Date.now() };
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    { onSignedOut },
    [api],
  );

  return (
    <Stack gap="md" maw={560}>
      <PageHeader title={t('ownPasskey.title')} />
      <Loaded status={loaded.status} onRetry={loaded.reload}>
        {loaded.data ? (
          <Adder api={api} passkeys={passkeys} onSignedOut={onSignedOut} first={loaded.data} />
        ) : (
          <FormMessage kind="warning">{t('ownPasskey.off')}</FormMessage>
        )}
      </Loaded>
    </Stack>
  );
}

function Adder({
  api,
  passkeys,
  onSignedOut,
  first,
}: Pick<Props, 'api' | 'passkeys' | 'onSignedOut'> & { first: Held }) {
  const { t } = useTranslation();
  const [outcome, setOutcome] = useState<'added' | keyof typeof FAILURE_WORDS | null>(null);
  const [busy, setBusy] = useState(false);
  /** Set when the options may be spent (a try that reached the BFF failed): the next press asks again. */
  const spent = useRef(false);

  async function add() {
    setBusy(true);
    setOutcome(null);
    try {
      let { reply, at } = first;
      if (spent.current || Date.now() - at > OPTIONS_LIFE) {
        reply = await api.ownPasskeyOptions();
        at = Date.now();
        spent.current = false;
      }
      const response = await passkeys.register(reply.options);
      spent.current = true;
      await api.ownPasskeyAdd({ token: reply.token, response });
      setOutcome('added');
    } catch (error) {
      const kind = refusal(error, { onSignedOut });
      if (error instanceof PasskeyNotGiven) setOutcome('notGiven');
      else if (error instanceof PasskeyAlreadyHere) setOutcome('alreadyHere');
      else setOutcome(kind === 'forbidden' ? 'tooOld' : 'failed');
    }
    setBusy(false);
  }

  return outcome === 'added' ? (
    <>
      <FormMessage kind="success">{t('ownPasskey.added')}</FormMessage>
      <Text>{t('ownPasskey.addedText')}</Text>
    </>
  ) : (
    <>
      <Text c="dimmed">{t('ownPasskey.text')}</Text>
      {outcome !== null && <FormMessage kind="error">{t(FAILURE_WORDS[outcome])}</FormMessage>}
      <ActionRow>
        <ActionButton meaning="main" busy={busy} onClick={() => void add()}>
          {t('ownPasskey.submit')}
        </ActionButton>
      </ActionRow>
    </>
  );
}
