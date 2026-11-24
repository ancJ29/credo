import { IconBuilding } from 'credo-design-system';

export const Sizes = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
    <IconBuilding size={16} />
    <IconBuilding size={24} />
    <IconBuilding size={40} />
  </div>
);
export const InTheBrandColour = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24, color: 'var(--mantine-color-brand-6)' }}>
    <IconBuilding size={24} />
    <IconBuilding size={40} stroke={1.5} />
  </div>
);
