import type { DeliveryDoc, Language } from '@credo/shared';
import { Alert, Anchor, Button, Group, Image, Paper, Stack, Text, Title } from '@mantine/core';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { shownDay } from './day';
import { Loaded } from './Loaded';
import { LinesTable, ProofPhoto, StateBadge, useMoney } from './OrderParts';
import { type PageProps, refusal, useLoad } from './page';

/** The customer as the driver needs them: their name, their phone (a tap calls it) and their address. */
function WhereTo({ customer }: { customer: DeliveryDoc['request']['customer'] }) {
  const { t } = useTranslation();
  const phone = customer.extra['phone'];
  const address = customer.extra['address'];
  return (
    <Stack gap={4}>
      <Text fw={600}>{customer.name}</Text>
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
      const result = await api.deliver(day, id, { version, photo: photo! });
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
              <Title order={2}>{t('orders.requestTitle', { number: doc.request.number })}</Title>
              <StateBadge state={doc.request.state} />
            </Group>
            {doc.request.state === 'cancelled' && (
              <Alert color="red" role="alert">
                {t('myDeliveries.cancelled')}
              </Alert>
            )}
            {doc.request.state === 'delivered' && (
              <Alert color="green" role="alert">
                {t('myDeliveries.done')}
              </Alert>
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
            <Text fw={700} size="lg">
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
                  <Alert color="red" role="alert">
                    {t('myDeliveries.unusable')}
                  </Alert>
                )}
                {problem === 'failed' && (
                  <Alert color="red" role="alert">
                    {t('myDeliveries.sendFailed')}
                  </Alert>
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
