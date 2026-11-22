import { Anchor, Group, Image, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../components/atoms/ActionButton';
import { StatusBadge, type Status } from '../components/atoms/StatusBadge';
import { ActionRow } from '../components/molecules/ActionRow';
import { DataTable } from '../components/molecules/DataTable';
import { FormMessage } from '../components/molecules/FormMessage';
import { PageHeader } from '../components/organisms/PageHeader';
import { PageState } from '../components/organisms/PageState';
import { Panel } from '../components/organisms/Panel';
import { shownDay } from '../day';
import { LISTS } from '../listSheet';
import { numberOf, priceOf } from '../number';
import { ListTable } from '../parts/ListTable';
import { PageShell } from '../parts/PageShell';
import { FilterBar } from './Fields';
import { SAMPLES, useLanguage } from './samples';
import { TYPE, WEIGHTS } from './tokens';

/** The day, the request and the photo the phone page's samples hold: no real person's. */
const DAY = '2026-11-23';
const NUMBER = 'GH-0001';
/** A small picture, drawn inline so the entry fetches nothing. */
const PHOTO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="#d0d7de"/><rect x="60" y="50" width="120" height="70" fill="#8c959f"/></svg>',
  );

/** What a driver's request shows in each state of the phone page. */
type Step = 'waiting' | 'photo' | 'delivered' | 'failed' | 'cancelled';

/** The money the goods come to, in the sample's lines. */
function totalOf(language: 'vi' | 'en') {
  return SAMPLES[language].lines.reduce((sum, line) => sum + line.amount, 0);
}

/** The driver's day: a card each request, opening it. */
function Today() {
  const { t, i18n } = useTranslation();
  const language = useLanguage();
  const words = SAMPLES[language];
  const collect = t('orders.collect', {
    total: t('orders.money', { amount: priceOf(totalOf(language), language) }),
  });
  const requests: { id: string; number: string; state: Status; person: string }[] = [
    { id: 'r1', number: NUMBER, state: 'waiting', person: words.people[0].name },
    { id: 'r2', number: 'GH-0002', state: 'delivered', person: words.people[1].name },
  ];
  return (
    <Stack gap="md" p="md">
      <PageHeader title={t('nav.myDeliveries')} />
      <Text c="dimmed">
        {t('myDeliveries.forDay', { day: shownDay(DAY, i18n.language as 'vi' | 'en') })}
      </Text>
      {requests.map((request) => (
        <Panel key={request.id} to={`/my-deliveries/${DAY}/${request.id}`}>
          <Stack gap={4}>
            <Text fw={WEIGHTS.title}>{request.number}</Text>
            <StatusBadge status={request.state} />
            <Text>{request.person}</Text>
            <Text {...TYPE.caption}>{words.shopAddress}</Text>
            <Text {...TYPE.bodyStrong}>{collect}</Text>
          </Stack>
        </Panel>
      ))}
    </Stack>
  );
}

/** One request opened: where to, the goods, the money, and the presses its state offers. */
function Request({ step }: { step: Step }) {
  const { t, i18n } = useTranslation();
  const language = useLanguage();
  const words = SAMPLES[language];
  const total = totalOf(language);
  const state: Status =
    step === 'delivered' ? 'delivered' : step === 'cancelled' ? 'cancelled' : 'waiting';
  return (
    <Stack p="md">
      <PageShell
        title={t('orders.requestTitle', { number: NUMBER })}
        back={{ href: `/my-deliveries`, children: t('myDeliveries.back') }}
        recordStatus={state}
        status="ready"
      >
        {step === 'cancelled' && (
          <FormMessage kind="error">{t('myDeliveries.cancelled')}</FormMessage>
        )}
        {step === 'delivered' && <FormMessage kind="success">{t('myDeliveries.done')}</FormMessage>}
        <Panel>
          <Text>{t('orders.forDay', { day: shownDay(DAY, i18n.language as 'vi' | 'en') })}</Text>
          <Stack gap={4}>
            <Text {...TYPE.bodyStrong}>{words.people[0].name}</Text>
            <Text>
              <Anchor href={`tel:${words.phone.replace(/\s/g, '')}`}>
                {t('myDeliveries.call', { phone: words.phone })}
              </Anchor>
            </Text>
            <Text>{t('orders.address', { address: words.shopAddress })}</Text>
          </Stack>
        </Panel>
        <DataTable
          columns={[
            { heading: t('orders.product') },
            { heading: t('orders.quantity'), number: true },
            { heading: t('orders.amount'), number: true },
          ]}
          rows={words.lines.map((line) => ({
            key: line.name,
            cells: [line.name, numberOf(line.quantity, language), priceOf(line.amount, language)],
          }))}
          total={[
            t('orders.total'),
            numberOf(
              words.lines.reduce((sum, line) => sum + line.quantity, 0),
              language,
            ),
            priceOf(total, language),
          ]}
        />
        <Text fw={WEIGHTS.title} size="lg">
          {t('orders.collect', { total: t('orders.money', { amount: priceOf(total, language) }) })}
        </Text>
        {step === 'delivered' && (
          <Panel title={t('orders.proofTitle')}>
            <Image src={PHOTO} alt={t('orders.proofAlt')} radius="md" />
          </Panel>
        )}
        {step === 'waiting' && (
          <ActionButton meaning="main">{t('myDeliveries.deliver')}</ActionButton>
        )}
        {(step === 'photo' || step === 'failed') && (
          <Stack gap="sm">
            {step === 'failed' && (
              <FormMessage kind="error">{t('myDeliveries.sendFailed')}</FormMessage>
            )}
            <Text {...TYPE.bodyStrong}>{t('myDeliveries.photoTitle')}</Text>
            <Image src={PHOTO} alt={t('myDeliveries.photoAlt')} radius="md" />
            <ActionButton meaning="main">{t('myDeliveries.send')}</ActionButton>
            <ActionButton meaning="other">{t('myDeliveries.again')}</ActionButton>
          </Stack>
        )}
      </PageShell>
    </Stack>
  );
}

