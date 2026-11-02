# The walks page, rebuilt to its confirmed mock, recap, 2026-11-03

## At a glance

[The plan](../plans/2026-11-02-walks-page.md), step 1 is done on `walks-page`: `pnpm report` now
builds the confirmed mock as the page, fed the build's 96 screens in both languages. The old page
and its code still stand beside it until step 2.

## What shipped

- `visual/site/` holds the page (`index.html`, `page.js`, `words.js`) and the mock's Vietnamese
  questions; its test switches (the pretend-newer-build, forget, not-in-the-mock marks) are gone.
- `visual/capture.mjs` draws each screen on a DOM in both languages, keeps its markup, the app's
  stylesheet once and Mantine's per-colour style blocks once each, and a version a screen: twelve hex
  digits of SHA-256 over the stylesheet and both languages' markup. Random ids are renumbered in
  order and the shell's resizing flag dropped, so two builds of one commit hold the same versions.
- `visual/src/words.tsx` keeps the drawn markup (`lastDrawn`), the one hook the build needs.

## Evidence

- `walks.json`: 96 screens, 192 captures, none empty; a second build moved 0 versions; `index.html`
  5.4 MB.
- Round 5's jsdom check, less its switches, from `file://` and on a page with storage: 18 PASS, 0
  FAIL, no request but `file:`; the map holds 12 walks and a walk opens on its real screen.
- `visual`'s typecheck, lint, format and knip clean; the tests with coverage: 29 files, 478 tests, 100 % on all four, log ends `== exit 0`.
