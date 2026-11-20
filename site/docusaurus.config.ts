import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { GATE_STYLE } from '../visual/site/gate';
import { GATE_HASH_PATH, readGateHash } from '../visual/site/gate-file';
import { githubLinks } from './links';
import { MAP_PATH, checkLoaded, checkPairs, mapPages } from './map';

// One docs plugin rooted at the repository, so every page is shown from its one path and a link
// between two pages resolves inside the one instance. The pages are the docs map's, read from its text.
const PAGES = mapPages(readFileSync(resolve(__dirname, '..', MAP_PATH), 'utf8'), (path) =>
  existsSync(resolve(__dirname, '..', path)),
);
// A page written from a machine's page, and that page, name each other, or the build stops; the
// machine's page is off the map, so every doc under `docs/` is read too, named from one side or both.
checkPairs(
  PAGES,
  (path) =>
    existsSync(resolve(__dirname, '..', path))
      ? readFileSync(resolve(__dirname, '..', path), 'utf8')
      : null,
  readdirSync(resolve(__dirname, '..', 'docs'), { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.md'))
    .map((f) => `docs/${f.split(sep).join('/')}`),
);

// The password box's hash, one committed file the build reads and refuses without (`ops/site-password.sh`
// writes it): the box can never ship open or with a stand-in.
const GATE_HASH = readGateHash(resolve(__dirname, '..', GATE_HASH_PATH));

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
  // The password box (visual/site/gate.ts), started before the site's own scripts.
  clientModules: ['./gate-client.ts'],
  plugins: [
    // The box's hiding rule and the hash it checks against, in every page's head.
    () => ({
      name: 'site-gate',
      injectHtmlTags: () => ({
        headTags: [
          { tagName: 'style', innerHTML: GATE_STYLE },
          { tagName: 'script', innerHTML: `window.SITE_GATE_HASH=${JSON.stringify(GATE_HASH)};` },
        ],
      }),
    }),
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
