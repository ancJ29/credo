import { describe, expect, it } from 'vitest';
import { checkLoaded, mapPages, mapSidebar } from './map';

const MAP = [
  '---',
  'slug: /',
  '---',
  '',
  '# The credo docs map',
  '',
  '## The map',
  '',
  '- **Start here**',
  '  - [What credo is](README.md): for anyone new; answers "what is this?"',
  '  - Words we use: for anyone; answers "what does this mean?" **not yet written**',
  '  - [Products](../products.md): for anyone; answers "what is built?"',
  '- **The operator**',
  '  - [The runbook](../../ops/README.md): for the operator; answers "why?"',
  '',
  '## Notes',
  '',
  'Anything here is not read as the map.',
  '',
].join('\n');

const PAGES = [
  'docs/partners/map.md',
  'docs/partners/README.md',
  'docs/products.md',
  'ops/README.md',
];
const all = () => true;
const doc = (source: string, permalink = '/x') => ({ source, permalink });
const loaded = [
  doc('@site/../docs/partners/map.md', '/'),
  doc('@site/../docs/partners/README.md'),
  doc('@site/../docs/products.md'),
  doc('@site/../ops/README.md'),
];
const swap = (from: string, to: string) => MAP.replace(from, to);

describe('the docs map', () => {
  it('1. publishes the map and the pages it links, and no other page', () => {
    expect(mapPages(MAP, all)).toEqual(PAGES);
    expect(() => checkLoaded(loaded, PAGES)).not.toThrow();
  });

  it('2. stops the build on a loaded page that is not on the map, naming it', () => {
    expect(() => checkLoaded([...loaded, doc('@site/../docs/decisions.md')], PAGES)).toThrow(
      /docs\/decisions\.md is published but is not on the map/,
    );
  });

  it('3. stops the build on a map page with no loaded doc, naming it', () => {
    expect(() => checkLoaded(loaded.slice(0, 3), PAGES)).toThrow(
      /ops\/README\.md is on the map but the site loaded no page for it/,
    );
  });

  it('4. stops the build on a line whose linked file does not exist, naming the line', () => {
    expect(() => mapPages(MAP, (p) => p !== 'docs/products.md')).toThrow(
      /map\.md line 12: docs\/products\.md does not exist/,
    );
  });

  it('5. stops the build on a line that is not a branch, a page or a promised page', () => {
    expect(() => mapPages(swap('- **The operator**', 'a stray sentence'), all)).toThrow(
      /map\.md line 13: not a branch, a page or a promised page/,
    );
    expect(() =>
      mapPages(swap('- **Start here**', '  - [A page](README.md): a page'), all),
    ).toThrow(/line 9: not a branch/);
    expect(() => mapPages(swap('- **Start here**\n', ''), all)).toThrow(/line 9: not a branch/);
  });

  it('6. stops the build on a link that is not a whole .md page, or a page named twice', () => {
    expect(() => mapPages(swap('README.md)', 'README.md#top)'), all)).toThrow(
      /line 10: README\.md#top is not a whole \.md page/,
    );
    expect(() => mapPages(swap('../products.md', 'https://example.org/p.md'), all)).toThrow(
      /line 12: https:\/\/example\.org\/p\.md is not a whole \.md page/,
    );
    expect(() => mapPages(swap('../products.md', 'README.md'), all)).toThrow(
      /line 12: docs\/partners\/README\.md is named twice, first on line 10/,
    );
  });

  it('7. keeps a promised page on the map, publishing nothing and with no sidebar entry', () => {
    expect(mapPages(MAP, all)).not.toContain(null);
    expect(mapPages(MAP, all)).toHaveLength(4);
    expect(JSON.stringify(mapSidebar(MAP, all))).not.toContain('Words we use');
  });

  it('8. serves the map as the first page, at /', () => {
    expect(mapPages(MAP, all)[0]).toBe('docs/partners/map.md');
    expect(() =>
      checkLoaded([doc('@site/../docs/partners/map.md', '/map'), ...loaded.slice(1)], PAGES),
    ).toThrow(/the map is served at \/map, not at \//);
  });

  it('9. draws the sidebar as the map, then its branches in order, each page by its map name', () => {
    expect(mapSidebar(MAP, all)).toEqual({
      docs: [
        { type: 'doc', id: 'docs/partners/map', label: 'The credo docs map' },
        {
          type: 'category',
          label: 'Start here',
          items: [
            { type: 'doc', id: 'docs/partners/README', label: 'What credo is' },
            { type: 'doc', id: 'docs/products', label: 'Products' },
          ],
        },
        {
          type: 'category',
          label: 'The operator',
          items: [{ type: 'doc', id: 'ops/README', label: 'The runbook' }],
        },
      ],
    });
  });
});
