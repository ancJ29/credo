import { addDays, can, type Language, ORDER_LIST_DAYS, type Order } from '@credo/shared';
import { Anchor, Button, Group, Stack, Table, Text, Title } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { shownDay } from './day';
import { Loaded } from './Loaded';
import { StateBadge, useMoney } from './OrderParts';
import { type PageProps, useLoad } from './page';

/** The last `weeks` weeks of orders ending today, newest first: each week is one call, since the
 * BFF answers at most seven days. */
async function readWeeks(page: PageProps, weeks: number) {
  const today = page.today();
  const calls = Array.from({ length: weeks }, (_, week) => {
    const to = addDays(today, -week * ORDER_LIST_DAYS);
    return page.api.listOrders(addDays(to, 1 - ORDER_LIST_DAYS), to);
  });
  return (await Promise.all(calls)).flat();
}

/** The orders of the last 7 days, newest first, each with its number, day, customer, total, state
 * and the driver of the one sent; the 7 days before are one click away. */
export function OrdersPage(page: PageProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as Language;
  const money = useMoney();
  const [weeks, setWeeks] = useState(1);
  const loaded = useLoad(() => readWeeks(page, weeks), page, [page.api, weeks]);
  const rows: Order[] = loaded.data ?? [];
  const from = addDays(page.today(), 1 - weeks * ORDER_LIST_DAYS);

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{t('nav.orders')}</Title>
        {can(page.user, 'orders.canEdit') && (
          <Button component={Link} to="/orders/new">
            {t('orders.new')}
          </Button>
        )}
      </Group>
      <Text c="dimmed">{t('orders.since', { day: shownDay(from, language) })}</Text>
      <Loaded status={loaded.status} onRetry={loaded.reload}>
        {rows.length === 0 ? (
          <Text c="dimmed">{t('orders.empty')}</Text>
        ) : (
          <Table.ScrollContainer minWidth={720}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('orders.number')}</Table.Th>
                  <Table.Th>{t('orders.day')}</Table.Th>
                  <Table.Th>{t('orders.customer')}</Table.Th>
                  <Table.Th ta="right">{t('orders.total')}</Table.Th>
                  <Table.Th>{t('orders.stateHeading')}</Table.Th>
                  <Table.Th>{t('orders.driver')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((order) => (
                  <Table.Tr key={order.id}>
                    <Table.Td>
                      <Anchor component={Link} to={`/orders/${order.day}/${order.id}`}>
                        {order.number}
                      </Anchor>
                    </Table.Td>
                    <Table.Td>{shownDay(order.day, language)}</Table.Td>
                    <Table.Td>{order.customer.name}</Table.Td>
                    <Table.Td ta="right">{money(order.total)}</Table.Td>
                    <Table.Td>
                      <StateBadge state={order.state} />
                    </Table.Td>
                    <Table.Td>{order.request?.driver.name ?? ''}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Loaded>
      <Group>
        <Button variant="default" onClick={() => setWeeks(weeks + 1)}>
          {t('orders.earlier')}
        </Button>
      </Group>
    </Stack>
  );
}
