import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_CODE, DEMO_ROOT_NAME } from '@credo/shared/demo';
import { build } from 'vite';
import { createFront } from './front';

const UI_DIR = fileURLToPath(new URL('../../ui/', import.meta.url));

export type FakeArtifacts = { uiDir: string };

/** The fake build of the UI (`--mode fake`, `?fake` compiled in), into `dir`, never into the
 * checkout: a running fake's front serves from it. */
export async function buildFake(dir: string): Promise<FakeArtifacts> {
  const uiDir = join(dir, 'ui-fake');
  await build({
    root: UI_DIR,
    mode: 'fake',
    logLevel: 'warn',
    build: { outDir: uiDir, emptyOutDir: true },
  });
  return { uiDir };
}

export type RunningFake = {
  /** The front, where a browser goes: add `?fake`. */
  url: string;
  clientCode: string;
  rootName: string;
};

/** The fake UI served alone for the length of `use`: no BFF, no c-storage, and nothing left
 * listening when `use` ends, however it ends. */
export async function withFake<T>(
  { uiDir }: FakeArtifacts,
  use: (fake: RunningFake) => Promise<T>,
): Promise<T> {
  const front: Server = createFront({ staticDir: uiDir, bffUrl: null });
  const port = await new Promise<number>((resolve) => {
    front.listen(0, '127.0.0.1', () => resolve((front.address() as AddressInfo).port));
  });
  try {
    return await use({
      url: `http://127.0.0.1:${port}`,
      clientCode: DEMO_CODE,
      rootName: DEMO_ROOT_NAME,
    });
  } finally {
    await new Promise((resolve) => front.close(resolve));
  }
}
