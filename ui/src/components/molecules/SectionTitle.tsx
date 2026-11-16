import { Group, ThemeIcon, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { TOKENS } from '../../design-system/tokens';

/** A section's title: a grey icon tile beside a small, bold label in capitals. */
export function SectionTitle({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <Group gap={8} wrap="nowrap">
      <ThemeIcon
        variant="light"
        color="gray"
        size={TOKENS.iconTile}
        radius="sm"
        aria-hidden
        data-testid="section-icon"
      >
        {icon}
      </ThemeIcon>
      <Title order={3} fz="xs" fw={700} tt="uppercase" lts={0.5}>
        {label}
      </Title>
    </Group>
  );
}
