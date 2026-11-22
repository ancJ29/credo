import { Burger, Button, Collapse, Select, Text, Title } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import { CREDO_COLOUR } from '@credo/shared';
import { Fragment, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { ENTRIES, GROUPS, slugOf, type Entry } from './entries';
import classes from './Gallery.module.css';
import { CredoMantine } from './CredoMantine';
import { PALETTES } from './palettes';
import { ContractPanel, contractOf } from './Contract';

/** The gallery's own address: the page and what is below it. */
const BASE = '/48b74d079/gallery';

/** Where the browser remembers the gallery's theme; nothing outside the gallery reads it. */
const SAVED = 'credo-gallery-theme';

/** The app's own colour in the one spelling the palettes use, so a comparison and a return agree. */
const APP_COLOUR = CREDO_COLOUR.toLowerCase();

/** The gallery's themes: each stock palette by name, drawn from its shade 7, the app's own marked. */
const THEMES = PALETTES.map(({ name, shades }) => ({
  value: shades[7],
  label: `${name[0].toUpperCase()}${name.slice(1)}${shades[7] === APP_COLOUR ? ' · the app’s' : ''}`,
}));

/** The theme the browser remembers, if the gallery offers it; else the app's own colour. */
function remembered() {
  try {
    const saved = window.localStorage.getItem(SAVED);
    return THEMES.find(({ value }) => value === saved)?.value ?? APP_COLOUR;
  } catch {
    return APP_COLOUR;
  }
}

/** Remembers a theme where the browser lets it; where it does not, the choice lasts the visit. */
function remember(colour: string) {
  try {
    window.localStorage.setItem(SAVED, colour);
  } catch {
    // No storage: the gallery draws the same, and forgets the choice when it closes.
  }
}

const pathOf = (entry: Entry) => `${BASE}/${slugOf(entry.group)}/${slugOf(entry.name)}`;

/** The part an address names: the bare address names the first, an address matching none names none. */
function partAt(pathname: string): Entry | undefined {
  const rest = pathname.slice(BASE.length).replace(/^\/|\/$/g, '');
  if (rest === '') return ENTRIES[0];
  return ENTRIES.find((entry) => pathOf(entry) === `${BASE}/${rest}`);
}

/** One part on the workbench: its states as plates on the stage, and a right column with its name, description, props, the Show switch, the states to pick and the theme picker. */
function Part({ entry, picker }: { entry: Entry; picker: ReactNode }) {
  const [alone, setAlone] = useState(false);
  const [at, setAt] = useState(0);
  const shown = alone ? [entry.states[at]] : entry.states;
  const instead = ENTRIES.find(({ name }) => name === entry.instead);
  const contract = contractOf(entry.name);
  return (
    <article className={classes.part}>
      <div className={classes.stage}>
        {shown.map((state) => (
          <figure key={state.name} aria-label={state.name} className={classes.plate}>
            <div className={classes.sample}>{state.node}</div>
            <figcaption className={classes.plateName}>{state.name}</figcaption>
          </figure>
        ))}
      </div>
      <aside className={classes.side} aria-label="About this part">
        <div className={classes.controls}>
          {entry.states.length > 1 && (
            <section className={classes.sideSection}>
              <h3 className={classes.sideHead}>Show</h3>
              <Button.Group>
                <Button
                  size="xs"
                  fullWidth
                  variant={alone ? 'default' : 'filled'}
                  aria-pressed={!alone}
                  onClick={() => setAlone(false)}
                >
                  Side by side
                </Button>
                <Button
                  size="xs"
                  fullWidth
                  variant={alone ? 'filled' : 'default'}
                  aria-pressed={alone}
                  onClick={() => setAlone(true)}
                >
                  One at a time
                </Button>
              </Button.Group>
              {alone && (
                <div className={classes.pick} role="group" aria-label="States">
                  {entry.states.map((state, index) => (
                    <button
                      key={state.name}
                      type="button"
                      className={classes.pickOne}
                      aria-pressed={index === at}
                      onClick={() => setAt(index)}
                    >
                      {state.name}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
          <section className={classes.sideSection}>{picker}</section>
        </div>
        <Title order={2} fz={22} lh={1.2} mb={8}>
          {entry.name}
        </Title>
        <Text c="dimmed" inherit mb={18}>
          {entry.description}
        </Text>
        <section className={classes.sideSection}>
          <h3 className={classes.sideHead}>Use when</h3>
          <ul className={classes.useLines}>
            {entry.useWhen.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        <section className={classes.sideSection}>
          <h3 className={classes.sideHead}>Don’t use when</h3>
          <ul className={classes.useLines}>
            {entry.dontUseWhen.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {instead && (
            <Text size="sm" mt={6}>
              Instead: <Link to={pathOf(instead)}>{instead.name}</Link>
            </Text>
          )}
        </section>
        <section className={classes.sideSection}>
          <h3 className={classes.sideHead}>Props</h3>
          <code className={classes.props}>{entry.props}</code>
        </section>
        {contract && <ContractPanel contract={contract} built={!entry.toCome} />}
      </aside>
    </article>
  );
}

/** A label that folds and unfolds what sits under it: a group's heading with its count, or a kind's line; whether it is open is kept by the gallery, so hiding the list forgets no fold. */
function Fold({
  label,
  count,
  open,
  onToggle,
  children,
}: {
  label: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const toggle = (
    <button type="button" className={classes.fold} aria-expanded={open} onClick={onToggle}>
      <IconChevronRight className={classes.chevron} data-open={open} size={12} aria-hidden="true" />
      {label}
    </button>
  );
  return (
    <section aria-label={label} className={count === undefined ? classes.kind : undefined}>
      {count === undefined ? (
        <div className={classes.kindHead}>{toggle}</div>
      ) : (
        <div className={classes.groupHead}>
          <Title order={2} fz={13}>
            {toggle}
          </Title>
          <Text span inherit fz={12}>
            {count}
          </Text>
        </div>
      )}
      <Collapse expanded={open} transitionDuration={0} keepMounted={false}>
        {children}
      </Collapse>
    </section>
  );
}

/** The design system's parts as a workbench: a list by level and kind that folds and hides, one part at a time, light whatever the device asks, in a colour theme of the viewer's choosing. */
export function Gallery({
  test,
}: {
  /** Tests set Mantine's test mode: jsdom has no layout, so in the default mode a dropdown reads
   * its field as out of sight and hides itself. */
  test?: boolean;
}) {
  const { pathname } = useLocation();
  const entry = partAt(pathname);
  const [listShown, setListShown] = useState(true);
  // The folds closed, by group, or by group and kind: kept here, outside the list a hide unmounts.
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
  const fold = (key: string) => ({
    open: !folded.has(key),
    onToggle: () =>
      setFolded((was) => {
        const next = new Set(was);
        if (!next.delete(key)) next.add(key);
        return next;
      }),
  });
  const [colour, setColour] = useState<string>(remembered);
  const choose = (next: string) => {
    setColour(next);
    remember(next);
  };
  const link = (part: Entry) => (
    <Link
      key={part.name}
      className={classes.link}
      to={pathOf(part)}
      aria-current={part === entry ? 'page' : undefined}
    >
      {part.name}
    </Link>
  );
  const picker = (
    <Select
      size="xs"
      label="Colour theme"
      data={THEMES}
      value={colour}
      allowDeselect={false}
      onOptionSubmit={choose}
    />
  );
  return (
    <CredoMantine colour={colour} test={test}>
      <title>Credo: the design system’s gallery</title>
      <meta name="robots" content="noindex" />
      <div className={classes.root}>
        <header className={classes.top}>
          <Burger
            size="sm"
            color="white"
            opened={listShown}
            aria-expanded={listShown}
            aria-label={listShown ? 'Hide the list' : 'Show the list'}
            onClick={() => setListShown(!listShown)}
          />
          <Title order={1} fz={14}>
            Design system
          </Title>
          {entry !== undefined && (
            <span className={classes.crumb}>
              <span>
                {[entry.group, ...(entry.kind === undefined ? [] : [entry.kind])].join(' / ')} /
              </span>{' '}
              <b>{entry.name}</b>
            </span>
          )}
        </header>
        <div className={classes.wrap}>
          {listShown && (
            <nav className={classes.list} aria-label="Parts">
              {GROUPS.map((group) => {
                const parts = ENTRIES.filter((each) => each.group === group);
                const kinds = [...new Set(parts.map((part) => part.kind))];
                return (
                  <Fold key={group} label={group} count={parts.length} {...fold(group)}>
                    {kinds.map((kind) => {
                      const links = parts.filter((part) => part.kind === kind).map(link);
                      return kind === undefined ? (
                        <Fragment key="">{links}</Fragment>
                      ) : (
                        <Fold key={kind} label={kind} {...fold(`${group}/${kind}`)}>
                          {links}
                        </Fold>
                      );
                    })}
                  </Fold>
                );
              })}
            </nav>
          )}
          {entry === undefined ? (
            <div className={classes.part}>
              <div className={classes.stage} role="status">
                <Text>No part has this address. Pick one from the list.</Text>
              </div>
              <div className={classes.side}>{picker}</div>
            </div>
          ) : (
            <Part key={entry.name} entry={entry} picker={picker} />
          )}
        </div>
      </div>
    </CredoMantine>
  );
}
