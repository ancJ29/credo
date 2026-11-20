# The design system's next fixes: readable text on every client's colour, colours named, type named

## At a glance

What it is for: the design system for its real user, the staff of a small business in Vietnam (the
milestone of 2026-11-19). Landing A is in `main`: the text on a client's colour follows the colour
(your answer of 2026-11-20, "yes, switch to dark text, judged in the gallery first"). Landing B names
each colour by its use and makes brand-coloured text on white readable the same way: emerald keeps the
shades you picked, and its links take a darker shade by rule (your answers of 2026-11-20 19:2x, "yes to
all four, as you recommend"). Landing C names the text styles the screens draw today, with no `number`
style. B moves one set of pictures, the walks' company's links, a shade darker; C moves none. The
cheapest path builds on `onBrand`, the `--credo-*` variables and the gallery; the price, about 150
machine minutes and three picture runs of yours.

## The slice

One slice: a client's colour, from the gallery to every screen of both apps, in three landings on
`pre-merge`, each walkable. **A** (in `main`): the text on a client's colour follows the colour.
**B**: every colour a screen draws is read by what it is for, each value has one home (item 508), and
brand-coloured text on white follows the colour. **C**: text styles and weights read by name. It
follows `docs/plans/2026-11-12-design-system.md` and `docs/plans/2026-11-17-gallery-workbench.md` (the
gallery at `/48b74d079/gallery`). Light only stays (item 307). Stages: each step on the gallery, its
gates, the gallery and the walks page; no stage 4, since no resource, hop or key changes.

**Not in it** (your answers of 2026-11-20 19:2x): the design agent's skeleton memo, its own piece after
C, its gallery usage notes first, the gallery built as the design agent suggests with these answers'
changes, and there no toasts, messages inline only; a `number` style; a new emerald ramp. Nor a fourth
component level, or `parts/` swept into `components/` (item 498).

## The brief, checked

The design agent's two memos, forwarded, were read by pieces 202 and 209; this plan reread each claim
it rests on here.

- **Raw shades:** 32 lines in the four folders (step 6's grep): 21 in
  `ui/src/frame/frameLook.module.css`, 4 in `frame.module.css`, 5 in `components/`,
  `ui/src/pages/SignIn.tsx#L26`, `c="orange.9"` (`ui/src/pages/client/OrderPage.tsx#L221`). The 78
  `c="dimmed"` are Mantine's own role name and stay.
- **"The 12 plain links":** 11; the twelfth `Anchor` is the back link, `brand.7`
  (`ui/src/components/atoms/BackLink.tsx#L10`), 5.48:1 on emerald. The 11 read Mantine's
  `--mantine-color-anchor`, shade 6.
- **The links fail beyond emerald:** shade 6 on white reads 3.77:1 for emerald, 4.37 for the walks'
  company's `#2f7d6d` (`shared/src/demo.ts#L30`), 2.91 for `#d97757`; the other five stock colours
  pass, 4.71 to 5.57 (this plan's scratch run of `onBrand.ts`'s formula). No shade of amber `#ffbf00`
  reaches 4.5:1.
- **The memo's `brand-text` rule, 6 where it passes:** it would move the back link and the frame's
  brand text from shade 7 to 6 on five colours.
- **"Small capitals written three ways":** no `lts=` exists; `TOKENS.fieldLabel` and
  `TOKENS.sectionTitle` (`ui/src/design-system/tokens.ts#L20`, `#L22`) are each spread once.
- **Missed by both:** a CSS module's class names are hashed from its stylesheet's text
  (`ui/src/frame/frameLook.module.css#L3-L4`), so an edit to `frame.module.css` changes every frame
  screen's markup without a pixel; two of A's washes are the sign-in's (`SignIn.tsx#L30`, `#L100`).

## Landing A: the text follows the colour

`onBrand(shades, surface)` (`ui/src/design-system/onBrand.ts#L83`) picks the text on the filled
parts, the header and the menu: white where it reaches 4.5:1 against every shade of the span, else the
theme's darkest grey, else the span moves a shade at a time; the colour stays the client's. The theme
and `credoVariables` (`ui/src/design-system/cssVariables.ts#L24`) apply it; the gallery's "On the
brand" shows it. Only emerald's buttons take dark text (4.71:1); the walks' company's buttons move to
its shade 7 (4.91:1). *Rejected:* darkening each primary until white passes; Mantine's `autoContrast`.

## Landing B: colours named by role, and one home for each value

Each role is a `--credo-<role>` variable written once by `credoVariables`, or Mantine's own slot where
it has one; `FRAME_COLOURS`' value names (`tokens.ts#L52-L55`) go. Named by what each is for:

| Role | Today | Read by |
| --- | --- | --- |
| `surface`, `surface-sunken` | neutral 0, neutral 1 | the white look's header and menu; the sign-in ground |
| `text`, `text-muted`, `border`, `border-strong` | neutral 8, 7, 2, 3 | the white look; the door card's and avatar's edge |
| `hover-ink` | `ink-04` | the white look's hover and chip |
| `brand-text` | brand 7, by rule | the back link, the white look's name and open item, the phone bar's open icon |
| `brand-tint`, `brand-tint-strong`, `brand-line`, `on-brand-tint` | brand 0, 1, 2, 9 | the band, the open item, the badge, the logo tile's edge, text on a tint |
| `on-filled`, `on-header`, `on-menu` | A's | A |
| `header-hover`, `-chip`, `-avatar`, `-avatar-edge`, `-badge`; `menu-hover`, `-current`; `language-edge`, `-picked` | A's washes: 12, 12, 18, 90, 18; 5, 10; 55, 22 % of the text | `frame.module.css#L37-L99`, `SignIn.tsx#L30`, `#L100` |
| `tip`, `on-tip` | neutral 8, white | the icon strip's tip |
| `warning-text` | orange 9 | the order page's late line |
| `danger`, `success`, `warning` | Mantine's `red`, `green`, `orange` | the screens' colour names, unchanged |

**The links' rule** (your answer: emerald keeps its shades, its plain links take a darker shade by
rule): `onWhite(shades, from)`, beside `onBrand`, gives the first shade from `from` that reaches 4.5:1
on white, a shade darker at a time, else the theme's darkest grey (amber). From 6 for links, written
as Mantine's `--mantine-color-anchor`, `-brand-text` and `-brand-outline` (A's pin of `-brand-text`,
`cssVariables.ts#L43`, goes); from 7 for `brand-text`, so the back link and the frame's brand text stay
at 7 on every stock colour and the walks' company. **The walks move in one place:** the company's links
go from shade 6 to its own 7 (4.37 to 4.91:1), since the rule serves every colour, not emerald alone;
steel's and brick's stay. Emerald's links take 7 (5.48:1), seen in the gallery. *Rejected:* the memo's
one start at 6, which moves the back link on five colours that pass.

