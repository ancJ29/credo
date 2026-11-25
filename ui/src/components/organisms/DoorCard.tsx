import { Box, Paper } from '@mantine/core';
import type { ReactNode } from 'react';
import { TOKENS } from '../../design-system/tokens';
import { BrandBand } from '../molecules/BrandBand';

/** A door's card: a bar in the brand's gradient across its top, the company's band with its formatted name and description where given, then what it holds. */
export function DoorCard({
  name,
  logo,
  formatted,
  description,
  children,
}: {
  name: string;
  logo?: string;
  formatted?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Paper
      shadow="xl"
      radius="md"
      style={{ overflow: 'hidden', border: '1px solid var(--credo-border-strong)' }}
    >
      <Box data-bar style={{ height: TOKENS.doorBar, background: TOKENS.doorBarGradient }} />
      <BrandBand name={name} logo={logo} formatted={formatted} description={description} />
      <Box style={{ padding: TOKENS.doorBody }}>{children}</Box>
    </Paper>
  );
}
