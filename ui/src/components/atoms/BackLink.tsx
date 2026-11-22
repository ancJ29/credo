import { Anchor } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { Link, useInRouterContext } from 'react-router';

const LOOK = {
  size: 'sm',
  c: 'var(--credo-brand-text)',
  style: { display: 'inline-flex', gap: 6, alignItems: 'center' },
} as const;

/** A link back to where its caller says: a small arrow before its words, in the brand's shade 7. */
export function BackLink({ href, children }: { href: string; children: string }) {
  // Inside the app's router the address is a move within the app, never a page load; the gallery draws it outside one.
  const inApp = useInRouterContext();
  const words = (
    <>
      <IconArrowLeft size={14} aria-hidden />
      {children}
    </>
  );
  return inApp ? (
    <Anchor component={Link} to={href} {...LOOK}>
      {words}
    </Anchor>
  ) : (
    <Anchor href={href} {...LOOK}>
      {words}
    </Anchor>
  );
}
