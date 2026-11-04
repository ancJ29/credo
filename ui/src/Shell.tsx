import type { Language, TenantConfig } from '@credo/shared';
import {
  ActionIcon,
  AppShell,
  Badge,
  Group,
  Menu,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  IconBrandAdobe,
  IconChevronDown,
  IconDots,
  IconLanguage,
  IconMenu2,
  IconX,
} from '@tabler/icons-react';
import { createContext, type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import type { Brand } from './brand';
import classes from './frame.module.css';
import looks from './frameLook.module.css';
import { LANGUAGE_NAMES } from './i18n';
import { type MenuPage, PAGES } from './nav';
import { BRAND_GRADIENT, MENU_GRADIENT } from './theme';

/** How many pages the phone's bar holds before More. */
export const BAR_PAGES = 4;

/** What the frame knows for the More page, drawn inside it: the person's pages, their own links
 * (the password, the console's passkeys) and the way to sign out. */
export type FrameParts = {
  pages: readonly MenuPage[];
  links: readonly { to: string; label: string }[];
  onSignOut: () => void;
};
export const FrameContext = createContext<FrameParts | null>(null);

/** How the company wants its frame drawn: each switch off until its root turns it on. */
export type Look = Pick<TenantConfig, 'whiteHeader' | 'whiteMenu' | 'menuIcons'>;

type Props = {
  brand: Brand;
  /** The company's frame switches; the console passes none, so all stay off. */
  look?: Look;
  user: string;
  /** The languages the company offers. */
  languages: readonly Language[];
  onLanguage: (language: Language) => void;
  onSignOut: () => void;
  /** Starts with the user's menu open, for a mock of it. */
  userMenuOpen?: boolean;
  /** Starts with the language menu open, for a mock of it. */
  languageMenuOpen?: boolean;
  /** Where a person changes their own password; the user's menu lists it only when this is set. */
  passwordPath?: string;
  /** The pages this person's menu lists; every page, for a mock of the whole menu. */
  pages?: readonly MenuPage[];
  /** A word beside the brand, which says whose door this is; a client's app passes none. */
  badge?: string;
  /** Pages of the user's own, listed in the user's menu above sign-out; a client's app has none. */
  menuLinks?: readonly { to: string; label: string }[];
  /** The address of the page the phone's More opens. */
  morePath?: string;
  /** Whether the PC's side menu shows at first, as the device kept it; it shows when not said. */
  shown?: boolean;
  /** Told when a person hides or shows the side menu, so the device can keep it. */
  onShown?: (shown: boolean) => void;
  children: ReactNode;
};

/** A name's initials, up to two, for the user's mark in the header. */
const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();

/** The signed-in frame, in the old app's layout: the coloured header (the company's name beside a
 * stand-in logo, the language, the user) over a coloured side menu on a PC that a button hides, and
 * a bar of the first four pages and More on a phone; and a page. */
export function Shell({
  brand,
  look,
  user,
  languages,
  onLanguage,
  onSignOut,
  userMenuOpen,
  languageMenuOpen,
  passwordPath,
  pages = PAGES,
  badge,
  menuLinks = [],
  morePath = '/more',
  shown: shownAtFirst = true,
  onShown,
  children,
}: Props) {
  const { t, i18n } = useTranslation();
  const [shown, setShown] = useState(shownAtFirst);
  const { pathname } = useLocation();
  const open = (path: string) => pathname === path || pathname.startsWith(`${path}/`);
  const barPages = pages.slice(0, BAR_PAGES);
  const links = [
    ...(passwordPath === undefined ? [] : [{ to: passwordPath, label: t('user.password') }]),
    ...menuLinks,
  ];
  /** Set only when on, so the markup of a frame with all three off is the one it always was. */
  const whiteHeader = look?.whiteHeader ? 'true' : undefined;
  const whiteMenu = look?.whiteMenu ? 'true' : undefined;
  const strip = !shown && look?.menuIcons ? 'true' : undefined;
  /** A frame class, with its twin from the look's file after it when the switch is on. */
  const twin = (on: boolean | undefined, base: string | undefined, white: string | undefined) =>
    [base, on ? white : undefined].filter(Boolean).join(' ');
  const head = (base: string | undefined, white: string) => twin(!!whiteHeader, base, looks[white]);
  const side = (base: string | undefined, white: string) => twin(!!whiteMenu, base, looks[white]);
  const toggle = () => {
    setShown(!shown);
    onShown?.(!shown);
  };

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{
        width: strip ? 60 : 250,
        breakpoint: 'sm',
        collapsed: { mobile: true, desktop: !shown && !strip },
      }}
      footer={{ height: { base: 64, sm: 0 } }}
      padding="md"
    >
      <AppShell.Header
        className={head(classes.header, 'header')}
        data-white={whiteHeader}
        style={whiteHeader ? undefined : { background: BRAND_GRADIENT, color: '#fff' }}
      >
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group wrap="nowrap" gap="sm">
            <Group gap="sm" wrap="nowrap" className={head(classes.brand, 'brand')}>
              <IconBrandAdobe size={36} stroke={1.5} aria-hidden />
              <Title
                order={1}
                size="h4"
                fw={600}
                c={whiteHeader ? undefined : 'inherit'}
                className={whiteHeader ? looks.brandName : undefined}
              >
                {brand.name}
              </Title>
            </Group>
            {badge && (
              <Badge variant="filled" className={head(classes.badge, 'badge')}>
                {badge}
              </Badge>
            )}
            <ActionIcon
              variant="transparent"
              c="inherit"
              className={head(classes.button, 'button')}
              visibleFrom="sm"
              aria-label={t(shown ? 'nav.hideMenu' : 'nav.showMenu')}
              aria-expanded={shown}
              onClick={toggle}
            >
              {shown ? <IconX size={18} /> : <IconMenu2 size={18} />}
            </ActionIcon>
          </Group>
          <Group wrap="nowrap" gap="xs">
            {languages.length > 1 && (
              <Menu
                position="bottom-end"
                withinPortal={false}
                defaultOpened={languageMenuOpen}
                classNames={{ dropdown: classes.dropdown }}
              >
                <Menu.Target>
                  <UnstyledButton
                    className={head(classes.button, 'button')}
                    aria-label={t('user.language')}
                  >
                    <IconLanguage size={18} />
                    <span>{i18n.language.toUpperCase()}</span>
                  </UnstyledButton>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>{t('user.language')}</Menu.Label>
                  {languages.map((language) => (
                    <Menu.Item
                      key={language}
                      aria-current={i18n.language === language}
                      fw={i18n.language === language ? 600 : undefined}
                      onClick={() => onLanguage(language)}
                    >
                      {LANGUAGE_NAMES[language]}
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
            )}
            <Menu
              position="bottom-end"
              withinPortal={false}
              defaultOpened={userMenuOpen}
              classNames={{ dropdown: classes.dropdown }}
            >
              <Menu.Target>
                {/* A phone's header holds the mark alone: a long name would push the brand out. */}
                <UnstyledButton className={head(classes.user, 'user')} aria-label={user}>
                  <span className={head(classes.avatar, 'avatar')} aria-hidden>
                    {initialsOf(user)}
                  </span>
                  <Text span inherit fw={600} visibleFrom="sm">
                    {user}
                  </Text>
                  <IconChevronDown size={14} />
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                {links.map(({ to, label }) => (
                  <Menu.Item key={to} component={Link} to={to}>
                    {label}
                  </Menu.Item>
                ))}
                <Menu.Item onClick={onSignOut}>{t('user.signOut')}</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>
      {(shown || strip) && (
        <AppShell.Navbar
          className={side(classes.menu, 'menu')}
          data-white={whiteMenu}
          data-strip={strip}
          style={whiteMenu ? undefined : { background: MENU_GRADIENT, color: '#fff' }}
          visibleFrom="sm"
          aria-label={t('nav.menu')}
        >
          {pages.map(({ id, path, label, icon: Icon }) => (
            <Link
              key={id}
              to={path}
              className={
                strip
                  ? `${side(classes.item, 'item')} ${looks.stripItem}`
                  : side(classes.item, 'item')
              }
              aria-label={strip ? t(label) : undefined}
              data-tip={strip ? t(label) : undefined}
              aria-current={open(path) ? 'page' : undefined}
            >
              <Icon size={strip ? 22 : 20} stroke={1.6} />
              {!strip && <span>{t(label)}</span>}
            </Link>
          ))}
        </AppShell.Navbar>
      )}
      <AppShell.Main>
        <FrameContext value={{ pages, links, onSignOut }}>{children}</FrameContext>
      </AppShell.Main>
      <AppShell.Footer hiddenFrom="sm">
        <nav className={classes.bar} aria-label={t('nav.menu')}>
          {barPages.map(({ id, path, label, icon: Icon }) => (
            <Link
              key={id}
              to={path}
              className={classes.barLink}
              aria-label={t(label)}
              aria-current={open(path) ? 'page' : undefined}
            >
              <span className={classes.barIcon}>
                <Icon size={22} stroke={1.8} />
              </span>
            </Link>
          ))}
          <Link
            to={morePath}
            className={classes.barLink}
            aria-label={t('nav.more')}
            aria-current={barPages.some(({ path }) => open(path)) ? undefined : 'page'}
          >
            <span className={classes.barIcon}>
              <IconDots size={22} stroke={1.8} />
            </span>
          </Link>
        </nav>
      </AppShell.Footer>
    </AppShell>
  );
}
