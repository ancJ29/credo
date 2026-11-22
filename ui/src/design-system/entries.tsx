import {
  Badge,
  Button,
  Checkbox,
  Divider,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  useMantineTheme,
} from '@mantine/core';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IconBuilding, IconKeyboard, IconLock, IconQrcode, IconUser } from '@tabler/icons-react';
import { BackLink } from '../components/atoms/BackLink';
import { DoorHeading } from '../components/atoms/DoorHeading';
import { FieldLabel } from '../components/atoms/FieldLabel';
import { LogoTile } from '../components/atoms/LogoTile';
import { StatusBadge, type Status } from '../components/atoms/StatusBadge';
import { BrandBand } from '../components/molecules/BrandBand';
import { DetailField } from '../components/molecules/DetailField';
import { SectionTitle } from '../components/molecules/SectionTitle';
import { DoorCard } from '../components/organisms/DoorCard';
import { PageHeader } from '../components/organisms/PageHeader';
import { SectionCard } from '../components/organisms/SectionCard';
import { Charter } from './Charter';
import { SAMPLES, useLanguage } from './samples';
import { OnTheBrand, OnTheLinks } from './OnTheBrand';
import {
  ActionButtonStates,
  ActionRowStates,
  FormMessageStates,
  PageStateStates,
  TableScrollStates,
} from './Contract';
import {
  DetailColumnsStates,
  FieldPairStates,
  ListTableStates,
  PageFrame,
  PageSample,
  PageShellStates,
} from './PageBase';
import {
  Formats,
  Icons,
  Roles,
  Shapes,
  Sizes,
  Spacing,
  Tones,
  Type,
  Weights,
  Widths,
} from './Values';

/** A sample company logo for the tile: a plain shape, no real company's. */
const SAMPLE_LOGO =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Cpath d='M6 34 20 6l14 28z' fill='teal'/%3E%3C/svg%3E";

/** Each status of a row, as the person reads it: the part draws its words from the stage's dictionary. */
function StatusRow({ statuses }: { statuses: Status[] }) {
  return (
    <Group>
      {statuses.map((status) => (
        <StatusBadge key={status} status={status} />
      ))}
    </Group>
  );
}

/** The old app's sign-in page as the card holds it, in sentence case: the first of the door card's two states. */
function SignInState() {
  const { t } = useTranslation();
  const words = SAMPLES[useLanguage()];
  return (
    <DoorCard name={words.shop} logo={SAMPLE_LOGO}>
      <Stack gap="md">
        <DoorHeading title={t('auth.title')} />
        <TextInput
          label={t('auth.username')}
          placeholder={t('auth.usernamePlaceholder')}
          leftSection={<IconUser size={18} />}
        />
        <PasswordInput
          label={t('auth.password')}
          placeholder={t('auth.passwordPlaceholder')}
          leftSection={<IconLock size={18} />}
        />
        <Checkbox defaultChecked label={words.remember} />
        <Button variant="gradient" size="md" fullWidth>
          {t('auth.submit')}
        </Button>
        <Divider label={words.or} />
        <Button variant="default" fullWidth leftSection={<IconQrcode size={18} />}>
          {words.useLink}
        </Button>
      </Stack>
    </DoorCard>
  );
}

/** The old app's login-link page as the card holds it: the second state. */
function LinkState() {
  const words = SAMPLES[useLanguage()];
  return (
    <DoorCard name={words.shop} logo={SAMPLE_LOGO}>
      <Stack gap="md" align="center">
        <Stack gap={0} w="100%">
          <DoorHeading title={words.linkTitle} subtitle={words.linkSubtitle} />
        </Stack>
        <Button variant="gradient" size="md" fullWidth leftSection={<IconQrcode size={18} />}>
          {words.scanQr}
        </Button>
        <Divider label={words.or} w="100%" />
        <Button variant="default" fullWidth leftSection={<IconKeyboard size={18} />}>
          {words.enterCode}
        </Button>
        <BackLink href="#">{words.backToSignIn}</BackLink>
      </Stack>
    </DoorCard>
  );
}

