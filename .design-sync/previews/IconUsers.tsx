import { IconUsers } from 'credo-design-system';

export const Sizes = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
    <IconUsers size={16} />
    <IconUsers size={24} />
    <IconUsers size={40} />
  </div>
);
export const InTheBrandColour = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24, color: 'var(--mantine-color-brand-6)' }}>
    <IconUsers size={24} />
    <IconUsers size={40} stroke={1.5} />
  </div>
);
