import { IconSettings } from 'credo-design-system';

export const Sizes = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
    <IconSettings size={16} />
    <IconSettings size={24} />
    <IconSettings size={40} />
  </div>
);
export const InTheBrandColour = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24, color: 'var(--mantine-color-brand-6)' }}>
    <IconSettings size={24} />
    <IconSettings size={40} stroke={1.5} />
  </div>
);
