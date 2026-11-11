import { type Language, type PasskeyItem } from '@credo/shared';
import { Alert, Button, Group, Stack, Table, Text, Title } from '@mantine/core';
import { IconFingerprint } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Api } from '../../api';
import { dayOf } from '../../day';
import { Loaded } from '../../frame/Loaded';
import { PasskeyAlreadyHere, PasskeyNotGiven, type Passkeys } from '../../passkeys';
import { refusal, useLoad } from '../../page';
import { touch } from '../../touch';

type Props = { api: Api; passkeys: Passkeys; onSignedOut: () => void };

type Notice = 'notGiven' | 'alreadyHere' | 'addFailed' | 'removeFailed' | 'lastOne' | null;

const NOTICE = {
  notGiven: 'passkey.notGiven',
  alreadyHere: 'passkey.alreadyHere',
  addFailed: 'passkey.addFailed',
  removeFailed: 'passkey.removeFailed',
  lastOne: 'passkey.lastOne',
} as const;

/** The signed-in operator's own passkeys: when each was added and last used, one more made on
 * this device, and each removable but the last. No secret is shown, and none is named: the days
 * tell them apart. */
export function PasskeysPage({ api, passkeys, onSignedOut }: Props) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as Language;
  const loaded = useLoad(() => api.operatorPasskeys(), { onSignedOut }, [api]);
  const [changed, setChanged] = useState<PasskeyItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const list = changed ?? loaded.data ?? [];

  async function add() {
    setBusy(true);
    setNotice(null);
    try {
      const confirm = await touch(api, passkeys, 'add');
      const { options, token } = await api.operatorPasskeyAddOptions();
      const response = await passkeys.register(options);
      setChanged(await api.operatorPasskeyAdd({ token, response, confirm }));
    } catch (error) {
      refusal(error, { onSignedOut });
      if (error instanceof PasskeyNotGiven) setNotice('notGiven');
      else if (error instanceof PasskeyAlreadyHere) setNotice('alreadyHere');
      else setNotice('addFailed');
    }
    setBusy(false);
  }

  async function remove(id: string) {
    setBusy(true);
    setNotice(null);
    try {
      const result = await api.operatorPasskeyRemove(id, await touch(api, passkeys, 'remove'));
      if (result.kind === 'removed') setChanged(result.passkeys);
      else setNotice('lastOne');
    } catch (error) {
      refusal(error, { onSignedOut });
      setNotice(error instanceof PasskeyNotGiven ? 'notGiven' : 'removeFailed');
    }
    setBusy(false);
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{t('passkey.title')}</Title>
        <Button
          loading={busy}
          leftSection={<IconFingerprint size={18} />}
          onClick={() => void add()}
        >
          {t('passkey.add')}
        </Button>
      </Group>
      <Text c="dimmed">{t('passkey.intro')}</Text>
      {notice && (
        <Alert color="red" role="alert">
          {t(NOTICE[notice])}
        </Alert>
      )}
      <Loaded status={loaded.status} onRetry={loaded.reload}>
        <Table.ScrollContainer minWidth={480}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('passkey.colAdded')}</Table.Th>
                <Table.Th>{t('passkey.colLastUsed')}</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {list.map((passkey) => (
                <Table.Tr key={passkey.id}>
                  <Table.Td>{dayOf(passkey.addedAt, language)}</Table.Td>
                  <Table.Td>
                    {passkey.lastUsedAt === null
                      ? t('passkey.never')
                      : dayOf(passkey.lastUsedAt, language)}
                  </Table.Td>
                  <Table.Td ta="right">
                    <Button
                      variant="default"
                      size="xs"
                      disabled={busy}
                      aria-label={`${t('passkey.remove')}: ${dayOf(passkey.addedAt, language)}`}
                      onClick={() => void remove(passkey.id)}
                    >
                      {t('passkey.remove')}
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Loaded>
    </Stack>
  );
}
