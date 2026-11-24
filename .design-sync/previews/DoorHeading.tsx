import { DoorHeading } from 'credo-design-system';

export const TitleOnly = () => (
  <div style={{ width: 394 }}>
    <DoorHeading title="Sign in" />
  </div>
);
export const WithSubtitle = () => (
  <div style={{ width: 394 }}>
    <DoorHeading title="Sign in with a link" subtitle="Scan the code your manager gave you" />
  </div>
);
