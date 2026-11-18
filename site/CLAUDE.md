# site
Stack: Docusaurus 3 with its mermaid theme · Gate: `pnpm check` from the root, which runs this package's typecheck and, as its test, the site's build (a render failure, a broken link or a broken anchor is its red) · Ship: none yet; a build job and its deploy to Cloudflare Pages come in later steps

The docs site: the repository's own Markdown, shown where it already sits, for partners and other
readers who do not code. Open to anyone with the link, kept out of search engines (`noIndex`).

## What belongs here, and what does not

- **The site's frame belongs here:** `docusaurus.config.ts` (one docs plugin rooted at the
  repository, the pages it reads in `PAGES`), `sidebars.ts` (the order a reader meets them) and
  `links.ts` (a link to a file the site leaves out opens on GitHub at the built commit).
- **No page belongs here.** Every page lives once, where it already sits (`README.md`, `docs/`,
  `ops/README.md`, `services/*`); a new page for partners goes in `docs/partners/`.

## The directories of `site`

None: flat is the answer, since its three files are the site's config, its sidebar and its link plugin.
