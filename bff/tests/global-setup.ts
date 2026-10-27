import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    /** The c-storage binary the route tests start, one server per test file. */
    cStorageBinary: string;
  }
}

/** Builds the real c-storage once per run: the BFF's route tests meet the product's own client
 * and server, never a stand-in. Needs Go, and the tests bind loopback ports. */
export default async function setup(project: TestProject) {
  const dir = await mkdtemp(join(tmpdir(), 'credo-c-storage-'));
  const binary = join(dir, 'c-storage');
  try {
    await promisify(execFile)('go', ['build', '-o', binary, './cmd/server'], {
      cwd: fileURLToPath(new URL('../../c-storage', import.meta.url)),
      env: {
        ...process.env,
        CGO_ENABLED: '0',
        GOCACHE: process.env['GOCACHE'] ?? join(tmpdir(), 'credo-go-cache'),
      },
    });
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw new Error('go build of c-storage failed', { cause: error });
  }
  project.provide('cStorageBinary', binary);
  return () => rm(dir, { recursive: true, force: true });
}
