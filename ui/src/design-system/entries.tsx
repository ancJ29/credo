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
import { IconBuilding, IconKeyboard, IconLock, IconQrcode, IconUser } from '@tabler/icons-react';
import { BackLink } from '../components/atoms/BackLink';
import { DoorHeading } from '../components/atoms/DoorHeading';
import { FieldLabel } from '../components/atoms/FieldLabel';
import { LogoTile } from '../components/atoms/LogoTile';
import { StatusBadge } from '../components/atoms/StatusBadge';
import { BrandBand } from '../components/molecules/BrandBand';
import { DetailField } from '../components/molecules/DetailField';
import { SectionTitle } from '../components/molecules/SectionTitle';
import { DoorCard } from '../components/organisms/DoorCard';
import { PageHeader } from '../components/organisms/PageHeader';
import { SectionCard } from '../components/organisms/SectionCard';
import { OnTheBrand, OnTheLinks } from './OnTheBrand';
import { ROLES } from './tokens';

/** A sample company logo for the tile: a plain shape, no real company's. */
const SAMPLE_LOGO =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Cpath d='M6 34 20 6l14 28z' fill='teal'/%3E%3C/svg%3E";

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
export const GROUPS = ['Foundations', 'Atoms', 'Molecules', 'Organisms'] as const;

/** One part of the list: where it sits, its words, its props as the file declares them, its states. */
export type Entry = {
  group: (typeof GROUPS)[number];
  name: string;
  /** The kind it sits under inside its group in the list; a part with none sits straight under the group. */
  kind?: string;
  description: string;
  props: string;
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

function Type() {
  const theme = useMantineTheme();
  return <Text size="sm">Type: {theme.fontFamily}</Text>;
}

function Gaps() {
  const theme = useMantineTheme();
  return <Text size="sm">Gaps: {Object.values(theme.spacing).join(', ')}</Text>;
}

function Roles() {
  return (
    <Stack gap={4}>
      {Object.entries(ROLES).map(([role, value]) => (
        <Group key={role} gap="sm" wrap="nowrap">
          <Paper
            w={24}
            h={24}
            style={{ background: value, border: '1px solid var(--credo-border)' }}
          />
          <Text size="sm">
            --credo-{role}: {value}
          </Text>
        </Group>
      ))}
    </Stack>
  );
}

/** Every part of the design system, by level, each in its states: the table the gallery's list is drawn from. */
export const ENTRIES: Entry[] = [
  {
    group: 'Foundations',
    name: 'Values',
    description:
      "The brand's ten shades, the type, the gaps and the colour roles the theme gives every part.",
    props: 'theme.colors.brand · theme.fontFamily · theme.spacing · ROLES',
    states: [
      { name: 'Palette', node: <Palette /> },
      { name: 'Type', node: <Type /> },
      { name: 'Gaps', node: <Gaps /> },
      { name: 'Roles', node: <Roles /> },
    ],
  },
  {
    group: 'Foundations',
    name: 'On the brand',
    description:
      "The text on a client's colour, the white before the rule beside the rule's pick (white where it reaches 4.5:1, else dark), for each of the six stock colours and two typed ones, with the least ratio against the surface's shades; and the links, shade 6 before beside the rule's pick on white.",
    props: 'onBrand(shades, surface) · surface: filled | header | menu · onWhite(shades, from)',
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
    states: [{ name: 'Phone', node: <FieldLabel>Phone</FieldLabel> }],
  },
  {
    group: 'Atoms',
    name: 'DoorHeading',
    kind: 'Text',
    description:
      "A door's title as a heading, bold and centred, and a small dimmed subtitle beneath only when given.",
    props: 'title: string · subtitle?: string',
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
    states: [{ name: 'Default', node: <BackLink href="#">Quay lại đăng nhập</BackLink> }],
  },
  {
    group: 'Atoms',
    name: 'LogoTile',
    kind: 'Marks',
    description:
      "A company's logo in a small tile with a pale brand line. With no logo, or one that fails to load, it draws nothing.",
    props: 'logo?: string · alt: string',
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
      "A record's state as a chip: green when active, grey when not. It takes its word as a prop.",
    props: 'active: boolean · label: string',
    states: [
      {
        name: 'Active and inactive',
        node: (
          <Group>
            <StatusBadge active label="Active" />
            <StatusBadge active={false} label="Inactive" />
          </Group>
        ),
      },
    ],
  },
  {
    group: 'Molecules',
    name: 'BrandBand',
    kind: 'Headings',
    description:
      "The company's logo tile beside its name, bold and centred on the brand's palest shade, a brand-1 line beneath.",
    props: 'name: string · logo?: string',
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
    states: [
      { name: 'Default', node: <SectionTitle icon={<IconBuilding size={14} />} label="Basics" /> },
    ],
  },
  {
    group: 'Organisms',
    name: 'DoorCard',
    kind: 'Cards',
    description:
      "A door's card: a bar in the brand's gradient across its top, the company's band, then what it holds.",
    props: 'name: string · logo?: string · children: ReactNode',
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
];
