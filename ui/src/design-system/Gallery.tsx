import { Button, Group, MantineProvider, Text, Title } from '@mantine/core';
import { CREDO_COLOUR } from '@credo/shared';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { ENTRIES, GROUPS, slugOf, type Entry } from './entries';
import classes from './Gallery.module.css';
import { designThemeOf } from './theme';

/** The gallery's own address: the page and what is below it. */
const BASE = '/48b74d079/gallery';

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

/** The design system's parts as a workbench: a list by level, one part at a time, light whatever the device asks. */
export function Gallery() {
  const { pathname } = useLocation();
  const entry = partAt(pathname);
  return (
    <MantineProvider theme={designThemeOf(CREDO_COLOUR)} forceColorScheme="light">
      <title>Credo: the design system’s gallery</title>
      <meta name="robots" content="noindex" />
      <div className={classes.root}>
        <header className={classes.top}>
          <Title order={1} fz={16}>
            Design system
          </Title>
          <Text span inherit opacity={0.85}>
            Every part, one at a time
          </Text>
          <span className={classes.address}>{BASE}</span>
        </header>
        <div className={classes.wrap}>
          <nav className={classes.list} aria-label="Parts">
            {GROUPS.map((group) => {
              const parts = ENTRIES.filter((each) => each.group === group);
              return (
                <section key={group} aria-label={group}>
                  <div className={classes.groupHead}>
                    <Title order={2} fz={11} tt="uppercase" lts={0.5}>
                      {group}
                    </Title>
                    <Text span inherit fz={11}>
                      {parts.length}
                    </Text>
                  </div>
                  {parts.map((part) => (
                    <Link
                      key={part.name}
                      className={classes.link}
                      to={pathOf(part)}
                      aria-current={part === entry ? 'page' : undefined}
                    >
                      {part.name}
                    </Link>
                  ))}
                </section>
              );
            })}
          </nav>
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
