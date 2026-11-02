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

## Step 2, hardened (2026-11-03)

- The page's script is `visual/site/page.ts` (typed, bundled into one classic script at build) with
  its words in `words.ts` and its data's type in `data.ts`; `visual/src/capture.ts` replaces
  `capture.mjs`. The old page, `pnpm answers`, `answers.json`, `cli`, `report`, `build` and their
  tests are gone; `visual/site/index.html` stays the template, ignored by prettier alone.
- A screen's version is now over its markup in both languages and the style rules that match it
  (state pseudo-classes taken off, the frame's light scheme): a style change elsewhere re-asks nothing.
- A defect found on the way: React's `useId` also reaches the markup as `_r_5p_` (a class and a style
  selector Mantine builds from it), and Mantine's id is eight or nine digits, so versions moved with
  the order screens were drawn in; both are renumbered now. Step 1's second build had moved 1 of 96.
- Each case red once from its own assertion (the break, then put back): 1 ids left unnumbered; 2 the
  stylesheet left out; 3 the style pool dropped; 4 the name's case kept; 5 the walk opens at screen 1;
  6 a No saved without a memo; 7 a changed version read as kept; 8 Yes to all taking a No; 9 a cell
  skipped; 10 the name left out of the block; 11 storage's memory fallback removed; 12 `--muted` set
  to a pale grey (1.73:1).
- Whole `pnpm check` (the root's scripts and configs moved): `visual` 11 files, 184 tests, 100 % on
  all four; `== exit 0` in `logs/20261103-walks-page-step2-gate.log`. Reds on the way: run 1 lint (an
  unsafe `any` in a test), run 2 coverage (two branches of `capture.ts`), run 3 one `ui` test
  (`MyDeliveries.test.tsx`, never touched), open item 57; run 4 green.
- `pnpm report`: 96 screens, 192 captures, 5.3 MB; a second build moved 0 versions; jsdom check of the
  built file (`logs/20261103-walks-page-step2-jsdom.log`): 8 PASS.

## Step 3, QA's rule 7 amended (2026-11-03)

- [QA's rule 7](../conventions/qa.md#the-rules) amended as step 3 says, with its line at a glance
  and the stamp; the old rejection of the pixels is now the history of the rejected words.
- `git grep 'words change' docs/conventions/qa.md`: nothing. `git grep 'keying a yes to the
  pixels'`: one line, inside the rewritten rejection. The path and name check over the diff:
  nothing.
- Open item 57 (the `MyDeliveries.test.tsx` red above) is folded into item 56 as its second
  sighting, and deleted.

