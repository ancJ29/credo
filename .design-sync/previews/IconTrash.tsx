import { IconTrash } from 'credo-design-system';

export const Sizes = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
    <IconTrash size={16} />
    <IconTrash size={24} />
    <IconTrash size={40} />
  </div>
);
export const InTheBrandColour = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24, color: 'var(--mantine-color-brand-6)' }}>
    <IconTrash size={24} />
    <IconTrash size={40} stroke={1.5} />
  </div>
);
