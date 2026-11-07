import { type JoinOptionsReply, type Language, tokenOfFragment } from '@credo/shared';
import { Alert, Button, Center, Loader, Stack, Text } from '@mantine/core';
import { IconFingerprint } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { type Api, ApiError } from './api';
import { CREDO_BRAND } from './brand';
import type { DeviceStore } from './device';
import { PasskeyNotGiven, type Passkeys } from './passkeys';
import { SignInFrame } from './SignIn';
import { BRAND_GRADIENT } from './theme';

type Props = {
  api: Api;
  device: DeviceStore;
  passkeys: Passkeys;
  languages: readonly Language[];
  onLanguage: (language: Language) => void;
};

type Seen =
  | { phase: 'loading' | 'dead' | 'unavailable' }
  | { phase: 'ready'; link: string; opened: JoinOptionsReply };

/** Where the operator goes once joined: the dashboard, signed in. */
const AFTER = '/operator/clients';

/**
 * The page a join link opens: whose link it is and who made it, and one button that makes the
 * operator's first passkey and signs them in. The link's token is in the address's fragment, read
 * here and sent only in a request's body. A link that cannot be used says so in one sentence, since
 * which reason it is helps no one but the person who forwarded it.
 */
export function JoinPage({ api, device, passkeys, languages, onLanguage }: Props) {
  const { t } = useTranslation();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const link = tokenOfFragment(hash);
  const [seen, setSeen] = useState<Seen>({ phase: link ? 'loading' : 'dead' });
  const [status, setStatus] = useState<'idle' | 'busy' | 'notGiven' | 'failed'>('idle');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!link) return;
    let live = true;
    api.operatorJoinOptions(link).then(
      (opened) => live && setSeen({ phase: 'ready', link, opened }),
      (error: unknown) =>
        live &&
        setSeen({
          phase: error instanceof ApiError && error.status === 404 ? 'dead' : 'unavailable',
        }),
    );
    return () => {
      live = false;
    };
  }, [api, link, attempt]);

  async function make(token: string) {
    setStatus('busy');
    try {
      // The challenge is asked for afresh, so a page left open for a while still joins.
      const { options, token: challenge } = await api.operatorJoinOptions(token);
      const response = await passkeys.register(options);
      const session = await api.operatorJoin({ link: token, token: challenge, response });
      device.setOperatorAuthId(session.authId);
      void navigate(AFTER);
    } catch (error) {
      if (error instanceof PasskeyNotGiven) return setStatus('notGiven');
      if (error instanceof ApiError && error.status === 404) {
        return setSeen({ phase: 'dead' });
      }
      setStatus('failed');
    }
  }

  return (
    <SignInFrame
      brand={CREDO_BRAND}
      title={t('passkey.joinTitle')}
      languages={languages}
      onLanguage={onLanguage}
    >
      {seen.phase === 'loading' && (
        <Center mih={120}>
          <Loader aria-label={t('common.loading')} />
        </Center>
      )}
      {seen.phase === 'dead' && (
        <Alert color="red" role="alert">
          {t('passkey.dead')}
        </Alert>
      )}
      {seen.phase === 'unavailable' && (
        <Stack>
          <Alert color="red" role="alert">
            {t('common.unavailable')}
          </Alert>
          <Button
            onClick={() => {
              setSeen({ phase: 'loading' });
              setAttempt((n) => n + 1);
            }}
          >
            {t('common.retry')}
          </Button>
        </Stack>
      )}
      {seen.phase === 'ready' && (
        <Stack gap="lg">
          <Stack gap={4}>
            <Text fw={600}>{t('passkey.joinFor', { name: seen.opened.name })}</Text>
            <Text c="dimmed">
              {seen.opened.madeBy !== null
                ? t('passkey.joinMadeBy', { name: seen.opened.madeBy })
                : seen.opened.madeByTerminal
                  ? t('passkey.joinMadeByTerminal')
                  : t('passkey.joinMadeByNone')}
            </Text>
          </Stack>
          {status === 'notGiven' && (
            <Alert color="red" role="alert">
              {t('passkey.notGiven')}
            </Alert>
          )}
          {status === 'failed' && (
            <Alert color="red" role="alert">
              {t('common.unavailable')}
            </Alert>
          )}
          <Text c="dimmed">{t('passkey.joinHint')}</Text>
          <Button
            fullWidth
            size="md"
            loading={status === 'busy'}
            leftSection={<IconFingerprint size={20} />}
            style={{ background: BRAND_GRADIENT }}
            onClick={() => void make(seen.link)}
          >
            {t('passkey.makeButton')}
          </Button>
        </Stack>
      )}
    </SignInFrame>
  );
}
