import { can, type DeliveryDoc, type Language } from '@credo/shared';
import { Alert, Anchor, Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { shownDay } from './day';
import { Loaded } from './Loaded';
import {
  CancelPanel,
  CustomerBlock,
  LinesTable,
  type Outcome,
  OutcomeAlert,
  StateBadge,
  useMoney,
} from './OrderParts';
import { type PageProps, refusal, useLoad } from './page';

/** A delivery request opened to be read: its number, day and driver, the order it came from, the
 * customer with their phone and address, the lines and the total to collect. The office cancels a
 * waiting one after a check; its order then offers to send it again. */
export function DeliveryPage(page: PageProps) {
  const { api } = page;
  const { day = '', id = '' } = useParams();
  const { t, i18n } = useTranslation();
  const language = i18n.language as Language;
  const money = useMoney();
  const loaded = useLoad(() => api.getDelivery(day, id), page, [api, day, id]);
  const [written, setWritten] = useState<DeliveryDoc | null>(null);
  const [outcome, setOutcome] = useState<Outcome<DeliveryDoc>>(null);
  const [busy, setBusy] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const doc = written ?? loaded.data;

  async function cancel(version: string) {
    setBusy(true);
    setOutcome(null);
    try {
      const result = await api.cancelDelivery(day, id, { version });
      if (result.kind === 'done') {
        setWritten(result.doc);
        setCancelled(true);
      } else setOutcome({ kind: 'conflict', current: result.current });
    } catch (error) {
      refusal(error, page);
      setOutcome({ kind: 'failed' });
    }
    setBusy(false);
  }

  /** Their newer record is shown, or read again when the answer held none. */
  function showTheirs(current: DeliveryDoc | null) {
    setOutcome(null);
    setWritten(current);
    if (current === null) loaded.reload();
  }

  return (
    <Stack gap="lg">
      <Loaded status={loaded.status} onRetry={loaded.reload}>
        {doc && (
          <>
            <Group justify="space-between">
              <Title order={2}>{t('orders.requestTitle', { number: doc.request.number })}</Title>
              <StateBadge state={doc.request.state} />
            </Group>
            {cancelled && (
              <Alert color="green" role="alert">
                <Stack gap="xs" align="flex-start">
                  {t('orders.requestCancelled')}
                  <Button
                    component={Link}
                    to={`/orders/${doc.request.order.day}/${doc.request.order.id}`}
                    variant="default"
                  >
                    {t('orders.openOrder')}
                  </Button>
                </Stack>
              </Alert>
            )}
            <OutcomeAlert
              outcome={outcome}
              failed={t('orders.cancelFailed')}
              conflict={t('orders.conflict')}
              onTheirs={showTheirs}
            />
            <Paper withBorder p="md">
              <Stack gap="sm">
                <Text>{t('orders.forDay', { day: shownDay(doc.request.day, language) })}</Text>
                <Text>{t('orders.byDriver', { name: doc.request.driver.name })}</Text>
                <Text>
                  {t('orders.fromOrder')}{' '}
                  <Anchor
                    component={Link}
                    to={`/orders/${doc.request.order.day}/${doc.request.order.id}`}
                  >
                    {doc.request.order.number}
                  </Anchor>
                </Text>
                <CustomerBlock customer={doc.request.customer} />
              </Stack>
            </Paper>
            <LinesTable lines={doc.request.lines} total={doc.request.total} />
            <Text fw={600}>{t('orders.collect', { total: money(doc.request.total) })}</Text>
            {doc.request.state === 'waiting' && can(page.user, 'orders.canEdit') && (
              <CancelPanel
                title={t('orders.cancelRequest')}
                text={t('orders.cancelRequestText')}
                confirm={t('orders.cancelRequestConfirm', { number: doc.request.number })}
                busy={busy}
                onCancel={() => void cancel(doc.version)}
              />
            )}
          </>
        )}
      </Loaded>
    </Stack>
  );
}
