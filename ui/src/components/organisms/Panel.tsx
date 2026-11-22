import { Paper, Stack, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ROLES, SPACING } from '../../design-system/tokens';

/** A framed block: an optional level-3 title over what it holds, at the edge, padding and gap the design system decides; given an address, the whole block is one link to it, its words in their own colour. */
export function Panel({
  title,
  to,
  children,
}: {
  title?: string;
  to?: string;
  children: ReactNode;
}) {
  const inside = (
    <Stack gap={SPACING.md}>
      {title && <Title order={3}>{title}</Title>}
      {children}
    </Stack>
  );
  if (to !== undefined)
    return (
      <Paper
        component={Link}
        to={to}
        withBorder
        p={SPACING.md}
        td="none"
        c="inherit"
        style={{ borderColor: ROLES.border }}
      >
        {inside}
      </Paper>
    );
  return (
    <Paper withBorder p={SPACING.md} style={{ borderColor: ROLES.border }}>
      {inside}
    </Paper>
  );
}
