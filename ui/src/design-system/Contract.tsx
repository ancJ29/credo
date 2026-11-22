import { Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { GUIDELINE, type Contract, type PartState } from './guideline';
import { followedWords, heldWords } from './Charter';
import classes from './Gallery.module.css';
import { ActionButton } from '../components/atoms/ActionButton';
import { FormMessage } from '../components/molecules/FormMessage';
import { PageState } from '../components/organisms/PageState';

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

/** The words each message kind and page state is drawn with. */
const WORDS: Record<string, string> = {
  Error: 'The name could not be saved.',
  Warning: 'Someone changed this record first.',
  Success: 'The order was sent.',
  Info: 'Prices change on the first of the month.',
  Saved: 'Saved.',
  Forbidden: 'You may not open this page. Ask the person who runs the company.',
  Nothing: 'No page is open to you yet.',
  Empty: 'No staff yet. Add the first.',
  Standing: 'This client has no staff yet, so nothing can move.',
  'Not found': 'This address names no page.',
};

/** A form message at each kind, drawn by the part itself: the standing plate is a warning read at load, with a code above. */
export const FormMessageStates = platesOf('FormMessage', ({ name }) => (
  <Stack w={394} maw="100%">
    {name === 'Standing' ? (
      <FormMessage kind="warning" standing title="ACME-01">
        {WORDS[name]}
      </FormMessage>
    ) : (
      <FormMessage kind={name.toLowerCase() as 'error'}>{WORDS[name]}</FormMessage>
    )}
  </Stack>
));

/** A page state, drawn by the part itself: its title and words, its retry and its add. */
function PageStateSample({ state: { name } }: { state: PartState }) {
  const state = name === 'Not found' ? 'notFound' : (name.toLowerCase() as 'loading');
  return (
    <Stack w={394} maw="100%">
      <PageState
        state={state}
        title={name}
        onRetry={() => undefined}
        add={<ActionButton meaning="other">Add</ActionButton>}
      >
        {WORDS[name]}
      </PageState>
    </Stack>
  );
}

/** Each state a page can be in instead of its body, at its contract's tone and role. */
export const PageStateStates = platesOf('PageState', (state) => <PageStateSample state={state} />);

/** A button at each meaning, drawn by the part itself: the page's one main action first. */
export const ActionButtonStates = platesOf('ActionButton', ({ name }) => (
  <ActionButton meaning={name.toLowerCase() as 'main'}>
    {name === 'Danger' ? 'Delete the record' : `${name} action`}
  </ActionButton>
));
