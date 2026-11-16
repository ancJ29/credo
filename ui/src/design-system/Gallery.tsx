import {
  Badge,
  Button,
  Container,
  Group,
  MantineProvider,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
  useMantineTheme,
} from '@mantine/core';
import { CREDO_COLOUR } from '@credo/shared';
import type { ReactNode } from 'react';
import { StatusBadge } from '../components/atoms/StatusBadge';
import { designThemeOf } from './theme';

/** Every component of `components/`, by level, drawn in its states. A level with none says so. */
const LEVELS: { level: string; heading: string; entries: Record<string, ReactNode> }[] = [
  {
    level: 'atoms',
    heading: 'Atoms',
    entries: {
      StatusBadge: (
        <Group>
          <StatusBadge active label="Active" />
          <StatusBadge active={false} label="Inactive" />
        </Group>
      ),
    },
  },
  { level: 'molecules', heading: 'Molecules', entries: {} },
  { level: 'organisms', heading: 'Organisms', entries: {} },
];

function Values() {
  const theme = useMantineTheme();
  return (
    <Stack>
      <Title order={2}>Values</Title>
      <Group gap={0} aria-label="Palette">
        {theme.colors['brand'].map((shade, at) => (
          <Paper key={shade} h={40} w={40} bg={shade} radius={0} title={`brand ${at}`} />
        ))}
      </Group>
      <Text size="sm">Type: {theme.fontFamily}</Text>
      <Text size="sm">Gaps: {Object.values(theme.spacing).join(', ')}</Text>
    </Stack>
  );
}

function Mantines() {
  return (
    <Stack>
      <Title order={2}>Mantine, in the theme</Title>
      <Group>
        <Button>Save</Button>
        <Button variant="default">Cancel</Button>
        <TextInput label="Name" placeholder="A field" />
        <Badge>A badge</Badge>
      </Group>
    </Stack>
  );
}

/** The design system's parts on one page, light whatever the device asks. */
export function Gallery() {
  return (
    <MantineProvider theme={designThemeOf(CREDO_COLOUR)} forceColorScheme="light">
      <Container py="lg">
        <Stack gap="xl">
          <Title order={1}>Design system</Title>
          <Values />
          <Mantines />
          {LEVELS.map(({ level, heading, entries }) => (
            <Stack key={level}>
              <Title order={2}>{heading}</Title>
              {Object.entries(entries).map(([name, node]) => (
                <Stack key={name} gap="xs">
                  <Title order={3}>{name}</Title>
                  {node}
                </Stack>
              ))}
              {Object.keys(entries).length === 0 && <Text c="dimmed">Nothing yet.</Text>}
            </Stack>
          ))}
        </Stack>
      </Container>
    </MantineProvider>
  );
}
