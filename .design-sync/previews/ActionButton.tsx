import { ActionButton, IconPlus } from 'credo-design-system';

export const Main = () => <ActionButton meaning="main">Save</ActionButton>;
export const Other = () => <ActionButton meaning="other">Save a draft</ActionButton>;
export const Quiet = () => <ActionButton meaning="quiet">Cancel</ActionButton>;
export const Danger = () => <ActionButton meaning="danger">Delete the record</ActionButton>;
export const WithIcon = () => (
  <ActionButton meaning="other" icon={<IconPlus size={16} />}>
    Add staff member
  </ActionButton>
);
export const BusyAndDisabled = () => (
  <div style={{ display: 'flex', gap: 12 }}>
    <ActionButton meaning="main" busy>
      Saving
    </ActionButton>
    <ActionButton meaning="main" disabled>
      Send
    </ActionButton>
  </div>
);