/** Mantine's own button, field, badge, gradient button, default button and labelled divider, worded in the picked language. */
function MantineSample({ state }: { state: string }) {
  const { t } = useTranslation();
  const words = SAMPLES[useLanguage()];
  if (state === 'Gradient button') {
    return (
      <Button variant="gradient" w={394} leftSection={<IconQrcode size={18} />}>
        {words.scanQr}
      </Button>
    );
  }
  if (state === 'Default button') {
    return (
      <Button variant="default" w={394} leftSection={<IconKeyboard size={18} />}>
        {words.enterCode}
      </Button>
    );
  }
  if (state === 'Labelled divider') return <Divider w={394} label={words.or} />;
  return (
    <Group align="flex-end">
      <Button>{words.save}</Button>
      <Button variant="default">{words.cancel}</Button>
      <TextInput label={t('staff.colName')} placeholder={words.aField} />
      <Badge>{words.aBadge}</Badge>
    </Group>
  );
}

/** A part's two or three plates of the sample kind that reads the stage's language, one component each. */
function DoorHeadingSample({ withSubtitle }: { withSubtitle: boolean }) {
  const { t } = useTranslation();
  const words = SAMPLES[useLanguage()];
  return (
    <Stack w={394} gap={0}>
      {withSubtitle ? (
        <DoorHeading title={words.linkTitle} subtitle={words.linkSubtitle} />
      ) : (
        <DoorHeading title={t('auth.title')} />
      )}
    </Stack>
  );
}

/** The back link, worded in the picked language. */
function BackLinkSample() {
  return <BackLink href="#">{SAMPLES[useLanguage()].backToSignIn}</BackLink>;
}

/** The field label, worded by the dictionary's phone column. */
function FieldLabelSample() {
  const { t } = useTranslation();
  return <FieldLabel>{t('staff.colPhone')}</FieldLabel>;
}

/** The detail field with a value, and with none. */
function DetailFieldSample() {
  const { t } = useTranslation();
  const words = SAMPLES[useLanguage()];
  return (
    <Group gap="xl">
      <DetailField label={t('staff.colPhone')} value={words.phone} />
      <DetailField label={words.email} />
    </Group>
  );
}

/** The section title, worded by the dictionary's basics line. */
function SectionTitleSample() {
  const { t } = useTranslation();
  return <SectionTitle icon={<IconBuilding size={14} />} label={t('settings.basics')} />;
}

/** The section card, with a field in it. */
function SectionCardSample() {
  const { t } = useTranslation();
  const words = SAMPLES[useLanguage()];
  return (
    <SectionCard icon={<IconBuilding size={14} />} title={t('settings.basics')}>
      <DetailField label={t('staff.colName')} value={words.shop} />
    </SectionCard>
  );
}

/** The page header at each state, worded by the dictionary's staff line. */
function PageHeaderSample({ state }: { state: string }) {
  const { t } = useTranslation();
  const words = SAMPLES[useLanguage()];
  return (
    <Stack w={640} maw="100%">
      {state === 'With actions' ? (
        <PageHeader title={t('nav.staff')} actions={<Button>{t('staff.add')}</Button>} />
      ) : state === 'Title only' ? (
        <PageHeader title={t('nav.staff')} />
      ) : (
        <PageHeader title={words.person} status="inactive" subtitle="NV-001" />
      )}
    </Stack>
  );
}

/** The levels of the list, in order. */
export const GROUPS = [
  'Start here',
  'Foundations',
  'Rules',
  'Pages',
  'Atoms',
  'Molecules',
  'Organisms',
] as const;

