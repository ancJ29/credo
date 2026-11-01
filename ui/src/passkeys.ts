import type { AuthenticationResponse, CeremonyOptions, RegistrationResponse } from '@credo/shared';

/** The device did not give a passkey: the person dismissed the prompt, or the device refused. It
 * is the one failure the page words as "not given"; any other failure of a ceremony is the
 * service being unavailable. */
export class PasskeyNotGiven extends Error {
  constructor() {
    super('the passkey was not given');
    this.name = 'PasskeyNotGiven';
  }
}

/** The device already holds a passkey the options exclude (the browser's `InvalidStateError`):
 * another cannot be made on it for the same operator. */
export class PasskeyAlreadyHere extends Error {
  constructor() {
    super('the device already holds a passkey for this operator');
    this.name = 'PasskeyAlreadyHere';
  }
}

/** The one door to the device's passkeys. The app uses the browser's through `browserPasskeys`;
 * the fake build and the tests use a fake that answers as a passkey would, so no preview or test
 * ever makes a passkey on a person's own device. */
export type Passkeys = {
  /** Makes a passkey from the options a join or an add gave. */
  register: (options: CeremonyOptions) => Promise<RegistrationResponse>;
  /** Signs with a passkey the device holds for this address, from the options a sign-in gave. */
  authenticate: (options: CeremonyOptions) => Promise<AuthenticationResponse>;
};
