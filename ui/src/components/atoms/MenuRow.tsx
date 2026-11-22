import { UnstyledButton } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import { Link } from 'react-router';
import { ICON_SIZES } from '../../design-system/tokens';
import classes from './MenuRow.module.css';

/** A row of a menu page: an optional icon, its words and, where it opens an address, an arrow at the end; a line between rows and a lit row under the pointer. */
export function MenuRow({
  icon: Icon,
  to,
  onClick,
  children,
}: {
  icon?: typeof IconChevronRight;
  to?: string;
  onClick?: () => void;
  children: string;
}) {
  const words = (
    <>
      {Icon && <Icon size={20} stroke={1.6} />}
      <span>{children}</span>
      {to && <IconChevronRight size={ICON_SIZES.field} className={classes.go} />}
    </>
  );
  return to ? (
    <UnstyledButton component={Link} to={to} className={classes.row}>
      {words}
    </UnstyledButton>
  ) : (
    <UnstyledButton className={classes.row} onClick={onClick}>
      {words}
    </UnstyledButton>
  );
}
