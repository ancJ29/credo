import { clientAddress, HOME_BOX, type Language, type WaitingSignUp } from '@credo/shared';
import { Group, Stack, Table, Text, Title } from '@mantine/core';
import { TableScroll } from '../../components/molecules/TableScroll';
import { PageState } from '../../components/organisms/PageState';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Api } from '../../api';
import { CopyText } from '../../components/molecules/CopyText';
import { dayOf } from '../../day';
import { Loaded } from '../../frame/Loaded';
import { refusal, useLoad } from '../../page';
import { DataTable } from '../../components/molecules/DataTable';
import { ActionRow } from '../../components/molecules/ActionRow';
import { FormMessage } from '../../components/molecules/FormMessage';
import { Panel } from '../../components/organisms/Panel';
import { ActionButton } from '../../components/atoms/ActionButton';
import { PageHeader } from '../../components/organisms/PageHeader';

type Props = { api: Api; onSignedOut: () => void };

/** The clients on this stack, newest first as the BFF answers: the name as the operator gave it,
 * the code, the day it was made and a button that copies the client's sign-in link. */
export function ClientsPage({ api, onSignedOut }: Props) {
  const { t, i18n } = useTranslation();
  const loaded = useLoad(() => api.listClients(), { onSignedOut }, [api]);
  const clients = loaded.data ?? [];
  const [boxes, setBoxes] = useState(0);
  const [waiting, setWaiting] = useState<WaitingSignUp[]>([]);
  /** The waiting company a refusal is asked of, and what the last act said. */
  const [asking, setAsking] = useState<string | null>(null);
  const [said, setSaid] = useState<
    { kind: 'approved'; name: string } | { kind: 'taken' | 'failed' | 'unavailable' } | null
  >(null);

  /** The companies waiting for approval, above the list. A list that does not come shows none, and
   * the companies still show. */
  useEffect(() => {
    void (async () => {
      try {
        setWaiting(await api.listSignUps());
      } catch {
        // no list, no block
      }
    })();
  }, [api]);

  async function approve(one: WaitingSignUp) {
    setSaid(null);
    setAsking(null);
    try {
      const result = await api.approveSignUp(one.code);
      if (result.kind === 'taken') return setSaid({ kind: 'taken' });
      setWaiting((was) => was.filter((other) => other.code !== one.code));
      setSaid({ kind: 'approved', name: one.name });
      loaded.reload();
    } catch (error) {
      refusal(error, { onSignedOut });
      setSaid({ kind: 'failed' });
    }
  }

  async function refuse(one: WaitingSignUp) {
    setSaid(null);
    try {
      await api.refuseSignUp(one.code);
      setWaiting((was) => was.filter((other) => other.code !== one.code));
    } catch (error) {
      refusal(error, { onSignedOut });
      setSaid({ kind: 'unavailable' });
    }
    setAsking(null);
  }

  /** A move is offered only where the back end holds more than one box. A list that does not come
   * offers none. */
  useEffect(() => {
    void (async () => {
      try {
        setBoxes((await api.operatorBoxes()).length);
      } catch {
        // no list, no move
      }
    })();
  }, [api]);

  return (
    <Stack gap="lg">
      <PageHeader
        title={t('nav.clients')}
        actions={
          <ActionButton meaning="main" to="/operator/clients/new">
            {t('operator.add')}
          </ActionButton>
        }
      />
      {said?.kind === 'approved' && (
        <FormMessage kind="success">{t('operator.approved', { name: said.name })}</FormMessage>
      )}
      {said?.kind === 'taken' && <FormMessage kind="error">{t('operator.taken')}</FormMessage>}
      {said?.kind === 'failed' && (
        <FormMessage kind="error">{t('operator.approveFailed')}</FormMessage>
      )}
      {said?.kind === 'unavailable' && (
        <FormMessage kind="error">{t('common.unavailable')}</FormMessage>
      )}
      {loaded.status === 'ready' && waiting.length > 0 && (
        <Stack gap="sm">
          <Title order={3}>{t('operator.waitingTitle')}</Title>
          <DataTable
            columns={[
              { heading: t('operator.colName') },
              { heading: t('operator.colCode') },
              { heading: t('operator.colContact') },
              { heading: t('operator.colAsked') },
              { heading: '' },
            ]}
            rows={waiting.map((one) => ({
              key: one.code,
              cells: [
                one.name,
                one.code,
                `${one.contactName} · ${one.contactPhone}`,
                dayOf(one.sentAt, i18n.language as Language),
                <ActionRow>
                  <ActionButton
                    meaning="other"
                    label={`${t('operator.approve')}: ${one.name}`}
                    onClick={() => void approve(one)}
                  >
                    {t('operator.approve')}
                  </ActionButton>
                  <ActionButton
                    meaning="quiet"
                    label={`${t('operator.refuse')}: ${one.name}`}
                    onClick={() => setAsking(one.code)}
                  >
                    {t('operator.refuse')}
                  </ActionButton>
                </ActionRow>,
              ],
            }))}
          />
          {waiting
            .filter((one) => one.code === asking)
            .map((one) => (
              <Panel key={one.code}>
                <Stack gap="sm">
                  <Text>{t('operator.refuseAsk', { name: one.name })}</Text>
                  <ActionRow>
                    <ActionButton meaning="other" onClick={() => void refuse(one)}>
                      {t('operator.refuseConfirm')}
                    </ActionButton>
                    <ActionButton meaning="quiet" onClick={() => setAsking(null)}>
                      {t('operator.refuseCancel')}
                    </ActionButton>
                  </ActionRow>
                </Stack>
              </Panel>
            ))}
        </Stack>
      )}
      <Loaded status={loaded.status} onRetry={loaded.reload}>
        {clients.length === 0 ? (
          <PageState state="empty">{t('operator.empty')}</PageState>
        ) : (
          <TableScroll>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('operator.colName')}</Table.Th>
                  <Table.Th>{t('operator.colCode')}</Table.Th>
                  <Table.Th>{t('operator.colBox')}</Table.Th>
                  <Table.Th>{t('operator.colMade')}</Table.Th>
                  <Table.Th>{t('operator.colLink')}</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {clients.map((client) => (
                  <Table.Tr key={client.code}>
                    <Table.Td>{client.name}</Table.Td>
                    <Table.Td>{client.code}</Table.Td>
                    <Table.Td>{client.box ?? HOME_BOX}</Table.Td>
                    <Table.Td>{dayOf(client.madeAt, i18n.language as Language)}</Table.Td>
                    <Table.Td>
                      <CopyText
                        value={clientAddress(window.location.origin, client.code)}
                        label={t('operator.copyLink')}
                        about={client.code}
                      />
                    </Table.Td>
                    <Table.Td ta="right">
                      <Group gap="xs" justify="flex-end" wrap="nowrap">
                        <ActionButton
                          meaning="other"
                          to={`/operator/clients/${client.code}/root-password`}
                          label={`${t('operator.rootPassword')}: ${client.code}`}
                        >
                          {t('operator.rootPassword')}
                        </ActionButton>
                        {boxes > 1 && (
                          <ActionButton
                            meaning="other"
                            to={`/operator/clients/${client.code}/move`}
                            label={`${t('operator.moveClient')}: ${client.code}`}
                          >
                            {t('operator.moveClient')}
                          </ActionButton>
                        )}
                        <ActionButton
                          meaning="other"
                          to={`/operator/clients/${client.code}/delete`}
                          label={`${t('operator.deleteClient')}: ${client.code}`}
                        >
                          {t('operator.deleteClient')}
                        </ActionButton>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </TableScroll>
        )}
      </Loaded>
    </Stack>
  );
}
