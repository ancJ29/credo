import type { ReactNode } from 'react';
import { BEFORE_CONFIG } from '../brand';
import { Boot } from '../Boot';
import { ClientMade } from '../ClientMade';
import { NewClient } from '../NewClient';
import { OperatorPage } from '../OperatorPage';
import { OperatorSignIn } from '../OperatorSignIn';
import { Settings } from '../Settings';
import { Shell } from '../Shell';
import { SignIn } from '../SignIn';
import { UnknownClient } from '../UnknownClient';
import { FILLED, FRESH, MADE, NEW_CLIENT, OPERATOR, ROOT, TYPED } from './fixtures';
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

const operatorSignIn = (
  status: 'idle' | 'busy' | 'refused',
  initial?: { username: string; password: string },
) => <OperatorSignIn status={status} initial={initial} onSubmit={inert} />;

const newClient = (
  status: 'idle' | 'busy' | 'failed' | 'taken',
  initial?: { code: string; name: string },
) => (
  <OperatorPage onSignOut={inert}>
    <NewClient status={status} initial={initial} onSubmit={inert} />
  </OperatorPage>
);

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

/** Credo's own colour, which the operator's pages and screen 9 are drawn in. */
const CREDO = BEFORE_CONFIG.colour;

/**
 * The screens of piece 1's walk (1 to 6, and 9) and of the operator's (11 to 13, which the walk
 * numbers 1 to 4), each in its states, drawn from fixtures.
 */
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
        id: 'refused',
        label: 'failed: the save refused, what was typed kept',
        colour: FILLED.colour,
        screen: settings(TYPED, { outcome: 'refused' }),
      },
      {
        id: 'logo-too-large',
        label: 'failed: the logo is too large, the logo kept',
        colour: FILLED.colour,
        screen: settings(FILLED, { logoRefusal: 'logoTooLarge' }),
      },
      {
        id: 'logo-not-image',
        label: 'failed: the logo is not an image, the logo kept',
        colour: FILLED.colour,
        screen: settings(FILLED, { logoRefusal: 'logoNotImage' }),
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
  {
    number: 9,
    label: 'A link that names no company we know',
    states: [
      {
        id: 'unknown',
        label: 'failed: no, malformed or unknown code',
        colour: CREDO,
        screen: <UnknownClient />,
      },
    ],
  },
  {
    number: 11,
    label: 'The operator’s walk, 1: sign in at the operator’s page',
    states: [
      { id: 'empty', label: 'empty', colour: CREDO, screen: operatorSignIn('idle') },
      { id: 'filled', label: 'filled', colour: CREDO, screen: operatorSignIn('idle', OPERATOR) },
      { id: 'loading', label: 'loading', colour: CREDO, screen: operatorSignIn('busy', OPERATOR) },
      { id: 'failed', label: 'failed', colour: CREDO, screen: operatorSignIn('refused', OPERATOR) },
    ],
  },
  {
    number: 12,
    label: 'The operator’s walk, 2 and 4: a new client, its code and the company’s name',
    states: [
      { id: 'empty', label: 'empty', colour: CREDO, screen: newClient('idle') },
      { id: 'typed', label: 'filled: typed', colour: CREDO, screen: newClient('idle', NEW_CLIENT) },
      { id: 'loading', label: 'loading', colour: CREDO, screen: newClient('busy', NEW_CLIENT) },
      {
        id: 'failed',
        label: 'failed: not made, what was typed kept',
        colour: CREDO,
        screen: newClient('failed', NEW_CLIENT),
      },
      {
        id: 'taken',
        label: 'failed: the code is taken',
        colour: CREDO,
        screen: newClient('taken', NEW_CLIENT),
      },
    ],
  },
  {
    number: 13,
    label: 'The operator’s walk, 3: made, the link, the root’s name and its first password',
    states: [
      {
        id: 'made',
        label: 'filled: shown once',
        colour: CREDO,
        screen: (
          <OperatorPage onSignOut={inert}>
            <ClientMade {...MADE} onAnother={inert} />
          </OperatorPage>
        ),
      },
    ],
  },
];
