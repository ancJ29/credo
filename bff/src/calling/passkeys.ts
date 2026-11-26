import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import type { StoredPasskey } from '@credo/shared';

/**
 * The four calls to the passkey library, for every caller's ceremonies: the operators' and a
 * company's differ only in the address the browser opened, so each caller passes its own. A call
 * returns what the library says and decides nothing about who may.
 */

/** The name the operators' passkeys are made for; a company's own is its plain name. */
export const OPERATORS_RP_NAME = 'Credo';
/** The COSE algorithms a passkey may use (EdDSA, ES256, RS256), named so the library's default is
 * never read: it asks the runtime about ML-DSA-44, which Node 24 and later warn about as
 * experimental. Held by operator-algorithms.route.test.ts. */
const PASSKEY_ALGORITHMS = [-8, -7, -257];

/** The address a ceremony is checked against and the relying party it is made for, which is that
 * address's host. */
export type Relying = { origin: string; rpID: string };

export const relyingOn = (origin: string): Relying => ({
  origin,
  rpID: new URL(origin).hostname,
});

const bytesOf = (base64url: string) => new Uint8Array(Buffer.from(base64url, 'base64url'));

/** The options a new passkey is made with, for the relying party named `rpName`, for `user` (the id
 * the device keeps and the name it shows), leaving out the passkeys already `held`. */
export async function registrationOptions(
  relying: Relying,
  user: { id: string; name: string },
  held: StoredPasskey[],
  rpName: string,
) {
  return await generateRegistrationOptions({
    rpName,
    rpID: relying.rpID,
    userName: user.name,
    userID: new TextEncoder().encode(user.id),
    attestationType: 'none',
    excludeCredentials: held.map(({ id, transports }) => ({ id, transports })),
    supportedAlgorithmIDs: PASSKEY_ALGORITHMS,
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });
}

/** The key a registration made, or null where the library refuses the response: it throws for
 * what it refuses and which part is not said. */
export async function verifiedRegistration(
  relying: Relying,
  response: unknown,
  expectedChallenge: string,
) {
  try {
    const result = await verifyRegistrationResponse({
      response: response as RegistrationResponseJSON,
      expectedChallenge,
      expectedOrigin: relying.origin,
      expectedRPID: relying.rpID,
      requireUserVerification: true,
      supportedAlgorithmIDs: PASSKEY_ALGORITHMS,
    });
    if (result.verified) return result.registrationInfo.credential;
  } catch {
    // The library throws for what it refuses; which part is not said.
  }
  return null;
}

/** A credential the library verified, as it is stored: added now and never used. */
export const storedPasskey = (
  credential: { id: string; publicKey: Uint8Array; counter: number; transports?: string[] },
  now: number,
): StoredPasskey => ({
  id: credential.id,
  publicKey: Buffer.from(credential.publicKey).toString('base64url'),
  counter: credential.counter,
  transports: credential.transports ?? [],
  addedAt: now,
  lastUsedAt: null,
});

/** The options a sign-in or a touch is answered to, with user verification; `allowed` names the
 * only passkeys that may answer, none leaving the device to offer its own. */
export async function authenticationOptions(
  relying: Relying,
  allowed?: { id: string; transports: string[] }[],
) {
  return await generateAuthenticationOptions({
    rpID: relying.rpID,
    userVerification: 'required',
    ...(allowed
      ? { allowCredentials: allowed.map(({ id, transports }) => ({ id, transports })) }
      : {}),
  });
}

/** The counter a passkey's answer to a challenge moves on to, or null where the library says the
 * answer is not that passkey's, to that challenge, at that address, with user verification. */
export async function verifiedAuthentication(
  relying: Relying,
  answer: AuthenticationResponseJSON,
  challenge: string,
  passkey: StoredPasskey,
) {
  try {
    const result = await verifyAuthenticationResponse({
      response: answer,
      expectedChallenge: challenge,
      expectedOrigin: relying.origin,
      expectedRPID: relying.rpID,
      credential: {
        id: passkey.id,
        publicKey: bytesOf(passkey.publicKey),
        counter: passkey.counter,
        transports: passkey.transports,
      },
      requireUserVerification: true,
    });
    if (result.verified) return result.authenticationInfo.newCounter;
  } catch {
    // The library throws for what it refuses; which part is not said.
  }
  return null;
}