/** One part of the list: where it sits, its words, its props as the file declares them, its states. */
export type Entry = {
  group: (typeof GROUPS)[number];
  name: string;
  /** The kind it sits under inside its group in the list; a part with none sits straight under the group. */
  kind?: string;
  description: string;
  props: string;
  /** One to three short lines: when a screen builder uses this part. */
  useWhen: string[];
  /** One to three short lines: when not to, each saying what is right instead. */
  dontUseWhen: string[];
  /** The name of the entry to use instead, drawn as a link to it. */
  instead?: string;
  /** A part with a contract and no code yet: its entry is drawn from Mantine at the values it decides. */
  toCome?: true;
  states: { name: string; node: ReactNode }[];
};

/** A part's address segment: its name in lower case, hyphenated. */
export const slugOf = (name: string) =>
  name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function Palette() {
  const theme = useMantineTheme();
  return (
    <Group gap={0}>
      {theme.colors['brand'].map((shade, at) => (
        <Paper key={shade} h={40} w={40} bg={shade} radius={0} title={`brand ${at}`} />
      ))}
    </Group>
  );
}

/** Every part of the design system, by level, each in its states: the table the gallery's list is drawn from. */
export const ENTRIES: Entry[] = [
  {
    group: 'Start here',
    name: 'The charter',
    description:
      'What the guideline is for, what credo is, where a coder looks for a choice, and the rules that hold for every screen.',
    props: 'GUIDELINE.charter',
    useWhen: [
      'You are about to code a screen and have not read the guideline.',
      'A choice of look or feel comes up and you do not know where to look.',
    ],
    dontUseWhen: [
      'You need a colour, a text style or a gap: that is Values.',
      'A part already draws what you need: use the part.',
    ],
    instead: 'Values',
    states: [{ name: 'The charter', node: <Charter /> }],
  },
  {
    group: 'Foundations',
    name: 'Values',
    description:
      "The brand's ten shades, each text style with its size, line height, weight and spacing, each spacing step, width, icon size, corner and shadow with its use, the formats' places, each colour role with its value for the chosen colour and what it is for, and the four meanings a colour carries.",
    props:
      'theme.colors.brand · TYPE · WEIGHTS · SIZES · SPACING · WIDTHS · ICON_SIZES · RADII · ROLES · TONES',
    useWhen: [
      'You need a colour, a text style or a gap for a screen.',
      "You are choosing between the brand's shades or the colour roles.",
    ],
    dontUseWhen: [
      'A part already draws what you need: use the part, not its raw values.',
      "The text sits on the client's colour: that is On the brand's.",
    ],
    instead: 'On the brand',
    states: [
      { name: 'Palette', node: <Palette /> },
      { name: 'Type', node: <Type /> },
      { name: 'Weights', node: <Weights /> },
      { name: 'Sizes', node: <Sizes /> },
      { name: 'Spacing', node: <Spacing /> },
      { name: 'Widths', node: <Widths /> },
      { name: 'Icons', node: <Icons /> },
      { name: 'Corners and shadows', node: <Shapes /> },
      { name: 'Formats', node: <Formats /> },
      { name: 'Roles', node: <Roles /> },
      { name: 'Meanings', node: <Tones /> },
    ],
  },
  {
    group: 'Foundations',
    name: 'On the brand',
    description:
      "The text on a client's colour, the white before the rule beside the rule's pick (white where it reaches 4.5:1, else dark), for each of the six stock colours and two typed ones, with the least ratio against the surface's shades; and the links, shade 6 before beside the rule's pick on white.",
    props: 'onBrand(shades, surface) · surface: filled | header | menu · onWhite(shades, from)',
    useWhen: [
      "Text or a link sits on the client's colour, in a button, the header or the menu.",
      'You need to know which text colour a surface takes.',
    ],
    dontUseWhen: ["The text sits on white or a pale ground: Values' roles hold it."],
    instead: 'Values',
    states: [
      { name: 'Buttons', node: <OnTheBrand surface="filled" /> },
      { name: 'Header', node: <OnTheBrand surface="header" /> },
      { name: 'Menu', node: <OnTheBrand surface="menu" /> },
      { name: 'Links', node: <OnTheLinks /> },
    ],
  },
  {
    group: 'Foundations',
    name: 'Mantine, in the theme',
    description:
      "Mantine's own button, field and badge, as the theme dresses them; the gradient button, the default button and the labelled divider each have their own row.",
    props: 'Button · TextInput · Badge · Divider',
    useWhen: [
      'You need a button, a field, a badge or a divider no part of ours draws.',
      "You want to see how the theme dresses Mantine's own parts.",
    ],
    dontUseWhen: [
      'A part of ours already draws it: use that part.',
      'You want to choose a colour yourself: the theme gives them.',
    ],
    states: ['Button, field, badge', 'Gradient button', 'Default button', 'Labelled divider'].map(
      (name) => ({ name, node: <MantineSample state={name} /> }),
    ),
  },
  {
    group: 'Pages',
    name: 'The page base',
    description:
      'The frame every signed-in page sits in, then one page drawn from parts only, each slot named: the back link, the title, the actions, the body’s blocks and their fields, a status, the table and a message. A new page is built from these slots, and no style is chosen in it.',
    props: 'Shell · BackLink · PageShell · DetailColumns · SectionCard · FieldPair · ListTable',
    useWhen: [
      'You are about to build a signed-in page and need to know which parts it is made of.',
      'You need to know where a page’s back link, title, actions and blocks go.',
    ],
    dontUseWhen: [
      'A page a person reaches before signing in: that is DoorCard’s.',
      'A look the parts do not give: ask, and the guideline gains a part.',
    ],
    instead: 'DoorCard',
    states: [
      { name: 'The frame', node: <PageFrame /> },
      { name: 'A page, from parts', node: <PageSample /> },
    ],
  },
  {
    group: 'Pages',
    name: 'PageShell',
    kind: 'Layout',
    description:
      'The shell of a page: a way back above, its heading with the record’s status chip and what acts on it beside, then its body, drawn only when its data is ready.',
    props:
      "title: string · actions?: ReactNode · status: 'loading' | 'failed' | 'ready' · onRetry?: () => void · back?: { href: string; children: string } · recordStatus?: Status · subtitle?: string · children: ReactNode",
    useWhen: ['A signed-in page loads its data and shows it under its title.'],
    dontUseWhen: [
      'A page before sign-in: that is DoorCard’s.',
      'A heading alone, with no data to wait for: that is PageHeader’s.',
    ],
    instead: 'PageHeader',
    states: PageShellStates,
  },
  {
    group: 'Pages',
    name: 'DetailColumns',
    kind: 'Layout',
    description:
      'The two columns of a detail page: what identifies the record, and what acts on it beside; one column on a phone.',
    props: 'main: ReactNode · side?: ReactNode',
    useWhen: ['A record’s page holds its details and its actions in separate blocks.'],
    dontUseWhen: ['Two fields in a row: that is FieldPair’s.'],
    instead: 'FieldPair',
    states: DetailColumnsStates,
  },
  {
    group: 'Pages',
    name: 'FieldPair',
    kind: 'Layout',
    description: 'Two fields a row on a wide window, one over the other on a phone.',
    props: 'children: ReactNode',
    useWhen: [
      'Two fields of a block belong side by side, each a DetailField when it is read, not edited.',
    ],
    dontUseWhen: ['The blocks of a page: that is DetailColumns’.'],
    instead: 'DetailColumns',
    states: FieldPairStates,
  },
  {
    group: 'Pages',
    name: 'ListTable',
    kind: 'Lists',
    description:
      'A kind’s records as a table: its headings, a row each, the name linking to the record, the price at the right.',
    props: 'kind: customers | products · shown: ColumnKey[] · rows: Shown[] · language',
    useWhen: ['A page lists the records of a kind, one row each.'],
    dontUseWhen: ['A few facts about one record: that is DetailField’s.'],
    instead: 'DetailField',
    states: ListTableStates,
  },
  {
    group: 'Atoms',
    name: 'FieldLabel',
    kind: 'Text',
    description:
      "A label in small capitals, bold and spaced: the legacy's field and section label.",
    props: 'children: string',
    useWhen: ['A small capitalised label sits over a field or a value in a form.'],
    dontUseWhen: [
      "A section's title: that is SectionTitle's.",
      "A page's title: that is PageHeader's.",
    ],
    instead: 'SectionTitle',
    states: [{ name: 'Phone', node: <FieldLabelSample /> }],
  },
  {
    group: 'Atoms',
    name: 'DoorHeading',
    kind: 'Text',
    description:
      "A door's title as a heading, bold and centred, and a small dimmed subtitle beneath only when given.",
    props: 'title: string · subtitle?: string',
    useWhen: ["A door's title, and a subtitle only if it has one, at the top of a card."],
    dontUseWhen: [
      "A page's title with actions beside it: that is PageHeader's.",
      "A section's title inside a page: that is SectionTitle's.",
    ],
    instead: 'PageHeader',
    states: [
      { name: 'With subtitle', node: <DoorHeadingSample withSubtitle /> },
      { name: 'Title only', node: <DoorHeadingSample withSubtitle={false} /> },
    ],
  },
  {
    group: 'Atoms',
    name: 'BackLink',
    kind: 'Text',
    description:
      "A link back to where its caller says: a small arrow before its words, in the brand's shade 7.",
    props: 'href: string · children: string',
    useWhen: ['A page leads back to where it came from, as one line under its content.'],
    dontUseWhen: ['A button that does something: use a button.', 'A link inside running text.'],
    states: [{ name: 'Default', node: <BackLinkSample /> }],
  },
  {
    group: 'Atoms',
    name: 'LogoTile',
    kind: 'Marks',
    description:
      "A company's logo in a small tile with a pale brand line. With no logo, or one that fails to load, it draws nothing.",
    props: 'logo?: string · alt: string',
    useWhen: ["A company's logo appears alone, small, in a tile."],
    dontUseWhen: ["The logo beside the company's name: that is BrandBand's."],
    instead: 'BrandBand',
    states: [
      { name: 'With a logo', node: <LogoTile logo={SAMPLE_LOGO} alt="Sample company" /> },
      {
        name: 'No logo',
        node: (
          <Text size="sm" c="dimmed">
            <LogoTile alt="Sample company" />
            draws nothing
          </Text>
        ),
      },
    ],
  },
  {
    group: 'Atoms',
    name: 'StatusBadge',
    kind: 'Marks',
    description:
      'A status as a chip: the part decides its tone and its word, in the language of the person reading.',
    props: 'status: Status',
    useWhen: ['A record’s status is shown as a chip beside its name or in its row.'],
    dontUseWhen: [
      'A message to the person: that is FormMessage’s.',
      'A status of no record, or a colour of the screen’s own choosing: ask, and the guideline gains a status.',
    ],
    instead: 'FormMessage',
    states: [
      {
        name: 'An order',
        node: <StatusRow statuses={['draft', 'confirmed', 'fulfilled', 'cancelled']} />,
      },
      {
        name: 'A delivery request',
        node: <StatusRow statuses={['waiting', 'delivered', 'cancelled']} />,
      },
      { name: 'A person', node: <StatusRow statuses={['active', 'inactive']} /> },
    ],
  },
  {
    group: 'Atoms',
    name: 'ActionButton',
    kind: 'Buttons',
    description:
      'The button a page offers an act with: its meaning (the main action, another, a quiet one or a danger) decides its look, at one size and the width of its words; an address makes it a link, busy shows the loader and takes no second press.',
    props:
      "meaning: 'main' | 'other' | 'quiet' | 'danger' · children: string · onClick?: () => void · to?: string · submit?: boolean · busy?: boolean · disabled?: boolean · icon?: ReactNode · label?: string",
    useWhen: [
      'A page offers an act: one main action a page, the others as other or quiet.',
      'A delete’s last step, on the page that confirms it, is a danger.',
      'A move to another page that is itself the act, an add or an open: give it an address and it is drawn as a link.',
    ],
    dontUseWhen: [
      'A move back to where the person came from: that is BackLink’s.',
      'A second main action on one page: ask which is the main.',
    ],
    instead: 'BackLink',
    states: ActionButtonStates,
  },
  {
    group: 'Molecules',
    name: 'ActionRow',
    kind: 'Buttons',
    description:
      'The buttons of a block in one row, in the order they are read, at the end of the block, with one gap between them. Mantine Group, at the values it decides.',
    props: 'children: ReactNode',
    useWhen: ['A block of a page ends in two or more buttons, or in one: give them to the row.'],
    dontUseWhen: [
      'A single button beside a page’s title: that is PageHeader’s actions; two or more go in a row there, an ActionRow handed to its actions.',
      'A button under a message: that is FormMessage’s act.',
    ],
    instead: 'PageHeader',
    states: ActionRowStates,
  },
  {
    group: 'Molecules',
    name: 'TableScroll',
    kind: 'Lists',
    description:
      'A frame for a table: below its least width the table scrolls sideways inside it and its columns keep their room, never the page. Mantine table scroll container, at the width it decides.',
    props: 'children: ReactNode',
    useWhen: ['A page draws a table of its own: wrap it, so it has the one least width.'],
    dontUseWhen: [
      'A kind’s list of customers or products: that is ListTable’s, which scrolls itself.',
    ],
    instead: 'ListTable',
    states: TableScrollStates,
  },
  {
    group: 'Molecules',
    name: 'BrandBand',
    kind: 'Headings',
    description:
      "The company's logo tile beside its name, bold and centred on the brand's palest shade, a brand-1 line beneath.",
    props: 'name: string · logo?: string',
    useWhen: ["The company's logo and name lead a door or a card."],
    dontUseWhen: ["The logo alone: that is LogoTile's.", "A page's title: that is PageHeader's."],
    instead: 'LogoTile',
    states: [
      {
        name: 'Default',
        node: (
          <Stack w={474} maw="100%" gap={0}>
            <BrandBand name="Công ty TNHH Acme" logo={SAMPLE_LOGO} />
          </Stack>
        ),
      },
    ],
  },
  {
    group: 'Molecules',
    name: 'DetailField',
    kind: 'Fields',
    description: 'A label over its value; with no value, a dash. It takes its words as props.',
    props: 'label: string · value?: string',
    useWhen: ["A record's label and its value are read, not edited."],
    dontUseWhen: [
      'The value is edited: use a field.',
      "A section's title: that is SectionTitle's.",
      'Two of them in a row: put them in a FieldPair, which lays out the row.',
    ],
    instead: 'FieldLabel',
    states: [
      {
        name: 'With a value, and with none',
        node: <DetailFieldSample />,
      },
    ],
  },
  {
    group: 'Molecules',
    name: 'SectionTitle',
    kind: 'Headings',
    description: "A section's title: a grey icon tile beside a small, bold label in capitals.",
    props: 'icon: ReactNode · label: string',
    useWhen: ['A section of a page or a card opens with its icon and a short label.'],
    dontUseWhen: [
      "The page's own title: that is PageHeader's.",
      "A label over one field: that is FieldLabel's.",
    ],
    instead: 'PageHeader',
    states: [{ name: 'Default', node: <SectionTitleSample /> }],
  },
  {
    group: 'Molecules',
    name: 'FormMessage',
    kind: 'Messages',
    description:
      'A message to the person, by its kind: its colour and spoken role follow the kind, and a standing note from the page load is spoken as a note.',
    props:
      "kind: 'error' | 'warning' | 'success' | 'info' | 'saved' · title?: string · standing?: boolean · act?: ReactNode · children: ReactNode",
    useWhen: [
      'A form or an act tells the person what happened: it failed, it needs care, it worked.',
      'The message of a save, once, in the column of the form it saved.',
    ],
    dontUseWhen: [
      'A page that cannot load, or has nothing: that is PageState’s.',
      'A mark on a record, as active or not: that is StatusBadge’s.',
    ],
    instead: 'PageState',
    states: FormMessageStates,
  },
  {
    group: 'Organisms',
    name: 'DoorCard',
    kind: 'Cards',
    description:
      "A door's card: a bar in the brand's gradient across its top, the company's band, then what it holds.",
    props: 'name: string · logo?: string · children: ReactNode',
    useWhen: ['A page a person reaches before sign-in, the card holding its words and buttons.'],
    dontUseWhen: [
      "A block inside a signed-in page: that is SectionCard's.",
      "The card `SignInFrame` (`ui/src/pages/SignIn.tsx`) draws for itself: this card is the one to use, and the frame's moves to it (open item 651).",
    ],
    instead: 'SectionCard',
    states: [
      {
        name: 'Sign-in',
        node: (
          <Stack w={474} maw="100%">
            <SignInState />
          </Stack>
        ),
      },
      {
        name: 'Login link',
        node: (
          <Stack w={474} maw="100%">
            <LinkState />
          </Stack>
        ),
      },
    ],
  },
  {
    group: 'Organisms',
    name: 'SectionCard',
    kind: 'Cards',
    description: 'A bordered block: a section title over what it holds. No edit mode.',
    props: 'icon: ReactNode · title: string · children: ReactNode',
    useWhen: ['A signed-in page groups its fields or details in a block with a title.'],
    dontUseWhen: [
      "A page before sign-in: that is DoorCard's.",
      'Content with no title: no card, only the page.',
    ],
    instead: 'DoorCard',
    states: [
      {
        name: 'Default',
        node: <SectionCardSample />,
      },
    ],
  },
  {
    group: 'Organisms',
    name: 'PageHeader',
    kind: 'Headers',
    description:
      "A page's heading, with what acts on the page beside it. A record's status is a chip beside the title, and a subtitle the line under it, dimmed and close to it. No phone variant.",
    props: 'title: string · actions?: ReactNode · status?: Status · subtitle?: string',
    useWhen: ['A page opens with its title, and the actions that act on the whole page beside it.'],
    dontUseWhen: [
      "A section inside the page: that is SectionTitle's.",
      "The title of a card before sign-in: that is DoorHeading's.",
    ],
    instead: 'SectionTitle',
    states: [
      {
        name: 'With actions',
        node: <PageHeaderSample state="With actions" />,
      },
      {
        name: 'Title only',
        node: <PageHeaderSample state="Title only" />,
      },
      {
        name: 'With status and subtitle',
        node: <PageHeaderSample state="With status and subtitle" />,
      },
    ],
  },
  {
    group: 'Organisms',
    name: 'PageState',
    kind: 'States',
    description:
      'What a whole page shows in the place of its body when its data is not a list or a record: loading, failed with a retry, forbidden, nothing, empty with an add, or not found. A failed load is an error message with a default-look retry under it, the rest a title over words, spoken as a status; the loader is named and with a least height.',
    props:
      "state: 'loading' | 'failed' | 'forbidden' | 'nothing' | 'empty' | 'notFound' · title?: string · onRetry?: () => void · add?: ReactNode · children?: string",
    useWhen: [
      'A page’s data is loading, failed, forbidden, empty or missing, and the page says so in the place of its body.',
    ],
    dontUseWhen: [
      'A message under a form’s buttons: that is FormMessage’s.',
      'A page with its data: draw the page.',
    ],
    instead: 'FormMessage',
    states: PageStateStates,
  },
];
