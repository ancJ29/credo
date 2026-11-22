import { Table } from '@mantine/core';
import type { ReactNode } from 'react';
import { WIDTHS } from '../../design-system/tokens';

/** A frame for a table: below its least width the table scrolls sideways inside it and its columns keep their room, never the page. Mantine table scroll container, at the width it decides. */
export function TableScroll({ children }: { children: ReactNode }) {
  return <Table.ScrollContainer minWidth={WIDTHS.table}>{children}</Table.ScrollContainer>;
}
