import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

/** The environment `go build` runs in: the caller's, with the module and cache settings Go needs
 * where the home folder is read-only, and a build cache under the temp folder when none is set. */
export function goBuildEnv(base: Record<string, string | undefined>) {
  return {
    ...base,
    CGO_ENABLED: '0',
    GOCACHE: base['GOCACHE'] ?? join(tmpdir(), 'credo-go-cache'),
  };
}

/** Builds the real c-storage into `output`. The one place it is built: the BFF's route tests and
 * `pnpm stack` both start what this makes. Needs Go. */
export async function buildCStorage(output: string) {
  await promisify(execFile)('go', ['build', '-o', output, './cmd/server'], {
    cwd: fileURLToPath(new URL('../../c-storage', import.meta.url)),
    env: goBuildEnv(process.env),
  });
}
