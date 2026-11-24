import { ActionButton, ActionRow } from 'credo-design-system';

export const One = () => (
  <div style={{ width: 394 }}>
    <ActionRow>
      <ActionButton meaning="main">Save</ActionButton>
    </ActionRow>
  </div>
);
export const Three = () => (
  <div style={{ width: 394 }}>
    <ActionRow>
      <ActionButton meaning="quiet">Cancel</ActionButton>
      <ActionButton meaning="other">Save a draft</ActionButton>
      <ActionButton meaning="main">Send</ActionButton>
    </ActionRow>
  </div>
);
