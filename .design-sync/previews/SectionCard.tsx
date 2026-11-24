import { DetailField, IconBuilding, SectionCard } from 'credo-design-system';

export const Basics = () => (
  <div style={{ width: 474, maxWidth: '100%' }}>
    <SectionCard icon={<IconBuilding size={14} />} title="Basics">
      <DetailField label="Name" value="An Phat" />
      <DetailField label="Address" value="12 Le Loi" />
    </SectionCard>
  </div>
);
