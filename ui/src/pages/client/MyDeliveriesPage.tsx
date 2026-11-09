import type { DeliveryRequest, Language } from '@credo/shared';
import { Group, Paper, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { shownDay } from '../../day';
import { Loaded } from '../../frame/Loaded';
import { StateBadge, useMoney } from '../../parts/OrderParts';
import { type PageProps, useLoad } from '../../page';

const addressOf = (request: DeliveryRequest) => {
  const address = request.customer.extra['address'];
  return typeof address === 'string' ? address : '';
};

/** The signed-in driver's own requests for the phone's today, those waiting first and then those
 * delivered, each a card to open with its number, customer, address and the total to collect. */
export function MyDeliveriesPage(page: PageProps) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const day = page.today();
  const loaded = useLoad(() => page.api.myDeliveries(day), page, [page.api, day]);
  const rows = loaded.data ?? [];

  return (
    <Stack gap="md">
      <Title order={2}>{t('nav.myDeliveries')}</Title>
      <Text c="dimmed">
        {t('myDeliveries.forDay', { day: shownDay(day, i18n.language as Language) })}
      </Text>
      <Loaded status={loaded.status} onRetry={loaded.reload}>
        {rows.length === 0 ? (
          <Text c="dimmed">{t('myDeliveries.none')}</Text>
        ) : (
          rows.map((request) => (
            <Paper
              key={request.id}
              component={Link}
              to={`/my-deliveries/${request.day}/${request.id}`}
              withBorder
              p="md"
              td="none"
              c="inherit"
            >
              <Stack gap={4}>
                <Group justify="space-between">
                  <Text fw={700}>{request.number}</Text>
                  <StateBadge state={request.state} />
                </Group>
                <Text>{request.customer.name}</Text>
                <Text size="sm" c="dimmed">
                  {addressOf(request)}
                </Text>
                <Text fw={600}>{t('orders.collect', { total: money(request.total) })}</Text>
              </Stack>
            </Paper>
          ))
        )}
      </Loaded>
    </Stack>
  );
}
