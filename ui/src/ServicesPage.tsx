import { type Language } from '@credo/shared';
import {
  Alert,
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Api, ApiError, hopOf, type ServicesCheck } from './api';
import { timeOf } from './day';
import { refusal } from './page';

type Props = {
  api: Api;
  /** The commit this page's own files were built from. */
  build: string;
  onSignedOut: () => void;
};

/** What the last check found: all three answered; the BFF answered and c-storage did not; or the
 * BFF did not answer, so c-storage cannot be seen. Null before the first check ends. */
type Found = { kind: 'ok'; check: ServicesCheck } | { kind: 'storage' } | { kind: 'bff' } | null;

const MINUTE = 60_000;

const STATE = {
  answers: 'services.answers',
  silent: 'services.silent',
  unseen: 'services.unseen',
} as const;

const NAME = {
  app: ['services.app', 'services.appNote'],
  bff: ['services.bff', 'services.bffNote'],
  storage: ['services.storage', 'services.storageNote'],
} as const;

/** For each build, whether it is the odd one out: with two against one, the one; with three
 * different, none can be called odd. */
function outOfStep(builds: string[]) {
  const count = (build: string) => builds.filter((other) => other === build).length;
  const most = Math.max(...builds.map(count));
  return builds.map((build) => count(build) < most);
}

/** The services status: whether the app's page, the BFF and c-storage answer, the build each runs
 * and whether it is one build. It asks on opening, each minute while the page is in view, at once
 * when it is shown again, and on "Check now"; hidden, it asks nothing. */
export function ServicesPage({ api, build, onSignedOut }: Props) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as Language;
  const [found, setFound] = useState<Found>(null);
  const [busy, setBusy] = useState(false);
  const asking = useRef(false);
  const signedOut = useRef(onSignedOut);
  useEffect(() => {
    signedOut.current = onSignedOut;
  });

  /** One check, unless one is still out. */
  const check = useCallback(async () => {
    if (asking.current) return;
    asking.current = true;
    setBusy(true);
    try {
      setFound({ kind: 'ok', check: await api.operatorServices() });
    } catch (error) {
      refusal(error, { onSignedOut: () => signedOut.current() });
      // A sign-in that ended is the prompt's to answer; the page keeps what it found.
      if (!(error instanceof ApiError && error.status === 401)) setFound({ kind: hopOf(error) });
    }
    asking.current = false;
    setBusy(false);
  }, [api]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => clearInterval(timer);
    const start = () => {
      stop();
      void check();
      timer = setInterval(() => void check(), MINUTE);
    };
    const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop());
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [check]);

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{t('nav.services')}</Title>
        <Button
          variant="default"
          loading={busy}
          leftSection={<IconRefresh size={18} />}
          onClick={() => void check()}
        >
          {t('services.checkNow')}
        </Button>
      </Group>
      <Text c="dimmed">{t('services.intro')}</Text>
      {found === null ? (
        <Center mih={240}>
          <Loader aria-label={t('common.loading')} />
        </Center>
      ) : (
        <Report found={found} build={build} language={language} />
      )}
    </Stack>
  );
}

/** A build as the screens show it: a commit's first seven characters. The comparison reads the full values. */
const shortBuild = (build: string) => build.slice(0, 7);

/** What a check found, said: the verdict, each service with its state, build and time, and when. */
function Report({
  found,
  build,
  language,
}: {
  found: NonNullable<Found>;
  build: string;
  language: Language;
}) {
  const { t } = useTranslation();
  const ok = found.kind === 'ok' ? found.check : null;
  const builds = ok ? [build, ok.build, ok.storage.build] : [];
  const odd = ok ? outOfStep(builds) : [false, false, false];
  const oneBuild = new Set(builds).size === 1;
  const rows = [
    { id: 'app', state: 'answers', build, ms: null, odd: odd[0] },
    {
      id: 'bff',
      state: found.kind === 'bff' ? 'silent' : 'answers',
      build: ok?.build ?? '—',
      ms: ok?.bffMs ?? null,
      odd: odd[1],
    },
    {
      id: 'storage',
      state: found.kind === 'ok' ? 'answers' : found.kind === 'storage' ? 'silent' : 'unseen',
      build: ok?.storage.build ?? '—',
      ms: ok?.storage.ms ?? null,
      odd: odd[2],
    },
  ] as const;
  return (
    <>
      {ok ? (
        <Alert color={oneBuild ? 'green' : 'yellow'} role="status">
          {t(oneBuild ? 'services.oneBuild' : 'services.twoBuilds')}
        </Alert>
      ) : (
        <Alert color="red" role="alert">
          {t(found.kind === 'storage' ? 'services.storageDown' : 'services.bffDown')}
        </Alert>
      )}
      <Stack gap="sm">
        {rows.map((row) => (
          <Paper key={row.id} withBorder p="md" radius="md" aria-label={t(NAME[row.id][0])}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Stack gap={2}>
                <Text fw={600}>{t(NAME[row.id][0])}</Text>
                <Text c="dimmed" size="sm">
                  {t(NAME[row.id][1])}
                </Text>
              </Stack>
              <Badge
                color={row.state === 'answers' ? 'green' : row.state === 'silent' ? 'red' : 'gray'}
                variant="light"
              >
                {t(STATE[row.state])}
              </Badge>
            </Group>
            <Group gap="md" mt="sm">
              <Text size="sm">
                {t('services.build')}: <code>{shortBuild(row.build)}</code>
              </Text>
              {row.odd && (
                <Badge color="yellow" variant="light">
                  {t('services.differs')}
                </Badge>
              )}
              {row.ms !== null && <Text size="sm">{t('services.time', { ms: row.ms })}</Text>}
            </Group>
          </Paper>
        ))}
      </Stack>
      {ok && (
        <Text c="dimmed" size="sm">
          {t('services.checkedAt', { time: timeOf(ok.checkedAt, language) })}
        </Text>
      )}
    </>
  );
}
