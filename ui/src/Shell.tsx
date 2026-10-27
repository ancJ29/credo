import type { Language } from '@credo/shared';
import { AppShell, Avatar, Burger, Button, Group, Menu, NavLink, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronDown } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import type { Brand } from './brand';
import { BrandMark } from './BrandMark';
import { LANGUAGE_NAMES } from './i18n';
import { PAGES } from './nav';

type Props = {
  brand: Brand;
  user: string;
  /** The languages the company offers. */
  languages: readonly Language[];
  onLanguage: (language: Language) => void;
  onSignOut: () => void;
  /** Starts with the user's menu open, for a mock of it. */
  userMenuOpen?: boolean;
  children: ReactNode;
};

/** The signed-in frame: the company's brand, the menu of pages, the user's menu, and a page. */
export function Shell({
  brand,
  user,
  languages,
  onLanguage,
  onSignOut,
  userMenuOpen,
  children,
}: Props) {
  const { t, i18n } = useTranslation();
  const [opened, { toggle, close }] = useDisclosure();
  const { pathname } = useLocation();

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group wrap="nowrap">
            <Burger
              opened={opened}
              aria-expanded={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              aria-label={t('nav.menu')}
            />
            <BrandMark brand={brand} />
          </Group>
          <Menu position="bottom-end" withinPortal={false} defaultOpened={userMenuOpen}>
            <Menu.Target>
              {/* A phone's header holds the avatar alone: a long name would push the brand out. */}
              <Button
                variant="subtle"
                color="gray"
                aria-label={user}
                leftSection={<Avatar name={user} color="brand" size={28} aria-hidden />}
                rightSection={<IconChevronDown size={14} />}
              >
                <Text span inherit visibleFrom="sm">
                  {user}
                </Text>
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              {languages.length > 1 && (
                <>
                  <Menu.Label>{t('user.language')}</Menu.Label>
                  {languages.map((language) => (
                    <Menu.Item
                      key={language}
                      onClick={() => onLanguage(language)}
                      disabled={i18n.language === language}
                    >
                      {LANGUAGE_NAMES[language]}
                    </Menu.Item>
                  ))}
                  <Menu.Divider />
                </>
              )}
              <Menu.Item onClick={onSignOut}>{t('user.signOut')}</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="xs" aria-label={t('nav.menu')}>
        {PAGES.map(({ id, path, label, icon: Icon }) => (
          <NavLink
            key={id}
            component={Link}
            to={path}
            label={t(label)}
            leftSection={<Icon size={20} stroke={1.6} />}
            active={pathname === path}
            onClick={close}
          />
        ))}
      </AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
