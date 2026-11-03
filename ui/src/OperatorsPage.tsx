import type { Language } from '@credo/shared';
import { Badge, Button, Group, Stack, Table, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { Api } from './api';
import { dayOf } from './day';
import { Loaded } from './Loaded';
import { useLoad } from './page';

type Props = { api: Api; onSignedOut: () => void };

/** Everyone who may sign in to the console, the one added last first: their name (the reader marked
 * "you"), whether they are invited or active, who added them and when ("—" once that operator is
 * deleted), how many passkeys they hold and when they last signed in. Each row but the reader's
 * offers a new link and a delete, each its own page. No secret is shown. */
export function OperatorsPage({ api, onSignedOut }: Props) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as Language;
  const loaded = useLoad(() => api.listOperators(), { onSignedOut }, [api]);
  const operators = loaded.data ?? [];

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{t('nav.operators')}</Title>
        <Button component={Link} to="/operator/operators/new">
          {t('team.add')}
        </Button>
      </Group>
      <Text c="dimmed">{t('team.intro')}</Text>
      <Loaded status={loaded.status} onRetry={loaded.reload}>
        <Table.ScrollContainer minWidth={760}>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('team.colName')}</Table.Th>
                <Table.Th>{t('team.colState')}</Table.Th>
                <Table.Th>{t('team.colAddedBy')}</Table.Th>
                <Table.Th>{t('team.colAddedOn')}</Table.Th>
                <Table.Th>{t('team.colPasskeys')}</Table.Th>
                <Table.Th>{t('team.colSignedIn')}</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {operators.map((one) => (
                <Table.Tr key={one.id}>
                  <Table.Td>
                    {one.name}
                    {one.you && (
                      <Badge ml="xs" variant="light">
                        {t('team.you')}
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>{t(one.state === 'active' ? 'team.active' : 'team.invited')}</Table.Td>
                  <Table.Td>
                    {one.addedBy ?? (one.addedByTerminal ? t('team.terminal') : '—')}
                  </Table.Td>
                  <Table.Td>{dayOf(one.addedAt, language)}</Table.Td>
                  <Table.Td>{one.passkeys}</Table.Td>
                  <Table.Td>{dayOf(one.signedInAt, language)}</Table.Td>
                  <Table.Td ta="right">
                    {!one.you && (
                      <Group gap="xs" justify="flex-end" wrap="nowrap">
                        <Button
                          component={Link}
                          to={`/operator/operators/${one.id}/link`}
                          variant="default"
                          size="xs"
                          aria-label={`${t('team.newLink')}: ${one.name}`}
                        >
                          {t('team.newLink')}
                        </Button>
                        <Button
                          component={Link}
                          to={`/operator/operators/${one.id}/delete`}
                          variant="default"
                          size="xs"
                          color="red"
                          aria-label={`${t('team.delete')}: ${one.name}`}
                        >
                          {t('team.delete')}
                        </Button>
                      </Group>
                    )}
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
