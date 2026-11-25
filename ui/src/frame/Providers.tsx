import type { Language } from '@credo/shared';
import { type ReactNode, useEffect, useMemo } from 'react';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../i18n';
import { CredoMantine } from '../design-system/CredoMantine';

type Props = {
  /** The tenant's brand colour. */
  colour: string;
  language: Language;
  /** The app is light whatever the device asks. */
  scheme?: 'light';
  /** The element that carries the colour scheme, where it is not the page's own. */
  root?: () => HTMLElement;
  /** Tests switch Mantine's transitions off. */
  test?: boolean;
  children: ReactNode;
};

/** What a page that is drawn inside another's window fixes: the colour scheme, and the element
 * that carries it. */
export type Look = Pick<Props, 'scheme' | 'root'>;

/** The look and the words: what every screen is drawn inside. */
export function Providers({ colour, language, scheme, root, test, children }: Props) {
  const i18n = useMemo(() => createI18n(language), [language]);
  // The page is marked in the language shown: on the element that carries the colour scheme.
  useEffect(() => {
    (root?.() ?? document.documentElement).setAttribute('lang', language);
  }, [language, root]);
  return (
    <CredoMantine colour={colour} scheme={scheme} root={root} test={test}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </CredoMantine>
  );
}
