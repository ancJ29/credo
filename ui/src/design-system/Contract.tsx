import { Anchor, Stack, Table, Text } from '@mantine/core';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { GUIDELINE, type Contract, type PartState } from './guideline';
import { followedWords, heldWords } from './Charter';
import classes from './Gallery.module.css';
import { ActionButton } from '../components/atoms/ActionButton';
import { ActionRow } from '../components/molecules/ActionRow';
import { DataTable } from '../components/molecules/DataTable';
import { FormMessage } from '../components/molecules/FormMessage';
import { TableScroll } from '../components/molecules/TableScroll';
import { PageState } from '../components/organisms/PageState';
import { priceOf } from '../number';
import { SAMPLES, useLanguage } from './samples';

/** The contract of a part, by the name of its entry. */
export const contractOf = (part: string) =>
  GUIDELINE.contracts.find((contract) => contract.part === part);

/** A key of a theme table, as it is written in `tokens.ts`. */
const keyWords = ({ table, key }: Contract['decides'][number]['from'][number]) => `${table}.${key}`;

/** A part's contract in the side panel: what a screen gives it, what it decides, what it serves and holds. */
export function ContractPanel({ contract, built }: { contract: Contract; built?: boolean }) {
  return (
    <>
      <section className={classes.sideSection}>
        <h3 className={classes.sideHead}>Takes from a screen</h3>
        <ul className={classes.useLines}>
          {contract.takes.map(({ prop, is, line }) => (
            <li key={prop}>
              <code>{prop}</code> ({is}): {line}
            </li>
          ))}
        </ul>
      </section>
      <section className={classes.sideSection}>
        <h3 className={classes.sideHead}>Decides itself</h3>
        <ul className={classes.useLines}>
          {contract.decides.map(({ what, from }) => (
            <li key={what}>
              {what} <code>{from.map(keyWords).join(', ')}</code>
            </li>
          ))}
          {contract.fixes.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <Text size="sm" mt={6}>
          Serves: {contract.serves}. {heldWords(contract.heldBy)}{' '}
          {contract.followed === 'yes'
            ? followedWords(contract.followed)
            : built && contract.used
              ? `Built and in use; the screens do not all follow it yet: open item ${contract.followed.item} moves them.`
              : built
                ? `Built; the screens do not use it yet: open item ${contract.followed.item} moves them.`
                : `To come: open item ${contract.followed.item} builds it.`}
        </Text>
      </section>
    </>
  );
}

/** The plates of a part to come, one for each state its contract names, drawn by `draw`. */
const platesOf = (part: string, draw: (state: PartState) => ReactNode) =>
  contractOf(part)!.states.map((state) => ({ name: state.name, node: draw(state) }));

/** The words a message kind or a page state is drawn with, in the picked language: the dictionary's where a screen says them, else the samples'. */
function useStateWords() {
  const { t } = useTranslation();
  const words = SAMPLES[useLanguage()];
  return (name: string) => {
    const read: Record<string, string> = {
      Forbidden: t('forbidden.text'),
      Nothing: t('nothing.text'),
      Empty: t('staff.empty'),
    };
    return read[name] ?? words.messages[name] ?? '';
  };
}

/** A form message at each kind, drawn by the part itself: the standing plate is a warning read at load, with a code above. */
function FormMessageSample({ state: { name } }: { state: PartState }) {
  const words = useStateWords();
  return (
    <Stack w={394} maw="100%">
      {name === 'Standing' ? (
        <FormMessage kind="warning" standing title="ACME-01">
          {words(name)}
        </FormMessage>
      ) : (
        <FormMessage kind={name.toLowerCase() as 'error'}>{words(name)}</FormMessage>
      )}
    </Stack>
  );
}

export const FormMessageStates = platesOf('FormMessage', (state) => (
  <FormMessageSample state={state} />
));

/** A page state, drawn by the part itself: its title and words, its retry and its add. */
function PageStateSample({ state: { name } }: { state: PartState }) {
  const { t } = useTranslation();
  const words = useStateWords();
  const state = name === 'Not found' ? 'notFound' : (name.toLowerCase() as 'loading');
  const titles: Record<string, string> = {
    Loading: t('common.loading'),
    Failed: t('common.loadFailed'),
    Forbidden: t('forbidden.title'),
    Nothing: t('nothing.title'),
    Empty: t('staff.title'),
    'Not found': words('Not found'),
  };
  return (
    <Stack w={394} maw="100%">
      <PageState
        state={state}
        title={titles[name]}
        onRetry={() => undefined}
        add={<ActionButton meaning="other">{t('staff.add')}</ActionButton>}
      >
        {words(name)}
      </PageState>
    </Stack>
  );
}

/** Each state a page can be in instead of its body, at its contract's tone and role. */
export const PageStateStates = platesOf('PageState', (state) => <PageStateSample state={state} />);

/** A button at each meaning, drawn by the part itself: the page's one main action first. */
function ActionButtonSample({ name }: { name: string }) {
  const words = SAMPLES[useLanguage()];
  const meaning = name.toLowerCase() as 'main';
  const label = {
    Main: words.mainAction,
    Other: words.otherAction,
    Quiet: words.quietAction,
    Danger: words.deleteRecord,
  }[name as 'Main'];
  return <ActionButton meaning={meaning}>{label}</ActionButton>;
}

export const ActionButtonStates = platesOf('ActionButton', ({ name }) => (
  <ActionButtonSample name={name} />
));

/** A block's buttons in a row, drawn by the part itself: one gap, at the end. */
function ActionRowSample({ name }: { name: string }) {
  const words = SAMPLES[useLanguage()];
  return (
    <Stack w={394} maw="100%">
      <ActionRow>
        {name === 'One' ? (
          <ActionButton meaning="main">{words.save}</ActionButton>
        ) : (
          <>
            <ActionButton meaning="quiet">{words.cancel}</ActionButton>
            <ActionButton meaning="other">{words.saveDraft}</ActionButton>
            <ActionButton meaning="main">{words.send}</ActionButton>
          </>
        )}
      </ActionRow>
    </Stack>
  );
}

export const ActionRowStates = platesOf('ActionRow', ({ name }) => <ActionRowSample name={name} />);

/** A table at its least width, drawn by the part itself: it scrolls sideways below it. */
function TableScrollSample() {
  const { t } = useTranslation();
  const words = SAMPLES[useLanguage()];
  return (
    <Stack w={394} maw="100%">
      <TableScroll>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('staff.colName')}</Table.Th>
              <Table.Th>{t('staff.colPhone')}</Table.Th>
              <Table.Th>{words.address}</Table.Th>
              <Table.Th>{t('nav.staff')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td>{words.shop}</Table.Td>
              <Table.Td>0901 000 000</Table.Td>
              <Table.Td>{words.shopAddress}</Table.Td>
              <Table.Td>3</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </TableScroll>
    </Stack>
  );
}

export const TableScrollStates = platesOf('TableScroll', () => <TableScrollSample />);

/** A table at each of its states, drawn by the part itself: an order's lines under their total, and a list whose name opens a page. */
function DataTableSample({ state: { name } }: { state: PartState }) {
  const { t } = useTranslation();
  const words = SAMPLES[useLanguage()];
  const language = useLanguage();
  const lines = name === 'Order lines';
  return (
    <Stack w={640} maw="100%">
      {lines ? (
        <DataTable
          columns={[
            { heading: t('orders.product') },
            { heading: t('orders.quantity'), number: true },
            { heading: t('orders.amount'), number: true },
          ]}
          rows={words.lines.map((line) => ({
            key: line.name,
            cells: [line.name, line.quantity, priceOf(line.amount, language)],
          }))}
          total={[
            t('orders.total'),
            words.lines.reduce((sum, line) => sum + line.quantity, 0),
            priceOf(
              words.lines.reduce((sum, line) => sum + line.amount, 0),
              language,
            ),
          ]}
        />
      ) : (
        <DataTable
          columns={[{ heading: t('staff.colName') }, { heading: t('staff.colPhone') }]}
          rows={words.people.map((person, index) => ({
            key: person.name,
            cells: [
              <Anchor key="name" component={Link} to={`/customers/${index + 1}`}>
                {person.name}
              </Anchor>,
              person.phone,
            ],
          }))}
        />
      )}
    </Stack>
  );
}

/** A table with a total line, and one whose name opens a page. */
export const DataTableStates = platesOf('DataTable', (state) => <DataTableSample state={state} />);
