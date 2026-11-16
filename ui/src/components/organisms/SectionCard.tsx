import { Paper, Stack } from '@mantine/core';
import type { ReactNode } from 'react';
import { TOKENS } from '../../design-system/tokens';
import { SectionTitle } from '../molecules/SectionTitle';

/** A bordered block: a section title over what it holds. No edit mode. */
export function SectionCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <Paper component="section" withBorder p={TOKENS.cardPadding}>
      <Stack gap="lg">
        <SectionTitle icon={icon} label={title} />
        {children}
      </Stack>
    </Paper>
  );
}
