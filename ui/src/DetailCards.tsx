import { Grid, Paper, SimpleGrid, Stack, Title } from '@mantine/core';
import type { ReactNode } from 'react';

/** The frame of a detail page, as the old app's: two columns from `md` (992), the details (`main`)
 * seven twelfths and the actions (`side`) five, one column below with `main` first. A later detail
 * page takes it as is: its fields in `DetailCard`s and `FieldPair`s, identity as `main`, actions
 * and the danger zone as `side`. Without a `side` (a page with nothing for it) `main` takes the
 * full twelve at every width, so no blank half is left. */
export function DetailColumns({ main, side }: { main: ReactNode; side?: ReactNode }) {
  return (
    <Grid gap="lg">
      <Grid.Col span={side === undefined ? 12 : { base: 12, md: 7 }}>{main}</Grid.Col>
      {side !== undefined && <Grid.Col span={{ base: 12, md: 5 }}>{side}</Grid.Col>}
    </Grid>
  );
}

/** One bordered block with its title; what it holds is stacked. */
export function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper component="section" withBorder p="md">
      <Stack gap="md">
        <Title order={3}>{title}</Title>
        {children}
      </Stack>
    </Paper>
  );
}

/** Two fields a row from `sm` (768), one below. */
export function FieldPair({ children }: { children: ReactNode }) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
      {children}
    </SimpleGrid>
  );
}
