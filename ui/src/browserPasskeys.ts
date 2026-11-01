import {
  authenticationResponseSchema,
  registrationResponseSchema,
  type CeremonyOptions,
} from '@credo/shared';
import {
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import { type Passkeys, PasskeyAlreadyHere, PasskeyNotGiven } from './passkeys';

/** The browser's `NotAllowedError` alone reads as "not given", and its `InvalidStateError` (the
 * device holds a passkey the options exclude) as "already here"; whatever else a ceremony throws
 * (a library error, an options call that did not parse) stays an error, which the page words as
 * the service being unavailable. */
async function ceremony<T>(run: () => Promise<T>) {
  try {
    return await run();
  } catch (error) {
    if (error instanceof Error && error.name === 'NotAllowedError') throw new PasskeyNotGiven();
    if (error instanceof Error && error.name === 'InvalidStateError')
      throw new PasskeyAlreadyHere();
    throw error;
  }
}

/** The options are the BFF's library's own; only their challenge is read by the app. */
const asCreation = (options: CeremonyOptions) =>
  options as unknown as PublicKeyCredentialCreationOptionsJSON;
const asRequest = (options: CeremonyOptions) =>
  options as unknown as PublicKeyCredentialRequestOptionsJSON;

/** The device's passkeys, through the browser. */
export const browserPasskeys: Passkeys = {
  register: (options) =>
    ceremony(async () =>
      registrationResponseSchema.parse(
        await startRegistration({ optionsJSON: asCreation(options) }),
      ),
    ),
  authenticate: (options) =>
    ceremony(async () =>
      authenticationResponseSchema.parse(
        await startAuthentication({ optionsJSON: asRequest(options) }),
      ),
    ),
};
