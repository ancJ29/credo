import { IconUser } from 'credo-design-system';

export const Sizes = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
    <IconUser size={16} />
    <IconUser size={24} />
    <IconUser size={40} />
  </div>
);
export const InTheBrandColour = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24, color: 'var(--mantine-color-brand-6)' }}>
    <IconUser size={24} />
    <IconUser size={40} stroke={1.5} />
  </div>
);
