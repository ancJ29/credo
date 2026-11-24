import { Grid, SimpleGrid } from '@mantine/core';
import type { ReactNode } from 'react';
import { SectionCard } from '../components/organisms/SectionCard';
import classes from './DetailCards.module.css';

/** The frame of a detail page, as the old app's: two columns from `md` (992), the details (`main`)
 * seven twelfths and the actions (`side`) five, one column below with `main` first. A later detail
 * page takes it as is: its fields in `DetailCard`s and `FieldPair`s, identity as `main`, actions
 * and the danger zone as `side`. Without a `side` (a page with nothing for it) `main` takes the
 * full twelve at every width, so no blank half is left; a `side` that is `null` or `false` (as
 * `existing && <Steps/>` is) counts as none. With `sideFirst` the side comes above the main below 992
 * and stays in view beside it as the page scrolls. */
export function DetailColumns({
  main,
  side,
  sideFirst,
}: {
  main: ReactNode;
  side?: ReactNode;
  sideFirst?: boolean;
}) {
  const hasSide = Boolean(side);
  return (
    <Grid gap="lg">
      <Grid.Col
        span={hasSide ? { base: 12, md: 7 } : 12}
        order={hasSide && sideFirst ? { base: 2, md: 1 } : undefined}
      >
        {main}
      </Grid.Col>
      {hasSide && (
        <Grid.Col span={{ base: 12, md: 5 }} order={sideFirst ? { base: 1, md: 2 } : undefined}>
          {sideFirst ? <div className={classes.stuck}>{side}</div> : side}
        </Grid.Col>
      )}
    </Grid>
  );
}

/** One bordered block with its icon tile and title; what it holds is stacked. The organism
 * `SectionCard` draws it. */
export function DetailCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <SectionCard icon={icon} title={title}>
      {children}
    </SectionCard>
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
