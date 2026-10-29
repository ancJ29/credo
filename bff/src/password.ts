import { randomBytes, randomInt, scrypt, type ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';
import { constantTimeEqual } from './constant-time';

const KEY_BYTES = 64;
const COST = { N: 16384, r: 8, p: 1 } as const;

const derive = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keyBytes: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/** A password as it is hashed and checked: in Unicode's composed form, so the same word typed on a
 * keyboard that composes and on one that does not is one password. The one place that is done. */
const composed = (password: string) => password.normalize('NFC');

/** `scrypt$N$r$p$salt$hash`: its own random salt, and the cost it was made at, so raising the cost
 * later still verifies the hashes already stored. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(composed(password), salt, KEY_BYTES, COST);
  return [
    'scrypt',
    COST.N,
    COST.r,
    COST.p,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$');
}

const STORED = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([\w-]+)\$([\w-]+)$/;

export async function verifyPassword(password: string, stored: string) {
  const match = STORED.exec(stored);
  if (!match) return false;
  const [, n, r, p, salt, hash] = match as unknown as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  const expected = Buffer.from(hash, 'base64url');
  const actual = await derive(composed(password), Buffer.from(salt, 'base64url'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return expected.length === KEY_BYTES && constantTimeEqual(actual, expected);
}

const nobody = hashPassword('nobody');

/** The work of a check against a user who is not there. Always null: no one is signed in. */
export async function verifyAgainstNobody(password: string) {
  await verifyPassword(password, await nobody);
  return null;
}

/** A first password: random, 96 bits, shown once and stored only as its hash. */
export const newPassword = () => randomBytes(12).toString('base64url');

const CLASSES = ['abcdefghijkmnopqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '@$!%*?&'];

/** A password the app makes for a person: 12 characters holding a capital, a small letter, a digit
 * and one of `@$!%*?&`, which is the rule of a password typed (`passwordIsValid` in `shared/`).
 * Look-alike characters are left out, since it is read off a screen and handed over. */
export function madePassword() {
  const pick = (from: string) => from[randomInt(from.length)];
  const all = CLASSES.join('');
  const chars = [...CLASSES.map(pick), ...Array.from({ length: 8 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
