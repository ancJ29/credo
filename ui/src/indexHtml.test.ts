import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('the page’s own head', () => {
  it('11: holds the three phone metas, which a phone reads before any script runs', () => {
    const html = readFileSync(`${import.meta.dirname}/../index.html`, 'utf8');
    const metas = [...html.matchAll(/<meta name="([^"]+)" content="([^"]+)"/g)].map(
      (found) => [found[1], found[2]] as const,
    );

    expect(metas).toEqual(
      expect.arrayContaining([
        ['apple-mobile-web-app-capable', 'yes'],
        ['mobile-web-app-capable', 'yes'],
        ['apple-mobile-web-app-status-bar-style', 'default'],
      ]),
    );
  });
});
