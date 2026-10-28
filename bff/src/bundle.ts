import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('./lambda-main.ts', import.meta.url));

/** The BFF's Lambda as one CommonJS file for the nodejs24.x runtime: no `node_modules` ships beside
 * it. Lambda runs the handler by `index.handler`, so the file is named `index.js` by the caller.
 * esbuild bundles for the target Node's syntax; whether the bundle runs there is the `app` job's
 * check (the bundle under Node 24). */
export async function bundleBff(outfile: string) {
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'cjs',
    legalComments: 'none',
    logLevel: 'warning',
  });
}
