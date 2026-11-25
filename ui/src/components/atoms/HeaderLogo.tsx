import { IconBrandAdobe } from '@tabler/icons-react';
import { useState } from 'react';
import { TOKENS } from '../../design-system/tokens';

/** The mark at the start of the header, in the 36-pixel square of the stand-in icon: on the coloured header the logo for the coloured header bare, else the one logo on a white tile; on the white header the logo; the stand-in where none applies or the picture fails to load. */
export function HeaderLogo({
  logo,
  logoOnColour,
  white,
}: {
  logo?: string;
  logoOnColour?: string;
  white: boolean;
}) {
  const [failed, setFailed] = useState<string | undefined>();
  const shown = white ? logo : (logoOnColour ?? logo);
  if (shown === undefined || failed === shown)
    return <IconBrandAdobe size={36} stroke={1.5} aria-hidden />;
  const tile = !white && logoOnColour === undefined;
  const { size, inset, radius } = TOKENS.headerLogo;
  return (
    <img
      src={shown}
      alt=""
      onError={() => setFailed(shown)}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        objectFit: 'contain',
        ...(tile
          ? {
              boxSizing: 'border-box',
              padding: inset,
              borderRadius: radius,
              backgroundColor: TOKENS.headerLogo.tile,
            }
          : {}),
      }}
    />
  );
}
