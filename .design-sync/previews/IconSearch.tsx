import { IconSearch } from 'credo-design-system';

export const Sizes = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
    <IconSearch size={16} />
    <IconSearch size={24} />
    <IconSearch size={40} />
  </div>
);
export const InTheBrandColour = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24, color: 'var(--mantine-color-brand-6)' }}>
    <IconSearch size={24} />
    <IconSearch size={40} stroke={1.5} />
  </div>
);
