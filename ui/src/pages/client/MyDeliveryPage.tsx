import { type DeliveryDoc, type Language, photoAddressRequestOf } from '@credo/shared';
import { Anchor, Button, Group, Image, Paper, Stack, Text, Title } from '@mantine/core';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { shownDay } from '../../day';
import { Loaded } from '../../frame/Loaded';
import { LinesTable, ProofPhoto, StateBadge, useMoney } from '../../parts/OrderParts';
import { type PageProps, refusal, useLoad } from '../../page';
import { TYPE, WEIGHTS } from '../../design-system/tokens';
import { FormMessage } from '../../components/molecules/FormMessage';

/** The customer as the driver needs them: their name, their phone (a tap calls it) and their address. */
function WhereTo({ customer }: { customer: DeliveryDoc['request']['customer'] }) {
  const { t } = useTranslation();
  const phone = customer.extra['phone'];
  const address = customer.extra['address'];
  return (
    <Stack gap={4}>
      <Text {...TYPE.bodyStrong}>{customer.name}</Text>
      {typeof phone === 'string' && phone !== '' && (
        <Text>
          <Anchor href={`tel:${phone.replace(/\s/g, '')}`}>
            {t('myDeliveries.call', { phone })}
          </Anchor>
        </Text>
      )}
      {typeof address === 'string' && address !== '' && (
        <Text>{t('orders.address', { address })}</Text>
      )}
    </Stack>
  );
}

/**
 * One of the driver's requests opened on the phone: the customer, the goods and the money to
 * collect, and for a waiting one a single button, Delivered, which opens the camera. The photo is
 * made small and shown before it is sent, to send or to take again; a send that fails keeps it.
 * The office having cancelled the request first, the driver reads so and nothing is delivered.
 */
export function MyDeliveryPage(page: PageProps) {
  const { api } = page;
  const { day = '', id = '' } = useParams();
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const loaded = useLoad(() => api.getDelivery(day, id), page, [api, day, id]);
  const [written, setWritten] = useState<DeliveryDoc | null>(null);
  /** The photo as it will be sent: made small, kept until it is sent. */
  const [photo, setPhoto] = useState<string | null>(null);
  const [problem, setProblem] = useState<'unusable' | 'failed' | null>(null);
  const [busy, setBusy] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const doc = written ?? loaded.data;

  async function choose(file: File | undefined) {
    if (!file) return;
    setProblem(null);
    try {
      setPhoto(await page.shrink(file));
    } catch {
      setProblem('unusable');
    }
  }

  async function send(version: string) {
    setBusy(true);
    setProblem(null);
    try {
      // The photo first: an address is asked for, the picture goes to it, then the request is marked
      // delivered. A stop between leaves the request waiting, and Send again asks afresh.
      const asked = await api.askPhotoAddress(day, id, photoAddressRequestOf(photo!));
      let result;
      if (asked.kind === 'address') {
        await api.putPhoto(asked.url, photo!);
        result = await api.deliver(day, id, { version });
      } else result = asked;
      if (result.kind === 'done') setWritten(result.doc);
      else if (result.current) setWritten(result.current);
      else loaded.reload();
      // Sent, or refused because the request is no longer waiting: the photo is not needed now.
      setPhoto(null);
    } catch (error) {
      refusal(error, page);
      setProblem('failed');
    }
    setBusy(false);
  }

  return (
    <Stack gap="lg">
      <Loaded status={loaded.status} onRetry={loaded.reload}>
        {doc && (
          <>
            <Group justify="space-between">
              <Title {...TYPE.pageTitle}>
                {t('orders.requestTitle', { number: doc.request.number })}
              </Title>
              <StateBadge state={doc.request.state} />
            </Group>
            {doc.request.state === 'cancelled' && (
              <FormMessage kind="error">{t('myDeliveries.cancelled')}</FormMessage>
            )}
            {doc.request.state === 'delivered' && (
              <FormMessage kind="success">{t('myDeliveries.done')}</FormMessage>
            )}
            <Paper withBorder p="md">
              <Stack gap="sm">
                <Text>
                  {t('orders.forDay', {
                    day: shownDay(doc.request.day, i18n.language as Language),
                  })}
                </Text>
                <WhereTo customer={doc.request.customer} />
              </Stack>
            </Paper>
            <LinesTable lines={doc.request.lines} total={doc.request.total} />
            <Text fw={WEIGHTS.title} size="lg">
              {t('orders.collect', { total: money(doc.request.total) })}
            </Text>
            {doc.request.state === 'delivered' && (
              <ProofPhoto page={page} day={doc.request.day} id={doc.request.id} />
            )}
            {doc.request.state === 'waiting' && (
              <Stack gap="sm">
                {/* The camera, opened by the buttons below; the picture it gives is chosen here. */}
                <input
                  ref={camera}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  aria-label={t('myDeliveries.photoField')}
                  tabIndex={-1}
                  style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
                  onChange={(event) => void choose(event.currentTarget.files?.[0])}
                />
                {problem === 'unusable' && (
                  <FormMessage kind="error">{t('myDeliveries.unusable')}</FormMessage>
                )}
                {problem === 'failed' && (
                  <FormMessage kind="error">{t('myDeliveries.sendFailed')}</FormMessage>
                )}
                {photo === null ? (
                  <Button size="lg" onClick={() => camera.current?.click()}>
                    {t('myDeliveries.deliver')}
                  </Button>
                ) : (
                  <>
                    <Title order={3}>{t('myDeliveries.photoTitle')}</Title>
                    <Image src={photo} alt={t('myDeliveries.photoAlt')} radius="md" />
                    <Button size="lg" loading={busy} onClick={() => void send(doc.version)}>
                      {t('myDeliveries.send')}
                    </Button>
                    <Button variant="default" onClick={() => camera.current?.click()}>
                      {t('myDeliveries.again')}
                    </Button>
                  </>
                )}
              </Stack>
            )}
            <Anchor component={Link} to="/my-deliveries">
              {t('myDeliveries.back')}
            </Anchor>
          </>
        )}
      </Loaded>
    </Stack>
  );
}