`gray.6` (`frame.module.css#L127`) reads Mantine's `dimmed`. Two values of one purpose stay two roles,
the drift named in the tick. *Not added:* the memo's
`surface-raised` (the cards draw Mantine's white body), `focus` (Mantine's ring reads the filled shade
A sets; nothing here names it), `on-brand`, `brand-surface` (A's `on-*`, Mantine's `filled`). The
screens' 120-odd `color=` names move to `danger`, `success`, `warning` with the skeleton piece's message
atom and status map, which rewrite those lines.

**One home for each value:** `TOKENS.badgeRadius` and `TOKENS.cardPadding` (`tokens.ts#L12`, `#L24`)
read the theme's `sm` and `lg` (`ui/src/design-system/appTheme.ts#L154-L155`), closing items 508 and
596; `doorPadding`, `doorBody` and `logoTile` stay component settings, said in the doc comment. The
gradients' angles, 135 and 180 (`cssVariables.ts#L34-L35`), come from `tokens.ts`, and the washes
become one table of numbers. `todayOf` (`onBrand.ts#L74`) becomes `beforeOf`, the gallery's "Today"
column "Before", since in `main` that state is no longer today.

**The check extends:** case 7 (`ui/src/design-system/literals.test.ts#L10`) refuses
`--mantine-color-<name>-<n>` in a stylesheet outside the design system; the lint refuses a numbered
shade (`brand.7`) and that variable in `.ts`/`.tsx`, as selectors of the one `no-restricted-syntax`
block (`eslint.config.js#L75-L87`), since a second block over the same files replaces its options.

## Landing C: type by name

Named in `tokens.ts` from what screens draw today: `pageTitle` (22 at 700, `appTheme.ts#L151`);
`sectionLabel` and `fieldLabel` (the two small-capital entries, renamed); `body` (Mantine's `md` at
400, a `Text` with no prop, so no reader moves); `bodyStrong` (body at 600); `caption` (`sm`, dimmed,
24 texts); and weights by role for the rest, `label` 500, `emphasis` 600, `title` 700, over the 19
`fw=` and the frame stylesheets' 3 weights. A use that fits none keeps its number in a pinned list with
its reason. The sizes join: one `fz={12}` (`SignIn.tsx#L97`) and four pixel sizes in the frame
stylesheets. The check then refuses a numeric `fw=`, `fz=`, `fontWeight`, `font-weight` and
`font-size` outside the design system, in the same lint block, closing item 309. No `number` style
(your answer; `grep -rnE 'tabular|font-variant-numeric' ui/src` counts 0). Item 308 waits for your look.

