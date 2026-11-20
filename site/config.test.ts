import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GATE_STYLE } from '../visual/site/gate';
import config from './docusaurus.config';

type Plugin = { name?: string; injectHtmlTags?: () => { headTags: unknown[] } };
const plugins = () =>
  (config.plugins ?? []).map(
    (p) => (typeof p === 'function' ? (p as () => Plugin)() : p) as Plugin,
  );

// The docs site's build is the only place these two entries take effect, and a build whose password
// box is gone still passes, so the config is read here: removing either leaves this red.
describe('the password box in the docs site', () => {
  it('starts the box from a client module that exists, before the site’s own scripts', () => {
    expect(config.clientModules).toEqual(['./gate-client.ts']);
    expect(existsSync(resolve(__dirname, 'gate-client.ts'))).toBe(true);
  });

  it('puts the hiding rule and the committed hash in the head of every page', () => {
    const gate = plugins().find((p) => p.name === 'site-gate');
    expect(gate).toBeDefined();
    const hash = readFileSync(
      resolve(__dirname, '..', 'ops', 'site-password.sha256'),
      'utf8',
    ).trim();
    expect(gate!.injectHtmlTags!().headTags).toEqual([
      { tagName: 'style', innerHTML: GATE_STYLE },
      { tagName: 'script', innerHTML: `window.SITE_GATE_HASH=${JSON.stringify(hash)};` },
    ]);
  });
});
