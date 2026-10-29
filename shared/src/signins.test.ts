import { describe, expect, it } from 'vitest';
import {
  changeOwnPasswordRequestSchema,
  issueQrReplySchema,
  parseQr,
  qrLink,
  qrSecretSchema,
  setEmailRequestSchema,
  signInQrRequestSchema,
  signInRoutes,
} from './signins';

const ID = '7f0c9a52-5b2e-4a39-9d5f-0c6a8e1b2d34';
const SECRET = 'q3Zk9d1Xw0pL7mTnB2vC8rYh5sGjA4eF';
const TAG = 'a'.repeat(64);

describe('the ways to sign in', () => {
  it('C: An email is given or taken back over the version read, and is matched as a sign-in name is', () => {
    expect(setEmailRequestSchema.parse({ version: TAG, email: ' Lan@Minh-Phat.Example ' })).toEqual(
      {
        version: TAG,
        email: 'lan@minh-phat.example',
      },
    );
    expect(setEmailRequestSchema.parse({ version: TAG, email: null }).email).toBeNull();
    for (const bad of ['', 'lan', 'lan@', 'a b@c.example', `${'x'.repeat(200)}@c.example`]) {
      expect(setEmailRequestSchema.safeParse({ version: TAG, email: bad }).success, bad).toBe(
        false,
      );
    }
    expect(setEmailRequestSchema.safeParse({ version: 'x', email: null }).success).toBe(false);
    expect(setEmailRequestSchema.safeParse({ version: TAG }).success).toBe(false);
  });

  it('C: A QR code’s link names the company, the person and a secret, and only such a link is read back', () => {
    const link = qrLink('minh-phat', ID, SECRET);

    expect(link).toBe(`/login?client-code=minh-phat&qr=${ID}.${SECRET}`);
    expect(parseQr(new URL(link, 'https://credo.example').searchParams.get('qr'))).toEqual({
      id: ID,
      secret: SECRET,
    });
    for (const bad of [
      null,
      '',
      ID,
      `${ID}.`,
      `${ID}.short`,
      `not-an-id.${SECRET}`,
      `${ID}.${SECRET}.more`,
      `${ID}.${SECRET}!`,
    ]) {
      expect(parseQr(bad), String(bad)).toBeNull();
    }
    expect(qrSecretSchema.safeParse('x'.repeat(129)).success).toBe(false);
  });

  it('C: A QR code is issued with a link and an end, and a phone opens it with the person and the secret alone', () => {
    expect(issueQrReplySchema.safeParse({ link: '/login', expiresAt: 1 }).success).toBe(true);
    expect(issueQrReplySchema.safeParse({ link: '/login' }).success).toBe(false);
    expect(signInQrRequestSchema.safeParse({ id: ID, secret: SECRET }).success).toBe(true);
    expect(signInQrRequestSchema.safeParse({ id: 'x', secret: SECRET }).success).toBe(false);
    expect(signInQrRequestSchema.safeParse({ id: ID, secret: SECRET, extra: 1 }).success).toBe(
      false,
    );
  });

  it('C: One’s own password is changed with the current one given and a new one that follows the rule', () => {
    const ok = { current: 'Old-password-1!', password: 'New-password-2@' };

    expect(changeOwnPasswordRequestSchema.safeParse(ok).success).toBe(true);
    expect(changeOwnPasswordRequestSchema.safeParse({ ...ok, current: '' }).success).toBe(false);
    expect(changeOwnPasswordRequestSchema.safeParse({ ...ok, password: 'weak' }).success).toBe(
      false,
    );
    expect(changeOwnPasswordRequestSchema.safeParse({ password: ok.password }).success).toBe(false);
  });

  it('C: The routes of these ways sit under the person’s and the sign-in’s', () => {
    expect(signInRoutes.email(ID)).toBe(`/api/employees/${ID}/email`);
    expect(signInRoutes.issueQr(ID)).toBe(`/api/employees/${ID}/qr`);
    expect(signInRoutes.qr).toBe('/api/auth/sign-in-qr');
    expect(signInRoutes.password).toBe('/api/auth/password');
  });
});
