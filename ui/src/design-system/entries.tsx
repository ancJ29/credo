import {
  Badge,
  Box,
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
import type { Language } from '@credo/shared';
import { useTranslation } from 'react-i18next';
import {
  IconBuilding,
  IconKey,
  IconKeyboard,
  IconLock,
  IconQrcode,
  IconUser,
} from '@tabler/icons-react';
import { BackLink } from '../components/atoms/BackLink';
import { BrandName } from '../components/atoms/BrandName';
import { DoorHeading } from '../components/atoms/DoorHeading';
import { FieldLabel } from '../components/atoms/FieldLabel';
import { LogoTile } from '../components/atoms/LogoTile';
import { StatusBadge, type Status } from '../components/atoms/StatusBadge';
import { BrandBand } from '../components/molecules/BrandBand';
import { DetailField } from '../components/molecules/DetailField';
import { SectionTitle } from '../components/molecules/SectionTitle';
import { DoorCard } from '../components/organisms/DoorCard';
import { DoorPage } from '../components/organisms/DoorPage';
import { PageHeader } from '../components/organisms/PageHeader';
import { SectionCard } from '../components/organisms/SectionCard';
import { CREDO_BRAND } from '../brand';
import { headerLook } from '../frame/Shell';
import { LANGUAGE_NAMES } from '../i18n';
import { Charter } from './Charter';
import { ScanCard } from './ScanStates';
import { SignUpCard, UnknownAddressSample } from './SignUpStates';
import { ColourScope } from './ColourScope';
import { PALETTES } from './palettes';
import { WEIGHTS } from './tokens';
import { ChoiceStates } from './Choices';
import { MenuStates } from './Menus';
import { PhotoStates } from './Photos';
import { LinkStates } from './Links';
import { DialogStates } from './Dialog';
import { FieldStates } from './Fields';
import { SAMPLES, useLanguage } from './samples';
import { OnTheBrand, OnTheLinks } from './OnTheBrand';
import {
  ConfirmPageStates,
  SettingsPageStates,
  BrandPreviewStates,
  IdentityFieldsStates,
  DaySheetStates,
  FormPageStates,
  ImportPageStates,
  ListPageStates,
  MenuPageStates,
  PhonePageStates,
} from './Pages';
import {
  ActionButtonStates,
  ActionRowStates,
  CopyTextStates,
  DataTableStates,
  FormMessageStates,
  MenuRowStates,
  TagStates,
  PageStateStates,
  PanelStates,
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

/** A sample company logo for the tile: Tabler's Adobe icon (3.49.0) at stroke 2, in teal, the human's choice for the gallery's sample. */
const SAMPLE_LOGO =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='teal' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12.893 4.514l7.977 14a.993 .993 0 0 1 -.394 1.365a1.04 1.04 0 0 1 -.5 .127h-3.476l-4.5 -8l-2.5 4h1.5l2 4h-8.977c-.565 0 -1.023 -.45 -1.023 -1c0 -.171 .045 -.34 .13 -.49l7.977 -13.993a1.034 1.034 0 0 1 1.786 0l0 -.009'/%3E%3C/svg%3E";

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

/** The company name in the four ways the atom draws it, on white or on the coloured header: plain, formatted, the colours given way, and a formatted name with nothing left after cleaning. */
function BrandNameSample({ state }: { state: 'plain' | 'formatted' | 'header' | 'nothing' }) {
  const words = SAMPLES[useLanguage()];
  const formatted = state === 'formatted' || state === 'header';
  const name = (
    <BrandName
      name={words.shop}
      formatted={
        state === 'nothing'
          ? '<script>x</script> <br>'
          : formatted
            ? words.shopFormatted
            : undefined
      }
      colours={state !== 'header'}
    />
  );
  if (state !== 'header') return <Text fw={WEIGHTS.title}>{name}</Text>;
  return (
    <ColourScope colour={PALETTES[2].shades[7]}>
      <div {...headerLook(false)}>
        <Group h={56} px="md">
          <Text fw={WEIGHTS.title} c="inherit">
            {name}
          </Text>
        </Group>
      </div>
    </ColourScope>
  );
}

/** The company's formatted name and description on a band, in the picked language. */
function FormattedBand() {
  const words = SAMPLES[useLanguage()];
  return (
    <BrandBand
      name={words.shop}
      logo={SAMPLE_LOGO}
      formatted={words.shopFormatted}
      description={words.shopDescription}
    />
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
        <Checkbox defaultChecked label={t('auth.remember')} />
        <Button variant="gradient" size="md" fullWidth>
          {t('auth.submit')}
        </Button>
        <Divider label={t('auth.or')} />
        <Button variant="default" fullWidth leftSection={<IconKey size={18} />}>
          {t('auth.passkey')}
        </Button>
        <Button variant="default" fullWidth leftSection={<IconQrcode size={18} />}>
          {t('qrScan.button')}
        </Button>
      </Stack>
    </DoorCard>
  );
}

/** One door's screen as the gallery draws it: the sweep, the switch where there are two languages, a card of the company's or credo's own. */
function DoorPageSample({
  credo,
  languages,
}: {
  credo?: boolean;
  languages?: readonly Language[];
}) {
  const { t, i18n } = useTranslation();
  const words = SAMPLES[useLanguage()];
  return (
    <Box style={{ '--door-page-height': '460px' }}>
      <DoorPage
        languages={languages?.map((language) => ({ language, name: LANGUAGE_NAMES[language] }))}
        onLanguage={languages ? (language) => void i18n.changeLanguage(language) : undefined}
      >
        <DoorCard
          name={credo ? CREDO_BRAND.name : words.shop}
          logo={credo ? undefined : SAMPLE_LOGO}
        >
          <Stack gap="md">
            <DoorHeading title={t('auth.title')} />
            <TextInput
              label={t('auth.username')}
              placeholder={t('auth.usernamePlaceholder')}
              leftSection={<IconUser size={18} />}
            />
            <Button variant="gradient" size="md" fullWidth>
              {t('auth.submit')}
            </Button>
          </Stack>
        </DoorCard>
      </DoorPage>
    </Box>
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
  /** What a new page of this kind must have, one short line each: only a kind of page has them. */
  mustHave?: string[];
  /** A state drawn `phone` stands in a frame as wide as a phone, where the app's breakpoints answer to it. */
  states: { name: string; node: ReactNode; phone?: true }[];
};

/** The kind a page of the app's own sits under in Pages: each entry in it carries `mustHave`. */
export const KIND_OF_PAGE = 'Kinds of page';

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
    kind: 'Mantine’s own',
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
    group: 'Foundations',
    name: 'Fields',
    kind: 'Mantine’s own',
    description:
      'Mantine’s own fields as the theme dresses them: text, password, number, long text, drop-down, file and colour, each with a label and a hint, with an error and read-only, and the staff list’s filter bar of a search and three drop-downs.',
    props:
      'TextInput · PasswordInput · NumberInput · Textarea · NativeSelect · type="file" · ColorInput · label · description · error · readOnly',
    useWhen: [
      'A person types or picks one value: a name, a password, an amount, a note or one of a list.',
      'A list narrows by a search and drop-downs: the filter bar.',
    ],
    dontUseWhen: [
      'A record’s value is only read: that is DetailField’s.',
      'A choice of a few shown at once: a tick box or a switch.',
    ],
    instead: 'DetailField',
    states: FieldStates,
  },
  {
    group: 'Foundations',
    name: 'Choices',
    kind: 'Mantine’s own',
    description:
      'Mantine’s own choices as the theme dresses them: a tick box and a list of them, a switch, a one-of-many list and the segmented pick, as the settings page and the permission editor draw them.',
    props:
      'Checkbox · Checkbox.Group · Switch · Radio.Group · SegmentedControl · label · description',
    useWhen: [
      'A person ticks any of a few, shown all at once: a tick box in a list.',
      'A setting is on or off and acts at once: a switch.',
      'A person picks one of a few shown at once: a one-of-many list, or the segmented pick when the words are short.',
    ],
    dontUseWhen: [
      'One value picked from a long list: a drop-down, under Fields.',
      'A choice made on a button that acts: the button itself.',
    ],
    instead: 'Fields',
    states: ChoiceStates,
  },
  {
    group: 'Foundations',
    name: 'Menus',
    kind: 'Mantine’s own',
    description:
      'Mantine’s own menus as the theme dresses them: the frame’s language menu and person menu, each a button that a press opens onto a list.',
    props: 'Menu · Menu.Target · Menu.Dropdown · Menu.Label · Menu.Item',
    useWhen: [
      'A few choices or acts sit behind one button in the header: the language, the person.',
      'The list is short and each item acts at once or opens a page.',
    ],
    dontUseWhen: [
      'A page of rows on a phone: that is MenuRow’s.',
      'One value picked from a long list in a form: a drop-down, under Fields.',
    ],
    instead: 'MenuRow',
    states: MenuStates,
  },
  {
    group: 'Foundations',
    name: 'Photos and codes',
    kind: 'Mantine’s own',
    description:
      'Mantine’s own picture as the theme dresses it, with the sign-in QR code beside it: a person’s photo and its choose button, a delivery’s proof, a company’s logo, the code a phone reads to sign in, its link with the copy button and the question a new code asks first.',
    props: 'Image · FileButton · Avatar · QrCode (value, label)',
    useWhen: [
      'A person’s or a company’s picture is shown, or chosen from a file on the device.',
      'A delivery’s proof is shown under its title.',
      'A sign-in link is shown as a code a phone reads.',
    ],
    dontUseWhen: [
      'A small mark of the client’s beside a name: that is LogoTile’s.',
      'A link to copy or follow as words: that is under Links.',
    ],
    instead: 'LogoTile',
    states: PhotoStates,
  },
  {
    group: 'Foundations',
    name: 'Links',
    kind: 'Mantine’s own',
    description:
      'Mantine’s own link as the theme dresses it, in the link colour: a name that opens its page in a row, a phone number a tap calls and a link inside a sentence.',
    props: 'Anchor · component · to · href',
    useWhen: [
      'A name or a number in a row or a sentence opens a page or calls a phone.',
      'The link is words inside text, not a button.',
    ],
    dontUseWhen: [
      'A way back above a page: that is BackLink’s.',
      'An act that changes something: a button, under ActionButton.',
    ],
    instead: 'BackLink',
    states: LinkStates,
  },
  {
    group: 'Foundations',
    name: 'Dialog',
    kind: 'Mantine’s own',
    description:
      'Mantine’s own dialog as the theme dresses it: a press opens it over the page, as the ended session’s dialog says its title, its text and the two ways on.',
    props: 'Modal · opened · onClose · title · centered',
    useWhen: ['The page waits on one answer and nothing beneath works until it comes.'],
    dontUseWhen: [
      'A message that needs no answer: that is FormMessage’s.',
      'A list of choices behind a header button: that is under Menus.',
    ],
    instead: 'FormMessage',
    states: DialogStates,
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
    props: 'main: ReactNode · side?: ReactNode · sideFirst?: boolean',
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
    dontUseWhen: [
      'A few facts about one record: that is DetailField’s.',
      'Any other table, with a total line or a column of numbers: that is DataTable’s.',
    ],
    instead: 'DetailField',
    states: ListTableStates,
  },
  {
    group: 'Pages',
    kind: KIND_OF_PAGE,
    name: 'The list page',
    description:
      'A list of records, drawn from parts only: the title with its acts beside it, a kind’s records in a table, the staff list filtered by a status chip, empty with its add, loading, failed, and at a phone’s width a card each row.',
    props:
      'PageShell · ActionRow · ActionButton · ListTable · DataTable · StatusBadge · PageState · Panel',
    useWhen: [
      'You are about to build a page that lists records and opens each one.',
      'You need a page whose add is the main act beside its title.',
    ],
    dontUseWhen: [
      'A page that takes a form: that is the form page’s.',
      'A page for a phone only: that is the phone page’s.',
    ],
    instead: 'The phone page',
    mustHave: [
      'The title with its acts beside it, the add the main.',
      'A kind’s records in ListTable, any other table in DataTable.',
      'A status as a StatusBadge column.',
      'Empty said by PageState with its add.',
      'At the phone’s width a card a row, the name and its chip first, the other columns as captions.',
    ],
    states: ListPageStates,
  },
  {
    group: 'Pages',
    kind: KIND_OF_PAGE,
    name: 'The form page',
    description:
      'A form that adds a record, drawn from parts only: the way back above the title, fields in titled blocks two a row, a refusal on its field and a whole form’s above the blocks, one main at the foot, and what was made.',
    props: 'PageShell · SectionCard · FieldPair · Fields · Choices · FormMessage · ActionButton',
    useWhen: [
      'You are about to build a page where someone fills in fields and saves one record.',
      'You need a page that says what it made after the save.',
    ],
    dontUseWhen: [
      'A page that lists records: that is the list page’s.',
      'A page that asks before an act that cannot be undone: that is the confirm page’s.',
    ],
    instead: 'The list page',
    mustHave: [
      'The way back above the title.',
      'Fields in titled blocks, two a row.',
      'A field’s refusal on its field, a whole form’s above the blocks.',
      'One main at the foot.',
      'After a save, what was made.',
    ],
    states: FormPageStates,
  },
  {
    group: 'Pages',
    kind: KIND_OF_PAGE,
    name: 'The phone page',
    description:
      'The driver’s phone page, drawn at a phone’s width from parts only: the day’s requests as cards that each open a request, then one request with its customer, goods and money to collect, the photo before it is sent, delivered, a send that failed and cancelled by the office.',
    props: 'PageHeader · PageShell · Panel · DataTable · StatusBadge · FormMessage · ActionButton',
    useWhen: [
      'You are about to build a page a person reads on a phone, outdoors, with a thumb.',
      'You need a page whose acts are one main press a state.',
    ],
    dontUseWhen: [
      'A page the office reads at a desk: that is the page base’s.',
      'A list of records with columns: that is ListTable’s.',
    ],
    instead: 'The page base',
    mustHave: [
      'The phone’s width: the page is drawn at 390 px, in a frame whose breakpoints are the phone’s.',
      'One main press a state, under what it acts on, the other under it.',
      'The money to collect in bold under the goods.',
      'Every press at least 36 px tall, as ActionButton’s small size stands.',
    ],
    states: PhonePageStates,
  },
  {
    group: 'Pages',
    kind: KIND_OF_PAGE,
    name: 'The day sheet',
    description:
      'The office’s day sheet, drawn from parts only: the day’s drivers each in a titled panel with what to bring back and the way into their day, one driver’s day with the cash field and the close asked once in its own block, and the closed day.',
    props:
      'PageHeader · PageShell · Panel · DataTable · StatusBadge · Fields · ActionRow · ActionButton · FormMessage',
    useWhen: [
      'You are about to build a page that gathers a day’s money by driver.',
      'You need a page that asks once before it closes something for good.',
    ],
    dontUseWhen: [
      'A page for the driver on a phone: that is the phone page’s.',
      'A page that lists one kind of record: that is the list page’s.',
    ],
    instead: 'The list page',
    mustHave: [
      'The day under the title or in its field.',
      'A titled Panel a block: a driver, or a part of the day.',
      'Totals at the right, through DataTable.',
      'The close asked once, in its own block.',
    ],
    states: DaySheetStates,
  },
  {
    group: 'Pages',
    kind: KIND_OF_PAGE,
    name: 'The import page',
    description:
      'The page that adds many records from a spreadsheet, drawn from parts only and one step at a time: choose the file, the preview that counts what will be added and says each row’s result, and done.',
    props: 'PageHeader · Panel · Fields · DataTable · ActionRow · ActionButton · FormMessage',
    useWhen: [
      'You are about to build a page that adds many records from one file.',
      'You need a page that shows what a file will do before it does it.',
    ],
    dontUseWhen: [
      'A page that adds one record: that is the form page’s.',
      'A page that lists the records already held: that is the list page’s.',
    ],
    instead: 'The form page',
    mustHave: [
      'One step drawn at a time, one main each.',
      'The preview counts what will be added.',
      'A row’s result by its meaning, never a colour’s name.',
    ],
    states: ImportPageStates,
  },
  {
    group: 'Pages',
    kind: KIND_OF_PAGE,
    name: 'The menu page',
    description:
      'The page of rows a phone opens from its bar’s last place, drawn from parts only at the phone’s width: the pages the bar leaves out first, then the person’s own links and sign-out last, each a row in a panel.',
    props: 'PageHeader · Panel · MenuRow',
    useWhen: [
      'You are about to build the page a phone’s bar opens for what it has no room for.',
      'You need a page whose whole content is a few places to go and one act.',
    ],
    dontUseWhen: [
      'A page that lists the records already held: that is the list page’s.',
      'The menu beside a wide page: that is the frame’s, not a page.',
    ],
    instead: 'The list page',
    mustHave: [
      'The phone’s width.',
      'The pages first, the person’s links and sign-out last.',
      'Each place or act a MenuRow.',
    ],
    states: MenuPageStates,
  },
  {
    group: 'Pages',
    kind: KIND_OF_PAGE,
    name: 'The confirm page',
    description:
      'The page that asks before an act that changes a company for good, drawn from parts only: what will happen first, a standing warning at a delete, the code to type, the last press, and once made, the new value read-only beside its copy button.',
    props: 'PageHeader · FormMessage · Panel · TextInput · ActionRow · ActionButton · CopyText',
    useWhen: [
      'You are about to build the page that asks before a delete, a move or a new password.',
      'You need a page that hands back a made value once and never again.',
    ],
    dontUseWhen: [
      'A question that fits in a line over the page it came from: that is a dialog, which this app does not use for acts.',
      'A form that only saves what was typed: that is the form page’s.',
    ],
    instead: 'The form page',
    mustHave: [
      'What will happen first, and a standing warning where it cannot be undone.',
      'One thing to type where the act cannot be undone.',
      'Red only on a delete’s last press.',
      'A made value read-only beside its copy button.',
    ],
    states: ConfirmPageStates,
  },
  {
    group: 'Pages',
    kind: KIND_OF_PAGE,
    name: 'The settings page',
    description:
      'The page where a company sets its name, formatted name, description, logo, colour and languages, drawn from parts only: titled blocks of fields and choices, a save that stays on the page and says saved, and a refusal said through a message, the logo’s too.',
    props:
      'PageHeader · SectionCard · IdentityFields · ColorInput · Radio.Group · Switch · Checkbox.Group · NativeSelect · FormMessage · ActionButton',
    useWhen: [
      'You are about to build a page that edits one record in place and stays on it after the save.',
      'You need a field that takes a picture, with its refusal under it.',
    ],
    dontUseWhen: [
      'A form that makes a new record and then shows what was made: that is the form page’s.',
      'A page that asks before an act that cannot be undone: that is the confirm page’s.',
    ],
    instead: 'The form page',
    mustHave: [
      'Fields in titled blocks.',
      'The save stays on the page and says saved.',
      'A refusal through a message, the logo’s too.',
    ],
    states: SettingsPageStates,
  },
  {
    group: 'Pages',
    name: 'BrandPreview',
    kind: 'Layout',
    description:
      'A block titled Preview that shows a company header and the title of its sign-in card in the colour given, with the formatted name and the description where given, before anything is saved; both pictures are hidden from a reader and take no focus, only the title and two captions are read.',
    props:
      'name: string · logo?: string · formatted?: string · description?: string · brand: string · whiteHeader?: boolean',
    useWhen: ['A page sets a company look and shows it before the save, beside its fields.'],
    dontUseWhen: [
      'The real header or a real door: those are Shell and DoorCard, which the app draws.',
    ],
    instead: 'DoorCard',
    states: BrandPreviewStates,
  },
  {
    group: 'Pages',
    name: 'IdentityFields',
    kind: 'Fields',
    description:
      'The fields of the Identity block: the company name, the name with formatting typed as HTML with its hint and a preview of it as the company draws it, and the short description for the sign-in card; each is told what was typed.',
    props:
      "name: string · formattedName: string · description: string · onChange: (field: 'name' | 'formattedName' | 'description', value: string) => void",
    useWhen: ['A page sets the company name, its formatted name and its description in one block.'],
    dontUseWhen: ['The picture of the header and the card: that is BrandPreview’s.'],
    instead: 'BrandPreview',
    states: IdentityFieldsStates,
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
    name: 'BrandName',
    kind: 'Text',
    description:
      'The company name, plain, or formatted where one is typed as HTML: cleaned at each draw to bold, line breaks and one colour on a span, built as elements, hidden from a reader beside the plain name; colours false lets the colour of the text show.',
    props: 'name: string · formatted?: string · colours?: boolean',
    useWhen: [
      'The company name is drawn where it may be formatted: a heading, a band, a preview.',
      'The name sits on the coloured header: give colours false, and the text colour wins.',
    ],
    dontUseWhen: [
      'The name with its logo: that is BrandBand’s.',
      'A name read by the browser, as the tab or a logo’s alt: that stays the plain name.',
    ],
    instead: 'BrandBand',
    states: [
      { name: 'Plain', node: <BrandNameSample state="plain" /> },
      { name: 'Formatted', node: <BrandNameSample state="formatted" /> },
      { name: 'On the coloured header', node: <BrandNameSample state="header" /> },
      { name: 'Nothing left', node: <BrandNameSample state="nothing" /> },
    ],
  },
  {
    group: 'Atoms',
    name: 'DoorHeading',
    kind: 'Text',
    description:
      "A door's title as the second heading, in the third's size, bold and centred, and a small dimmed subtitle beneath only when given.",
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
    name: 'MenuRow',
    kind: 'Lists',
    description:
      'A row of a menu page: an optional icon, its words and, where it opens an address, an arrow at the end; a line between rows and a lit row under the pointer.',
    props: 'icon?: typeof IconChevronRight · to?: string · onClick?: () => void · children: string',
    useWhen: ['A page lists ways on or acts as rows, as the phone’s More does.'],
    dontUseWhen: [
      'A list behind a header button: that is Menus, Mantine’s own.',
      'A row of data with columns: that is DataTable’s.',
    ],
    instead: 'DataTable',
    states: MenuRowStates,
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
      'A word that is no status of a record, as a colleague’s “you”: that is Tag’s.',
    ],
    instead: 'Tag',
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
    name: 'Tag',
    kind: 'Marks',
    description:
      'A word beside a name or in a row, drawn light at the chip’s size: in the brand’s tone, or in the tone of its meaning (danger, success, warning or info).',
    props: "meaning?: 'brand' | 'danger' | 'success' | 'warning' | 'info' · children: string",
    useWhen: [
      'A word marks a person or a setting, as a colleague’s “you” or a permission that is custom.',
      'A state of a thing that is no record’s status, as a service’s health or a build that differs: give it its meaning.',
    ],
    dontUseWhen: [
      'A record’s status, an order’s or a person’s: that is StatusBadge’s.',
      'A message to the person: that is FormMessage’s.',
    ],
    instead: 'StatusBadge',
    states: TagStates,
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
    name: 'DataTable',
    kind: 'Lists',
    description:
      'A table of rows under headings, in a scrolling frame: numbers at the right, an optional total line in bold, every row lit under the pointer. It takes its words as props.',
    props: 'columns: Column[] · rows: Row[] · total?: ReactNode[]',
    useWhen: [
      'A page draws a table of its own: an order’s lines with their total, or a list whose name opens a page.',
    ],
    dontUseWhen: [
      'A kind’s list of customers or products: that is ListTable’s, which picks its own columns.',
      'A few facts about one record: that is DetailField’s.',
    ],
    instead: 'ListTable',
    states: DataTableStates,
  },
  {
    group: 'Molecules',
    name: 'CopyText',
    kind: 'Buttons',
    description:
      'A button that copies a value and says the copied word for a moment after; given a field, it sits at the right of a read-only field that shows the value in the code face.',
    props: 'value: string · label: string · about: string · field?: string',
    useWhen: [
      'A page shows a link or a password once, to be sent on: give the button the value and the field’s label.',
      'A table row holds a link to copy: the button alone, its words naming what it copies.',
    ],
    dontUseWhen: [
      'A value that is only read: that is DetailField’s.',
      'A button that does anything but copy: that is ActionButton’s.',
    ],
    instead: 'ActionButton',
    states: CopyTextStates,
  },
  {
    group: 'Molecules',
    name: 'BrandBand',
    kind: 'Headings',
    description:
      'The company logo tile beside its name as the first heading, formatted where a formatted name is given, with a short description in a caption under the name, bold and centred on the brand palest shade, a brand-1 line beneath.',
    props: 'name: string · logo?: string · formatted?: string · description?: string',
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
      {
        name: 'Formatted, with a description',
        node: (
          <Stack w={474} maw="100%" gap={0}>
            <FormattedBand />
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
      "A door's card: a bar in the brand's gradient across its top, the company's band with its formatted name and description where given, then what it holds.",
    props:
      'name: string · logo?: string · formatted?: string · description?: string · children: ReactNode',
    useWhen: ['A page a person reaches before sign-in, the card holding its words and buttons.'],
    dontUseWhen: [
      "A block inside a signed-in page: that is SectionCard's.",
      "A card of a screen's own on a door: `SignInFrame` (`ui/src/pages/SignIn.tsx`) draws this one for the four doors.",
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
      ...(
        [
          ['Login link', 'link'],
          ['The camera', 'camera'],
          ['A picture', 'picture'],
          ['Paste the link', 'paste'],
          ['Signed in', 'signedIn'],
          ['A code refused', 'refused'],
          ['No camera', 'noCamera'],
        ] as const
      ).map(([name, state]) => ({
        name,
        node: (
          <Stack w={474} maw="100%">
            <ScanCard state={state} />
          </Stack>
        ),
      })),
      ...(['form', 'taken', 'sent'] as const).map((state) => ({
        name: { form: 'A company’s sign-up', taken: 'An address taken', sent: 'Sent for approval' }[
          state
        ],
        node: (
          <Stack w={474} maw="100%">
            <SignUpCard state={state} />
          </Stack>
        ),
      })),
    ],
  },
  {
    group: 'Organisms',
    name: 'DoorPage',
    kind: 'Layout',
    description:
      "A door's whole screen: the brand's gradient sweeping all of it, the language switch in its top right corner, and the card centred, with no menu, bar or header.",
    props:
      'languages?: readonly Choice[] · onLanguage?: (language: Language) => void · children: ReactNode',
    useWhen: ['A page a person reaches before sign-in, round its DoorCard.'],
    dontUseWhen: [
      'A signed-in page, with its menu and header: that is PageShell’s.',
      'The card alone: that is DoorCard’s.',
    ],
    instead: 'DoorCard',
    states: [
      {
        name: 'Company, two languages',
        node: <DoorPageSample languages={['vi', 'en']} />,
      },
      {
        name: 'Credo, no logo',
        node: <DoorPageSample credo languages={['vi', 'en']} />,
      },
      {
        name: 'One language, no switch',
        node: <DoorPageSample />,
      },
      { name: 'An address with no company', node: <UnknownAddressSample /> },
      { name: 'Waiting for approval', node: <UnknownAddressSample waiting /> },
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
      'Content with no section title: that is Panel’s.',
    ],
    instead: 'Panel',
    states: [
      {
        name: 'Default',
        node: <SectionCardSample />,
      },
    ],
  },
  {
    group: 'Organisms',
    name: 'Panel',
    kind: 'Cards',
    description:
      'A framed block: an optional level-3 title over what it holds, at the edge, padding and gap the design system decides; given an address, the whole block is one link to it, its words in their own colour.',
    props: 'title?: string · to?: string · children: ReactNode',
    useWhen: ['A page frames a few lines or fields: with a title over them, or with none.'],
    dontUseWhen: [
      'A block with a section title and its icon: that is SectionCard’s.',
      'A page before sign-in: that is DoorCard’s.',
    ],
    instead: 'SectionCard',
    states: PanelStates,
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
