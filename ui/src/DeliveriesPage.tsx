import { daySchema, type DeliveryRequest, driverDay } from '@credo/shared';
import { Anchor, Button, Group, Paper, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { Loaded } from './Loaded';
import { StateBadge, useMoney } from './OrderParts';
import { type PageProps, useLoad } from './page';
import { useGapText } from './ReconcileParts';

const addressOf = (request: DeliveryRequest) => {
  const address = request.customer.extra['address'];
  return typeof address === 'string' ? address : '';
};

/** The delivery requests of one day, today unless another is picked, one group for each driver,
 * each request with its number, customer, address, order number, total and state; the office opens
 * one to read it. */
export function DeliveriesPage(page: PageProps) {
  const { t } = useTranslation();
  const money = useMoney();
  const [params, setParams] = useSearchParams();
  const asked = daySchema.safeParse(params.get('day'));
  const day = asked.success ? asked.data : page.today();
  const gapText = useGapText();
  const loaded = useLoad(
    () => Promise.all([page.api.listDeliveries(day), page.api.listReconciliations(day)]),
    page,
    [page.api, day],
  );
  const [rows, closedDays] = loaded.data ?? [[], []];
  const drivers = [...new Map(rows.map((row) => [row.driver.id, row.driver])).values()];

  return (
    <Stack gap="lg">
      <Title order={2}>{t('nav.deliveries')}</Title>
      <TextInput
        label={t('orders.sendDay')}
        type="date"
        w="100%"
        maw={240}
        value={day}
        onChange={(event) => {
          const next = event.currentTarget.value;
          if (daySchema.safeParse(next).success) setParams({ day: next }, { replace: true });
        }}
      />
      <Loaded status={loaded.status} onRetry={loaded.reload}>
        {rows.length === 0 ? (
          <Text c="dimmed">{t('orders.noRequests')}</Text>
        ) : (
          drivers.map((driver) => {
            const mine = rows.filter((row) => row.driver.id === driver.id);
            const figures = driverDay(rows, driver.id);
            const closed = closedDays.find((one) => one.driver.id === driver.id);
            return (
              <Paper key={driver.id} withBorder p="md">
                <Stack gap="sm">
                  <Title order={3}>
                    {driver.name}{' '}
                    <Text span c="dimmed" inherit>
                      {t('orders.requestCount', { n: mine.length })}
                    </Text>
                  </Title>
                  <Group justify="space-between" align="flex-end">
                    <Stack gap={2}>
                      <Text>
                        {t('reconcile.bringBack', { total: money(figures.toCollect) })}
                        {' · '}
                        {t('reconcile.deliveredOf', {
                          n: figures.delivered.length,
                          m: figures.delivered.length + figures.waiting.length,
                        })}
                      </Text>
                      <Text c="dimmed">
                        {closed
                          ? t('reconcile.dayClosedGap', { gap: gapText(closed.difference) })
                          : t('reconcile.dayOpen')}
                      </Text>
                    </Stack>
                    <Button
                      component={Link}
                      to={`/deliveries/${day}/drivers/${driver.id}`}
                      variant="default"
                      aria-label={t('reconcile.openFor', { name: driver.name })}
                    >
                      {t('reconcile.open')}
                    </Button>
                  </Group>
                  <Table.ScrollContainer minWidth={720}>
                    <Table highlightOnHover aria-label={driver.name}>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>{t('orders.requestNumber')}</Table.Th>
                          <Table.Th>{t('orders.customer')}</Table.Th>
                          <Table.Th>{t('orders.addressHeading')}</Table.Th>
                          <Table.Th>{t('orders.orderNumber')}</Table.Th>
                          <Table.Th ta="right">{t('orders.total')}</Table.Th>
                          <Table.Th>{t('orders.stateHeading')}</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {mine.map((request) => (
                          <Table.Tr key={request.id}>
                            <Table.Td>
                              <Anchor
                                component={Link}
                                to={`/deliveries/${request.day}/${request.id}`}
                              >
                                {request.number}
                              </Anchor>
                            </Table.Td>
                            <Table.Td>{request.customer.name}</Table.Td>
                            <Table.Td>{addressOf(request)}</Table.Td>
                            <Table.Td>{request.order.number}</Table.Td>
                            <Table.Td ta="right">{money(request.total)}</Table.Td>
                            <Table.Td>
                              <StateBadge state={request.state} />
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                </Stack>
              </Paper>
            );
          })
        )}
      </Loaded>
    </Stack>
  );
}
