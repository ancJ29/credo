import { useState } from 'react';
import { TOKENS } from '../../design-system/tokens';

/** A company's logo in a small tile with a pale brand line. With no logo, or one that fails to load, it draws nothing. */
export function LogoTile({ logo, alt }: { logo?: string; alt: string }) {
  const [failed, setFailed] = useState<string | undefined>();
  if (logo === undefined || failed === logo) return null;
  return (
    <img
      src={logo}
      alt={alt}
      onError={() => setFailed(logo)}
      style={{
        width: TOKENS.logoTile.size,
        height: TOKENS.logoTile.size,
        borderRadius: TOKENS.logoTile.radius,
        border: '1px solid var(--credo-brand-line)',
        objectFit: 'contain',
      }}
    />
  );
}
