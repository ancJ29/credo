import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// One docs plugin rooted at the repository, so every page is shown from its one path and a link
// between two pages resolves inside the one instance. The dated plans and recaps are left out.
const PAGES = [
  'README.md',
  'docs/*.md',
  'docs/conventions/*.md',
  'docs/memo/*.md',
  'docs/partners/**/*.md',
  'ops/README.md',
  'services/*/README.md',
  'services/*/docs/**/*.md',
];

const config: Config = {
  title: 'credo',
  tagline: 'The docs, for partners and for the team',
  // The Pages project's address; the project is created in Cloudflare's dashboard by the human.
  url: 'https://credo-docs.pages.dev',
  baseUrl: '/',
  // Open to anyone with the link, and kept out of search engines.
  noIndex: true,
  // 'throw' once the link plugin turns a link to a file outside the site into a GitHub link.
  onBrokenLinks: 'warn',
  // 'detect' reads a .md file as plain Markdown, so a { or < in prose does not break the build.
  markdown: { format: 'detect', mermaid: true },
  themes: ['@docusaurus/theme-mermaid'],
  plugins: [
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
