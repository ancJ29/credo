import { Alert, Button, Center, Loader, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { GUIDELINE, type Contract, type PartState } from './guideline';
import { followedWords, heldWords } from './Charter';
import classes from './Gallery.module.css';
import { TONES, TYPE } from './tokens';

/** The contract of a part, by the name of its entry. */
export const contractOf = (part: string) =>
  GUIDELINE.contracts.find((contract) => contract.part === part);

/** A key of a theme table, as it is written in `tokens.ts`. */
const keyWords = ({ table, key }: Contract['decides'][number]['from'][number]) => `${table}.${key}`;

/** A part's contract in the side panel: what a screen gives it, what it decides, what it serves and holds. */
export function ContractPanel({ contract }: { contract: Contract }) {
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
  'Not found': 'This address names no page.',
};

/** A form message at each kind's tone and spoken role, Mantine's Alert. */
export const FormMessageStates = platesOf('FormMessage', ({ name, tone, role }) => (
  <Stack w={394} maw="100%">
    <Alert color={TONES[tone!]} role={role}>
      {WORDS[name]}
    </Alert>
  </Stack>
));

/** A page state: its title and message as the contract's styles draw them, its loader and retry button. */
function PageStateSample({ state: { name, role, tone } }: { state: PartState }) {
  if (name === 'Loading')
    return (
      <Center mih={240}>
        <Loader aria-label="Loading" />
      </Center>
    );
  if (tone)
    return (
      <Stack align="flex-start" w={394} maw="100%">
        <Alert color={TONES[tone]} role={role} w="100%">
          The page did not load.
        </Alert>
        <Button variant="default">Try again</Button>
      </Stack>
    );
  return (
    <Stack gap="xs" role={role} w={394} maw="100%">
      <Title {...TYPE.pageTitle}>{name}</Title>
      <Text {...TYPE.caption}>{WORDS[name]}</Text>
      {name === 'Empty' && <Button variant="default">Add</Button>}
    </Stack>
  );
}

/** Each state a page can be in instead of its body, at its contract's tone and role. */
export const PageStateStates = platesOf('PageState', (state) => <PageStateSample state={state} />);
