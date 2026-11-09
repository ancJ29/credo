import { Paper, Title, UnstyledButton } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import classes from '../frame/frame.module.css';
import { BAR_PAGES, FrameContext } from '../frame/Shell';

/** The phone's More: the pages its bar leaves out, then the person's own links and sign-out. Drawn
 * inside the frame, which knows them. */
export function MorePage() {
  const { t } = useTranslation();
  const frame = useContext(FrameContext);
  if (!frame) throw new Error('MorePage is drawn inside the frame');
  const { pages, links, onSignOut } = frame;
  const others = pages.slice(BAR_PAGES);

  return (
    <>
      <Title order={2} mb="md">
        {t('nav.more')}
      </Title>
      {others.length > 0 && (
        <Paper withBorder mb="md">
          {others.map(({ id, path, label, icon: Icon }) => (
            <UnstyledButton key={id} component={Link} to={path} className={classes.moreRow}>
              <Icon size={20} stroke={1.6} />
              <span>{t(label)}</span>
              <IconChevronRight size={16} className={classes.go} />
            </UnstyledButton>
          ))}
        </Paper>
      )}
      <Paper withBorder>
        {links.map(({ to, label }) => (
          <UnstyledButton key={to} component={Link} to={to} className={classes.moreRow}>
            <span>{label}</span>
            <IconChevronRight size={16} className={classes.go} />
          </UnstyledButton>
        ))}
        <UnstyledButton className={classes.moreRow} onClick={onSignOut}>
          <span>{t('user.signOut')}</span>
        </UnstyledButton>
      </Paper>
    </>
  );
}
