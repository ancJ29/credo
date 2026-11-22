import { Button } from '@mantine/core';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { TONES, WEIGHTS } from '../../design-system/tokens';

// The looks of the four meanings: the main action filled, another the default look, a quiet one subtle, a danger red filled.
const LOOKS = {
  main: { variant: 'filled' },
  other: { variant: 'default' },
  quiet: { variant: 'subtle' },
  danger: { variant: 'filled', color: TONES.danger },
} as const;

/** The button a page offers an act with: its meaning (the main action, another, a quiet one or a danger) decides its look, at one size and the width of its words; an address makes it a link, busy shows the loader and takes no second press. */
export function ActionButton({
  meaning,
  children,
  onClick,
  to,
  submit,
  busy,
  disabled,
  icon,
  label,
}: {
  meaning: 'main' | 'other' | 'quiet' | 'danger';
  children: string;
  onClick?: () => void;
  to?: string;
  submit?: boolean;
  busy?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  label?: string;
}) {
  const shared = {
    ...LOOKS[meaning],
    size: 'sm',
    fw: WEIGHTS.emphasis,
    style: { width: 'fit-content' },
    loading: busy,
    disabled,
    leftSection: icon,
    'aria-label': label,
  } as const;
  if (to !== undefined)
    return (
      <Button component={Link} to={to} {...shared}>
        {children}
      </Button>
    );
  return (
    <Button type={submit ? 'submit' : undefined} onClick={onClick} {...shared}>
      {children}
    </Button>
  );
}