/** The phone page's six states, the driver walk's: today's requests, one opened, the photo taken, delivered, a send that failed, cancelled by the office. */
export const PhonePageStates = [
  { name: 'The day’s requests', node: <Today />, phone: true as const },
  { name: 'One request', node: <Request step="waiting" />, phone: true as const },
  { name: 'The photo taken', node: <Request step="photo" />, phone: true as const },
  { name: 'Delivered', node: <Request step="delivered" />, phone: true as const },
  { name: 'A send that failed', node: <Request step="failed" />, phone: true as const },
  { name: 'Cancelled by the office', node: <Request step="cancelled" />, phone: true as const },
];

/** A customer the list page's samples hold: its code, and the words of the sample people. */
function customersOf(language: 'vi' | 'en') {
  const words = SAMPLES[language];
  return words.people.map((person, index) => ({
    id: `c${index + 1}`,
    code: `KH-00${index + 1}`,
    name: person.name,
    phone: person.phone,
    address: words.shopAddress,
  }));
}

/** The acts beside a list's title: the import the other, the add the main, unless the page's empty state holds the add. */
function ListActs({ kind, add }: { kind: 'customers' | 'products'; add: boolean }) {
  const { t } = useTranslation();
  return (
    <ActionRow>
      <ActionButton meaning="other" to={`/${kind}/import`}>
        {t('lists.import')}
      </ActionButton>
      {add && (
        <ActionButton meaning="main" to={`/${kind}/new`}>
          {t(`lists.${kind}.newButton`)}
        </ActionButton>
      )}
    </ActionRow>
  );
}

/** The list page as the customers' list draws it, in the state the load is in: the records in ListTable, none said by PageState with its add, or the load's loading and failed. */
function ListState({ state }: { state: 'list' | 'empty' | 'loading' | 'failed' }) {
  const { t } = useTranslation();
  const language = useLanguage();
  return (
    <Stack p="md">
      <PageShell
        title={t('nav.customers')}
        actions={<ListActs kind="customers" add={state !== 'empty'} />}
        status={state === 'loading' || state === 'failed' ? state : 'ready'}
      >
        {state === 'empty' ? (
          <PageState
            state="empty"
            add={
              <ActionButton meaning="main" to="/customers/new">
                {t('lists.customers.newButton')}
              </ActionButton>
            }
          >
            {t('lists.customers.empty')}
          </PageState>
        ) : (
          <ListTable
            kind="customers"
            shown={LISTS.customers.shown}
            rows={customersOf(language)}
            language={language}
          />
        )}
      </PageShell>
    </Stack>
  );
}

type Staffer = { id: string; code: string; name: string; phone: string; status: Status };

/** The people a staff list draws, each with the status its chip shows. */
function staffOf(language: 'vi' | 'en') {
  const words = SAMPLES[language];
  return words.people.map((person, index): Staffer => ({
    id: `s${index + 1}`,
    code: `NV-00${index + 1}`,
    name: person.name,
    phone: person.phone,
    status: index === 2 ? 'inactive' : 'active',
  }));
}

/** The staff list filtered to one status: the filter bar over the table, its status a chip column. */
function Filtered() {
  const { t } = useTranslation();
  const language = useLanguage();
  const people = staffOf(language).filter((person) => person.status === 'active');
  return (
    <Stack p="md">
      <PageShell
        title={t('staff.title')}
        status="ready"
        actions={
          <ActionRow>
            <ActionButton meaning="other" to="/staff/import">
              {t('staff.import')}
            </ActionButton>
            <ActionButton meaning="main" to="/staff/new">
              {t('staff.add')}
            </ActionButton>
          </ActionRow>
        }
      >
        <FilterBar />
        <DataTable
          columns={[
            { heading: t('staff.colName') },
            { heading: t('staff.colCode') },
            { heading: t('staff.colPhone') },
            { heading: t('staff.colStatus') },
          ]}
          rows={people.map((person) => ({
            key: person.id,
            cells: [person.name, person.code, person.phone, <StatusBadge status={person.status} />],
          }))}
        />
      </PageShell>
    </Stack>
  );
}

/** The staff list at the phone's width: a card a row, the name and its chip first, the other columns as captions. */
function Cards() {
  const { t } = useTranslation();
  const language = useLanguage();
  return (
    <Stack p="md">
      <PageShell
        title={t('staff.title')}
        status="ready"
        actions={
          <ActionButton meaning="main" to="/staff/new">
            {t('staff.add')}
          </ActionButton>
        }
      >
        <Stack gap="xs">
          {staffOf(language).map((person) => (
            <Panel key={person.id} to={`/staff/${person.id}`}>
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Text fw={WEIGHTS.title}>{person.name}</Text>
                <StatusBadge status={person.status} />
              </Group>
              <Text {...TYPE.caption}>{person.code}</Text>
              <Text {...TYPE.caption}>{person.phone}</Text>
            </Panel>
          ))}
        </Stack>
      </PageShell>
    </Stack>
  );
}

/** The list page's six states: a list, filtered with a status, empty, loading, failed, and at the phone's width. */
export const ListPageStates = [
  { name: 'A list', node: <ListState state="list" /> },
  { name: 'Filtered, with a status', node: <Filtered /> },
  { name: 'Empty', node: <ListState state="empty" /> },
  { name: 'Loading', node: <ListState state="loading" /> },
  { name: 'Failed', node: <ListState state="failed" /> },
  { name: 'At the phone', node: <Cards />, phone: true as const },
];
