import type { ReactNode } from 'react';
import {
  Group,
  Paper,
  Stack,
  Text,
  Title,
  useMantineTheme,
  type MantineSize,
  type MantineTheme,
} from '@mantine/core';
import { credoVariables } from './cssVariables';
import { FRAME_VALUES } from './tokens';
import { GUIDELINE, type FormatName, type RoleName, type ShadowName } from './guideline';
import { IconBuilding } from '@tabler/icons-react';
import {
  HEADER_WASHES,
  ICON_SIZES,
  MENU_WASHES,
  ON_BRAND,
  RADII,
  ROLES,
  SPACING,
  TONES,
  TYPE,
  WIDTHS,
} from './tokens';

/** What a text style may set: the props `TYPE` spreads. */
type Style = { order?: number; fz?: string; size?: string; fw?: number; lts?: number };

/** What a style draws, as words: its size, line height, weight and letter spacing. */
type TextFacts = { size: string; lineHeight: string; weight: string; spacing: string };

/** Mantine writes a size as `calc(0.75rem * var(--mantine-scale))`; the facts say 12 px. */
const px = (size: string) => `${parseFloat(size.replace('calc(', '')) * 16} px`;

/**
 * What a text style draws in a theme. A heading (a style with `order`, or one drawn on a heading
 * of `level`) starts from its level's size, line height and weight, other text from the body's;
 * a `Text` with a `size` takes that size's line height, a style with only `fz` keeps the one it
 * started from.
 */
function textFacts(theme: MantineTheme, style: Style, level?: number): TextFacts {
  const heading = level ?? style.order;
  const base = heading
    ? theme.headings.sizes[`h${heading}` as 'h2']
    : { fontSize: theme.fontSizes.md, lineHeight: theme.lineHeights.md, fontWeight: '400' };
  const named = (style.size ?? style.fz) as MantineSize;
  return {
    size: px((style.size ?? style.fz) ? theme.fontSizes[named] : base.fontSize),
    lineHeight: style.size ? theme.lineHeights[named] : base.lineHeight,
    weight: String(style.fw ?? base.fontWeight),
    spacing: `${style.lts ?? 0} px`,
  };
}

/** The level of heading a style is drawn on, where it is one: the others are text. */
const LEVEL: Partial<Record<keyof typeof TYPE, number>> = { pageTitle: 2, sectionLabel: 3 };

const SAMPLE = 'Sample text 1,250,000';

/** Each text style: drawn as a screen reads it, its name in plain letters, what it draws and what it is for. */
export function Type() {
  const theme = useMantineTheme();
  const { fontFamily } = theme;
  return (
    <Stack gap="sm">
      <Text size="sm">Type: {fontFamily}</Text>
      {(Object.keys(TYPE) as (keyof typeof TYPE)[]).map((name) => {
        const style: Style = TYPE[name];
        const facts = textFacts(theme, style, LEVEL[name]);
        return (
          <Stack key={name} gap={2}>
            {style.order ? (
              <Title {...TYPE.pageTitle}>{SAMPLE}</Title>
            ) : LEVEL[name] ? (
              <Title order={3} {...TYPE.sectionLabel}>
                {SAMPLE}
              </Title>
            ) : (
              <Text component="span" {...TYPE[name]}>
                {SAMPLE}
              </Text>
            )}
            <Text size="sm">{name}</Text>
            <Text size="sm" c="dimmed">
              {`size ${facts.size} · line height ${facts.lineHeight} · weight ${facts.weight} · spacing ${facts.spacing}`}
            </Text>
            <Text size="sm">{GUIDELINE.values.styles[name]}</Text>
          </Stack>
        );
      })}
    </Stack>
  );
}

/** Every colour role a screen reads, each with the value the app writes for the chosen colour and what it is for. */
export function Roles() {
  const theme = useMantineTheme();
  const written = credoVariables(theme).variables;
  const row = (role: RoleName, ground?: string) => (
    <Group key={role} gap="sm" wrap="nowrap" align="flex-start">
      <Paper
        w={24}
        h={24}
        style={{
          flex: 'none',
          background: ground
            ? `linear-gradient(var(--credo-${role}), var(--credo-${role})), var(${ground})`
            : `var(--credo-${role})`,
          border: '1px solid var(--credo-border)',
        }}
      />
      <Text size="sm">{role}</Text>
      <Text size="sm" c="dimmed">
        {written[`--credo-${role}`]}
      </Text>
      <Text size="sm">{GUIDELINE.values.roles[role]}</Text>
    </Group>
  );
  return (
    <Stack gap={4}>
      {(Object.keys(ROLES) as RoleName[]).map((role) => row(role))}
      {ON_BRAND.map((role) => row(role))}
      {(Object.keys(HEADER_WASHES) as RoleName[]).map((role) =>
        row(role, '--credo-header-gradient'),
      )}
      {(Object.keys(MENU_WASHES) as RoleName[]).map((role) => row(role, '--credo-menu-gradient'))}
    </Stack>
  );
}

