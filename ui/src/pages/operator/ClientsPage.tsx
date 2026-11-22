import { clientAddress, HOME_BOX, type Language } from '@credo/shared';
import { Group, Stack, Table } from '@mantine/core';
import { TableScroll } from '../../components/molecules/TableScroll';
import { PageState } from '../../components/organisms/PageState';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Api } from '../../api';
import { CopyText } from '../../components/molecules/CopyText';
import { dayOf } from '../../day';
import { Loaded } from '../../frame/Loaded';
import { useLoad } from '../../page';
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
