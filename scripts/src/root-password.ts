import { buildApp } from '@credo/bff';
import { ROOT_NAME } from '@credo/bff/clients';
import { tenantStorage } from '@credo/bff/company-copy';
import { hashPassword } from '@credo/bff/password';
import { readSignIn, setSignInPassword } from '@credo/bff/staff-records';
import {
  AUTH_HEADER,
  CLIENT_HEADER,
  type CStorageClient,
  DEVICE_HEADER,
  HOME_BOX,
  normaliseClientCode,
  passwordIsValid,
  recordKeys,
  ROUTES,
  storedClientSchema,
} from '@credo/shared';
import { copyOfCode } from './demo/mapping';

/** A run that was asked for what it will not do, before anything was written: exit status 2. */
export class Refused extends Error {}

const ROOT_PASSWORD_USAGE =
  'usage: root-password [--check] <code>… (the new password on stdin, one line)';

/** The read-back signs in through the BFF's own code in this process: no server listens, and no
 * operator is signed in, so no passkey is checked against this address or challenge signed. */
const NO_OPERATOR = { origin: 'http://localhost', serviceKey: 'the root password door' };
const DEVICE = 'device-root-password';

/** The password as typed: the first line of the input, whole (no trimming: a password has no
 * control character, and no space at either end). */
export function passwordFrom(input: string) {
  return input.split('\n', 1)[0];
}

/**
 * What needs no connection: the password follows piece 2's rule, and each code is one of the demo
 * copies (the mapping's), once. Returns the codes as the BFF takes them. The words name the rule
 * and never the password.
 */
export function checkRootPassword(codes: string[], password: string) {
  if (codes.length === 0) throw new Refused(`no code named. ${ROOT_PASSWORD_USAGE}`);
  if (!passwordIsValid(password)) {
    throw new Refused(
      'the password breaks the rule: 8 to 128 characters, a capital, a small letter, a digit, one of @$!%*?&, no space at either end',
    );
  }
  const normalised = codes.map(normaliseClientCode);
  for (const [at, code] of normalised.entries()) {
    if (!copyOfCode(code)) throw new Refused(`${code} is not one of the demo copies`);
    if (normalised.indexOf(code) !== at) throw new Refused(`${code} is named twice`);
  }
  return normalised;
}

type Target = { code: string; tenantId: string; company: string };

/** Every code's index and root record, read before the first write: a code with no client, an
 * index or a record that does not parse, or a sign-in that is no root's, refuses the whole run. */
async function readTargets(storage: CStorageClient, codes: string[]) {
  const targets: Target[] = [];
  for (const code of codes) {
    const index = await storage.getRecord(recordKeys.client(code));
    if (!index) throw new Refused(`${code} is not on this service`);
    const client = storedClientSchema.safeParse(index.data);
    if (!client.success) throw new Refused(`${code}: its index record does not parse`);
    // The script serves the home box alone (item 271): a copy moved off it is named and refused.
    const box = client.data.box ?? HOME_BOX;
    if (box !== HOME_BOX) {
      throw new Refused(`${code}: its line names box ${box}, and this script serves the home box`);
    }
    const root = await readSignIn(
      tenantStorage(storage, client.data.id),
      client.data.id,
      ROOT_NAME,
    );
    if (!root?.user.root) throw new Refused(`${code}: its root record is missing or is no root's`);
    targets.push({ code, tenantId: client.data.id, company: client.data.name });
  }
  return targets;
}

/** What the run did to be named when it stops: the roots set and the roots it did not reach. */
function stopped(why: string, codes: string[], done: string[]) {
  const left = codes.filter((code) => !done.includes(code));
  return new Error(
    `${why}; set: ${done.join(', ') || 'none'}; not set, password as it was: ${left.join(', ') || 'none'}`,
  );
}

/** A sign-in as the root with the new password, then out again: the app's own routes, so what is
 * proved is what the root will meet. Returns the sign-in's status. */
async function signsIn(storage: CStorageClient, code: string, password: string, now: () => number) {
  const app = buildApp({ storage, now, ...NO_OPERATOR, logger: false });
  const headers = { [CLIENT_HEADER]: code, [DEVICE_HEADER]: DEVICE };
  const reply = await app.inject({
    method: 'POST',
    url: ROUTES.signIn,
    headers,
    payload: { name: ROOT_NAME, password },
  });
  if (reply.statusCode === 200) {
    const { authId } = reply.json<{ authId: string }>();
    await app.inject({
      method: 'POST',
      url: ROUTES.signOut,
      headers: { ...headers, [AUTH_HEADER]: authId },
    });
  }
  return reply.statusCode;
}

/**
 * Gives the named demo copies' roots the password, one write each (the product's own write, which
 * mints a new generation and so ends every session), after every code was read and its company
 * named. A run that stops names the roots set; one it did not reach keeps its password, and the
 * same run again ends in the same state. Nothing it says holds the password or a hash.
 */
export async function setRootPasswords(
  storage: CStorageClient,
  codes: string[],
  password: string,
  io: { out: (line: string) => void; now: () => number },
) {
  const named = checkRootPassword(codes, password);
  const targets = await readTargets(storage, named);
  for (const { code, company } of targets) io.out(`${code}: ${company}`);
  const done: string[] = [];
  for (const { code, tenantId } of targets) {
    try {
      const hash = await hashPassword(password);
      const set = await setSignInPassword(
        tenantStorage(storage, tenantId),
        tenantId,
        ROOT_NAME,
        (user) => user.root,
        hash,
        io.now,
      );
      if (set === 'not owned') throw new Error('its root record changed under this run');
    } catch (error) {
      throw stopped(`${code}: ${(error as Error).message}`, named, done);
    }
    done.push(code);
    io.out(`${code}: set`);
    const status = await signsIn(storage, code, password, io.now);
    if (status !== 200) {
      throw stopped(`${code}: set, but the sign-in read back answered ${status}`, named, done);
    }
    io.out(`${code}: signs in`);
  }
}
