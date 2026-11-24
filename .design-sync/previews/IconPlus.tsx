import { IconPlus } from 'credo-design-system';

export const Sizes = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
    <IconPlus size={16} />
    <IconPlus size={24} />
    <IconPlus size={40} />
  </div>
);
export const InTheBrandColour = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24, color: 'var(--mantine-color-brand-6)' }}>
    <IconPlus size={24} />
    <IconPlus size={40} stroke={1.5} />
  </div>
);
