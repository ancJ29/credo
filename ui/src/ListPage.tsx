import { type Language } from '@credo/shared';
import { Button, Group, Stack, Table, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Loaded } from './Loaded';
import { headingOf, LISTS, type ListKind } from './listSheet';
import { type PageProps, useLoad } from './page';

/**
 * The company's customers or products as the BFF lists them, in code order, with the root's way to
 * import more from Excel. The root alone has these pages, and the BFF checks the same on every
 * call. A price is shown as the language writes a number.
 */
export function ListPage({ kind, ...page }: PageProps & { kind: ListKind }) {
  const { api } = page;
  const { t, i18n } = useTranslation();
  const language = i18n.language as Language;
  const list = LISTS[kind];
  const loaded = useLoad(() => list.load(api, language), page, [api, kind, language]);
  const rows = loaded.data ?? [];

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{t(`nav.${kind}`)}</Title>
        <Button component={Link} to={`/${kind}/import`} variant="default">
          {t('lists.import')}
        </Button>
      </Group>
      <Loaded status={loaded.status} onRetry={loaded.reload}>
        {rows.length === 0 ? (
          <Text c="dimmed">{t(`lists.${kind}.empty`)}</Text>
        ) : (
          <Table.ScrollContainer minWidth={640}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  {list.shown.map((key) => (
                    <Table.Th key={key} ta={key === 'price' ? 'right' : undefined}>
                      {headingOf(key, language)}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row) => (
                  <Table.Tr key={row.code}>
                    {list.shown.map((key) => (
                      <Table.Td key={key} ta={key === 'price' ? 'right' : undefined}>
                        {row[key]}
                      </Table.Td>
                    ))}
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
