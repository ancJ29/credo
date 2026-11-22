import { can, type DeliveryDoc, type Language } from '@credo/shared';
import { Anchor, Paper, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { shownDay } from '../../day';
import { Loaded } from '../../frame/Loaded';
import {
  CancelPanel,
  CustomerBlock,
  LinesTable,
  type Outcome,
  OutcomeAlert,
  ProofPhoto,
  useMoney,
} from '../../parts/OrderParts';
import { type PageProps, refusal, useLoad } from '../../page';
import { TYPE } from '../../design-system/tokens';
import { ActionButton } from '../../components/atoms/ActionButton';
import { PageShell } from '../../parts/PageShell';
import { FormMessage } from '../../components/molecules/FormMessage';

/** A delivery request opened to be read: its number, day and driver, the order it came from, the
 * customer with their phone and address, the lines and the total to collect, and for a delivered one
 * its photo. The office cancels a waiting one after a check; its order then offers to send it again. */
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
    <Loaded status={loaded.status} onRetry={loaded.reload}>
      {doc && (
        <PageShell
          title={t('orders.requestTitle', { number: doc.request.number })}
          recordStatus={doc.request.state}
          status="ready"
          onRetry={loaded.reload}
        >
          {cancelled && (
            <FormMessage
              kind="success"
              act={
                <ActionButton
                  meaning="other"
                  to={`/orders/${doc.request.order.day}/${doc.request.order.id}`}
                >
                  {t('orders.openOrder')}
                </ActionButton>
              }
            >
              {t('orders.requestCancelled')}
            </FormMessage>
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
          <Text {...TYPE.bodyStrong}>
            {t('orders.collect', { total: money(doc.request.total) })}
          </Text>
          {doc.request.state === 'delivered' && (
            <ProofPhoto page={page} day={doc.request.day} id={doc.request.id} />
          )}
          {doc.request.state === 'waiting' && can(page.user, 'orders.canEdit') && (
            <CancelPanel
              title={t('orders.cancelRequest')}
              text={t('orders.cancelRequestText')}
              confirm={t('orders.cancelRequestConfirm', { number: doc.request.number })}
              busy={busy}
              onCancel={() => void cancel(doc.version)}
            />
          )}
        </PageShell>
      )}
    </Loaded>
  );
}
