import { QRCodeSVG } from 'qrcode.react';

/** A QR code drawn as SVG in the browser: `value` is what a phone reads, `label` what a screen
 * reader says. Only the page that shows a sign-in link imports this, so no other page loads it. */
export function QrCode({ value, label }: { value: string; label: string }) {
  return (
    <QRCodeSVG
      value={value}
      size={176}
      level="M"
      marginSize={2}
      role="img"
      aria-label={label}
      title={label}
    />
  );
}