## The palette check: what moves, on every colour

The picture run draws the walks' company, credo's steel, and brick after one settings step
(`walk/specs/piece-1.spec.ts#L163`). So B's first step adds `visual/src/resolved.test.ts`: every
screen of the walks page, drawn as the capture draws it (`visual/src/capture.ts`'s `matchingRules`),
each element's declarations resolved, under the six colours and four typed ones (the company's,
`#d97757`, pure red, amber), class names left out, being hashed. One hash a screen and colour, against
`visual/src/resolved.pinned.txt` from the tree A landed. Equal resolved styles draw equal pixels, so its
0 holds steps 5, 6, 9 and 10 on every colour; step 7 rewrites it by `--write`, its diff read. It stays
standing; the skeleton piece's look changes rewrite it the same way.

## The cases

| # | The case | Held by |
| --- | --- | --- |
| 1 | Every stock colour's surfaces get a text at 4.5:1 or more on every shade of the span | `ui/src/design-system/onBrand.test.ts` |
| 2 | 4,096 typed colours and five named ones each find a pass | same |
| 3 | White stays wherever it passes | same |
| 4 | White on a light colour's shade 6 is refused | same |
| 5 | Dark text is the theme's darkest grey | same |
| 6 | The filled parts and the checks' mark take the pick, at rest and on hover | `ui/src/design-system/appTheme.test.tsx` |
| 7 | The header, the sign-in and the join button draw the header's pick | `ui/src/frame/Shell.test.tsx`, `ui/src/pages/SignIn.test.tsx` |
| 8 | The menu draws the menu's pick | `ui/src/frame/Shell.test.tsx` |
| 9 | "On the brand" draws each colour's surfaces, before and after, with ratios | `ui/src/design-system/Gallery.test.tsx` |
| 10 | No stylesheet or script outside the design system names a numbered shade | `literals.test.ts`, the lint block |
| 11 | No resolved style of any screen moves on any of the ten colours, but where step 7 says | `visual/src/resolved.test.ts` |
| 12 | The badge's corners and the card's padding are written once, read from the theme | `appTheme.test.tsx` |
| 13 | No weight or size number stands outside the design system | `literals.test.ts`, the lint block |
| 14 | The field label's spacing is held, not only its weight (item 513) | `ui/src/components/atoms/FieldLabel.test.tsx` |
| 15 | B moves only the walks' company's links; C moves no picture | the picture run |
| 16 | Every stock and typed colour's links and brand text reach 4.5:1 on white, amber by the dark grey | `onBrand.test.ts` |
| 17 | Emerald's shade 6 as a link is refused (the planted failing pair) | same |
| 18 | A start that passes is kept: the back link at 7, steel's and brick's links at 6 | same |
| 19 | "On the brand" draws a links row, before and after, each with its ratio | `Gallery.test.tsx` |

## The steps

Each step's gate is `pnpm --filter @credo/ui check`, `pnpm --filter @credo/visual check` and the
citation test, `pnpm --filter @credo/scripts exec vitest run src/citations.test.ts`. No step has a
review: one comes before `main` moves (QA rule 5). Each size is this piece's own row of the same
shape, else piece 126's. One recap, step 11, before C lands, not one a landing.

**Landing A: the text follows the colour.** In `main` and on ridge.

- [x] **1. The rule and the gallery, no screen changed.** Cases 1 to 5 and 9; the decisions row; items
      630, 631, 636 filed. _Done when:_ the gates exit 0 and `git diff --name-only pre-merge...HEAD --
      ui/src/frame ui/src/pages ui/src/parts ui/src/components` prints nothing. **12 min.**
      _Evidence:_ `d9c81355`, `d633ce7e`; as asked, each case red once.
- [x] **1b. The stock colours replaced by your pick** ("yes, as you suggestion"). _Done when:_ the ui
      gate, the citation test and the walk's typecheck and lint exit 0. **15 min.** _Evidence:_
      `b59c21ae`; as asked, the settings step replayed with the real router.
- [x] **2. The screens take it.** Cases 6 to 8. _Done when:_ the three gates exit 0. **16 min.**
      _Evidence:_ as asked, each case red once; two snapshots diffed to variable names alone.
- [x] **3. Landing A.** Your write run, then a run with no flags. _Done when:_ the second reads green,
      every count 0. **7 min, and your runs.** _Evidence:_ both green; 410 pictures of six client walks
      committed alone in `58710f78`, the operator walks 0.

