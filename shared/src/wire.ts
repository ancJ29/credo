import { z } from 'zod';
import { tenantConfigSchema } from './config';

export const ROUTES = {
  config: '/api/config',
  signIn: '/api/auth/sign-in',
  signOut: '/api/auth/sign-out',
  me: '/api/auth/me',
} as const;

/** The session handle, on every call after sign-in. */
export const AUTH_HEADER = 'x-auth-id';
/** The SHA-256 of the body, hex, on every write: CloudFront's origin access control requires it
 * for the Lambda URL, and the local front refuses a write without the right one. */
export const HASH_HEADER = 'x-amz-content-sha256';
/** The device id the UI minted, on sign-in. */
export const DEVICE_HEADER = 'x-device-id';

export const signInRequestSchema = z.strictObject({
  name: z.string().min(1),
  password: z.string().min(1),
});
export type SignInRequest = z.infer<typeof signInRequestSchema>;

export const userViewSchema = z.strictObject({ name: z.string(), root: z.boolean() });
export type UserView = z.infer<typeof userViewSchema>;

export const sessionReplySchema = z.strictObject({
  authId: z.string(),
  expiresAt: z.number(),
  user: userViewSchema,
});
export type SessionReply = z.infer<typeof sessionReplySchema>;

export const meReplySchema = z.strictObject({ user: userViewSchema });
export type MeReply = z.infer<typeof meReplySchema>;

/** The settings with the version they were read at; a save sends it back. */
export const configDocSchema = z.strictObject({
  config: tenantConfigSchema,
  version: z.string(),
});
export type ConfigDoc = z.infer<typeof configDocSchema>;

/** `version` is null only for the first save, when no settings exist yet. */
export const saveConfigRequestSchema = z.strictObject({
  config: tenantConfigSchema,
  version: z.string().nullable(),
});
export type SaveConfigRequest = z.infer<typeof saveConfigRequestSchema>;

export const errorReplySchema = z.strictObject({
  error: z.string(),
  details: z.string().optional(),
});

/** A save over newer settings: the newer ones, for the page to offer; none if they are gone. */
export const conflictReplySchema = z.strictObject({
  error: z.string(),
  current: configDocSchema.nullable(),
});
export type ConflictReply = z.infer<typeof conflictReplySchema>;
