import { Badge } from '@mantine/core';
import type { OrderState, RequestState } from '@credo/shared';
import { useTranslation } from 'react-i18next';
import { TONES } from '../../design-system/tokens';

// Every status the records carry: an order's, a delivery request's, and a person's active or not (archived).
export type Status = OrderState | RequestState | 'active' | 'inactive';

// The tone each status is drawn at, one each; a status the records gain is a type error here.
export const STATUS_TONE: Record<Status, keyof typeof TONES> = {
  draft: 'info',
  confirmed: 'warning',
  fulfilled: 'success',
  cancelled: 'danger',
  waiting: 'warning',
  delivered: 'success',
  active: 'success',
  inactive: 'info',
};

// The statuses, in the order the table lists them.
export const STATUSES = Object.keys(STATUS_TONE) as Status[];

/** A status as a chip: the part decides its tone and its word, in the language of the person reading. */
export function StatusBadge({ status }: { status: Status }) {
  const { t } = useTranslation();
  const word =
    status === 'active'
      ? t('staff.chipActive')
      : status === 'inactive'
        ? t('staff.chipInactive')
        : t(`orders.state.${status}`);
  return (
    <Badge variant="light" color={TONES[STATUS_TONE[status]]} data-status={status}>
      {word}
    </Badge>
  );
}
