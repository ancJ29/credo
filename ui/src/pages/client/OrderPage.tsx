import {
  can,
  type Customer,
  type Language,
  type OrderDoc,
  QUANTITY_MAX,
  type Product,
  type SaveOrderRequest,
} from '@credo/shared';
import {
  Alert,
  Anchor,
  Button,
  Group,
  NativeSelect,
  NumberInput,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import type { OrderResult } from '../../api';
import { DetailCard, DetailColumns } from '../../parts/DetailCards';
import { shownDay } from '../../day';
import { Loaded } from '../../frame/Loaded';
import {
  CancelPanel,
  CustomerBlock,
  LinesTable,
  type Outcome,
  OutcomeAlert,
  SendPanel,
  StateBadge,
  useMoney,
} from '../../parts/OrderParts';
import { type PageProps, refusal, useLoad } from '../../page';

/** What the page tells after a step that went through. */
type Done = 'saved' | 'confirmed' | 'sent' | 'cancelled';

/** An order already saved, with what its page does when a step goes through and when someone's
 * newer record is asked for. */
type Existing = {
  doc: OrderDoc;
  onDoc: (doc: OrderDoc, done: Done) => void;
  onTheirs: (current: OrderDoc | null) => void;
};

type Lines = { productId: string; quantity: number }[];

/** The draft's customer and lines as the form edits them. A line already saved is drawn at the price
 * it was saved at, as Confirm will copy it, and marked when its product's price has moved since,
 * since a save takes the new one; a line added now is drawn at the list's price. */
function FormFields({
  page,
  existing,
  customers,
  products,
}: {
  page: PageProps;
  /** The draft being changed and what its page does with a save; none for a new order. */
  existing: Existing | null;
  customers: Customer[];
  products: Product[];
}) {
  const doc = existing?.doc ?? null;
  const { t, i18n } = useTranslation();
  const language = i18n.language as Language;
  const money = useMoney();
  const number = new Intl.NumberFormat(language);
  const navigate = useNavigate();
  const day = doc?.order.day ?? page.today();
  const [customerId, setCustomerId] = useState(doc?.order.customer.id ?? '');
  const [lines, setLines] = useState<Lines>(
    () => doc?.order.lines.map(({ productId, quantity }) => ({ productId, quantity })) ?? [],
  );
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [outcome, setOutcome] = useState<Outcome<OrderDoc>>(null);
  const [saving, setSaving] = useState(false);

  const priced = lines.flatMap((line) => {
    const product = products.find((one) => one.id === line.productId);
    if (!product) return [];
    const saved = doc?.order.lines.find((one) => one.productId === line.productId)?.price;
    const price = saved ?? product.price;
    const moved = price === product.price ? null : product.price;
    return [{ ...line, product, price, moved, amount: price * line.quantity }];
  });
  const total = priced.reduce((sum, line) => sum + line.amount, 0);
  const dirty =
    customerId !== (doc?.order.customer.id ?? '') ||
    JSON.stringify(lines) !==
      JSON.stringify(
        doc?.order.lines.map(({ productId: id, quantity: count }) => ({
          productId: id,
          quantity: count,
        })) ?? [],
      );
  const complete = customerId !== '' && lines.length > 0;
  // a moved price is a change a save makes, though nothing was typed
  const worthSaving = dirty || priced.some((line) => line.moved !== null);

  /** A product added twice is one line: its quantity grows. */
  const addLine = () => {
    const kept = lines.find((line) => line.productId === productId);
    const grown = Math.min((kept?.quantity ?? 0) + quantity, QUANTITY_MAX);
    setLines(
      kept
        ? lines.map((line) => (line === kept ? { ...line, quantity: grown } : line))
        : [...lines, { productId, quantity: grown }],
    );
    setProductId('');
    setQuantity(1);
  };

  async function save() {
    setSaving(true);
    setOutcome(null);
    const request: SaveOrderRequest = { day, customerId, lines, extra: doc?.order.extra ?? {} };
    try {
      if (!existing) {
        const made = await page.api.createOrder(request);
        void navigate(`/orders/${made.order.day}/${made.order.id}`);
        return;
      }
      const result = await page.api.saveOrder(day, existing.doc.order.id, {
        ...request,
        version: existing.doc.version,
      });
      if (result.kind === 'done') existing.onDoc(result.doc, 'saved');
      else setOutcome({ kind: 'conflict', current: result.current });
    } catch (error) {
      refusal(error, page);
      setOutcome({ kind: 'failed' });
    }
    setSaving(false);
  }

  const main = (
    <Stack gap="lg">
      <OutcomeAlert
        outcome={outcome}
        failed={t('orders.saveFailed')}
        conflict={t('orders.conflict')}
        // Only a save of an order already made can meet a newer one.
        onTheirs={(current) => existing!.onTheirs(current)}
      />
      <DetailCard title={t('orders.details')}>
        <TextInput label={t('orders.day')} readOnly value={shownDay(day, language)} maw={240} />
        <NativeSelect
          label={t('orders.customer')}
          required
          value={customerId}
          onChange={(event) => setCustomerId(event.currentTarget.value)}
          data={[
            { value: '', label: t('orders.chooseCustomer') },
            ...customers.map((one) => ({ value: one.id, label: `${one.code} · ${one.name}` })),
          ]}
        />
      </DetailCard>
      <DetailCard title={t('orders.lines')}>
        <Group align="flex-end" wrap="wrap">
          <NativeSelect
            label={t('orders.product')}
            value={productId}
            onChange={(event) => setProductId(event.currentTarget.value)}
            data={[
              { value: '', label: t('orders.chooseProduct') },
              ...products.map((one) => ({
                value: one.id,
                label: `${one.code} · ${one.name} · ${one.unit}`,
              })),
            ]}
          />
          <NumberInput
            label={t('orders.quantity')}
            description={t('orders.wholeUnits')}
            allowDecimal={false}
            allowNegative={false}
            min={1}
            max={QUANTITY_MAX}
            w={140}
            value={quantity}
            onChange={(value) => setQuantity(typeof value === 'number' ? value : 1)}
          />
          <Button variant="default" disabled={productId === ''} onClick={addLine}>
            {t('orders.addLine')}
          </Button>
        </Group>
        {priced.length === 0 ? (
          <Text c="dimmed">{t('orders.noLines')}</Text>
        ) : (
          <Table.ScrollContainer minWidth={560}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('orders.product')}</Table.Th>
                  <Table.Th>{t('orders.unit')}</Table.Th>
                  <Table.Th ta="right">{t('orders.price')}</Table.Th>
                  <Table.Th ta="right">{t('orders.quantity')}</Table.Th>
                  <Table.Th ta="right">{t('orders.amount')}</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {priced.map(({ product, price, moved, quantity: count, amount }) => (
                  <Table.Tr key={product.id}>
                    <Table.Td>
                      {product.code} · {product.name}
                    </Table.Td>
                    <Table.Td>{product.unit}</Table.Td>
                    <Table.Td ta="right">
                      {number.format(price)}
                      {moved !== null && (
                        <Text size="xs" c="orange.9">
                          {t('orders.priceMoved', { price: number.format(moved) })}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td ta="right">{number.format(count)}</Table.Td>
                    <Table.Td ta="right">{number.format(amount)}</Table.Td>
                    <Table.Td ta="right">
                      <Button
                        variant="subtle"
                        color="red"
                        size="compact-sm"
                        aria-label={t('orders.removeLine', { name: product.name })}
                        onClick={() =>
                          setLines(lines.filter((line) => line.productId !== product.id))
                        }
                      >
                        {t('orders.remove')}
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
              <Table.Tfoot>
                <Table.Tr>
                  <Table.Th colSpan={4} ta="right">
                    {t('orders.total')}
                  </Table.Th>
                  <Table.Th ta="right">{money(total)}</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Tfoot>
            </Table>
          </Table.ScrollContainer>
        )}
      </DetailCard>
      <Group>
        <Button
          loading={saving}
          disabled={!complete || (doc !== null && !worthSaving)}
          onClick={() => void save()}
        >
          {t('orders.saveDraft')}
        </Button>
      </Group>
    </Stack>
  );
  return (
    <DetailColumns
      main={main}
      side={existing && <OrderActions page={page} {...existing} unsaved={dirty} />}
    />
  );
}

/** The steps an order offers, by its state: a draft is confirmed or cancelled, a confirmed order
 * whose request is gone is sent again, and one that is confirmed is cancelled with its request. */
function OrderActions({
  page,
  doc,
  unsaved,
  onDoc,
  onTheirs,
}: {
  page: PageProps;
  doc: OrderDoc;
  /** The form holds changes not saved yet: a confirm would send the version read. */
  unsaved: boolean;
  onDoc: (doc: OrderDoc, done: Done) => void;
  onTheirs: (current: OrderDoc | null) => void;
}) {
  const { t } = useTranslation();
  const { order } = doc;
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome<OrderDoc>>(null);

  async function run(call: () => Promise<OrderResult>, done: Done) {
    setBusy(true);
    setOutcome(null);
    try {
      const result = await call();
      if (result.kind === 'done') onDoc(result.doc, done);
      else setOutcome({ kind: 'conflict', current: result.current });
    } catch (error) {
      refusal(error, page);
      setOutcome({ kind: 'failed' });
    }
    setBusy(false);
  }
  const send = (confirming: boolean) => (driverId: string, day: string) =>
    void run(
      () =>
        confirming
          ? page.api.confirmOrder(order.day, order.id, { version: doc.version, driverId, day })
          : page.api.sendOrder(order.day, order.id, { version: doc.version, driverId, day }),
      confirming ? 'confirmed' : 'sent',
    );

  return (
    <Stack gap="lg">
      <OutcomeAlert
        outcome={outcome}
        failed={t('orders.stepFailed')}
        conflict={t('orders.conflict')}
        onTheirs={onTheirs}
      />
      {order.state === 'draft' && (
        <SendPanel
          page={page}
          title={t('orders.confirm')}
          submit={t('orders.confirmSubmit')}
          minDay={order.day}
          disabled={unsaved}
          hint={unsaved ? t('orders.saveFirst') : undefined}
          busy={busy}
          onSend={send(true)}
        />
      )}
      {order.state === 'confirmed' && order.request === null && (
        <SendPanel
          page={page}
          title={t('orders.sendAgain')}
          submit={t('orders.sendAgainSubmit')}
          minDay={order.day}
          disabled={false}
          busy={busy}
          onSend={send(false)}
        />
      )}
      <CancelPanel
        title={t('orders.cancelOrder')}
        text={t(order.request ? 'orders.cancelOrderSentText' : 'orders.cancelOrderText')}
        confirm={t('orders.cancelOrderConfirm', { number: order.number })}
        busy={busy}
        onCancel={() =>
          void run(
            () => page.api.cancelOrder(order.day, order.id, { version: doc.version }),
            'cancelled',
          )
        }
      />
    </Stack>
  );
}

/** An order read: its customer, lines and total left, its request and the steps its state allows
 * (`steps`, none when there are none) right. */
function OrderView({ doc, steps }: { doc: OrderDoc; steps: ReactNode }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as Language;
  const { order } = doc;
  return (
    <DetailColumns
      main={
        <Stack gap="lg">
          <DetailCard title={t('orders.details')}>
            <Text>{t('orders.onDay', { day: shownDay(order.day, language) })}</Text>
            <CustomerBlock customer={order.customer} />
          </DetailCard>
          <DetailCard title={t('orders.lines')}>
            <LinesTable lines={order.lines} total={order.total} />
          </DetailCard>
        </Stack>
      }
      side={
        <Stack gap="lg">
          <DetailCard title={t('orders.sentTitle')}>
            {order.request ? (
              <Text>
                <Anchor
                  component={Link}
                  to={`/deliveries/${order.request.day}/${order.request.id}`}
                >
                  {order.request.number}
                </Anchor>
                {' · '}
                {t('orders.byDriver', { name: order.request.driver.name })}
                {' · '}
                {t('orders.forDay', { day: shownDay(order.request.day, language) })}
              </Text>
            ) : (
              <Text c="dimmed">
                {t(order.state === 'confirmed' ? 'orders.notSent' : 'orders.noRequest')}
              </Text>
            )}
          </DetailCard>
          {steps}
        </Stack>
      }
    />
  );
}

/** The company's lists an order picks from, read once; the form is drawn when both are in. */
function Editor(props: { page: PageProps; existing: Existing | null }) {
  const { api } = props.page;
  const loaded = useLoad(
    async () => ({ customers: await api.listCustomers(), products: await api.listProducts() }),
    props.page,
    [api],
  );
  return (
    <Loaded status={loaded.status} onRetry={loaded.reload}>
      {loaded.data && <FormFields {...props} {...loaded.data} />}
    </Loaded>
  );
}

/** A new order: the form, and the order's own page once it is saved. */
export function NewOrderPage(page: PageProps) {
  const { t } = useTranslation();
  return (
    <Stack gap="lg">
      <Title order={2}>{t('orders.newTitle')}</Title>
      <Editor page={page} existing={null} />
    </Stack>
  );
}

/** An order by its day and id: a draft is changed, confirmed or cancelled by whoever may edit; any
 * other is read, with its request, and offers what its state allows. */
export function OrderPage(page: PageProps) {
  const { day = '', id = '' } = useParams();
  const { t } = useTranslation();
  const loaded = useLoad(() => page.api.getOrder(day, id), page, [page.api, day, id]);
  const [written, setWritten] = useState<OrderDoc | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [resets, setResets] = useState(0);
  const doc = written ?? loaded.data;
  const editor = can(page.user, 'orders.canEdit');

  const onDoc = (next: OrderDoc, what: Done) => {
    setWritten(next);
    setDone(what);
  };
  /** Their newer record is shown and the form drawn again from it, or the page reads again when
   * the answer held none. */
  const onTheirs = (current: OrderDoc | null) => {
    setWritten(current);
    setDone(null);
    setResets(resets + 1);
    if (current === null) loaded.reload();
  };

  return (
    <Stack gap="lg">
      <Loaded status={loaded.status} onRetry={loaded.reload}>
        {doc && (
          <>
            <Group justify="space-between">
              <Title order={2}>{t('orders.orderTitle', { number: doc.order.number })}</Title>
              <StateBadge state={doc.order.state} />
            </Group>
            {done && (
              <Alert color="green" role="alert">
                {t(`orders.done.${done}`, { number: doc.order.request?.number })}
              </Alert>
            )}
            {doc.order.state === 'draft' && editor ? (
              <Editor
                key={`${doc.order.id}:${resets}`}
                page={page}
                existing={{ doc, onDoc, onTheirs }}
              />
            ) : (
              <OrderView
                doc={doc}
                steps={
                  editor &&
                  doc.order.state === 'confirmed' && (
                    <OrderActions
                      key={doc.version}
                      page={page}
                      doc={doc}
                      unsaved={false}
                      onDoc={onDoc}
                      onTheirs={onTheirs}
                    />
                  )
                }
              />
            )}
          </>
        )}
      </Loaded>
    </Stack>
  );
}
