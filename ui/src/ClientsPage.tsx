import type { Language } from '@credo/shared';
import { Button, Group, Stack, Table, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { Api } from './api';
import { CopyText } from './CopyText';
import { dayOf } from './day';
import { Loaded } from './Loaded';
import { useLoad } from './page';

type Props = { api: Api; onSignedOut: () => void };

/** The clients on this stack, newest first as the BFF answers: the name as the operator gave it,
 * the code, the day it was made and a button that copies the client's sign-in link. */
export function ClientsPage({ api, onSignedOut }: Props) {
  const { t, i18n } = useTranslation();
  const loaded = useLoad(() => api.listClients(), { onSignedOut }, [api]);
  const clients = loaded.data ?? [];

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{t('nav.clients')}</Title>
        <Button component={Link} to="/operator/clients/new">
          {t('operator.add')}
        </Button>
      </Group>
      <Loaded status={loaded.status} onRetry={loaded.reload}>
        {clients.length === 0 ? (
          <Text c="dimmed">{t('operator.empty')}</Text>
        ) : (
          <Table.ScrollContainer minWidth={640}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('operator.colName')}</Table.Th>
                  <Table.Th>{t('operator.colCode')}</Table.Th>
                  <Table.Th>{t('operator.colMade')}</Table.Th>
                  <Table.Th>{t('operator.colLink')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {clients.map((client) => (
                  <Table.Tr key={client.code}>
                    <Table.Td>{client.name}</Table.Td>
                    <Table.Td>{client.code}</Table.Td>
                    <Table.Td>{dayOf(client.madeAt, i18n.language as Language)}</Table.Td>
                    <Table.Td>
                      <CopyText
                        value={`${window.location.origin}${client.link}`}
                        label={t('operator.copyLink')}
                        about={client.code}
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Loaded>
    </Stack>
  );
}
