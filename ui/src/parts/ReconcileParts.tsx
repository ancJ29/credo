import { useTranslation } from 'react-i18next';
import { useMoney } from './OrderParts';

/** A difference in words: exact, short by an amount, or over by one. */
export function useGapText() {
  const { t } = useTranslation();
  const money = useMoney();
  return (gap: number) => {
    if (gap === 0) return t('reconcile.gapExact');
    return gap < 0
      ? t('reconcile.gapShort', { amount: money(-gap) })
      : t('reconcile.gapOver', { amount: money(gap) });
  };
}
