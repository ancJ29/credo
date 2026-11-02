# The walks page, rebuilt to its confirmed mock

## At a glance

**For** the human's confirmation of UI: each screen of the day as large as the window, answered
yes or no in one key, in the language its person reads. The human opens it from disk after each
build; partners (`p1`…) open the deployed page. **The path:** the mock confirmed on 11-02 becomes
the page, its script typed in `visual/src` and fed the build's 96 screens in place of its ten
frozen ones; the old page goes. **Price:** a day of the machine's build, nothing new hosted; a new
browser starts with no answers.

| | Today | Rebuilt |
| --- | --- | --- |
| A screen | drawn live beside its panel | the picture filling the window, the question in a bar |
| An answer | one a language, until the words change | one a screen, until its picture's version moves |
| Kept in | `visual/answers.json` and the browser | the browser, under the name typed |
| The map | rows slip out of their columns after a cell of several walks (`visual/src/page.css#L245-L247`, `page.tsx#L126`) | one cell per person and stage, cards stacked inside |

## Decided here

- **Captured, not drawn live.** The build already draws each screen on jsdom
  (`visual/src/words.tsx#L70-L139`); it keeps that markup in both languages, framed on the page at
  the device's width, where the app's CSS alone lays it out (no script in `ui/src` reads a width).
  *Rejected:* live, as today: the page carries the whole app, and a browser may draw other than
  what the version hashed. *Price:* about 16 KB a screen a language, 3.5 MB in all.
- **The version** (Decide 56): twelve hex digits of SHA-256 over the markup in both languages and
  the style rules matching it; Mantine's random ids renumbered in order; run-time styles kept per
  screen, as states carry other companies' colours (`ui/src/mock/fixtures.ts#L12`, `#L30`).
  *Rejected:* the whole stylesheet (any style change re-asks all 96); the walk's base images (the
  stack's, made once a piece, for some screens).
- **The 192 yes do not carry over:** they were given on words. Every screen opens new once; Yes to
  all gives a walk's back in one key.
- **`pnpm answers` and `visual/answers.json` retire:** nothing reads them once answers live in the
  browser. The machine reads the pasted block, and a No becomes a case.
- **A PC screen on a phone** is scaled to the width, as in the mock; Look, a pinch or the View
  menu's phone width make it legible.
- **Stages and stake:** the fake is the mock itself; step 1 swaps its data for the build's. The
  deployed page, the shared check, comes after the merge: `walks.yml` deploys from `main` alone
  (`.github/workflows/walks.yml#L81`). A tool on invented data: the gate's ceremony, no act run,
  no stack, no walk.

## The cases

Rows 1 to 3 held in `capture.test.ts`, 4 to 11 in `page.test.ts`, 12 in `tokens.test.ts`.

| # | The case |
| --- | --- |
| 1 | Two builds of one commit give every screen the same version |
| 2 | A version moves with the screen's markup in either language or a rule matching it, and with nothing else |
| 3 | A screen drawn in another company's colour keeps it |
| 4 | Every open asks who is answering, the last name filled in; answers are kept under it, trimmed, any case |
| 5 | A walk opens at its first new or changed screen, in its person's language; L shows the other |
| 6 | One answer a screen, Yes or No (a No needs a memo), keeping version, language, memo and time |
| 7 | A kept version not the build's reads changed, and its card counts it |
| 8 | Yes to all asks once, skips a No or a memo, and Undo puts each back |
| 9 | The map holds one cell per person and stage, whatever a cell holds |
| 10 | The block carries the build line, the name and a line a screen answered |
| 11 | Without storage the page works until it closes |
| 12 | Each token pair of text on its background reads 4.5:1 or more, light and dark |

## Steps

- [x] **1. The mock's page on the build's data.** `pnpm report` keeps each screen's markup, the
  stylesheet once, a version a screen (the whole stylesheet in it for now) and the mock's
  Vietnamese questions; the page is the mock's three files, its test switches gone. Done when:
  `walks.json` reads 96 screens and 192 captures, none empty; a second build moves 0 versions;
  `index.html` under 8 MB; round 5's jsdom check
  (`$ROOT_DIR/one-off/20261102-2340-walks-mock-round-5/check.mjs`), less its switches, all PASS.
  Then point 1.
- [ ] **2. Hardened.** The script as typed modules; the old page, `pnpm answers`, `answers.json`
  and their tests removed; the version narrowed to the matching rules. Done when: each case red
  once from its own assertion; `@credo/visual` at 100 %; `pnpm check` exit 0;
  `git grep 'display: contents' visual/src` empty; `git diff --stat main -- ui walk` empty.
- [ ] **3. QA's rule 7 amended** (`docs/conventions/qa.md#L122-L128`): a yes holds until the
  screen's version moves, one answer a screen; *Rejected:* a yes keyed to the words, which kept a
  changed look's yes unseen. Its line at a glance, and the stamp (Decides 56, 57). Done when:
  `git grep 'words change' docs/conventions/qa.md` finds nothing.
- [ ] **4. Review and merge.** Another model reviews (rule 5); the merge; the human's push. Done
  when: every finding tagged in the recap; the walks workflow green on GitHub. Then point 2.

## The human's points

1. **The first look, from disk (after step 1).** The page the build just made asks who is
   answering, then shows the map; all 96 screens are new, since your old yes were given on words.
   Open a walk and answer a few: the screens are the real ones now, not the mock's ten. A yes
   starts the hardening; a no names what to change first.
2. **The deployed page (after step 4).** At the shared address, where partners answer, the map's
   rows now line up under their stages; today they slip out of their columns after a cell of several walks.
   Answer under a label such as `p1` and copy the block into the chat. A yes ends the milestone; a
   no becomes a case and a fix.
