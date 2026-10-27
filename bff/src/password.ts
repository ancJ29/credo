import { randomBytes, scrypt, type ScryptOptions } from 'node:crypto';
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

/** `scrypt$N$r$p$salt$hash`: its own random salt, and the cost it was made at, so raising the cost
 * later still verifies the hashes already stored. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, KEY_BYTES, COST);
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
  const actual = await derive(password, Buffer.from(salt, 'base64url'), expected.length, {
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
