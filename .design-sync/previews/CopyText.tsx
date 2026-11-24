import { CopyText } from 'credo-design-system';

const LINK = 'https://an-phat.example/login';

export const Alone = () => <CopyText value={LINK} label="Copy" about="Sign-in link" />;
export const InItsField = () => (
  <div style={{ width: 394 }}>
    <CopyText value={LINK} label="Copy" about="Sign-in link" field="Sign-in link" />
  </div>
);
