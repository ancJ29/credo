import { z } from 'zod';
import { emailSchema } from './records';
import { passwordIsValid } from './staff';
import { ROUTES, tagSchema } from './wire';

// The ways to sign in beyond a code and a password: an email, a QR code, and one's own password.
// The email is a second sign-in name the root gives, and no mail is ever sent to it.

/** A person's email, or none, over the version read. */
export const setEmailRequestSchema = z.strictObject({
  version: tagSchema,
  email: emailSchema.nullable(),
});
export type SetEmailRequest = z.input<typeof setEmailRequestSchema>;

/** An email's record: the person who holds it, and when it was claimed, the age a failed set's claim
 * waits for before it is taken over. It is live only while that person's record holds the email. */
export const storedSignInEmailSchema = z.strictObject({ employeeId: z.uuid(), at: z.number() });
export type StoredSignInEmail = z.infer<typeof storedSignInEmailSchema>;

/** A QR code as kept: the SHA-256 hex of its secret, never the secret, and when it stops signing in. */
export const storedSignInQrSchema = z.strictObject({
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  expiresAt: z.number(),
});
export type StoredSignInQr = z.infer<typeof storedSignInQrSchema>;

/** How long a QR code signs in. */
export const QR_MINUTES = 15;

/** A QR code's secret: 32 random bytes in base64url, or what a test and the fake stand in. */
export const qrSecretSchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/);

/** The link a QR code opens: the company's code, then the person and the secret. */
export const qrLink = (clientCode: string, id: string, secret: string) =>
  `/login?client-code=${clientCode}&qr=${id}.${secret}`;

/** The person and the secret a link's `qr` names, or null for anything else. */
export function parseQr(raw: string | null) {
  const [id, secret, ...rest] = (raw ?? '').split('.');
  const parsed = z.uuid().safeParse(id);
  const found = qrSecretSchema.safeParse(secret);
  return parsed.success && found.success && rest.length === 0
    ? { id: parsed.data, secret: found.data }
    : null;
}

/** A QR code issued: its link, and when it stops signing in. */
export const issueQrReplySchema = z.strictObject({ link: z.string(), expiresAt: z.number() });
export type IssueQrReply = z.infer<typeof issueQrReplySchema>;

/** A phone opening a QR code's link. */
export const signInQrRequestSchema = z.strictObject({ id: z.uuid(), secret: qrSecretSchema });
export type SignInQrRequest = z.infer<typeof signInQrRequestSchema>;

/** One's own password: the current one first, then a new one under the same rule as every password. */
export const changeOwnPasswordRequestSchema = z.strictObject({
  current: z.string().min(1).max(1024),
  password: z.string().refine(passwordIsValid, 'a password'),
});
export type ChangeOwnPasswordRequest = z.infer<typeof changeOwnPasswordRequestSchema>;

/** The routes of these ways, beside `ROUTES` and `employeeRoutes`. */
export const signInRoutes = {
  qr: '/api/auth/sign-in-qr',
  password: '/api/auth/password',
  email: (id: string) => `${ROUTES.employees}/${id}/email`,
  issueQr: (id: string) => `${ROUTES.employees}/${id}/qr`,
};

/** Wrong tries a name has free before any wait. */
export const WAIT_FREE_TRIES = 5;
/** The wait the sixth wrong try starts, in seconds; each next wrong try doubles it. */
export const WAIT_FIRST_SECONDS = 30;
/** The longest wait, in seconds: 15 minutes. */
export const WAIT_MAX_SECONDS = 900;

/** The seconds a name waits after its `wrong`th wrong try in a row: none to the fifth, then 30
 * seconds doubling, at most 15 minutes. */
export function waitAfter(wrong: number): number {
  if (wrong <= WAIT_FREE_TRIES) return 0;
  return Math.min(WAIT_FIRST_SECONDS * 2 ** (wrong - WAIT_FREE_TRIES - 1), WAIT_MAX_SECONDS);
}

/** The back end's 429: a name that must wait, and the seconds left. */
export const waitReplySchema = z.strictObject({
  error: z.literal('Wait'),
  waitSeconds: z.number().int().positive(),
});
export type WaitReply = z.infer<typeof waitReplySchema>;

/** How a wait is told: seconds under a minute, whole minutes rounded up from one. */
export function waitShown(seconds: number): { unit: 'second' | 'minute'; count: number } {
  return seconds < 60
    ? { unit: 'second', count: Math.max(1, Math.ceil(seconds)) }
    : { unit: 'minute', count: Math.ceil(seconds / 60) };
}
