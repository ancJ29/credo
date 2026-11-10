import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestProject } from 'vitest/node';
import { buildAudit, buildCStorage } from './build';

declare module 'vitest' {
  export interface ProvidedContext {
    /** The c-storage binary the route tests start, one server per test file. */
    cStorageBinary: string;
    /** The audit service's binary, started by the route tests that read their entries back. */
    auditBinary: string;
  }
}

/** Builds the real c-storage once per run: the BFF's route tests meet the product's own client
 * and server, never a stand-in. Needs Go, and the tests bind loopback ports. */
export default async function setup(project: TestProject) {
  const dir = await mkdtemp(join(tmpdir(), 'credo-c-storage-'));
  const binary = join(dir, 'c-storage');
  const audit = join(dir, 'audit');
  try {
    await buildCStorage(binary);
    await buildAudit(audit);
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw new Error('go build of c-storage or the audit service failed', { cause: error });
  }
  project.provide('cStorageBinary', binary);
  project.provide('auditBinary', audit);
  return () => rm(dir, { recursive: true, force: true });
}
