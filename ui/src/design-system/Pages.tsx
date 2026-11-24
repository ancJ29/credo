import {
  Anchor,
  Checkbox,
  ColorInput,
  Group,
  Image,
  NativeSelect,
  NumberInput,
  PasswordInput,
  Radio,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import {
  IconBuilding,
  IconBuildingStore,
  IconLock,
  IconLogin,
  IconNote,
  IconPackage,
  IconPhone,
  IconUser,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../components/atoms/ActionButton';
import { MenuRow } from '../components/atoms/MenuRow';
import { StatusBadge, type Status } from '../components/atoms/StatusBadge';
import { ActionRow } from '../components/molecules/ActionRow';
import { CopyText } from '../components/molecules/CopyText';
import { DataTable } from '../components/molecules/DataTable';
import { FormMessage } from '../components/molecules/FormMessage';
import { PageHeader } from '../components/organisms/PageHeader';
import { PageState } from '../components/organisms/PageState';
import { Panel } from '../components/organisms/Panel';
import { shownDay } from '../day';
import { LANGUAGE_NAMES } from '../i18n';
import { LISTS } from '../listSheet';
import { numberOf, priceOf } from '../number';
import { ListTable } from '../parts/ListTable';
import { FieldPair } from '../parts/DetailCards';
import { PageShell } from '../parts/PageShell';
import { SectionCard } from '../components/organisms/SectionCard';
import { MAX_LOGO_BYTES } from '@credo/shared';
import { FilterBar } from './Fields';
import { PALETTES } from './palettes';
import { PICTURE } from './Photos';
import { SAMPLES, useLanguage } from './samples';
import { TONES, TYPE, WEIGHTS } from './tokens';

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

/** The form page as the staff member's add draws it: the way back above the title, fields in titled blocks two a row, one main at the foot; `refused` adds a whole-form message above the blocks and the code's refusal on its field. */
function NewRecord({ refused }: { refused: boolean }) {
  const { t } = useTranslation();
  const words = SAMPLES[useLanguage()];
  return (
    <Stack p="md">
      <PageShell
        title={t('addPerson.title')}
        status="ready"
        back={{ href: '/staff', children: t('staff.back') }}
        subtitle={t('addPerson.intro')}
      >
        <Stack gap="lg">
          {refused && <FormMessage kind="error">{t('addPerson.failed')}</FormMessage>}
          <SectionCard icon={<IconUser size={14} />} title={t('addPerson.basic')}>
            <FieldPair>
              <TextInput label={t('addPerson.name')} required defaultValue={words.person} />
              <TextInput
                label={t('addPerson.code')}
                description={t('addPerson.codeHint')}
                error={refused && t('addPerson.codeInvalid')}
                defaultValue={refused ? '!' : ''}
              />
              <NativeSelect
                label={t('addPerson.department')}
                data={[t('addPerson.noneChosen'), words.departmentValue]}
              />
            </FieldPair>
          </SectionCard>
          <SectionCard icon={<IconPhone size={14} />} title={t('addPerson.contacts')}>
            <FieldPair>
              <TextInput label={t('addPerson.phone')} type="tel" defaultValue={words.phone} />
              <TextInput label={t('addPerson.personalPhone')} type="tel" />
            </FieldPair>
          </SectionCard>
          <SectionCard icon={<IconNote size={14} />} title={t('addPerson.noteCard')}>
            <Textarea label={t('addPerson.note')} />
          </SectionCard>
          <ActionButton meaning="main" submit>
            {t('addPerson.submit')}
          </ActionButton>
        </Stack>
      </PageShell>
    </Stack>
  );
}

/** A form of one block, as the own password's: the words under the title, the block's fields, one main. */
function OneBlock() {
  const { t } = useTranslation();
  const words = SAMPLES[useLanguage()];
  return (
    <Stack p="md">
      <PageShell title={t('ownPassword.title')} status="ready" subtitle={t('ownPassword.text')}>
        <Stack gap="lg">
          <SectionCard icon={<IconLock size={14} />} title={t('ownPassword.title')}>
            <PasswordInput label={t('ownPassword.current')} defaultValue={words.secretValue} />
            <FieldPair>
              <PasswordInput label={t('ownPassword.new')} description={words.passwordHint} />
              <PasswordInput label={t('ownPassword.again')} />
            </FieldPair>
          </SectionCard>
          <ActionButton meaning="main" submit>
            {t('ownPassword.submit')}
          </ActionButton>
        </Stack>
      </PageShell>
    </Stack>
  );
}

/** What the add made: the message, the credentials read-only in their block, the main to open it. */
function Made() {
  const { t } = useTranslation();
  const words = SAMPLES[useLanguage()];
  return (
    <Stack p="md">
      <PageShell title={t('addPerson.madeTitle')} status="ready">
        <Stack gap="lg">
          <FormMessage kind="success">{t('addPerson.madeIntro')}</FormMessage>
          <SectionCard icon={<IconLogin size={14} />} title={t('addPerson.madeCard')}>
            <FieldPair>
              <TextInput label={t('addPerson.signInName')} value={words.codeValue} readOnly />
              <TextInput label={t('addPerson.firstPassword')} value={words.secretValue} readOnly />
            </FieldPair>
          </SectionCard>
          <Stack gap="xs" align="flex-start">
            <ActionButton meaning="main" to="/staff/s1">
              {t('addPerson.open')}
            </ActionButton>
            <ActionButton meaning="other" to="/staff/new">
              {t('addPerson.another')}
            </ActionButton>
          </Stack>
        </Stack>
      </PageShell>
    </Stack>
  );
}

/** The form page's four states: a new record, refused, one block, and made. */
export const FormPageStates = [
  { name: 'A new record', node: <NewRecord refused={false} /> },
  { name: 'Refused', node: <NewRecord refused /> },
  { name: 'One block', node: <OneBlock /> },
  { name: 'Made', node: <Made /> },
];

/** The day sheet's requests: what each driver took, the customer, the money and where it stands. */
const SHEET = [
  { number: 'GH-0001', state: 'delivered' as const, line: 0, person: 2 },
  { number: 'GH-0002', state: 'waiting' as const, line: 1, person: -1 },
  { number: 'GH-0003', state: 'delivered' as const, line: 2, person: 1 },
];

/** A table of the sheet's requests, the money at the right, and the line of what is to be collected when `collect` says so. */
function SheetTable({ rows, collect }: { rows: typeof SHEET; collect?: boolean }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const words = SAMPLES[language];
  const money = (amount: number) => t('orders.money', { amount: priceOf(amount, language) });
  const amountOf = (row: (typeof SHEET)[number]) => words.lines[row.line].amount;
  return (
    <DataTable
      columns={[
        { heading: t('orders.requestNumber') },
        { heading: t('orders.customer') },
        { heading: t('orders.total'), number: true },
        { heading: t('orders.stateHeading') },
      ]}
      rows={rows.map((row) => ({
        key: row.number,
        cells: [
          row.number,
          row.person < 0 ? words.shop : words.people[row.person].name,
          money(amountOf(row)),
          <StatusBadge key="state" status={row.state} />,
        ],
      }))}
      total={
        collect
          ? [
              t('reconcile.toCollect'),
              '',
              money(rows.reduce((sum, row) => sum + amountOf(row), 0)),
              '',
            ]
          : undefined
      }
    />
  );
}

/** The day's drivers as the deliveries page draws them: the day in its field, a titled panel a driver with what to bring back, whether the day is closed, the way into it and the driver's requests. */
function Drivers() {
  const { t } = useTranslation();
  const language = useLanguage();
  const words = SAMPLES[language];
  const money = (amount: number) => t('orders.money', { amount: priceOf(amount, language) });
  const first = SHEET.slice(0, 2);
  const second = SHEET.slice(2);
  const driver = (index: number, mine: typeof SHEET, closed: boolean) => {
    const name = words.people[index].name;
    const figures = mine.filter((row) => row.state === 'delivered');
    return (
      <Panel key={name} title={name}>
        <Text c="dimmed">{t('orders.requestCount', { n: mine.length })}</Text>
        <Text>
          {t('reconcile.bringBack', {
            total: money(figures.reduce((sum, row) => sum + words.lines[row.line].amount, 0)),
          })}
          {' · '}
          {t('reconcile.deliveredOf', { n: figures.length, m: mine.length })}
        </Text>
        <Text c="dimmed">
          {closed
            ? t('reconcile.dayClosedGap', { gap: t('reconcile.gapExact') })
            : t('reconcile.dayOpen')}
        </Text>
        <ActionButton
          meaning="other"
          to={`/deliveries/${DAY}/drivers/d${index + 1}`}
          label={t('reconcile.openFor', { name })}
        >
          {t('reconcile.open')}
        </ActionButton>
        <SheetTable rows={mine} />
      </Panel>
    );
  };
  return (
    <Stack p="md" gap="lg">
      <PageHeader title={t('nav.deliveries')} />
      <TextInput label={t('orders.sendDay')} type="date" defaultValue={DAY} maw={240} />
      {driver(0, first, false)}
      {driver(1, second, true)}
    </Stack>
  );
}

/** One driver's day, as the close asks it: the delivered and the waiting in their panels, the cash field read-only while the close is asked once, in its own block, with its main and the way to keep the day open. */
function OneDay() {
  const { t, i18n } = useTranslation();
  const language = useLanguage();
  const words = SAMPLES[language];
  const cash = words.lines[0].amount;
  return (
    <Stack p="md">
      <PageShell
        title={t('reconcile.title', { name: words.people[0].name })}
        subtitle={t('orders.forDay', { day: shownDay(DAY, i18n.language as 'vi' | 'en') })}
        back={{ href: `/deliveries?day=${DAY}`, children: t('reconcile.back') }}
        status="ready"
      >
        <Panel title={t('reconcile.deliveredTitle')}>
          <SheetTable rows={SHEET.slice(0, 1)} collect />
        </Panel>
        <Panel title={t('reconcile.waitingTitle')}>
          <Text c="dimmed">{t('reconcile.waitingText')}</Text>
          <SheetTable rows={SHEET.slice(1, 2)} />
        </Panel>
        <Panel title={t('reconcile.cashTitle')}>
          <NumberInput
            label={t('reconcile.cash')}
            description={t('reconcile.wholeDong')}
            allowDecimal={false}
            allowNegative={false}
            thousandSeparator={language === 'vi' ? '.' : ','}
            decimalSeparator={language === 'vi' ? ',' : '.'}
            readOnly
            defaultValue={cash}
            maw={320}
          />
          <Text role="status">{t('reconcile.gapExact')}</Text>
        </Panel>
        <Panel title={t('reconcile.close')}>
          <Text c="dimmed">{t('reconcile.closeText')}</Text>
          <Text {...TYPE.bodyStrong}>
            {t('reconcile.closeAsk', { name: words.people[0].name })}
          </Text>
          <Text>
            {t('reconcile.closeCash', {
              amount: t('orders.money', { amount: priceOf(cash, language) }),
            })}
          </Text>
          <Text>{t('reconcile.closeGap', { gap: t('reconcile.gapExact') })}</Text>
          <Text>{t('reconcile.closeWaiting', { count: 1 })}</Text>
          <ActionRow>
            <ActionButton meaning="main">{t('reconcile.closeConfirm')}</ActionButton>
            <ActionButton meaning="other">{t('reconcile.keepOpen')}</ActionButton>
          </ActionRow>
        </Panel>
      </PageShell>
    </Stack>
  );
}

/** One driver's day once closed: the message, what was delivered, and the closed day's figures in one row, the money at the right. */
function ClosedDay() {
  const { t, i18n } = useTranslation();
  const language = useLanguage();
  const words = SAMPLES[language];
  const cash = priceOf(words.lines[0].amount, language);
  const money = (amount: string) => t('orders.money', { amount });
  return (
    <Stack p="md">
      <PageShell
        title={t('reconcile.title', { name: words.people[0].name })}
        subtitle={t('orders.forDay', { day: shownDay(DAY, i18n.language as 'vi' | 'en') })}
        back={{ href: `/deliveries?day=${DAY}`, children: t('reconcile.back') }}
        status="ready"
      >
        <FormMessage kind="success">{t('reconcile.closedNow')}</FormMessage>
        <Panel title={t('reconcile.deliveredTitle')}>
          <SheetTable rows={SHEET.slice(0, 1)} collect />
        </Panel>
        <Panel title={t('reconcile.closedTitle')}>
          <DataTable
            columns={[
              { heading: t('reconcile.toCollect'), number: true },
              { heading: t('reconcile.handedIn'), number: true },
              { heading: t('reconcile.difference') },
              { heading: t('reconcile.closedBy') },
            ]}
            rows={[
              {
                key: 'closed',
                cells: [
                  money(cash),
                  money(cash),
                  t('reconcile.gapExact'),
                  t('reconcile.byRoot', { name: words.people[1].name }),
                ],
              },
            ]}
          />
        </Panel>
      </PageShell>
    </Stack>
  );
}

/** The day sheet's three states: the day's drivers, one driver's day with the close asked, and the day closed. */
export const DaySheetStates = [
  { name: 'The day’s drivers', node: <Drivers /> },
  { name: 'One driver’s day', node: <OneDay /> },
  { name: 'Closed', node: <ClosedDay /> },
];

/** The import's rows: a name each, the row's number and its result. */
const IMPORT_ROWS = [
  { line: 2, person: 0, ready: true },
  { line: 3, person: 1, ready: true },
  { line: 4, person: 2, ready: false },
];

/** Choose, as the import draws its first step: the words under the title, the template, the file field and the one main. */
function Choose() {
  const { t } = useTranslation();
  return (
    <Stack p="md" gap="lg">
      <div>
        <PageHeader title={t('import.title')} />
        <Text c="dimmed">{t('import.intro')}</Text>
      </div>
      <Panel>
        <Stack gap="lg">
          <Stack gap="xs" align="flex-start">
            <ActionButton meaning="other">{t('import.template')}</ActionButton>
            <Text {...TYPE.caption}>{t('import.templateHint')}</Text>
          </Stack>
          <TextInput
            type="file"
            accept=".xlsx"
            label={t('import.file')}
            description={t('import.fileHint')}
          />
          <Text>{t('import.chosen', { name: 'staff.xlsx' })}</Text>
          <ActionButton meaning="main">{t('import.read')}</ActionButton>
        </Stack>
      </Panel>
    </Stack>
  );
}

/** The preview, as the import draws its second step: what will be added counted, each row's result in the tone of its meaning, the one main to add them. */
function Preview() {
  const { t } = useTranslation();
  const words = SAMPLES[useLanguage()];
  const held = IMPORT_ROWS.filter((row) => row.ready).length;
  return (
    <Stack p="md" gap="lg">
      <PageHeader title={t('import.previewTitle')} />
      <Text>
        {t('import.summary', {
          held,
          total: IMPORT_ROWS.length,
          refused: IMPORT_ROWS.length - held,
        })}
      </Text>
      <DataTable
        columns={[
          { heading: t('import.colRow'), number: true },
          { heading: t('staff.colName') },
          { heading: t('import.colResult') },
        ]}
        rows={IMPORT_ROWS.map((row) => ({
          key: String(row.line),
          cells: [
            row.line,
            words.people[row.person].name,
            row.ready ? (
              <Text key="result" c={TONES.success}>
                {t('import.willAdd')}
              </Text>
            ) : (
              <Text key="result" c={TONES.danger}>
                {t('import.refusedDepartment', { name: words.departmentValue })}
              </Text>
            ),
          ],
        }))}
      />
      <ActionRow>
        <ActionButton meaning="main">{t('import.add', { count: held })}</ActionButton>
        <ActionButton meaning="other">{t('import.another')}</ActionButton>
      </ActionRow>
    </Stack>
  );
}

/** Done, as the import draws its last step: what was added, what was skipped, and the one main back to the list. */
function ImportDone() {
  const { t } = useTranslation();
  return (
    <Stack p="md" gap="lg">
      <PageHeader title={t('import.doneTitle')} />
      <FormMessage kind="success">{t('import.doneAdded', { count: 2 })}</FormMessage>
      <FormMessage kind="warning">{t('import.doneRefused', { count: 1 })}</FormMessage>
      <Text>{t('import.doneSignIn')}</Text>
      <ActionRow>
        <ActionButton meaning="main" to="/staff">
          {t('staff.back')}
        </ActionButton>
      </ActionRow>
    </Stack>
  );
}

/** The import page's three states: choose, the preview, and done. */
export const ImportPageStates = [
  { name: 'Choose', node: <Choose /> },
  { name: 'The preview', node: <Preview /> },
  { name: 'Done', node: <ImportDone /> },
];

/** The phone's More as the company's menu draws it: the pages its bar leaves out in one panel when there are any, then the person's own link and sign-out last in another, each a row. */
function MenuPage({ others }: { others: boolean }) {
  const { t } = useTranslation();
  return (
    <Stack p="md" gap="md">
      <PageHeader title={t('nav.more')} />
      {others && (
        <Panel>
          <Stack gap={0}>
            <MenuRow icon={IconBuildingStore} to="/customers">
              {t('nav.customers')}
            </MenuRow>
            <MenuRow icon={IconPackage} to="/products">
              {t('nav.products')}
            </MenuRow>
          </Stack>
        </Panel>
      )}
      <Panel>
        <Stack gap={0}>
          <MenuRow to="/password">{t('user.password')}</MenuRow>
          <MenuRow to="/passkey">{t('user.passkey')}</MenuRow>
          <MenuRow>{t('user.signOut')}</MenuRow>
        </Stack>
      </Panel>
    </Stack>
  );
}

/** The menu page's two states, both at the phone's width: the company's More, and More with no other pages. */
export const MenuPageStates = [
  { name: 'The company’s More', node: <MenuPage others />, phone: true as const },
  { name: 'No other pages', node: <MenuPage others={false} />, phone: true as const },
];

/** The company and its code the confirm page's samples name: the gallery's own, no real client's. */
const CLIENT_CODE = 'sample-shop';
/** A one-time password the made state shows once: made up for the sample. */
const MADE_PASSWORD = 'k7Tq-92xv-Lm4d';

/** The confirm page before the act: what will happen first, the standing warning at a delete, the code to type, then the last press and the way back. */
function Confirm({ erase }: { erase: boolean }) {
  const { t } = useTranslation();
  const { shop } = SAMPLES[useLanguage()];
  return (
    <Stack p="md" gap="lg">
      <div>
        <PageHeader
          title={t(erase ? 'operator.deleteClientTitle' : 'operator.rootTitle', { name: shop })}
        />
        {!erase && <Text c="dimmed">{t('operator.rootIntro', { name: shop })}</Text>}
      </div>
      {erase && (
        <FormMessage kind="warning" standing title={CLIENT_CODE}>
          {t('operator.deleteClientIntro', { name: shop })}
        </FormMessage>
      )}
      <Panel>
        <Stack gap="lg">
          <TextInput
            label={t(erase ? 'operator.deleteClientCodeLabel' : 'operator.rootCodeLabel')}
            description={t(erase ? 'operator.deleteClientCodeHint' : 'operator.rootCodeHint', {
              code: CLIENT_CODE,
            })}
            autoCapitalize="none"
            autoComplete="off"
            required
          />
          <Text {...TYPE.caption}>
            {t(erase ? 'operator.deleteClientTouch' : 'operator.rootTouch')}
          </Text>
          <ActionRow>
            <ActionButton meaning={erase ? 'danger' : 'main'} submit>
              {t(erase ? 'operator.deleteClientMake' : 'operator.rootSet')}
            </ActionButton>
            <ActionButton meaning="other" to="/operator/clients">
              {t('operator.back')}
            </ActionButton>
          </ActionRow>
        </Stack>
      </Panel>
    </Stack>
  );
}

/** The confirm page after the act: the success, the made value read-only in its field with the copy button at its right, and the way back. */
function ConfirmMade() {
  const { t } = useTranslation();
  return (
    <Stack p="md" gap="lg">
      <PageHeader title={t('operator.rootMadeTitle')} />
      <FormMessage kind="success">{t('operator.rootMadeIntro')}</FormMessage>
      <Panel>
        <CopyText
          value={MADE_PASSWORD}
          label={t('operator.copy')}
          about={t('operator.rootMadePassword')}
          field={t('operator.rootMadePassword')}
        />
      </Panel>
      <ActionRow>
        <ActionButton meaning="main" to="/operator/clients">
          {t('operator.back')}
        </ActionButton>
      </ActionRow>
    </Stack>
  );
}

/** The add-a-passkey page before the press: what a passkey is and that the password stays, then the one press. */
function PasskeyToAdd() {
  const { t } = useTranslation();
  return (
    <Stack p="md" gap="lg">
      <PageHeader title={t('ownPasskey.title')} />
      <Text c="dimmed">{t('ownPasskey.text')}</Text>
      <ActionRow>
        <ActionButton meaning="main" submit>
          {t('ownPasskey.submit')}
        </ActionButton>
      </ActionRow>
    </Stack>
  );
}

/** The add-a-passkey page after the touch: the success, and how to use the passkey next time. */
function PasskeyAdded() {
  const { t } = useTranslation();
  return (
    <Stack p="md" gap="lg">
      <PageHeader title={t('ownPasskey.title')} />
      <FormMessage kind="success">{t('ownPasskey.added')}</FormMessage>
      <Text>{t('ownPasskey.addedText')}</Text>
    </Stack>
  );
}

/** The confirm page's five states: a delete, a change, and made, then the add-a-passkey page's two at the phone's width. */
export const ConfirmPageStates = [
  { name: 'A delete', node: <Confirm erase /> },
  { name: 'A change', node: <Confirm erase={false} /> },
  { name: 'Made', node: <ConfirmMade /> },
  { name: 'A passkey to add', node: <PasskeyToAdd />, phone: true as const },
  { name: 'A passkey added', node: <PasskeyAdded />, phone: true as const },
];

/** The settings page as the company's own draws it: titled blocks, the logo from the photos with its choose and remove, the colour from a palette, the languages; `saved` says so above the blocks, `refused` says why above them and under the logo. */
function SettingsPage({ state }: { state: 'basics' | 'saved' | 'refused' }) {
  const { t } = useTranslation();
  const words = SAMPLES[useLanguage()];
  return (
    <Stack p="md" gap="lg">
      <div>
        <PageHeader title={t('settings.title')} />
        <Text c="dimmed">{t('settings.intro')}</Text>
      </div>
      {state === 'saved' && <FormMessage kind="saved">{t('settings.saved')}</FormMessage>}
      {state === 'refused' && <FormMessage kind="error">{t('settings.saveRefused')}</FormMessage>}
      <SectionCard icon={<IconBuilding size={14} />} title={t('settings.basics')}>
        <Stack gap="lg">
          <FieldPair>
            <TextInput label={t('settings.name')} required defaultValue={words.shop} />
            <Stack gap={6}>
              <Text size="sm" fw={WEIGHTS.label}>
                {t('settings.logo')}
              </Text>
              <Group>
                <Image src={PICTURE} alt="" h={48} w={48} fit="contain" />
                <ActionButton meaning="other">{t('settings.logoChoose')}</ActionButton>
                <ActionButton meaning="quiet">{t('settings.logoRemove')}</ActionButton>
              </Group>
              {state === 'refused' && (
                <FormMessage kind="error">
                  {t('settings.logoTooLarge', { max: MAX_LOGO_BYTES / 1024 })}
                </FormMessage>
              )}
            </Stack>
          </FieldPair>
          <Radio.Group label={t('settings.palette')} defaultValue={PALETTES[0].name}>
            <Group mt="xs" gap="lg">
              {PALETTES.map((palette) => (
                <Radio
                  key={palette.name}
                  value={palette.name}
                  label={t(`settings.palettes.${palette.name}`)}
                />
              ))}
            </Group>
          </Radio.Group>
          <FieldPair>
            <Stack gap="md">
              <ColorInput
                label={t('settings.colour')}
                format="hex"
                withEyeDropper={false}
                defaultValue={PALETTES[0].shades[7]}
              />
              <Switch label={t('settings.whiteHeader')} />
              <Switch label={t('settings.menuIcons')} defaultChecked />
            </Stack>
            <Checkbox.Group label={t('settings.languages')} defaultValue={['vi', 'en']}>
              <Group mt="xs">
                <Checkbox value="vi" label={LANGUAGE_NAMES.vi} />
                <Checkbox value="en" label={LANGUAGE_NAMES.en} />
              </Group>
            </Checkbox.Group>
          </FieldPair>
          <NativeSelect
            label={t('settings.defaultLanguage')}
            data={[LANGUAGE_NAMES.vi, LANGUAGE_NAMES.en]}
          />
        </Stack>
      </SectionCard>
      <ActionButton meaning="main" submit>
        {t('settings.save')}
      </ActionButton>
    </Stack>
  );
}

/** The settings page's three states: the basics, saved, and refused. */
export const SettingsPageStates = [
  { name: 'The basics', node: <SettingsPage state="basics" /> },
  { name: 'Saved', node: <SettingsPage state="saved" /> },
  { name: 'Refused', node: <SettingsPage state="refused" /> },
];
