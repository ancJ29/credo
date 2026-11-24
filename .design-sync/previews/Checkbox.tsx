import { Checkbox } from 'credo-design-system';

export const States = () => (
  <div style={{ display: 'grid', gap: 8 }}>
    <Checkbox defaultChecked label="Remember me" />
    <Checkbox label="Send me a copy" />
  </div>
);
