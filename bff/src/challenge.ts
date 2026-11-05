import { createHmac, hkdfSync } from 'node:crypto';
import { constantTimeEqual } from './constant-time';

/** What a challenge is minted for. A token made for one purpose opens for no other. */
export type Purpose =
  | 'sign-in'
  | 'join'
  | 'add'
  | 'confirm-add'
  | 'confirm-remove'
  | 'confirm-root-password'
  | 'confirm-add-operator'
  | 'confirm-operator-link'
  | 'confirm-delete-operator'
  | 'confirm-delete-client';

/** How long a challenge may wait for the device's answer. */
export const CHALLENGE_MS = 5 * 60 * 1000;

type Claims = { challenge: string; purpose: Purpose; subject: string; endsAt: number };

/**
 * Challenges that are signed and not stored: an options call writes nothing. The token holds the
 * challenge, its purpose, whom it serves (a link's hash, an operator's id, or nothing for a
 * sign-in) and when it ends, signed under a key derived from the BFF's own service key, so a
 * token is read only by the BFF that made it and a forged or changed one opens nothing.
 */
export function createChallenges({ serviceKey, now }: { serviceKey: string; now: () => number }) {
  const key = Buffer.from(hkdfSync('sha256', serviceKey, '', 'credo operator challenge', 32));
  const sign = (body: string) => createHmac('sha256', key).update(body).digest('base64url');

  return {
    /** The token that binds `challenge` to a purpose and a subject. */
    mint(challenge: string, purpose: Purpose, subject = ''): string {
      const claims: Claims = { challenge, purpose, subject, endsAt: now() + CHALLENGE_MS };
      const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
      return `${body}.${sign(body)}`;
    },

    /** The challenge a token holds, or null when it was not signed here, was made for another
     * purpose or subject, or has ended. */
    open(token: string, purpose: Purpose, subject = ''): string | null {
      const [body, signature, ...rest] = token.split('.');
      if (!body || !signature || rest.length > 0) return null;
      if (!constantTimeEqual(Buffer.from(signature), Buffer.from(sign(body)))) return null;
      const claims = JSON.parse(Buffer.from(body, 'base64url').toString()) as Claims;
      if (claims.purpose !== purpose || claims.subject !== subject) return null;
      return claims.endsAt > now() ? claims.challenge : null;
    },
  };
}
