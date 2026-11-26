import { z } from 'zod';
import { clientCodeSchema } from './records';
import { nameSchema, passwordIsValid } from './staff';

// A company's own sign-up: someone with no company asks for an address and a root, and the company
// opens only once a credo operator approves it. A request is one record beside the client index
// (`recordKeys.signUp`), which makes nothing of a company until then.

/** The most requests that wait at once: past it a sign-up is a 503 and writes nothing, so the public
 * route's flood is a few hundred bytes a request, 20 times, and is then refused until an operator
 * refuses some. */
export const SIGN_UPS_WAITING_MAX = 20;

/** The detail a company's 404 carries where a request waits at its address, which the app reads to
 * draw the waiting screen and no other. */
export const SIGN_UP_WAITING = 'waiting';

/** What the sign-up page sends, with no session and no company header: the address the company asks
 * for (a company code's rule), its name, who to call and the phone to call, and the root's password,
 * under the app's own rule and kept only as its hash. */
export const signUpRequestSchema = z.strictObject({
  code: clientCodeSchema,
  name: nameSchema,
  contactName: z.string().trim().min(1).max(100),
  contactPhone: z
    .string()
    .trim()
    .regex(/^[0-9 +]{1,20}$/),
  password: z.string().refine(passwordIsValid, 'a password'),
});
export type SignUpRequest = z.infer<typeof signUpRequestSchema>;

/** The answer to a sent request: the address it asked for, for the card that says it was sent. */
export const signUpReplySchema = z.strictObject({ code: clientCodeSchema });
export type SignUpReply = z.infer<typeof signUpReplySchema>;

/** A waiting request as the store keeps it, under its code: the name, the contact, the root's
 * password as its hash alone, and when it was sent. No id, no settings and no root: not a company. */
export const storedSignUpSchema = z.strictObject({
  name: z.string(),
  contactName: z.string(),
  contactPhone: z.string(),
  passwordHash: z.string(),
  sentAt: z.number(),
});
export type StoredSignUp = z.infer<typeof storedSignUpSchema>;

/** A waiting request as the operator is shown it: its code beside the record, and no hash. */
export const waitingSignUpSchema = z.strictObject({
  code: clientCodeSchema,
  name: z.string(),
  contactName: z.string(),
  contactPhone: z.string(),
  sentAt: z.number(),
});
export type WaitingSignUp = z.infer<typeof waitingSignUpSchema>;

export const signUpListReplySchema = z.strictObject({ signUps: z.array(waitingSignUpSchema) });
export type SignUpListReply = z.infer<typeof signUpListReplySchema>;

/** What an approval answers: the path the new company signs in at, as the console's add does. */
export const signUpApprovedReplySchema = z.strictObject({ link: z.string() });
export type SignUpApprovedReply = z.infer<typeof signUpApprovedReplySchema>;

/** The routes: the public send; and the operator's list, refusal (`DELETE` on the request) and
 * approval, by the requested code. */
export const signUpRoutes = {
  send: '/api/sign-up',
  list: '/api/operator/sign-ups',
  one: (code: string) => `/api/operator/sign-ups/${code}`,
  approve: (code: string) => `/api/operator/sign-ups/${code}/approve`,
};
