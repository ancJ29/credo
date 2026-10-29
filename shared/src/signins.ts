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
