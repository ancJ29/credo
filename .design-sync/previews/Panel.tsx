import { DetailField, Panel, Text } from 'credo-design-system';

export const WithATitle = () => (
  <div style={{ width: 474, maxWidth: '100%' }}>
    <Panel title="Basics">
      <DetailField label="Name" value="An Phat" />
    </Panel>
  </div>
);
export const NoTitle = () => (
  <div style={{ width: 474, maxWidth: '100%' }}>
    <Panel>
      <Text>Changes are kept when you save.</Text>
    </Panel>
  </div>
);
