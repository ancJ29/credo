import { Alert, Button, Group, Paper, Stack, Text } from '@mantine/core';
import { IconBuilding, IconList, IconUser } from '@tabler/icons-react';
import type { Language } from '@credo/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BackLink } from '../components/atoms/BackLink';
import { StatusBadge } from '../components/atoms/StatusBadge';
import { DetailField } from '../components/molecules/DetailField';
import { SectionCard } from '../components/organisms/SectionCard';
import type { Shown } from '../listSheet';
import { DetailColumns, FieldPair } from '../parts/DetailCards';
import { ListTable } from '../parts/ListTable';
import { PageShell } from '../parts/PageShell';
import { SAMPLES, useLanguage } from './samples';
import { TONES, TYPE } from './tokens';

/** A retry that asks nothing: the sample's data is no one's. */
const NO_RETRY = () => undefined;

/** Three sample records, no real person's, named in the picked language. */
function rowsOf(language: Language): Shown[] {
  return SAMPLES[language].people.map((person, index) => ({
    id: String(index + 1),
    code: `C00${index + 1}`,
    ...person,
  }));
}

/** What a part is drawn in: a column's room, the words coming from the gallery's provider. */
function Sample({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <Stack w={wide ? 960 : 640} maw="100%">
      {children}
    </Stack>
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
  const { t } = useTranslation();
  const language = useLanguage();
  const words = SAMPLES[language];
  return (
    <Sample wide>
      <BackLink href="#">{t('staff.back')}</BackLink>
      <PageShell
        title={words.staffMember}
        actions={<Button>{t('person.save')}</Button>}
        status="ready"
        onRetry={NO_RETRY}
      >
        <DetailColumns
          main={
            <Stack gap="lg">
              <SectionCard icon={<IconUser size={14} />} title={t('person.basic')}>
                <FieldPair>
                  <DetailField label={t('person.name')} value={words.person} />
                  <DetailField label={t('person.phone')} value={words.phone} />
                </FieldPair>
                <StatusBadge status="active" />
              </SectionCard>
              <SectionCard icon={<IconList size={14} />} title={t('nav.customers')}>
                <ListTable
                  kind="customers"
                  shown={['code', 'name', 'phone']}
                  rows={rowsOf(language)}
                  language={language}
                />
              </SectionCard>
            </Stack>
          }
          side={
            <SectionCard icon={<IconBuilding size={14} />} title={words.actions}>
              <Alert color={TONES.info} role="status">
                {words.changesKept}
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
  {
    name: 'Side first',
    node: (
      <Sample wide>
        <DetailColumns sideFirst main={<Block title="Basics" />} side={<Block title="Preview" />} />
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

/** A list as its table, its headings and names in the picked language. */
function ListTableSample() {
  const language = useLanguage();
  return (
    <Sample>
      <ListTable
        kind="customers"
        shown={['code', 'name', 'phone']}
        rows={rowsOf(language)}
        language={language}
      />
    </Sample>
  );
}

/** A list as its table. */
export const ListTableStates = [{ name: 'Default', node: <ListTableSample /> }];
