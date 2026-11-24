import { ActionButton, CredoProvider, DetailField, Panel } from 'credo-design-system';

// The preview cards are already wrapped in the provider; these show the two props it takes.
export const InTheBrandColour = () => (
  <CredoProvider colour="#1f7a5c">
    <Panel title="A company in green">
      <DetailField label="Name" value="An Phat" />
      <ActionButton meaning="main">Save</ActionButton>
    </Panel>
  </CredoProvider>
);
export const InVietnamese = () => (
  <CredoProvider language="vi">
    <Panel title="Cơ bản">
      <DetailField label="Tên" value="An Phát" />
      <ActionButton meaning="main">Lưu</ActionButton>
    </Panel>
  </CredoProvider>
);
