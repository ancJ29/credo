import { type Language, type OwnPasskeyItem, type SessionReply } from '@credo/shared';
import { Stack, Table, Text } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../api';
import { ActionButton } from '../../components/atoms/ActionButton';
import { ActionRow } from '../../components/molecules/ActionRow';
import { FormMessage } from '../../components/molecules/FormMessage';
import { TableScroll } from '../../components/molecules/TableScroll';
import { PageHeader } from '../../components/organisms/PageHeader';
import { Panel } from '../../components/organisms/Panel';
import { dayOf } from '../../day';
import { Loaded } from '../../frame/Loaded';
import { type PageProps, refusal, useLoad } from '../../page';

type Props = PageProps & {
  /** The session that replaces the one held: a removal signs the person's other devices out. */
  onSession: (session: SessionReply) => void;
};

/** The list read, or null where the company has passkeys switched off (a 404). */
type Read = OwnPasskeyItem[] | null;

/** One's own passkeys, for anyone signed in: each one's device, day added and day last used, and a
 * Remove that asks first. A removal ends the person's other sessions and answers the one this
 * device keeps. With none held the page says so and leads to the add; where the company has
 * passkeys switched off it says that, with no list. */
export function OwnPasskeysPage(props: Props) {
  const { api, onSession } = props;
  const { t, i18n } = useTranslation();
  const language = i18n.language as Language;
  const loaded = useLoad<Read>(
    async () => {
      try {
        return await api.ownPasskeys();
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    props,
    [api],
  );
  const [left, setLeft] = useState<OwnPasskeyItem[] | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<'removed' | 'failed' | null>(null);
  const [busy, setBusy] = useState(false);
  const list = left ?? loaded.data ?? [];

  async function remove(id: string) {
    setBusy(true);
    setOutcome(null);
    try {
      const done = await api.ownPasskeyRemove(id);
      setLeft(done.passkeys);
      setAsking(null);
      setOutcome('removed');
      onSession(done.session);
    } catch (error) {
      refusal(error, props);
      setAsking(null);
      setOutcome('failed');
    }
    setBusy(false);
  }

  return (
    <Stack gap="lg" maw={720}>
      <PageHeader title={t('ownPasskeys.title')} />
      <Loaded status={loaded.status} onRetry={loaded.reload}>
        {loaded.data === null ? (
          <FormMessage kind="warning">{t('ownPasskey.off')}</FormMessage>
        ) : (
          <>
            <Text c="dimmed">{t('ownPasskeys.text')}</Text>
            {outcome === 'removed' && (
              <FormMessage kind="success">{t('ownPasskeys.removed')}</FormMessage>
            )}
            {outcome === 'failed' && (
              <FormMessage kind="error">{t('passkey.removeFailed')}</FormMessage>
            )}
            {list.length === 0 ? (
              <Text>{t('ownPasskeys.none')}</Text>
            ) : (
              <TableScroll>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('ownPasskeys.colDevice')}</Table.Th>
                      <Table.Th>{t('passkey.colAdded')}</Table.Th>
                      <Table.Th>{t('passkey.colLastUsed')}</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {list.map((passkey) => {
                      const device = passkey.device ?? t('ownPasskeys.deviceUnknown');
                      return (
                        <Table.Tr key={passkey.id}>
                          <Table.Td>{device}</Table.Td>
                          <Table.Td>{dayOf(passkey.addedAt, language)}</Table.Td>
                          <Table.Td>
                            {passkey.lastUsedAt === null
                              ? t('passkey.never')
                              : dayOf(passkey.lastUsedAt, language)}
                          </Table.Td>
                          <Table.Td ta="right">
                            <ActionButton
                              meaning="other"
                              disabled={busy}
                              label={`${t('ownPasskeys.remove')}: ${device}`}
                              onClick={() => setAsking(passkey.id)}
                            >
                              {t('ownPasskeys.remove')}
                            </ActionButton>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </TableScroll>
            )}
            <ActionRow>
              <ActionButton meaning={list.length === 0 ? 'main' : 'other'} to="/passkey">
                {t('ownPasskey.submit')}
              </ActionButton>
            </ActionRow>
            {asking !== null && (
              <Panel>
                <Stack gap="sm">
                  <Text>{t('ownPasskeys.removeAsk')}</Text>
                  <ActionRow>
                    <ActionButton meaning="main" busy={busy} onClick={() => void remove(asking)}>
                      {t('ownPasskeys.removeConfirm')}
                    </ActionButton>
                    <ActionButton meaning="other" onClick={() => setAsking(null)}>
                      {t('ownPasskeys.removeCancel')}
                    </ActionButton>
                  </ActionRow>
                </Stack>
              </Panel>
            )}
          </>
        )}
      </Loaded>
    </Stack>
  );
}
