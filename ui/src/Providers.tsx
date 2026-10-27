import type { Language } from '@credo/shared';
import { MantineProvider } from '@mantine/core';
import { type ReactNode, useMemo } from 'react';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from './i18n';
import { themeOf } from './theme';

type Props = {
  /** The tenant's brand colour. */
  colour: string;
  language: Language;
  /** Fixed by a mock; the app follows the system's. */
  scheme?: 'light' | 'dark';
  /** The element that carries the colour scheme, where it is not the page's own. */
  root?: () => HTMLElement;
  /** Tests switch Mantine's transitions off. */
  test?: boolean;
  children: ReactNode;
};

/** The look and the words: what every screen is drawn inside. */
export function Providers({ colour, language, scheme, root, test, children }: Props) {
  const i18n = useMemo(() => createI18n(language), [language]);
  const theme = useMemo(() => themeOf(colour), [colour]);
  return (
    <MantineProvider
      theme={theme}
      forceColorScheme={scheme}
      getRootElement={root}
      env={test ? 'test' : 'default'}
    >
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </MantineProvider>
  );
}
