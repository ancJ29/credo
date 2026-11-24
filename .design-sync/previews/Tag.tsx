import { Tag } from 'credo-design-system';

export const InTheBrandsTone = () => (
  <div style={{ display: 'flex', gap: 8 }}>
    <Tag>You</Tag>
    <Tag>Custom</Tag>
  </div>
);
export const Meanings = () => (
  <div style={{ display: 'flex', gap: 8 }}>
    <Tag meaning="success">Answers</Tag>
    <Tag meaning="danger">Silent</Tag>
    <Tag meaning="info">Unseen</Tag>
    <Tag meaning="warning">Differs</Tag>
  </div>
);
