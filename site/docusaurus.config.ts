import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { githubLinks } from './links';
import { MAP_PATH, checkLoaded, checkPairs, mapPages } from './map';

// One docs plugin rooted at the repository, so every page is shown from its one path and a link
// between two pages resolves inside the one instance. The pages are the docs map's, read from its text.
const PAGES = mapPages(readFileSync(resolve(__dirname, '..', MAP_PATH), 'utf8'), (path) =>
  existsSync(resolve(__dirname, '..', path)),
);
// A page written from a machine's page, and that page, name each other, or the build stops.
checkPairs(PAGES, (path) =>
  existsSync(resolve(__dirname, '..', path))
    ? readFileSync(resolve(__dirname, '..', path), 'utf8')
    : null,
);

const config: Config = {
  title: 'credo',
  tagline: 'The docs, for partners and for the team',
  // The Pages project's address; the project is created in Cloudflare's dashboard by the human.
  url: 'https://credo-docs.pages.dev',
  baseUrl: '/',
  // Open to anyone with the link, and kept out of search engines.
  noIndex: true,
  // A link to a file the site leaves out opens on GitHub (links.ts), so what is left broken is broken.
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  // 'detect' reads a .md file as plain Markdown, so a { or < in prose does not break the build.
  markdown: { format: 'detect', mermaid: true, hooks: { onBrokenMarkdownLinks: 'throw' } },
  themes: ['@docusaurus/theme-mermaid'],
  plugins: [
    // Once every page is loaded: the pages the site holds are exactly the map's, the map served at `/`.
    () => ({
      name: 'map-load-check',
      allContentLoaded({ allContent }) {
        // Every docs plugin instance, by its id, so a second one is read as the default is.
        const instances = allContent['docusaurus-plugin-content-docs'] as Record<
          string,
          { loadedVersions: { docs: { source: string; permalink: string }[] }[] }
        >;
        checkLoaded(
          Object.values(instances).flatMap((i) => i.loadedVersions.flatMap((v) => v.docs)),
          PAGES,
        );
      },
    }),
    // The mermaid theme's browser code imports its optional ELK layouts, which are not installed and
    // which no diagram here uses, so that import resolves to an empty module.
    () => ({
      name: 'no-elk-layouts',
      configureWebpack: () => ({ resolve: { alias: { '@mermaid-js/layout-elk': false } } }),
    }),
  ],
  presets: [
    [
      'classic',
      {
        docs: {
          path: '..',
          include: PAGES,
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          beforeDefaultRemarkPlugins: [githubLinks(PAGES)],
        },
        blog: false,
        pages: false,
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    navbar: { title: 'credo' },
  } satisfies Preset.ThemeConfig,
};

export default config;
