import { Alert, Button, Group, Paper, Stack, Text } from '@mantine/core';
import { IconBuilding, IconList, IconUser } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { BackLink } from '../components/atoms/BackLink';
import { StatusBadge } from '../components/atoms/StatusBadge';
import { DetailField } from '../components/molecules/DetailField';
import { SectionCard } from '../components/organisms/SectionCard';
import { createI18n } from '../i18n';
import type { Shown } from '../listSheet';
import { DetailColumns, FieldPair } from '../parts/DetailCards';
import { ListTable } from '../parts/ListTable';
import { PageShell } from '../parts/PageShell';
import { TONES, TYPE } from './tokens';

/** The words the parts draw themselves (a loader's name, a status's word), in English. */
const SAMPLE_WORDS = createI18n('en');

/** A retry that asks nothing: the sample's data is no one's. */
const NO_RETRY = () => undefined;

/** Three sample records, no real person's. */
const ROWS: Shown[] = [
  { id: '1', code: 'C001', name: 'An Nguyen', phone: '0901 234 567' },
  { id: '2', code: 'C002', name: 'Binh Tran', phone: '0902 345 678' },
  { id: '3', code: 'C003', name: 'Chi Le', phone: '0903 456 789' },
];

/** What a part is drawn in: the sample's words for the parts that speak, and a column's room. */
function Sample({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <I18nextProvider i18n={SAMPLE_WORDS}>
      <Stack w={wide ? 960 : 640} maw="100%">
        {children}
      </Stack>
    </I18nextProvider>
  );
}

/** One slot of the frame, named and said in a line. */
function Slot({ name, line }: { name: string; line: string }) {
  return (
    <Stack gap={0}>
      <Text {...TYPE.fieldLabel}>{name}</Text>
      <Text {...TYPE.caption}>{line}</Text>
    </Stack>
  );
}

/** The frame every signed-in page sits in, `ui/src/frame/Shell.tsx`, drawn as its four slots. */
export function PageFrame() {
  return (
    <Stack gap={0} w={640} maw="100%">
      <Paper withBorder p="sm" radius={0}>
        <Slot
          name="Header"
          line="The company’s name and mark, the language, the person; the client’s colour."
        />
      </Paper>
      <Group gap={0} align="stretch" wrap="nowrap">
        <Paper withBorder p="sm" radius={0} w={180}>
          <Slot
            name="Menu"
            line="The pages, at the side; below the small width it is the phone bar."
          />
        </Paper>
        <Paper withBorder p="md" radius={0} style={{ flex: 1 }} bg="var(--credo-surface-sunken)">
          <Slot
            name="Page"
            line="The page, set in the frame’s padding: every page below is drawn here."
          />
        </Paper>
      </Group>
      <Paper withBorder p="sm" radius={0}>
        <Slot name="Phone bar" line="Below the small width the menu moves here, under the page." />
      </Paper>
    </Stack>
  );
}

/** A page drawn from parts only, slot by slot: every look in it is a part's. */
export function PageSample() {
  return (
    <Sample wide>
      <BackLink href="#">Back to staff</BackLink>
      <PageShell
        title="Staff member"
        actions={<Button>Save</Button>}
        status="ready"
        onRetry={NO_RETRY}
      >
        <DetailColumns
          main={
            <Stack gap="lg">
              <SectionCard icon={<IconUser size={14} />} title="Basics">
                <FieldPair>
                  <DetailField label="Name" value="An Nguyen" />
                  <DetailField label="Phone" value="0901 234 567" />
                </FieldPair>
                <StatusBadge status="active" />
              </SectionCard>
              <SectionCard icon={<IconList size={14} />} title="Customers">
                <ListTable
                  kind="customers"
                  shown={['code', 'name', 'phone']}
                  rows={ROWS}
                  language="en"
                />
              </SectionCard>
            </Stack>
          }
          side={
            <SectionCard icon={<IconBuilding size={14} />} title="Actions">
              <Alert color={TONES.info} role="status">
                Changes are kept when you save.
              </Alert>
            </SectionCard>
          }
        />
      </PageShell>
    </Sample>
  );
}

/** A block of sample words to stand in a column. */
function Block({ title }: { title: string }) {
  return (
    <SectionCard icon={<IconBuilding size={14} />} title={title}>
      <DetailField label="Name" value="A shop" />
    </SectionCard>
  );
}

/** The page shell in each state of its data. */
export const PageShellStates = (['Ready', 'Loading', 'Failed'] as const).map((name) => ({
  name,
  node: (
    <Sample>
      <PageShell
        title="Staff"
        actions={<Button>Add</Button>}
        status={name === 'Ready' ? 'ready' : name === 'Loading' ? 'loading' : 'failed'}
        onRetry={NO_RETRY}
      >
        <Block title="Basics" />
      </PageShell>
    </Sample>
  ),
}));

/** The two columns of a detail page, with and without a side. */
export const DetailColumnsStates = [
  {
    name: 'Main and side',
    node: (
      <Sample wide>
        <DetailColumns main={<Block title="Basics" />} side={<Block title="Actions" />} />
      </Sample>
    ),
  },
  {
    name: 'Main only',
    node: (
      <Sample wide>
        <DetailColumns main={<Block title="Basics" />} />
      </Sample>
    ),
  },
];

/** A row of two fields. */
export const FieldPairStates = [
  {
    name: 'Two fields',
    node: (
      <Sample>
        <FieldPair>
          <DetailField label="Name" value="An Nguyen" />
          <DetailField label="Phone" value="0901 234 567" />
        </FieldPair>
      </Sample>
    ),
  },
];

/** A list as its table. */
export const ListTableStates = [
  {
    name: 'Default',
    node: (
      <Sample>
        <ListTable kind="customers" shown={['code', 'name', 'phone']} rows={ROWS} language="en" />
      </Sample>
    ),
  },
];
