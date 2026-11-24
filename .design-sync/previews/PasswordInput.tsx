import { IconLock, PasswordInput } from 'credo-design-system';

export const Default = () => (
  <div style={{ width: 300 }}>
    <PasswordInput label="Password" placeholder="Your password" leftSection={<IconLock size={18} />} />
  </div>
);
