import { IconQrcode } from 'credo-design-system';

export const Sizes = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
    <IconQrcode size={16} />
    <IconQrcode size={24} />
    <IconQrcode size={40} />
  </div>
);
export const InTheBrandColour = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24, color: 'var(--mantine-color-brand-6)' }}>
    <IconQrcode size={24} />
    <IconQrcode size={40} stroke={1.5} />
  </div>
);
