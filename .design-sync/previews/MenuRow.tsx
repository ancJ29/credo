import { IconSettings, IconUsers, MenuRow } from 'credo-design-system';

const frame = { width: 394, border: '1px solid #e5e7eb' };

export const AWayOn = () => (
  <div style={frame}>
    <MenuRow icon={IconSettings} to="/settings">
      Settings
    </MenuRow>
    <MenuRow icon={IconUsers} to="/staff">
      Staff
    </MenuRow>
  </div>
);
export const AnAct = () => (
  <div style={frame}>
    <MenuRow onClick={() => undefined}>Sign out</MenuRow>
  </div>
);