**Landing B: colours named by role, links readable** (from `pre-merge` at A's landing).

- [ ] **4. The palette check.** `resolved.test.ts` and its file; case 11 red once on a planted role
      value, green on a class renamed in `frame.module.css`. _Done when:_ the gates exit 0. **17 min**
      (step 1's shape: a new module and its cases).
- [ ] **5. The roles.** The table in `tokens.ts` and `credoVariables`, the 32 references and A's names
      moved, D's two tokens, the angles, `beforeOf`; Values lists the roles; case 12. _Done when:_ the
      gates exit 0, `resolved.pinned.txt` unchanged. **24 min** (step 2's shape).
- [ ] **6. The shades refused.** Case 10, each half red once on a planted `brand.7`. _Done when:_ the
      gates exit 0 and `grep -rnE --exclude='*.test.*' '"[a-z]+\.[0-9]"|--mantine-color-[a-z]+-[0-9]'
      ui/src/pages ui/src/parts ui/src/frame ui/src/components` prints nothing. **20 min** (piece 126's
      step 7).
- [ ] **7. The links follow the colour** (your answer on emerald). `onWhite`, cases 16 to 18 each red once; the links row, case
      19; the variables; the pinned file rewritten; item 636's thumb measured. _Done when:_ the gates
      exit 0 and the pinned file's diff names no screen under steel, brick, bronze, plum or indigo.
      **17 min** (step 1's shape).
- [ ] **8. Landing B.** `pre-merge` taken in; your run with `--moved all --write`, every moved picture
      a company screen with a link, the operator walks 0; the bases committed alone; your run with no
      flags. _Done when:_ it reads green, every count 0. **14 min** (step 3's rows), **and your two
      runs, about 20 each.**

**Landing C: type by name** (after B lands; your looks stay open meanwhile).

- [ ] **9. The styles.** The 19 weights, 3 stylesheet weights, 5 sizes and 24 captions moved; Type
      lists each style; case 14 red once. _Done when:_ the gates exit 0, the pinned file unchanged.
      **13 min** (piece 126's step 4).
- [ ] **10. Weights and sizes refused.** Case 13, red once each. _Done when:_ the gates exit 0.
      **20 min** (piece 126's step 7).
- [ ] **11. The recap.** `docs/recaps/2026-11-20-design-fixes.md`: the commits, the two rules, each
      colour's ratios, the check's patterns and red receipts, the picture counts, what was rejected
      (the memo's ask), C's run a marker. _Done when:_ the citation test exits 0. **9 min** (piece 126's).
- [ ] **12. Landing C.** As step 8, one run with no flags. _Done when:_ green, every count 0. **13 min,
      and your run.**

## Keeping every test and walk green

- **The walks page asks again for every frame screen** at each landing, a version being its markup
  (`visual/src/capture.ts#L262`); the run's counts say which moved.
- **No case is edited to fit a move**: any red but the links' at step 7 is the move being wrong.
- **The skeleton piece shares six files** (`eslint.config.js`, `literals.test.ts`, `tokens.ts`,
  `entries.tsx`, `OrderPage.tsx`, `ui/CLAUDE.md`): B and C leave it places to join, not shapes to undo,
  the refusals as selectors of the one lint block, roles its status map reads, styles as gallery entries.

## The human's points

1. **The six colours and two typed (step 1).** Answered yes, 2026-11-20 15:05.
2. **The screens, on the walks page (step 3).** Every client screen's buttons wear the company's own
   green, a shade darker, with white text; brick's and credo's own screens did not move. Does each read
   right? A no names the screen, and step 2 reopens.
3. **Links readable, on the walks page (step 8).** The company's links are a shade darker, its own
   colour, at 4.91:1 where they read 4.37:1; nothing else moved. Does each link still read as the
   company's colour, now readable? A yes lets the push take B to ridge; a no names the screen, and
   step 7 reopens.
4. **Links and colours named, in the gallery (step 8).** "On the brand" has a links row, emerald's at
   its shade 7 (5.48:1, from 3.77:1); "Values" lists each colour by what it is for. Does the page read
   true? A no names the colour or the role, and step 7 or 5 reopens.
5. **Type named, nothing moved (step 12).** "Values", Type, shows each style by name with its size and
   weight. Does each name say what the text is for? A yes closes the piece; a no names the style, and
   step 9 reopens.

## The open items in reach

| Item | What this plan does |
| --- | --- |
| 83, 94 | closed and updated by landing A |
| 307 (light only), 308 (the phone's title), 498 (`parts/`), 515 (no gallery picture), 629 (hidden button names) | leave: no step reaches them; B makes a dark set one value a role, when you ask |
| 508 and 596, two homes for two values | close, step 5 |
| 636, brand text on a light ground | its text part closes, step 7; the switch's thumb measured, left open where a colour fails 3:1 |
| 513, the label's spacing unasserted | closes, step 9 |
| 309, numeric weights | closes, step 10 |
