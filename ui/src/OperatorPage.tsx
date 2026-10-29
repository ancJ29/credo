import { type Language, LANGUAGES } from '@credo/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CREDO_BRAND } from './brand';
import { OPERATOR_PAGES } from './operatorNav';
import { Shell } from './Shell';

type Props = {
  /** Who is signed in, shown in the header. */
  name: string;
  onLanguage: (language: Language) => void;
  onSignOut: () => void;
  children: ReactNode;
};

/** The operator's signed-in frame: the client's shell in credo's name, a badge saying whose door
 * this is, the operator's five sections in the menu, and the language and sign-out in the user's
 * menu. */
export function OperatorPage({ name, onLanguage, onSignOut, children }: Props) {
  const { t } = useTranslation();
  return (
    <Shell
      brand={CREDO_BRAND}
      badge={t('operator.badge')}
      user={name}
      pages={OPERATOR_PAGES}
      languages={LANGUAGES}
      onLanguage={onLanguage}
      onSignOut={onSignOut}
    >
      {children}
    </Shell>
  );
}
