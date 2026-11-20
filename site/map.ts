import { posix } from 'node:path';
import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

// The docs map is the one list the site publishes: this module reads its text (not its file, so a
// script can read the map at any tag) into the pages, the sidebar and nothing else.

export const MAP_PATH = 'docs/partners/map.md';

type MapPage = { name: string; path: string | null };
type MapBranch = { label: string; pages: MapPage[] };

const BRANCH = /^- \*\*(.+)\*\*\s*$/;
const PAGE = /^ {2}- \[([^\]]+)\]\(([^)]*)\):/;
const PROMISED = /^ {2}- ([^[\]:]+):.*\*\*not yet written\*\*\s*$/;
const WHOLE_PAGE = /^[^#?:]+\.md$/;

// The branches under "The map", each with its pages in order; a promised page has no path. A line
// the map's shape does not allow stops the build, naming the map's line. `exists` tells whether a
// repository path is a file.
function readMap(text: string, exists: (path: string) => boolean, mapPath: string): MapBranch[] {
  const branches: MapBranch[] = [];
  const seen = new Map<string, number>();
  let inMap = false;
  text.split('\n').forEach((line, index) => {
    const at = `${mapPath} line ${index + 1}`;
    if (line.startsWith('## ')) inMap = line === '## The map';
    if (!inMap || line.trim() === '' || line.startsWith('## ')) return;
    const branch = BRANCH.exec(line);
    if (branch) {
      branches.push({ label: branch[1], pages: [] });
      return;
    }
    const current = branches.at(-1);
    const page = PAGE.exec(line);
    const promised = PROMISED.exec(line);
    if (!current || !(page || promised))
      throw new Error(`${at}: not a branch, a page or a promised page: ${line.trim()}`);
    if (promised) {
      current.pages.push({ name: promised[1], path: null });
      return;
    }
    const target = page![2];
    if (!WHOLE_PAGE.test(target)) throw new Error(`${at}: ${target} is not a whole .md page`);
    const path = posix.join(posix.dirname(mapPath), target);
    const first = seen.get(path);
    if (first !== undefined)
      throw new Error(`${at}: ${path} is named twice, first on line ${first}`);
    if (!exists(path)) throw new Error(`${at}: ${path} does not exist`);
    seen.set(path, index + 1);
    current.pages.push({ name: page![1], path });
  });
  if (!branches.some((b) => b.pages.some((p) => p.path)))
    throw new Error(`${mapPath}: no page is listed under "## The map"`);
  return branches;
}

// The pages the site publishes, the map itself first: the docs plugin's include and the link rewrite's list.
export function mapPages(
  text: string,
  exists: (path: string) => boolean,
  mapPath: string = MAP_PATH,
): string[] {
  const linked = readMap(text, exists, mapPath).flatMap((b) =>
    b.pages.flatMap((p) => (p.path ? [p.path] : [])),
  );
  return [mapPath, ...linked];
}

// What the site loaded, against the map: a page not on it, a map page with no doc, or a map not at `/`
// stops the build, so a glob or a second docs plugin adding a page is red by name; it reads docs plugins only.
export function checkLoaded(docs: { source: string; permalink: string }[], pages: string[]): void {
  const path = (source: string) =>
    posix.normalize(source.replace(/^@site\//, '')).replace(/^(\.\.\/)+/, '');
  const loaded = docs.map((d) => path(d.source));
  for (const p of loaded)
    if (!pages.includes(p)) throw new Error(`${p} is published but is not on the map`);
  for (const p of pages)
    if (!loaded.includes(p))
      throw new Error(`${p} is on the map but the site loaded no page for it`);
  const home = docs.find((d) => path(d.source) === pages[0]);
  if (home?.permalink !== '/') throw new Error(`the map is served at ${home?.permalink}, not at /`);
}

// A page and its machine's page name each other in front matter: `source` on the partner page,
// `partner_page` on the machine's. `read` gives a repository path's text, or null when it is no file.
export function checkPairs(pages: string[], read: (path: string) => string | null): void {
  const key = (path: string, name: string) => {
    const front = /^---\n([\s\S]*?)\n---/.exec(read(path) as string);
    return front?.[1].match(new RegExp(`^${name}: *(\\S+) *$`, 'm'))?.[1];
  };
  for (const page of pages) {
    const source = key(page, 'source');
    if (source) {
      if (read(source) === null)
        throw new Error(`${page} names the source ${source}, which does not exist`);
      if (key(source, 'partner_page') !== page)
        throw new Error(`${source} does not name ${page} as its partner_page`);
    }
    const partner = key(page, 'partner_page');
    if (partner) {
      if (!pages.includes(partner))
        throw new Error(`${page} names the partner_page ${partner}, which is not on the map`);
      if (key(partner, 'source') !== page)
        throw new Error(`${partner} does not name ${page} as its source`);
    }
  }
}

// A doc's id is its path from the repository root without `.md`.
const docId = (path: string) => path.replace(/\.md$/, '');

// The map first, then a category per branch, each page under its map name; a promised page has no entry.
export function mapSidebar(
  text: string,
  exists: (path: string) => boolean,
  mapPath: string = MAP_PATH,
): SidebarsConfig {
  return {
    docs: [
      { type: 'doc', id: docId(mapPath), label: 'The credo docs map' },
      ...readMap(text, exists, mapPath).map((branch) => ({
        type: 'category' as const,
        label: branch.label,
        items: branch.pages.flatMap((p) =>
          p.path ? [{ type: 'doc' as const, id: docId(p.path), label: p.name }] : [],
        ),
      })),
    ],
  };
}
