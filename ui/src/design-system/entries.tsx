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
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../i18n';
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
import { OnTheBrand, OnTheLinks } from './OnTheBrand';
import { ActionButtonStates, FormMessageStates, PageStateStates } from './Contract';
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

/** Each status of a row, as the person reads it: the part draws its words, so the sample is given the dictionary. */
const SAMPLE_WORDS = createI18n('en');
function StatusRow({ statuses }: { statuses: Status[] }) {
  return (
    <I18nextProvider i18n={SAMPLE_WORDS}>
      <Group>
        {statuses.map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </Group>
    </I18nextProvider>
  );
}

/** The old app's sign-in page as the card holds it, in sentence case: the first of the door card's two states. */
function SignInState() {
  return (
    <DoorCard name="Công ty TNHH Acme" logo={SAMPLE_LOGO}>
      <Stack gap="md">
        <DoorHeading title="Đăng nhập vào tài khoản của bạn" />
        <TextInput
          label="Tên đăng nhập"
          placeholder="Nhập tên đăng nhập"
          leftSection={<IconUser size={18} />}
        />
        <PasswordInput
          label="Mật khẩu"
          placeholder="Nhập mật khẩu"
          leftSection={<IconLock size={18} />}
        />
        <Checkbox defaultChecked label="Ghi nhớ đăng nhập" />
        <Button variant="gradient" size="md" fullWidth>
          Đăng nhập
        </Button>
        <Divider label="hoặc" />
        <Button variant="default" fullWidth leftSection={<IconQrcode size={18} />}>
          Dùng liên kết đăng nhập
        </Button>
      </Stack>
    </DoorCard>
  );
}

/** The old app's login-link page as the card holds it: the second state. */
function LinkState() {
  return (
    <DoorCard name="Công ty TNHH Acme" logo={SAMPLE_LOGO}>
      <Stack gap="md" align="center">
        <Stack gap={0} w="100%">
          <DoorHeading
            title="Đăng nhập bằng liên kết"
            subtitle="Quét mã QR hoặc nhập mã đăng nhập để đăng nhập"
          />
        </Stack>
        <Button variant="gradient" size="md" fullWidth leftSection={<IconQrcode size={18} />}>
          Quét mã QR
        </Button>
        <Divider label="hoặc" w="100%" />
        <Button variant="default" fullWidth leftSection={<IconKeyboard size={18} />}>
          Nhập mã thủ công
        </Button>
        <BackLink href="#">Quay lại đăng nhập</BackLink>
      </Stack>
    </DoorCard>
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
    states: [
      {
        name: 'Button, field, badge',
        node: (
          <Group align="flex-end">
            <Button>Save</Button>
            <Button variant="default">Cancel</Button>
            <TextInput label="Name" placeholder="A field" />
            <Badge>A badge</Badge>
          </Group>
        ),
      },
      {
        name: 'Gradient button',
        node: (
          <Button variant="gradient" w={394} leftSection={<IconQrcode size={18} />}>
            Quét mã QR
          </Button>
        ),
      },
      {
        name: 'Default button',
        node: (
          <Button variant="default" w={394} leftSection={<IconKeyboard size={18} />}>
            Nhập mã thủ công
          </Button>
        ),
      },
      { name: 'Labelled divider', node: <Divider w={394} label="hoặc" /> },
    ],
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
    states: [{ name: 'Phone', node: <FieldLabel>Phone</FieldLabel> }],
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
      {
        name: 'With subtitle',
        node: (
          <Stack w={394} gap={0}>
            <DoorHeading
              title="Đăng nhập bằng liên kết"
              subtitle="Quét mã QR hoặc nhập mã đăng nhập để đăng nhập"
            />
          </Stack>
        ),
      },
      {
        name: 'Title only',
        node: (
          <Stack w={394} gap={0}>
            <DoorHeading title="Đăng nhập vào tài khoản của bạn" />
          </Stack>
        ),
      },
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
    states: [{ name: 'Default', node: <BackLink href="#">Quay lại đăng nhập</BackLink> }],
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
    toCome: true,
    description:
      'The button a page offers an act with: its meaning (the main action, another, a quiet one or a danger) and its words and act, drawn at the look the meaning decides. Mantine’s Button, at the values it decides.',
    props: 'meaning: main | other | quiet | danger · children: string · onClick',
    useWhen: [
      'A page offers an act: one main action a page, the others as other or quiet.',
      'A delete’s last step, on the page that confirms it, is a danger.',
    ],
    dontUseWhen: [
      'A move to another page: that is a link, not an act.',
      'A second main action on one page: ask which is the main.',
    ],
    instead: 'BackLink',
    states: ActionButtonStates,
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
    ],
    instead: 'FieldLabel',
    states: [
      {
        name: 'With a value, and with none',
        node: (
          <Group gap="xl">
            <DetailField label="Phone" value="0901 234 567" />
            <DetailField label="Email" />
          </Group>
        ),
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
    states: [
      { name: 'Default', node: <SectionTitle icon={<IconBuilding size={14} />} label="Basics" /> },
    ],
  },
  {
    group: 'Molecules',
    name: 'FormMessage',
    kind: 'Messages',
    toCome: true,
    description:
      'A message under a form’s buttons: its kind (error, warning, success, info or saved) and its words, drawn at the kind’s colour and spoken role. Mantine’s Alert, at the values it decides.',
    props: 'kind: error | warning | success | info | saved · children: string',
    useWhen: [
      'A form or an act tells the person what happened: it failed, it needs care, it worked.',
      'The message of a save, once, under the buttons that saved.',
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
    dontUseWhen: ["A block inside a signed-in page: that is SectionCard's."],
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
        node: (
          <SectionCard icon={<IconBuilding size={14} />} title="Basics">
            <DetailField label="Name" value="A shop" />
          </SectionCard>
        ),
      },
    ],
  },
  {
    group: 'Organisms',
    name: 'PageHeader',
    kind: 'Headers',
    description: "A page's heading, with what acts on the page beside it. No phone variant.",
    props: 'title: string · actions?: ReactNode',
    useWhen: ['A page opens with its title, and the actions that act on the whole page beside it.'],
    dontUseWhen: [
      "A section inside the page: that is SectionTitle's.",
      "The title of a card before sign-in: that is DoorHeading's.",
    ],
    instead: 'SectionTitle',
    states: [
      {
        name: 'With actions',
        node: (
          <Stack w={640} maw="100%">
            <PageHeader title="Staff" actions={<Button>Add</Button>} />
          </Stack>
        ),
      },
      {
        name: 'Title only',
        node: (
          <Stack w={640} maw="100%">
            <PageHeader title="Staff" />
          </Stack>
        ),
      },
    ],
  },
  {
    group: 'Organisms',
    name: 'PageState',
    kind: 'States',
    toCome: true,
    description:
      'What a whole page shows when its data is not a list or a record: loading, failed with a retry, forbidden, nothing, empty with an add, or not found. Mantine’s Loader, Alert and Title, at the values it decides.',
    props:
      'state: loading | failed | forbidden | nothing | empty | not found · onRetry · add · children',
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
