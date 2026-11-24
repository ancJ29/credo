import { IconChevronRight } from 'credo-design-system';

export const Sizes = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
    <IconChevronRight size={16} />
    <IconChevronRight size={24} />
    <IconChevronRight size={40} />
  </div>
);
export const InTheBrandColour = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24, color: 'var(--mantine-color-brand-6)' }}>
    <IconChevronRight size={24} />
    <IconChevronRight size={40} stroke={1.5} />
  </div>
);
