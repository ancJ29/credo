import { IconKeyboard } from 'credo-design-system';

export const Sizes = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
    <IconKeyboard size={16} />
    <IconKeyboard size={24} />
    <IconKeyboard size={40} />
  </div>
);
export const InTheBrandColour = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24, color: 'var(--mantine-color-brand-6)' }}>
    <IconKeyboard size={24} />
    <IconKeyboard size={40} stroke={1.5} />
  </div>
);
