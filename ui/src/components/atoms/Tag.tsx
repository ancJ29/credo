import { Badge } from '@mantine/core';
import { SIZES, TONES } from '../../design-system/tokens';

/** A word beside a name or in a row, drawn light at the chip’s size: in the brand’s tone, or in the tone of its meaning (danger, success, warning or info). */
export function Tag({
  meaning = 'brand',
  children,
}: {
  meaning?: 'brand' | 'danger' | 'success' | 'warning' | 'info';
  children: string;
}) {
  return (
    <Badge variant="light" fz={SIZES.chip} color={meaning === 'brand' ? undefined : TONES[meaning]}>
      {children}
    </Badge>
  );
}
