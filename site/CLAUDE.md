# site
Stack: Docusaurus 3 with its mermaid theme · Gate: `pnpm check` from the root, which runs this package's typecheck and, as its test, the site's build (a render failure, a broken link or a broken anchor, a map line with no page, a page the site would publish that is not on the map, and a pair of pages that do not name each other are its red) · Ship: `.github/workflows/docs.yml` builds it on every push that changes a page it shows and, on `main`, publishes it to its own Cloudflare Pages project

The docs site: the pages on the docs map (`docs/partners/map.md`), shown where each already sits, for
partners and other readers who do not code. The map is the site's first page and the one list it
publishes: a page not on the map is not published. Open to anyone with the link, kept out of search engines (`noIndex`).

## What belongs here, and what does not

- **The site's frame belongs here:** `docusaurus.config.ts` (one docs plugin rooted at the
  repository, its pages the map's, and a check that what loaded is exactly the map), `map.ts` (reads
  the map's text into the pages, the sidebar and the refusals), `sidebars.ts` (the sidebar drawn
  from the map), `links.ts` (a link to a file the site leaves out opens on GitHub at the built
  commit) and the unit tests of `map.ts`.
- **One reader a page.** A page that fails for partners is not rewritten in place: it stays whole as
  the machine's page, leaves the map, and a partner page written from it takes its place on the map.
  The two name each other in their front matter: `source` on the partner page (the machine's page's
  path) and `partner_page` on the machine's page (the partner page's path). `checkPairs` in `map.ts`
  stops the build on a published page whose `source` is no file or does not name it back, and on a
  `partner_page` that is not on the map or whose `source` does not name the page back; a fact lives
  once, so the steps a partner follows live on the partner page.
- **No page belongs here.** Every page lives once, where it already sits (`docs/`, `ops/README.md`);
  a new page is published once its line is on the map, and a new page for partners goes in
  `docs/partners/`. A map line is one line a page, not wrapped: two spaces, a dash and a space, the page's name linked,
  then its words after a colon, as `readMap` in `map.ts` reads it; a promised page ends in
  `**not yet written**`.

## The directories of `site`

None: flat is the answer, since its six files are the site's config, the map's reader and its test, its sidebar, its link plugin and its test configuration.
