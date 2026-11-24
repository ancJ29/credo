import { IconLock } from 'credo-design-system';

export const Sizes = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
    <IconLock size={16} />
    <IconLock size={24} />
    <IconLock size={40} />
  </div>
);
export const InTheBrandColour = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24, color: 'var(--mantine-color-brand-6)' }}>
    <IconLock size={24} />
    <IconLock size={40} stroke={1.5} />
  </div>
);
