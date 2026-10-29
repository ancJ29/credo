import { Box } from '@mantine/core';
import { IconQrcode } from '@tabler/icons-react';

/** The place a QR code is drawn: a square the size of a phone's scan. It draws the QR icon, and the
 * link under it carries the code until the catalog holds a QR library to draw `value` with. */
export function QrCode({ label }: { value: string; label: string }) {
  return (
    <Box
      role="img"
      aria-label={label}
      w={176}
      h={176}
      bd="1px solid var(--mantine-color-neutral-3)"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}
    >
      <IconQrcode size={140} stroke={1.2} aria-hidden />
    </Box>
  );
}
