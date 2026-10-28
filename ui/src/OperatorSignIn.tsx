import { useTranslation } from 'react-i18next';
import { CREDO_BRAND } from './brand';
import { SignIn } from './SignIn';

type Props = Omit<Parameters<typeof SignIn>[0], 'brand' | 'title'>;

/** Credo's own door: the sign-in in credo's name, titled so it is never taken for a client's. */
export function OperatorSignIn(props: Props) {
  const { t } = useTranslation();
  return <SignIn brand={CREDO_BRAND} title={t('operator.signIn')} {...props} />;
}
