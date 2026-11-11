import type { DeliveryRequest, OrderLine, RequestState, OrderState } from '@credo/shared';
import {
  Alert,
  Badge,
  Button,
  Group,
  Image,
  NativeSelect,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loaded } from '../frame/Loaded';
import { type PageProps, useLoad } from '../page';

/** An amount in đồng as the language writes a number. */
export function useMoney() {
  const { t, i18n } = useTranslation();
  return (amount: number) =>
    t('orders.money', { amount: new Intl.NumberFormat(i18n.language).format(amount) });
}

const STATE_COLOUR: Record<OrderState | RequestState, string> = {
  draft: 'gray',
  confirmed: 'teal',
  fulfilled: 'green',
  cancelled: 'red',
  waiting: 'blue',
  delivered: 'green',
};

/** A state in words, in a badge. */
export function StateBadge({ state }: { state: OrderState | RequestState }) {
  const { t } = useTranslation();
  return (
    <Badge variant="light" color={STATE_COLOUR[state]}>
      {t(`orders.state.${state}`)}
    </Badge>
  );
}

const textIn = (value: unknown) => (typeof value === 'string' ? value : '');

/** A customer as an order kept them: name and code, phone and address when there are any. */
export function CustomerBlock({ customer }: { customer: DeliveryRequest['customer'] }) {
  const { t } = useTranslation();
  const phone = textIn(customer.extra['phone']);
  const address = textIn(customer.extra['address']);
  return (
    <Stack gap={2}>
      <Text fw={600}>{customer.name}</Text>
      <Text size="sm" c="dimmed">
        {customer.code}
      </Text>
      {phone !== '' && <Text size="sm">{t('orders.phone', { phone })}</Text>}
      {address !== '' && <Text size="sm">{t('orders.address', { address })}</Text>}
    </Stack>
  );
}

