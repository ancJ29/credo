import {
  Burger,
  Button,
  Collapse,
  Group,
  MantineProvider,
  NativeSelect,
  Text,
  Title,
} from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import { CREDO_COLOUR } from '@credo/shared';
import { Fragment, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { ENTRIES, GROUPS, slugOf, type Entry } from './entries';
import classes from './Gallery.module.css';
import { themeOf } from './appTheme';
import { PALETTES } from './palettes';

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

/** One part: its group, name, description, props and states, all side by side or one at a time. */
function Part({ entry }: { entry: Entry }) {
  const [alone, setAlone] = useState(false);
  const [at, setAt] = useState(0);
  const shown = alone ? [entry.states[at]] : entry.states;
  return (
    <article className={classes.part}>
      <Text size="xs" c="dimmed">
        {entry.group}
      </Text>
      <Title order={2}>{entry.name}</Title>
      <Text c="dimmed" maw="70ch" mt={4} mb="sm">
        {entry.description}
      </Text>
      <code className={classes.props}>{entry.props}</code>
      {entry.states.length > 1 && (
        <Group gap="md" my="md">
          <Text size="xs" c="dimmed">
            Show
          </Text>
          <Button.Group>
            <Button
              size="xs"
              variant={alone ? 'default' : 'filled'}
              aria-pressed={!alone}
              onClick={() => setAlone(false)}
            >
              All states side by side
            </Button>
            <Button
              size="xs"
              variant={alone ? 'filled' : 'default'}
              aria-pressed={alone}
              onClick={() => setAlone(true)}
            >
              One state at a time
            </Button>
          </Button.Group>
        </Group>
      )}
      {alone && (
        <Group gap="xs" mb="md" aria-label="States">
          {entry.states.map((state, index) => (
            <Button
              key={state.name}
              size="compact-xs"
              variant={index === at ? 'light' : 'default'}
              aria-pressed={index === at}
              onClick={() => setAt(index)}
            >
              {state.name}
            </Button>
          ))}
        </Group>
      )}
      <div className={classes.states}>
        {shown.map((state) => (
          <section key={state.name} aria-label={state.name} className={classes.state}>
            <h3 className={classes.stateName}>{state.name}</h3>
            <div className={classes.stage}>{state.node}</div>
          </section>
        ))}
      </div>
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
          <Title order={2} fz={11} tt="uppercase" lts={0.5}>
            {toggle}
          </Title>
          <Text span inherit fz={11}>
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
export function Gallery() {
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
  return (
    <MantineProvider theme={themeOf(colour)} forceColorScheme="light">
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
          <Title order={1} fz={16}>
            Design system
          </Title>
          <Text span inherit opacity={0.85}>
            Every part, one at a time
          </Text>
          <span className={classes.address}>{BASE}</span>
          <NativeSelect
            size="xs"
            aria-label="Colour theme"
            data={THEMES}
            value={colour}
            onChange={(event) => choose(event.currentTarget.value)}
          />
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
            <div className={classes.part} role="status">
              <Text>No part has this address. Pick one from the list.</Text>
            </div>
          ) : (
            <Part key={entry.name} entry={entry} />
          )}
        </div>
      </div>
    </MantineProvider>
  );
}
