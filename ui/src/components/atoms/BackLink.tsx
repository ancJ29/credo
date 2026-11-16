import { Anchor } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';

/** A link back to where its caller says: a small arrow before its words, in the brand's shade 7. */
export function BackLink({ href, children }: { href: string; children: string }) {
  return (
    <Anchor
      href={href}
      size="sm"
      c="brand.7"
      style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}
    >
      <IconArrowLeft size={14} aria-hidden />
      {children}
    </Anchor>
  );
}