/** The lines as they were saved, with the total under them. */
export function LinesTable({ lines, total }: { lines: readonly OrderLine[]; total: number }) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const number = new Intl.NumberFormat(i18n.language);
  return (
    <Table.ScrollContainer minWidth={560}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('orders.product')}</Table.Th>
            <Table.Th>{t('orders.unit')}</Table.Th>
            <Table.Th ta="right">{t('orders.price')}</Table.Th>
            <Table.Th ta="right">{t('orders.quantity')}</Table.Th>
            <Table.Th ta="right">{t('orders.amount')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {lines.map((line) => (
            <Table.Tr key={line.productId}>
              <Table.Td>
                {line.code} · {line.name}
              </Table.Td>
              <Table.Td>{line.unit}</Table.Td>
              <Table.Td ta="right">{number.format(line.price)}</Table.Td>
              <Table.Td ta="right">{number.format(line.quantity)}</Table.Td>
              <Table.Td ta="right">{number.format(line.amount)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
        <Table.Tfoot>
          <Table.Tr>
            <Table.Th colSpan={4} ta="right">
              {t('orders.total')}
            </Table.Th>
            <Table.Th ta="right">{money(total)}</Table.Th>
          </Table.Tr>
        </Table.Tfoot>
      </Table>
    </Table.ScrollContainer>
  );
}

/** What a write left: nothing yet, a failure that kept what was typed, or someone's newer record. */
export type Outcome<Doc> = { kind: 'failed' } | { kind: 'conflict'; current: Doc | null } | null;

/** A refusal to cancel, after a check: the one panel an order and a request both use. */
export function CancelPanel({
  title,
  text,
  confirm,
  busy,
  onCancel,
}: {
  title: string;
  text: string;
  confirm: string;
  busy: boolean;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  return (
    <Paper withBorder p="md">
      <Stack gap="sm" align="flex-start">
        <Title order={3}>{title}</Title>
        <Text c="dimmed">{text}</Text>
        {asking ? (
          <Group>
            <Button color="red" loading={busy} onClick={onCancel}>
              {confirm}
            </Button>
            <Button variant="default" onClick={() => setAsking(false)}>
              {t('orders.keep')}
            </Button>
          </Group>
        ) : (
          <Button variant="default" onClick={() => setAsking(true)}>
            {title}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}

/** The driver and the day a request is made for: Confirm and Send again both ask them, the day
 * today unless another is picked and never before the order's. With no one allowed to deliver, it
 * says to ask the admin. */
export function SendPanel({
  page,
  title,
  submit,
  minDay,
  disabled,
  busy,
  hint,
  onSend,
}: {
  page: PageProps;
  title: string;
  submit: string;
  /** The order's own day: a request is for it or a later one. */
  minDay: string;
  disabled: boolean;
  busy: boolean;
  /** A line under the buttons, when the panel cannot be pressed yet. */
  hint?: string;
  onSend: (driverId: string, day: string) => void;
}) {
  const { t } = useTranslation();
  const loaded = useLoad(() => page.api.listDrivers(), page, [page.api]);
  const drivers = loaded.data ?? [];
  const [driverId, setDriverId] = useState('');
  const [day, setDay] = useState(() => {
    const today = page.today();
    return today < minDay ? minDay : today;
  });
  // A day cleared is '', which is before any order's day.
  const ready = driverId !== '' && day >= minDay && !disabled;
  const send = (event: FormEvent) => {
    event.preventDefault();
    if (ready) onSend(driverId, day);
  };
  return (
    <Paper withBorder p="md">
      <Loaded status={loaded.status} onRetry={loaded.reload}>
        <form onSubmit={send}>
          <Stack gap="sm" align="flex-start">
            <Title order={3}>{title}</Title>
            {drivers.length === 0 ? (
              <Alert color="orange" role="alert" w="100%">
                {t('orders.noDrivers')}
              </Alert>
            ) : (
              <>
                <NativeSelect
                  label={t('orders.driver')}
                  w="100%"
                  maw={420}
                  value={driverId}
                  onChange={(event) => setDriverId(event.currentTarget.value)}
                  data={[
                    { value: '', label: t('orders.chooseDriver') },
                    ...drivers.map((driver) => ({
                      value: driver.id,
                      label: `${driver.code} · ${driver.name}`,
                    })),
                  ]}
                />
                <TextInput
                  label={t('orders.sendDay')}
                  type="date"
                  w="100%"
                  maw={420}
                  min={minDay}
                  value={day}
                  onChange={(event) => setDay(event.currentTarget.value)}
                />
                {hint !== undefined && (
                  <Text size="sm" c="dimmed">
                    {hint}
                  </Text>
                )}
                <Button type="submit" loading={busy} disabled={!ready}>
                  {submit}
                </Button>
              </>
            )}
          </Stack>
        </form>
      </Loaded>
    </Paper>
  );
}

/** What a failed or moved write says, over the page's buttons. */
export function OutcomeAlert<Doc>({
  outcome,
  failed,
  conflict,
  onTheirs,
}: {
  outcome: Outcome<Doc>;
  failed: string;
  conflict: string;
  onTheirs: (current: Doc | null) => void;
}) {
  const { t } = useTranslation();
  if (outcome === null) return null;
  if (outcome.kind === 'failed') {
    return (
      <Alert color="red" role="alert">
        {failed}
      </Alert>
    );
  }
  return (
    <Alert color="orange" role="alert">
      <Stack gap="xs" align="flex-start">
        {conflict}
        <Button variant="default" onClick={() => onTheirs(outcome.current)}>
          {t('orders.showTheirs')}
        </Button>
      </Stack>
    </Alert>
  );
}

/** A delivered request's photo, read from its own route. */
export function ProofPhoto({ page, day, id }: { page: PageProps; day: string; id: string }) {
  const { t } = useTranslation();
  const loaded = useLoad(() => page.api.getDeliveryPhoto(day, id), page, [page.api, day, id]);
  return (
    <Paper withBorder p="md">
      <Stack gap="sm">
        <Title order={3}>{t('orders.proofTitle')}</Title>
        <Loaded status={loaded.status} onRetry={loaded.reload}>
          {loaded.data && <Image src={loaded.data.photo} alt={t('orders.proofAlt')} radius="md" />}
        </Loaded>
      </Stack>
    </Paper>
  );
}
