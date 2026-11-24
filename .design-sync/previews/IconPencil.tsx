import { IconPencil } from 'credo-design-system';

export const Sizes = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
    <IconPencil size={16} />
    <IconPencil size={24} />
    <IconPencil size={40} />
  </div>
);
export const InTheBrandColour = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24, color: 'var(--mantine-color-brand-6)' }}>
    <IconPencil size={24} />
    <IconPencil size={40} stroke={1.5} />
  </div>
);
