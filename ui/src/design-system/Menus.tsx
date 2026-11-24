import { Button, Menu, Stack } from '@mantine/core';
import { IconChevronDown, IconLanguage } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_NAMES } from '../i18n';
import { ICON_SIZES } from './tokens';
import { SAMPLES, useLanguage } from './samples';

/** The frame's two menus, each opened by a press: the language's and the person's, worded by the dictionary where a screen says it. */
export const MenuStates: { name: string; node: ReactNode }[] = [
  { name: 'Language menu', node: <LanguageMenu /> },
  { name: 'Person menu', node: <PersonMenu /> },
];

/** The header's language menu: a button naming the language, a label and one item for each language, the picked one marked. */
function LanguageMenu() {
  const { t } = useTranslation();
  const picked = useLanguage();
  return (
    <Stack mih={160}>
      <Menu position="bottom-start" withinPortal={false}>
        <Menu.Target>
          <Button
            variant="default"
            leftSection={<IconLanguage size={ICON_SIZES.button} />}
            w="fit-content"
          >
            {picked.toUpperCase()}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{t('user.language')}</Menu.Label>
          {(Object.keys(LANGUAGE_NAMES) as (keyof typeof LANGUAGE_NAMES)[]).map((language) => (
            <Menu.Item key={language} aria-current={picked === language}>
              {LANGUAGE_NAMES[language]}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </Stack>
  );
}

/** The header's person menu: the person's name on a button, then the password and the sign-out. */
function PersonMenu() {
  const { t } = useTranslation();
  const words = SAMPLES[useLanguage()];
  return (
    <Stack mih={160}>
      <Menu position="bottom-start" withinPortal={false}>
        <Menu.Target>
          <Button
            variant="default"
            rightSection={<IconChevronDown size={ICON_SIZES.inline} />}
            w="fit-content"
          >
            {words.person}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item>{t('user.password')}</Menu.Item>
          <Menu.Item>{t('user.passkey')}</Menu.Item>
          <Menu.Item>{t('user.signOut')}</Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Stack>
  );
}
