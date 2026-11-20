// The build's side of the password box: the one committed file that holds the password's hash
// (`ops/site-password.sha256`, written by `ops/site-password.sh`). Both builds, the walks page's and
// the docs site's, read it here and stop when it is missing or is not one SHA-256 hash, so the box
// can never ship open or with a stand-in.
import { existsSync, readFileSync } from 'node:fs';

/** The hash file's path from the repository's root. */
export const GATE_HASH_PATH = 'ops/site-password.sha256';

const COMMAND = 'bash ops/site-password.sh';

/** The hash in `file`, or an error that names the command that writes it. */
export function readGateHash(file: string) {
  if (!existsSync(file)) {
    throw new Error(
      `the site's password is not set: ${file} is missing. Run ${COMMAND} once, then build again.`,
    );
  }
  const hash = readFileSync(file, 'utf8').trim();
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    throw new Error(
      `the site's password file ${file} does not hold one SHA-256 hash. Run ${COMMAND} to write it again.`,
    );
  }
  return hash;
}
