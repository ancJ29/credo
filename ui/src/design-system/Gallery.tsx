import {
  Badge,
  Button,
  Container,
  Divider,
  Group,
  MantineProvider,
  Checkbox,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
  useMantineTheme,
} from '@mantine/core';
import { CREDO_COLOUR } from '@credo/shared';
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
import { designThemeOf } from './theme';

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
        <Button variant="gradient" fullWidth>
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
        <Button variant="gradient" fullWidth leftSection={<IconQrcode size={18} />}>
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

/** Every component of `components/`, by level, drawn in its states. A level with none says so. */
const LEVELS: { level: string; heading: string; entries: Record<string, ReactNode> }[] = [
  {
    level: 'atoms',
    heading: 'Atoms',
    entries: {
      FieldLabel: <FieldLabel>Phone</FieldLabel>,
      DoorHeading: (
        <Stack w={394} gap={0}>
          <DoorHeading
            title="Đăng nhập bằng liên kết"
            subtitle="Quét mã QR hoặc nhập mã đăng nhập để đăng nhập"
          />
        </Stack>
      ),
      BackLink: <BackLink href="#">Quay lại đăng nhập</BackLink>,
      LogoTile: <LogoTile logo={SAMPLE_LOGO} alt="Sample company" />,
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
      BrandBand: (
        <Stack w={474} gap={0}>
          <BrandBand name="Công ty TNHH Acme" logo={SAMPLE_LOGO} />
        </Stack>
      ),
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
      DoorCard: (
        <Group align="flex-start" gap="xl">
          <Stack w={474}>
            <SignInState />
          </Stack>
          <Stack w={474}>
            <LinkState />
          </Stack>
        </Group>
      ),
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
      <Stack gap="xs">
        <Title order={3}>Gradient button</Title>
        <Group align="flex-start" gap="xl">
          <Button variant="gradient" w={394} leftSection={<IconQrcode size={18} />}>
            Quét mã QR
          </Button>
        </Group>
      </Stack>
      <Stack gap="xs">
        <Title order={3}>Default button</Title>
        <Group align="flex-start" gap="xl">
          <Button variant="default" w={394} leftSection={<IconKeyboard size={18} />}>
            Nhập mã thủ công
          </Button>
        </Group>
      </Stack>
      <Stack gap="xs">
        <Title order={3}>Labelled divider</Title>
        <Group align="flex-start" gap="xl">
          <Divider w={394} label="hoặc" />
        </Group>
      </Stack>
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
