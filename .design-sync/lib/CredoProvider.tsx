import type { Language } from '@credo/shared';
import { CREDO_COLOUR } from '@credo/shared';
import { useMemo, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, useInRouterContext } from 'react-router';
import { CredoMantine } from '../../ui/src/design-system/CredoMantine';
import { createI18n } from '../../ui/src/i18n';

type Props = {
  /** The brand colour the theme is made from; credo's own colour when omitted. */
  colour?: string;
  /** The language the parts speak: `vi` or `en`; Vietnamese when omitted. */
  language?: Language;
  children: ReactNode;
};

/** Everything a part reads from its surroundings: Mantine's theme in the brand colour, the
 * dictionary, and a router for the links (kept if the page already has one). Wrap a design in it once, at the root. */
export function CredoProvider({ colour = CREDO_COLOUR, language = 'vi', children }: Props) {
  const i18n = useMemo(() => createI18n(language), [language]);
  const inRouter = useInRouterContext();
  return (
    <CredoMantine colour={colour}>
      <I18nextProvider i18n={i18n}>
        {inRouter ? children : <MemoryRouter>{children}</MemoryRouter>}
      </I18nextProvider>
    </CredoMantine>
  );
}
