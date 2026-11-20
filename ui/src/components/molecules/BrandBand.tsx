import { Group, Text } from '@mantine/core';
import { TOKENS } from '../../design-system/tokens';
import { LogoTile } from '../atoms/LogoTile';

/** The company's logo tile beside its name, bold and centred on the brand's palest shade, a brand-1 line beneath. */
export function BrandBand({ name, logo }: { name: string; logo?: string }) {
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
      <Text fw={700} size="md">
        {name}
      </Text>
    </Group>
  );
}