/** The four meanings a colour carries, each with the Mantine colour that draws it and what it is for. */
export function Tones() {
  return (
    <Stack gap={4}>
      {GUIDELINE.values.notes.map((note) => (
        <Text key={note} size="sm">
          {note}
        </Text>
      ))}
      {(Object.keys(TONES) as (keyof typeof TONES)[]).map((tone) => (
        <Group key={tone} gap="sm" wrap="nowrap" align="flex-start">
          <Paper w={24} h={24} bg={`${TONES[tone]}.6`} style={{ flex: 'none' }} />
          <Text size="sm">{tone}</Text>
          <Text size="sm" c="dimmed">
            {TONES[tone]}
          </Text>
          <Text size="sm">{GUIDELINE.values.tones[tone]}</Text>
        </Group>
      ))}
    </Stack>
  );
}

/** One row of a value table: the name, what it is as a number, a sample drawn from it, and what it is for. */
function ValueRow({
  name,
  value,
  sample,
  use,
}: {
  name: string;
  value: string;
  sample?: ReactNode;
  use: string;
}) {
  return (
    <Group gap="sm" wrap="nowrap" align="flex-start">
      <Text size="sm" w={96} style={{ flex: 'none' }}>
        {name}
      </Text>
      <Text size="sm" c="dimmed" w={64} style={{ flex: 'none' }}>
        {value}
      </Text>
      {sample}
      <Text size="sm">{use}</Text>
    </Group>
  );
}

const names = <T extends object>(table: T) => Object.keys(table) as (keyof T & string)[];

/** The spacing steps, each drawn as a bar of its size, with what it separates. */
export function Spacing() {
  return (
    <Stack gap={4}>
      {names(SPACING).map((step) => (
        <ValueRow
          key={step}
          name={step}
          value={SPACING[step]}
          sample={
            <Paper
              h={8}
              bg="var(--credo-brand-line)"
              style={{ width: SPACING[step], flex: 'none' }}
            />
          }
          use={GUIDELINE.values.spacing[step]}
        />
      ))}
    </Stack>
  );
}

/** The widths, each with what it is the width of. */
export function Widths() {
  return (
    <Stack gap={4}>
      {names(WIDTHS).map((use) => (
        <ValueRow
          key={use}
          name={use}
          value={`${WIDTHS[use]} px`}
          use={GUIDELINE.values.widths[use]}
        />
      ))}
    </Stack>
  );
}

/** The icon sizes, each drawn at its size, with where it sits. */
export function Icons() {
  return (
    <Stack gap={4}>
      {names(ICON_SIZES).map((place) => (
        <ValueRow
          key={place}
          name={place}
          value={`${ICON_SIZES[place]} px`}
          sample={<IconBuilding size={ICON_SIZES[place]} style={{ flex: 'none' }} />}
          use={GUIDELINE.values.icons[place]}
        />
      ))}
    </Stack>
  );
}

/** The corners and the shadows, each drawn on a tile, with what it is for. */
export function Shapes() {
  const shadow = (name: ShadowName) =>
    name === 'lg' || name === 'xl' ? `var(--mantine-shadow-${name})` : FRAME_VALUES[name];
  return (
    <Stack gap={4}>
      {names(RADII).map((step) => (
        <ValueRow
          key={step}
          name={step}
          value={RADII[step]}
          sample={<Paper w={24} h={24} radius={step} withBorder style={{ flex: 'none' }} />}
          use={GUIDELINE.values.corners[step]}
        />
      ))}
      {(Object.keys(GUIDELINE.values.shadows) as ShadowName[]).map((name) => (
        <ValueRow
          key={name}
          name={name}
          value="shadow"
          sample={<Paper w={24} h={24} style={{ flex: 'none', boxShadow: shadow(name) }} />}
          use={GUIDELINE.values.shadows[name]}
        />
      ))}
    </Stack>
  );
}

/** What each kind of text is written by, and where it lives. */
export function Formats() {
  return (
    <Stack gap={4}>
      {(Object.keys(GUIDELINE.values.formats) as FormatName[]).map((format) => (
        <ValueRow key={format} name={format} value="" use={GUIDELINE.values.formats[format]} />
      ))}
    </Stack>
  );
}
