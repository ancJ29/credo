import { Paper, Stack, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { ROLES, SPACING } from '../../design-system/tokens';

/** A framed block: an optional level-3 title over what it holds, at the edge, padding and gap the design system decides. */
export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <Paper withBorder p={SPACING.md} style={{ borderColor: ROLES.border }}>
      <Stack gap={SPACING.md}>
        {title && <Title order={3}>{title}</Title>}
        {children}
      </Stack>
    </Paper>
  );
}
