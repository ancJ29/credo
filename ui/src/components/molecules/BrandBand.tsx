import { Group, Title } from '@mantine/core';
import { TOKENS, WEIGHTS } from '../../design-system/tokens';
import { LogoTile } from '../atoms/LogoTile';

/** The company's logo tile beside its name as the first heading, bold and centred on the brand's palest shade, a brand-1 line beneath. */
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
      <Title order={1} size="md" lh="md" fw={WEIGHTS.title}>
        {name}
      </Title>
    </Group>
  );
}
