import { IconUser, TextInput } from 'credo-design-system';

export const Labelled = () => (
  <div style={{ width: 300 }}>
    <TextInput label="Name" placeholder="Your name" leftSection={<IconUser size={18} />} />
  </div>
);
export const WithError = () => (
  <div style={{ width: 300 }}>
    <TextInput label="Department" defaultValue="Sales" error="That department does not exist" />
  </div>
);
