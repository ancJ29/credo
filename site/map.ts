import { posix } from 'node:path';
import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

// The docs map is the one list the site publishes: this module reads its text (not its file, so a
// script can read the map at any tag) into the pages, the sidebar and nothing else.

export const MAP_PATH = 'docs/partners/map.md';

type MapPage = { name: string; path: string | null };
type MapBranch = { label: string; pages: MapPage[] };

const BRANCH = /^- \*\*(.+)\*\*\s*$/;
const PAGE = /^ {2}- \[([^\]]+)\]\(([^)]+)\):/;
const PROMISED = /^ {2}- ([^[\]:]+):.*\*\*not yet written\*\*\s*$/;

// The branches under "The map", each with its pages in order; a promised page has no path.
function readMap(text: string, mapPath: string = MAP_PATH): MapBranch[] {
  const branches: MapBranch[] = [];
  let inMap = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) inMap = line === '## The map';
    if (!inMap) continue;
    const branch = BRANCH.exec(line);
    if (branch) {
      branches.push({ label: branch[1], pages: [] });
      continue;
    }
    const page = PAGE.exec(line);
    if (page && branches.length > 0) {
      const path = posix.join(posix.dirname(mapPath), page[2]);
      branches[branches.length - 1].pages.push({ name: page[1], path });
      continue;
    }
    const promised = PROMISED.exec(line);
    if (promised && branches.length > 0)
      branches[branches.length - 1].pages.push({ name: promised[1], path: null });
  }
  return branches;
}

// The pages the site publishes, the map itself first: the docs plugin's include and the link rewrite's list.
export function mapPages(text: string, mapPath: string = MAP_PATH): string[] {
  const linked = readMap(text, mapPath).flatMap((b) =>
    b.pages.flatMap((p) => (p.path ? [p.path] : [])),
  );
  return [mapPath, ...linked];
}

// A doc's id is its path from the repository root without `.md`.
const docId = (path: string) => path.replace(/\.md$/, '');

// The map first, then a category per branch, each page under its map name; a promised page has no entry.
export function mapSidebar(text: string, mapPath: string = MAP_PATH): SidebarsConfig {
  return {
    docs: [
      { type: 'doc', id: docId(mapPath), label: 'The credo docs map' },
      ...readMap(text, mapPath).map((branch) => ({
        type: 'category' as const,
        label: branch.label,
        items: branch.pages.flatMap((p) =>
          p.path ? [{ type: 'doc' as const, id: docId(p.path), label: p.name }] : [],
        ),
      })),
    ],
  };
}
