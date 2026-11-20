import { createHash, webcrypto } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GATE_PREFIX } from '../visual/site/gate';

// The docs site's build does not run the box's code as written: its Babel preset (`loose: true`)
// rewrites it, and a loose rewrite of `[...typedArray]` is `[].concat(typedArray)`, which does not
// spread. The box then refused the right password. So the box's file is put through the site's own
// Babel preset here, as the docs build does for the browser bundle, and the result is run.
type Babel = {
  transformSync: (code: string, options: Record<string, unknown>) => { code: string } | null;
};
const fromCore = createRequire(require.resolve('@docusaurus/core/package.json'));
const fromBabelPackage = createRequire(fromCore.resolve('@docusaurus/babel/package.json'));
const babel = fromBabelPackage('@babel/core') as Babel;
const preset = fromCore.resolve('@docusaurus/babel');

describe('the password box as the docs site builds it', () => {
  it('hashes a password to the same digest the committed hash is made of', async () => {
    const file = resolve(__dirname, '..', 'visual', 'site', 'gate.ts');
    const built = babel.transformSync(readFileSync(file, 'utf8'), {
      filename: file,
      babelrc: false,
      configFile: false,
      presets: [preset],
      caller: { name: 'client' },
    });
    expect(built).not.toBeNull();
    const dir = mkdtempSync(join(tmpdir(), 'gate-build-'));
    try {
      const out = join(dir, 'gate.mjs');
      writeFileSync(out, built!.code);
      const { digestOf } = (await import(pathToFileURL(out).href)) as {
        digestOf: (entry: string, win: { crypto: unknown }) => Promise<string>;
      };
      const entry = 'Ab3x@=./[+Zq';
      expect(await digestOf(entry, { crypto: webcrypto })).toBe(
        createHash('sha256')
          .update(GATE_PREFIX + entry)
          .digest('hex'),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
