import {
  can,
  closeRequestFor,
  driverDay,
  gapOf,
  handedInSchema,
  type Language,
  TOTAL_MAX,
} from '@credo/shared';
import { Anchor, Group, NumberInput, Paper, Stack, Table, Text, Title } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { shownDay } from '../../day';
import { Loaded } from '../../frame/Loaded';
import { useMoney } from '../../parts/OrderParts';
import { type PageProps, refusal, useLoad } from '../../page';
import { useGapText } from '../../parts/ReconcileParts';
import { TYPE } from '../../design-system/tokens';
import { ActionButton } from '../../components/atoms/ActionButton';
import { PageShell } from '../../parts/PageShell';
import { FormMessage } from '../../components/molecules/FormMessage';

/** What the page says of its last try to close: nothing, a day closed, a failure that kept the
 * cash, or a day that moved under the page (another set of requests, or closed already). */
type Outcome = 'closed' | 'failed' | 'moved' | null;

/** One driver's day, for the office to settle: the requests the driver delivered with the sum to
 * collect, those still waiting apart, the cash handed in and the difference at once. Close the day
 * asks first, then closes it for good; a closed day reads Closed, with who closed it. */
export function DriverDayPage(page: PageProps) {
  const { api } = page;
  const { day = '', driverId = '' } = useParams();
  const { t, i18n } = useTranslation();
  const language = i18n.language as Language;
  const money = useMoney();
  const gapText = useGapText();
  const loaded = useLoad(
    () => Promise.all([api.listDeliveries(day), api.listReconciliations(day)]),
    page,
    [api, day],
  );
  const [cash, setCash] = useState<number | ''>('');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [requests, closedDays] = loaded.data ?? [[], []];
  const driver = requests.find((one) => one.driver.id === driverId)?.driver;
  const closed = closedDays.find((one) => one.driver.id === driverId) ?? null;
  const figures = driverDay(requests, driverId);
  const typed = handedInSchema.safeParse(cash);
  const handedIn = typed.success ? typed.data : null;

  async function close(amount: number) {
    setBusy(true);
    setOutcome(null);
    try {
      const result = await api.closeDay(day, driverId, closeRequestFor(figures, amount));
      setOutcome(result.kind === 'closed' ? 'closed' : 'moved');
      // Either way the day is read again: Closed, or the figures as they now are.
      loaded.reload();
    } catch (error) {
      refusal(error, page);
      setOutcome('failed');
    }
    setAsking(false);
    setBusy(false);
  }

  const requestTable = (rows: typeof requests, withTotal: boolean) => (
    <Table.ScrollContainer minWidth={560}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('orders.requestNumber')}</Table.Th>
            <Table.Th>{t('orders.customer')}</Table.Th>
            <Table.Th>{t('orders.orderNumber')}</Table.Th>
            {withTotal && <Table.Th ta="right">{t('orders.total')}</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((request) => (
            <Table.Tr key={request.id}>
              <Table.Td>
                <Anchor component={Link} to={`/deliveries/${request.day}/${request.id}`}>
                  {request.number}
                </Anchor>
              </Table.Td>
              <Table.Td>{request.customer.name}</Table.Td>
              <Table.Td>{request.order.number}</Table.Td>
              {withTotal && <Table.Td ta="right">{money(request.total)}</Table.Td>}
            </Table.Tr>
          ))}
        </Table.Tbody>
        {withTotal && (
          <Table.Tfoot>
            <Table.Tr>
              <Table.Th colSpan={3} ta="right">
                {t('reconcile.toCollect')}
              </Table.Th>
              <Table.Th ta="right">{money(figures.toCollect)}</Table.Th>
            </Table.Tr>
          </Table.Tfoot>
        )}
      </Table>
    </Table.ScrollContainer>
  );

  return (
    <Loaded status={loaded.status} onRetry={loaded.reload}>
      {driver === undefined ? (
        <Text c="dimmed">{t('reconcile.noRequests')}</Text>
      ) : (
        <PageShell
          title={t('reconcile.title', { name: driver.name })}
          back={{ href: `/deliveries?day=${day}`, children: t('reconcile.back') }}
          status="ready"
          onRetry={loaded.reload}
        >
          <Text>{t('orders.forDay', { day: shownDay(day, language) })}</Text>
          {outcome === 'closed' && (
            <FormMessage kind="success">{t('reconcile.closedNow')}</FormMessage>
          )}
          {outcome === 'failed' && <FormMessage kind="error">{t('reconcile.failed')}</FormMessage>}
          {outcome === 'moved' && <FormMessage kind="warning">{t('reconcile.moved')}</FormMessage>}
          <Paper withBorder p="md">
            <Stack gap="sm">
              <Title order={3}>{t('reconcile.deliveredTitle')}</Title>
              {figures.delivered.length === 0 ? (
                <Text c="dimmed">{t('reconcile.noDelivered')}</Text>
              ) : (
                requestTable(figures.delivered, true)
              )}
            </Stack>
          </Paper>
          {figures.waiting.length > 0 && (
            <Paper withBorder p="md">
              <Stack gap="sm">
                <Title order={3}>{t('reconcile.waitingTitle')}</Title>
                <Text c="dimmed">{t('reconcile.waitingText')}</Text>
                {requestTable(figures.waiting, false)}
              </Stack>
            </Paper>
          )}
          {closed ? (
            <Paper withBorder p="md">
              <Stack gap="sm">
                <Title order={3}>{t('reconcile.closedTitle')}</Title>
                <Table aria-label={t('reconcile.closedTitle')}>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Th scope="row">{t('reconcile.toCollect')}</Table.Th>
                      <Table.Td ta="right">{money(closed.toCollect)}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Th scope="row">{t('reconcile.handedIn')}</Table.Th>
                      <Table.Td ta="right">{money(closed.handedIn)}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Th scope="row">{t('reconcile.difference')}</Table.Th>
                      <Table.Td ta="right">{gapText(closed.difference)}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Th scope="row">{t('reconcile.closedBy')}</Table.Th>
                      <Table.Td ta="right">
                        {closed.closedBy.code === null
                          ? t('reconcile.byRoot', { name: closed.closedBy.name })
                          : `${closed.closedBy.code} · ${closed.closedBy.name}`}
                      </Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              </Stack>
            </Paper>
          ) : (
            can(page.user, 'orders.canEdit') &&
            (day > page.today() ? (
              <Text c="dimmed">{t('reconcile.notYet')}</Text>
            ) : (
              <>
                <Paper withBorder p="md">
                  <Stack gap="sm">
                    <Title order={3}>{t('reconcile.cashTitle')}</Title>
                    <NumberInput
                      label={t('reconcile.cash')}
                      description={t('reconcile.wholeDong')}
                      allowDecimal={false}
                      allowNegative={false}
                      thousandSeparator={language === 'vi' ? '.' : ','}
                      decimalSeparator={language === 'vi' ? ',' : '.'}
                      min={0}
                      max={TOTAL_MAX}
                      w="100%"
                      maw={320}
                      readOnly={asking}
                      value={cash}
                      onChange={(value) => setCash(typeof value === 'number' ? value : '')}
                    />
                    <Text role="status">
                      {handedIn === null
                        ? t('reconcile.typeCash')
                        : gapText(gapOf(figures.toCollect, handedIn))}
                    </Text>
                  </Stack>
                </Paper>
                <Paper withBorder p="md">
                  <Stack gap="sm" align="flex-start">
                    <Title order={3}>{t('reconcile.close')}</Title>
                    <Text c="dimmed">{t('reconcile.closeText')}</Text>
                    {figures.tooLarge && (
                      <FormMessage kind="warning">{t('reconcile.tooLarge')}</FormMessage>
                    )}
                    {asking && handedIn !== null ? (
                      <Stack gap="xs" align="flex-start">
                        <Text {...TYPE.bodyStrong}>
                          {t('reconcile.closeAsk', { name: driver.name })}
                        </Text>
                        <Text>{t('reconcile.closeCash', { amount: money(handedIn) })}</Text>
                        <Text>
                          {t('reconcile.closeGap', {
                            gap: gapText(gapOf(figures.toCollect, handedIn)),
                          })}
                        </Text>
                        <Text>
                          {figures.waiting.length === 0
                            ? t('reconcile.closeNoWaiting')
                            : t('reconcile.closeWaiting', { count: figures.waiting.length })}
                        </Text>
                        <Group>
                          <ActionButton
                            meaning="main"
                            busy={busy}
                            onClick={() => void close(handedIn)}
                          >
                            {t('reconcile.closeConfirm')}
                          </ActionButton>
                          <ActionButton meaning="other" onClick={() => setAsking(false)}>
                            {t('reconcile.keepOpen')}
                          </ActionButton>
                        </Group>
                      </Stack>
                    ) : (
                      <ActionButton
                        meaning="other"
                        disabled={handedIn === null || figures.tooLarge}
                        onClick={() => setAsking(true)}
                      >
                        {t('reconcile.close')}
                      </ActionButton>
                    )}
                  </Stack>
                </Paper>
              </>
            ))
          )}
        </PageShell>
      )}
    </Loaded>
  );
}
