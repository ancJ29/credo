import type { ReactNode } from 'react';
import { Boot } from '../Boot';
import { Settings } from '../Settings';
import { Shell } from '../Shell';
import { SignIn } from '../SignIn';
import { FILLED, FRESH, ROOT, TYPED } from './fixtures';
import type { TenantConfig } from '@credo/shared';

/** The mock's handlers do nothing: no screen here calls a service. */
/* v8 ignore next -- untested: an inert handler, no behaviour to check */
const inert = () => {};

type SettingsProps = Parameters<typeof Settings>[0];

const settings = (
  config: TenantConfig,
  more: Partial<SettingsProps> = {},
  shell: { userMenuOpen?: boolean } = {},
) => (
  <Shell
    brand={config}
    user={ROOT.username}
    languages={config.languages}
    onLanguage={inert}
    onSignOut={inert}
    {...shell}
  >
    <Settings
      status="ready"
      config={config}
      outcome={null}
      saving={false}
      onSave={inert}
      onRetry={inert}
      onReload={inert}
      {...more}
    />
  </Shell>
);

const signIn = (
  status: 'idle' | 'busy' | 'refused',
  initial?: { username: string; password: string },
) => <SignIn brand={FILLED} status={status} initial={initial} onSubmit={inert} />;

type MockState = {
  id: string;
  label: string;
  /** The brand colour the screen is drawn in. */
  colour: string;
  screen: ReactNode;
};

export type MockScreen = {
  /** The walk's screen number. */
  number: number;
  label: string;
  states: MockState[];
};

/** The six screens of piece 1's walk, each in its states, drawn from fixtures. */
export const SCREENS: MockScreen[] = [
  {
    number: 1,
    label: 'Sign in, in the company’s name and colours',
    states: [
      { id: 'empty', label: 'empty', colour: FILLED.colour, screen: signIn('idle') },
      { id: 'filled', label: 'filled', colour: FILLED.colour, screen: signIn('idle', ROOT) },
      { id: 'loading', label: 'loading', colour: FILLED.colour, screen: signIn('busy', ROOT) },
    ],
  },
  {
    number: 2,
    label: 'Sign-in refused',
    states: [
      { id: 'failed', label: 'failed', colour: FILLED.colour, screen: signIn('refused', ROOT) },
    ],
  },
  {
    number: 3,
    label: 'Settings: name, logo, colour, languages',
    states: [
      {
        id: 'loading',
        label: 'loading',
        colour: FILLED.colour,
        screen: settings(FILLED, { status: 'loading' }),
      },
      { id: 'empty', label: 'empty: a new company', colour: FRESH.colour, screen: settings(FRESH) },
      { id: 'filled', label: 'filled', colour: FILLED.colour, screen: settings(FILLED) },
      {
        id: 'failed',
        label: 'failed: the page did not load',
        colour: FILLED.colour,
        screen: settings(FILLED, { status: 'failed' }),
      },
      {
        id: 'saving',
        label: 'loading: saving',
        colour: FILLED.colour,
        screen: settings(TYPED, { saving: true }),
      },
      {
        id: 'save-failed',
        label: 'failed: the save, what was typed kept',
        colour: FILLED.colour,
        screen: settings(TYPED, { outcome: 'failed' }),
      },
      {
        id: 'conflict',
        label: 'failed: a newer save exists',
        colour: FILLED.colour,
        screen: settings(TYPED, { outcome: 'conflict' }),
      },
    ],
  },
  {
    number: 4,
    label: 'Saved: the app shows the new name and colour',
    states: [
      {
        id: 'filled',
        label: 'filled',
        colour: TYPED.colour,
        screen: settings(TYPED, { outcome: 'saved' }),
      },
    ],
  },
  {
    number: 5,
    label: 'The language switched, from the user menu',
    states: [
      {
        id: 'filled',
        label: 'filled: the menu open',
        colour: FILLED.colour,
        screen: settings(FILLED, {}, { userMenuOpen: true }),
      },
    ],
  },
  {
    number: 6,
    label: 'The service down at start',
    states: [
      {
        id: 'loading',
        label: 'loading',
        colour: FRESH.colour,
        screen: <Boot status="loading" onRetry={inert} />,
      },
      {
        id: 'failed',
        label: 'failed',
        colour: FRESH.colour,
        screen: <Boot status="unavailable" onRetry={inert} />,
      },
    ],
  },
];
