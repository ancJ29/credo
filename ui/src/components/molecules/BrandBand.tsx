import { Group, Stack, Text, Title } from '@mantine/core';
import { TOKENS, TYPE, WEIGHTS } from '../../design-system/tokens';
import { BrandName } from '../atoms/BrandName';
import { LogoTile } from '../atoms/LogoTile';

/** The company logo tile beside its name as the first heading, formatted where a formatted name is given, with a short description in a caption under the name, bold and centred on the brand palest shade, a brand-1 line beneath. */
export function BrandBand({
  name,
  logo,
  formatted,
  description,
}: {
  name: string;
  logo?: string;
  formatted?: string;
  description?: string;
}) {
  const title = (
    <Title order={1} size="md" lh="md" fw={WEIGHTS.title}>
      <BrandName name={name} formatted={formatted} />
    </Title>
  );
  return (
    <Group
      justify="center"
      gap="md"
      style={{
        padding: TOKENS.doorPadding,
        background: 'var(--credo-brand-tint)',
        borderBottom: '1px solid var(--credo-brand-tint-strong)',
      }}
    >
      <LogoTile logo={logo} alt={name} />
      {description ? (
        <Stack gap={0}>
          {title}
          <Text {...TYPE.caption}>{description}</Text>
        </Stack>
      ) : (
        title
      )}
    </Group>
  );
}
