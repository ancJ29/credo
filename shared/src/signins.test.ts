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
  storedSignInEmailSchema,
  storedSignInQrSchema,
  waitAfter,
  waitReplySchema,
  waitShown,
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

  it('C: An email’s record names the person and when it was claimed, and a QR code’s keeps a hash and an end, never a secret', () => {
    expect(storedSignInEmailSchema.safeParse({ employeeId: ID, at: 5 }).success).toBe(true);
    expect(storedSignInEmailSchema.safeParse({ employeeId: 'x', at: 5 }).success).toBe(false);
    expect(storedSignInEmailSchema.safeParse({ employeeId: ID }).success).toBe(false);
    expect(storedSignInQrSchema.safeParse({ hash: 'a'.repeat(64), expiresAt: 5 }).success).toBe(
      true,
    );
    for (const hash of [SECRET, 'A'.repeat(64), 'a'.repeat(63)]) {
      expect(storedSignInQrSchema.safeParse({ hash, expiresAt: 5 }).success, hash).toBe(false);
    }
    expect(
      storedSignInQrSchema.safeParse({ hash: 'a'.repeat(64), expiresAt: 5, secret: SECRET })
        .success,
    ).toBe(false);
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

  it('C: Five wrong tries wait nothing, the sixth waits 30 seconds, and the wait doubles', () => {
    expect([1, 2, 3, 4, 5].map(waitAfter)).toEqual([0, 0, 0, 0, 0]);
    expect([6, 7, 8, 9, 10].map(waitAfter)).toEqual([30, 60, 120, 240, 480]);
  });

  it('C: No wait passes 15 minutes, from the eleventh wrong try on', () => {
    expect([11, 12, 50, 1000].map(waitAfter)).toEqual([900, 900, 900, 900]);
  });

  it('C: A wait is told in seconds under a minute and whole minutes, rounded up, from one, and the reply has one shape', () => {
    expect(waitShown(30)).toEqual({ unit: 'second', count: 30 });
    expect(waitShown(0.2)).toEqual({ unit: 'second', count: 1 });
    expect(waitShown(60)).toEqual({ unit: 'minute', count: 1 });
    expect(waitShown(61)).toEqual({ unit: 'minute', count: 2 });
    expect(waitReplySchema.safeParse({ error: 'Wait', waitSeconds: 30 }).success).toBe(true);
    expect(waitReplySchema.safeParse({ error: 'Wait', waitSeconds: 0 }).success).toBe(false);
    expect(waitReplySchema.safeParse({ error: 'Wait' }).success).toBe(false);
  });
});
