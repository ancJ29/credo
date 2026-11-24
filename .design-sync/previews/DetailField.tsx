import { DetailField } from 'credo-design-system';

export const WithAndWithoutValue = () => (
  <div style={{ display: 'flex', gap: 48 }}>
    <DetailField label="Phone" value="0901 234 567" />
    <DetailField label="Email" />
  </div>
);
