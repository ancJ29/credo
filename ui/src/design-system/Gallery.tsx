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
import { IconBuilding } from '@tabler/icons-react';
import { FieldLabel } from '../components/atoms/FieldLabel';
import { StatusBadge } from '../components/atoms/StatusBadge';
import { DetailField } from '../components/molecules/DetailField';
import { SectionTitle } from '../components/molecules/SectionTitle';
import { PageHeader } from '../components/organisms/PageHeader';
import { SectionCard } from '../components/organisms/SectionCard';
import { designThemeOf } from './theme';

/** Every component of `components/`, by level, drawn in its states. A level with none says so. */
const LEVELS: { level: string; heading: string; entries: Record<string, ReactNode> }[] = [
  {
    level: 'atoms',
    heading: 'Atoms',
    entries: {
      FieldLabel: <FieldLabel>Phone</FieldLabel>,
      StatusBadge: (
        <Group>
          <StatusBadge active label="Active" />
          <StatusBadge active={false} label="Inactive" />
        </Group>
      ),
    },
  },
  {
    level: 'molecules',
    heading: 'Molecules',
    entries: {
      DetailField: (
        <Group>
          <DetailField label="Phone" value="0901 234 567" />
          <DetailField label="Email" />
        </Group>
      ),
      SectionTitle: <SectionTitle icon={<IconBuilding size={14} />} label="Basics" />,
    },
  },
  {
    level: 'organisms',
    heading: 'Organisms',
    entries: {
      SectionCard: (
        <SectionCard icon={<IconBuilding size={14} />} title="Basics">
          <DetailField label="Name" value="A shop" />
        </SectionCard>
      ),
      PageHeader: <PageHeader title="Staff" actions={<Button>Add</Button>} />,
    },
  },
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
            </Stack>
          ))}
        </Stack>
      </Container>
    </MantineProvider>
  );
}
