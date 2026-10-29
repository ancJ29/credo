import { scryptSync, timingSafeEqual } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { passwordIsValid } from '@credo/shared';
import { hashPassword, madePassword, verifyAgainstNobody, verifyPassword } from './password';

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return { ...actual, timingSafeEqual: vi.fn(actual.timingSafeEqual) };
});

describe('A password is scrypt with its own salt, compared in constant time', () => {
  it('stores scrypt with its cost, a salt and a hash, never the password', async () => {
    const stored = await hashPassword('s3cret-ß');
    expect(stored).toMatch(/^scrypt\$16384\$8\$1\$[\w-]+\$[\w-]+$/);
    expect(stored).not.toContain('s3cret');
  });

  it('checks a password in its composed form, so the decomposed one of the same word is the same password', async () => {
    const word = 'Mật khẩu 1!';
    const stored = await hashPassword(word.normalize('NFD'));

    expect(await verifyPassword(word.normalize('NFC'), stored)).toBe(true);
    expect(await verifyPassword(word.normalize('NFD'), stored)).toBe(true);
    expect(await verifyPassword('Mat khau 1!', stored)).toBe(false);
  });

  it('gives the same password a different salt and so a different hash each time', async () => {
    const [one, two] = await Promise.all([hashPassword('same'), hashPassword('same')]);
    expect(one).not.toBe(two);
    expect(await verifyPassword('same', one)).toBe(true);
    expect(await verifyPassword('same', two)).toBe(true);
  });

  it('accepts the right password and refuses a wrong one', async () => {
    const stored = await hashPassword('right');
    expect(await verifyPassword('right', stored)).toBe(true);
    expect(await verifyPassword('wrong', stored)).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
  });

  it('compares the derived keys with timingSafeEqual, not ===', async () => {
    const stored = await hashPassword('right');
    vi.mocked(timingSafeEqual).mockClear();
    await verifyPassword('wrong', stored);
    expect(timingSafeEqual).toHaveBeenCalledTimes(1);
  });

  it('refuses a stored value it cannot read, and one whose hash is the wrong length', async () => {
    expect(await verifyPassword('x', 'plain-text-password')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$16384$8$1$c2FsdA$c2hvcnQ')).toBe(false);
  });

  it('refuses a stored hash cut short, though it is the right password’s own key as far as it goes', async () => {
    const salt = Buffer.from('0123456789abcdef');
    const cut = scryptSync('right', salt, 32, { N: 16384, r: 8, p: 1 });
    const stored = `scrypt$16384$8$1$${salt.toString('base64url')}$${cut.toString('base64url')}`;

    expect(await verifyPassword('right', stored)).toBe(false);
  });

  it('spends a check on nobody and always answers no one', async () => {
    vi.mocked(timingSafeEqual).mockClear();
    expect(await verifyAgainstNobody('anything')).toBeNull();
    expect(timingSafeEqual).toHaveBeenCalledTimes(1);
  });
});

describe('A password the app makes follows the rule of one typed', () => {
  it('holds a capital, a small letter, a digit and one of @$!%*?& in 12 characters, and differs each time', () => {
    const made = Array.from({ length: 300 }, madePassword);
    for (const password of made) {
      expect(password).toHaveLength(12);
      expect(passwordIsValid(password), password).toBe(true);
    }
    expect(new Set(made).size).toBe(300);
  });
});
