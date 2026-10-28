import { AppShell, Badge, Button, Container, Group } from '@mantine/core';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CREDO_BRAND } from './brand';
import { BrandMark } from './BrandMark';

type Props = { onSignOut: () => void; children: ReactNode };

/** The operator's signed-in frame: credo's name, a badge saying whose door this is, and a way out. No menu: the page makes clients and nothing else. */
export function OperatorPage({ onSignOut, children }: Props) {
  const { t } = useTranslation();
  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group wrap="nowrap">
            <BrandMark brand={CREDO_BRAND} />
            <Badge variant="light">{t('operator.badge')}</Badge>
          </Group>
          <Button variant="subtle" color="gray" onClick={onSignOut}>
            {t('user.signOut')}
          </Button>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Container size={640} px={0}>
          {children}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
