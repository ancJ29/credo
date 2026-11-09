import { type Language, LANGUAGES } from '@credo/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CREDO_BRAND } from '../brand';
import { OPERATOR_PAGES } from '../operatorNav';
import { Shell } from './Shell';

type Props = {
  /** Who is signed in, shown in the header. */
  name: string;
  /** Whether the PC's side menu shows at first, and the way to tell the device of a change. */
  shown?: boolean;
  onShown?: (shown: boolean) => void;
  onLanguage: (language: Language) => void;
  onSignOut: () => void;
  children: ReactNode;
};

/** The operator's signed-in frame: the client's shell in credo's name, a badge saying whose door
 * this is, the operator's five sections in the menu, the language in the header, and their passkeys and
 * sign-out in the user's menu and in More. */
export function OperatorPage({ name, shown, onShown, onLanguage, onSignOut, children }: Props) {
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
      menuLinks={[{ to: '/operator/passkeys', label: t('passkey.menu') }]}
      morePath="/operator/more"
      shown={shown}
      onShown={onShown}
    >
      {children}
    </Shell>
  );
}
