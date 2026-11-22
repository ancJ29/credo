import { Group } from '@mantine/core';
import type { ReactNode } from 'react';
import { SPACING } from '../../design-system/tokens';

/** The buttons of a block in one row, in the order they are read, at the end of the block, with one gap between them. Mantine Group, at the values it decides. */
export function ActionRow({ children }: { children: ReactNode }) {
  // It takes the block's width itself, so inside a stack that keeps its children at the start it still sits at the end.
  return (
    <Group gap={SPACING.sm} justify="flex-end" style={{ alignSelf: 'stretch' }}>
      {children}
    </Group>
  );
}
