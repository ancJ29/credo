# The design system's skeleton: which part to use, and messages and page states one way

## At a glance

What it is for: the week's milestone, the design system for its real user, the staff of a small
business in Vietnam, made usable with `p1`. Whoever builds a screen finds in the gallery which part to
use and how, and the app draws its messages and page states one way each. It builds the design agent's
skeleton memo, usage notes first (your answers of 2026-11-20 19:31: after landings B and C, now in
`main`; no toasts), with the design agent's review of 11-21 folded in and the dialog's title at 600
(your answer of 11-21). Three landings today: usage notes and Values explained, no app picture moved;
one message part, three screens moved; one page-state part, three screens moved. The memo's last four
pieces are the next milestone. The cheapest path builds on the gallery's entries, `Loaded`, `Notice`
and Mantine's `Alert`; the price, about 180 machine minutes, three reviews and four picture runs of
yours.

## The slice

One slice: a screen builder's three first questions (which part, how to tell the person, what to show
before the content), answered in the gallery and held by the code, in three landings on `pre-merge`,
each walkable. **1:** every gallery entry says when to use it, when not and what instead, and Values
explains each colour and text style. **2:** one message part, `FormMessage`, for the 96 hand-written
messages. **3:** one page-state part, `PageState`, for loading, empty, failed, forbidden and not found.
Stages: each step in the gallery, its gates, the gallery and the walks page; no stage 4, since no
resource changes.

**Before step 1:** piece 215 (one provider for the app and the gallery, and the stage's `safe center`)
lands on `pre-merge`, since it shares `ui/src/design-system/Gallery.tsx` and `Gallery.module.css` with
landing 1 and every look below reads the gallery's swatches.

**Not in it:** toasts and the `number` style (your answers of 11-20); an icon on messages or page
states (none of today's draws one, and one on all is a look of its own, asked when you want it); dark
mode (item 307).

## The brief, checked

- **Messages:** 96 `<Alert` in 32 files outside tests (the memo says about 85): red 46, orange 24,
  green 20, gray 2, yellow 1, three by a condition; roles `alert` 87, `status` 5, `note` 4, 19 of them
  green; no icon; `w="100%"` on 10, `mb="md"` on 2 (`ui/src/pages/SignIn.tsx#L165`, `#L170`). 58
  lines in `walk/specs` and 30 in 16 ui test files find a message by its role, so a role changed moves
  its finder.
- **Page states exist:** `Loaded` (`ui/src/frame/Loaded.tsx#L12`) draws loading and failed for 26 uses
  in 24 files, and `Notice` (`ui/src/pages/client/Notice.tsx#L6`) draws forbidden and nothing for 8;
  `PageState` is what both draw, not a new path. Five `Loader`s (`frame/Boot.tsx#L24`, `Loaded.tsx#L17`,
  `pages/client/QrLanding.tsx#L38`, `pages/operator/JoinPage.tsx#L88`, `ServicesPage.tsx#L118`), six
  empty texts, one not-found message (`ui/src/pages/client/RecordPage.tsx#L136`). No walk checks an
  empty list's words.
- **The review's ask 5a, one key in `TYPE`:** `size`, not `fz`. A `Text`'s `size` also sets its line
  height (Mantine 9.6.3's `Text` writes `--text-lh` from it), so `caption` and `fieldLabel` on `fz`
  would lose it; on a `Title`, `size: 'xs'` keeps the level's line height, as `fz` does today
  (`ui/src/design-system/tokens.ts#L34`, read by `SectionTitle`).
- **The dialog:** one `Modal` in the app, `SessionEnded` (`ui/src/OperatorApp.tsx#L273`), drawn by the
  operator passkeys walk's sixth screen, six pictures.
- **Landing B's promise:** the screens' colour names move to meanings with the message part and the
  status map (`docs/plans/2026-11-20-design-fixes.md#L95-L97`); landing 2 writes them.
- **The skeleton read's row 25** found no record statuses; `ORDER_STATES` and `REQUEST_STATES`
  (`shared/src/orders.ts#L62`, `#L92`) already have a map, `STATE_COLOUR` (`ui/src/parts/OrderParts.tsx#L29`),
  on six pages. **Its row 24** could not check the mock harness: it draws piece 1's walk screens alone
  (`ui/src/mock/screens.tsx#L79`), none of the four patterns' pages. Both are the next milestone's.

## Landing 1: the gallery says which part to use

`Entry` (`ui/src/design-system/entries.tsx#L92-L100`) gains `useWhen` and `dontUseWhen`, one to three
short English lines each, and an optional `instead`, another entry's name, drawn as a link to its
address. All 14 entries carry them, the three foundations included; the side panel draws them under
the description (`ui/src/design-system/Gallery.tsx#L73-L75`). An entry added later carries its own
(case 1), so `FormMessage` and `PageState` arrive with theirs.

**Values explains** (the review's ask 3): `tokens.ts` gains one purpose line for each role, `on-*`
value and wash, typed over their keys so a role without one is a type error, the one home the gallery
reads; each swatch shows its value as `credoVariables` writes it for the chosen colour (a shade's name
and its hex), since the browser's computed style is not there in a test. Each `TYPE` style draws its
size, line height, weight and spacing, and "use for", the specimen in its style and its name beside it
in plain letters (not "SECTIONLABEL").

**One key, one value, and the lines agents read:** `TYPE` on `size`; `FRAME_VALUES`' `menu-size` and
`link-size` (`tokens.ts#L131`, `#L141`) one value (the review's 5b); item 649's four leftovers.
`ui/CLAUDE.md`'s `components/` note gains: a part is chosen by its entry's use lines; a pattern or rule
is written at its first use, the rule of three being for shared code; text takes a `TYPE` style, a
`size` or `fw` on `Text` only where none fits, with a comment saying why (the review's ask 6).

## Landing 2: messages one way

`FormMessage` (`ui/src/components/atoms/`), props `kind` (`error`, `success`, `warning`, `info`),
an optional `title` (two messages have one), and its words as children. `tokens.ts` gains `TONES`,
each meaning's colour written once (`danger` red, `success` green, `warning` orange, `info` gray),
which the next milestone's status map reads too. The kind sets the tone and the role: `error` and
`warning` speak as `alert` (18 of 24 warnings do today, and a warning that appears after an act must
be heard), `success` and `info` as `status`. Full width, no margin of its own: spacing comes from the
parent's gap, so the sign-in's two take a `Stack` at `md`. Yellow goes: the two yellow notes are
warnings.

The entry's rules: under the buttons that caused it, a load error being `PageState`'s; one at a time
in a form; the words from the dictionary; no toasts. The rules no check can hold say so in the entry,
and screens that break one are filed in one open item, not moved.

**The raw part refused:** a `no-restricted-imports` block refusing `Alert` from `@mantine/core` over
`pages/`, `parts/`, `frame/` and the top level of `ui/src`, outside tests. Not over `components/`: the
levels' blocks (`eslint.config.js#L54-L78`) hold the same rule there, and a second block over the
same files would replace their options.

**The dialog at 600** (your answer): `TOKENS.dialogTitle` reads `WEIGHTS.emphasis`, and the theme's
heading, page-title and field-label weights (`ui/src/design-system/appTheme.ts#L150`, `#L151`, `#L177`)
read `WEIGHTS`; item 647 closes.

## Landing 3: page states one way

`PageState` (`ui/src/components/organisms/`), props `state` (`loading`, `empty`, `failed`,
`forbidden`, `notFound`), an optional `title`, `message` and `action`, its words as props. Centred in
the page body, one text style a part. A state that is the whole page keeps its title as the page's
level-2 heading, which `walk/specs/piece-2.spec.ts#L224` finds. `Loaded` and `Notice` draw it; the
five `Loader`s, the six empty texts and the not-found message move to it; the lint block refuses
`Loader` too. The entry's rules: an empty list says what the list is for and offers its add action
where the person may add; a failure offers "Try again"; never a blank page. Conflict keeps its place
in each form and gets an entry of its own: the layout most of its screens draw, the others filed.

## The cut: the next milestone

Seven pieces do not fit a day: at the sizes below, landings 1 to 3 take the afternoon and your four
runs. The next milestone, its own plan, in this order:

- **4. Buttons.** Of the 109 `Button`s outside the design system: `default` 50, no variant 45,
  `subtle` 6, `outline` 4 (the operator's red delete and move), four filled by a condition
  (`ImportPage.tsx#L234` among them); `light` and `transparent` are no `Button`'s. The confirm stays a
  page (item 306).
- **5. Status colours,** from `STATE_COLOUR`, whose teal and blue sit outside the memo's four, and the
  staff chips' filled badges (`ui/src/pages/client/StaffListPage.tsx#L143-L145`); `StatusBadge` has no
  caller outside the gallery. Every order, delivery and staff list screen moves: your look.
- **6. Formats:** 8 `new Intl.` in 5 files (`ui/src/day.ts` 3, `listSheet.ts`, `OrderPage.tsx`,
  `OrderParts.tsx` 2, `ProductForm.tsx`), `useMoney` already the money's; 0 moved expected.
- **7. Page patterns,** last, since they read 2 to 6; drawing them is a build of its own (the harness
  holds none).

By the same rows, 4 to 6 are about 140 machine minutes and two picture runs; 7 is a first run, sized
in its plan.

## The cases

| # | The case | Held by |
| --- | --- | --- |
| 1 | Every entry carries one to three use lines and one to three don't-use lines | `ui/src/design-system/Gallery.test.tsx` |
| 2 | An entry's `instead` names an entry that exists, and the panel links to its address | same |
| 3 | The side panel shows the part's use lines under its description | same |
| 4 | Every role, `on-*` value and wash has one purpose line | `tokens.ts`'s type, the typecheck |
| 5 | Values draws each role's value for the chosen colour, as `credoVariables` writes it | `Gallery.test.tsx` |
| 6 | Values draws each style's size, line height, weight and spacing, its name in plain letters | same |
| 7 | Landing 1 moves no screen's resolved style on any of the ten colours | `visual/src/resolved.test.ts` |
| 8 | Each kind draws its tone and role: error and warning `alert`, success and info `status` | `FormMessage.test.tsx` |
| 9 | A message is full width, with no margin of its own, its title only when given | same |
| 10 | No screen imports Mantine's `Alert`, nor in landing 3 its `Loader` | the lint block, red on a planted import |
| 11 | The dialog's title draws at `WEIGHTS.emphasis`; the theme's three weights read `WEIGHTS` | `ui/src/design-system/appTheme.test.tsx` |
| 12 | Landing 2 moves only the screens steps 6 and 8 name | `resolved.test.ts`, your picture run |
| 13 | Each of the five states draws centred, its words as props, a whole page's title at level 2 | `PageState.test.tsx` |
| 14 | A failure offers Try again; an empty list offers its add action when given | same |
| 15 | The gallery draws the five states and the conflict entry | `Gallery.test.tsx` |
| 16 | Landing 3 moves only the screens step 11 names | `resolved.test.ts`, your picture run |

## The steps

Each step's gate is `bash ops/gate.sh ui`, `bash ops/gate.sh visual` and the citation test,
`pnpm --filter @credo/scripts exec vitest run src/citations.test.ts`; each case red once. Sizes are
piece 203's rows of the same shape. The review before `main` is the orchestrator's at each landing,
about 20 minutes (203's three), not a step. One recap, `docs/recaps/2026-11-21-design-skeleton.md`,
begun at step 4 and added to at each landing, which the design agent rereads.

**Landing 1** (from `pre-merge` with piece 215 in it: `git log --oneline pre-merge | grep -c
gallery-provider` at least 1, then `git merge-base --is-ancestor pre-merge HEAD` exit 0).

- [ ] **1. The use lines.** The fields, the 14 entries' lines, the panel; cases 1 to 3; item 629 (the
      Show buttons pressed by their visible words). _Done when:_ the gates exit 0 and `git diff
      --name-only pre-merge...HEAD -- ui/src/frame ui/src/pages ui/src/parts ui/src/components` prints
      nothing. **17 min** (203's step 1, a new field and its cases).
- [ ] **2. Values explains.** The purpose lines, the values, the type specs; cases 4 to 6. _Done
      when:_ the gates exit 0, `visual/src/resolved.pinned.txt` unchanged. **19 min** (203's step 5, a
      table in `tokens.ts` that Values draws).
- [ ] **3. One key, one value, the lines.** `TYPE` on `size`, the 14 px once, item 649, the
      `ui/CLAUDE.md` lines. _Done when:_ the gates exit 0, `grep -c "fz:" ui/src/design-system/tokens.ts`
      prints 0, the pinned file unchanged (case 7); a moved hash stops the step. **10 min** (203's step
      10, small leftovers beside its own change).
- [ ] **4. Landing 1.** The recap begun; the gallery's row in `docs/products.md`. No picture run of
      yours: the pinned file holds its 0, as it held landing C's steps 9 and 10, and landing 2's write
      run would name any move as unlisted. _Done when:_ the citation test exits 0. **15 min** (203's
      step 11).

**Landing 2** (from `pre-merge` at landing 1).

- [ ] **5. The part.** `FormMessage`, `TONES`, its entry; cases 8 and 9. _Done when:_ the gates exit
      0. **17 min** (203's step 1).
- [ ] **6. The 96 moved.** Each finder whose message changes role follows it in the same commit, named
      in the tick; if `piece-1.spec.ts` or `piece-2.spec.ts` changes, item 650 rides along (its trigger)
      after its own grep. `ui/CLAUDE.md`'s count of colour names is rewritten from the step's grep.
      _Done when:_ the gates exit 0, `git grep -cP '<Alert\b' -- ui/src ':!*.test.*'` prints one
      line, the part's own file, and the pinned file's diff names only
      `office-orders/orders-15-photo-missing`, `operator-services/sv-2-two-builds` and any width move
      the tick lists (case 12). **15 min** (203's step 9, 85 sites under the pinned file).
- [ ] **7. The raw part refused.** Case 10, red once on a planted `Alert` import in a page. _Done
      when:_ the gates exit 0. **10 min** (203's step 10).
- [ ] **8. The dialog at 600.** Case 11 red once; the pinned file rewritten, its diff naming
      `operator-passkeys/pk-6-sign-in-ended` alone; item 644's second fix, the check's header saying
      which half it holds (its trigger, the first look change; this one is a weight, the same on every
      colour). _Done when:_ the gates exit 0. **12 min** (203's step 5b, a pinned rewrite read).
- [ ] **9. Landing 2.** `pre-merge` taken in; your run with `--moved all --write`, every moved picture
      one steps 6 and 8 name, every other 0; the bases committed alone; your run with no
      flags; the recap's lines. _Done when:_ it reads green, every count 0. **17 min** (203's step 8,
      and 3 for the recap), **and your two runs, about 22 each** (203's step 12).

**Landing 3** (from `pre-merge` at landing 2).

- [ ] **10. The part.** `PageState`, its entry and the conflict entry; `Loaded` and `Notice` draw it;
      cases 13 to 15. _Done when:_ the gates exit 0. **17 min** (203's step 1).
- [ ] **11. The states moved.** The five `Loader`s, six empty texts, the not-found message; `Loader`
      refused, case 10 red once more. _Done when:_ the gates exit 0, `git grep -cP '<Loader\b' --
      ui/src ':!*.test.*'` prints one line, the part's own file, and the pinned file's diff names only
      the screens the tick lists, expected `operator-setup/op-7-list-failed`,
      `office-staff/office-3-forbidden` and `-4-nothing` (case 16). **15 min** (203's step 9).
- [ ] **12. Landing 3.** As step 9. **17 min, and your two runs.**

## What moves, and what must not

Three counts at each landing: the pinned file (131 screens on ten colours), your picture run (786
pictures), and the walks page's questions, asked again wherever a screen's markup changes. Landing 1
moves none for the app; landing 2 moves 18 pictures of three screens and re-asks the screens whose
message changed its role; landing 3 moves the screens its tick names. No case is edited to fit a
move; a red outside the named screens is the move being wrong.

## The human's points

1. **The gallery says which part to use (step 4).** In the gallery each part says, under its
   description, when to use it, when not and what instead; Values gives each colour its purpose and
   value, each text style its size, line height and weight. Could someone build a screen from it
   without asking? A no names the part or line, and step 1 or 2 reopens.
2. **Messages one way (step 9).** On the walks page every message draws as before, through one part.
   Two yellow notes turn orange: the order's missing photo and the services' two builds. Screens whose
   message changed its spoken role are asked again, no pixel moved. Does each read right? A no names
   the screen, and step 6 reopens.
3. **The dialog's title at 600 (step 9).** The one dialog, the operator's "sign-in ended", draws its
   title a touch bolder, 600 where it was 550, as you answered; its six pictures move, nothing else.
   Does the title still read as the dialog's own? A no names what reads wrong, and step 8 reopens.
4. **Page states one way (step 12).** A page that failed to load, or that the person may not open,
   draws one way: centred, its words under its title, "Try again" where it failed. On the walks page:
   the operator's failed list, the office's forbidden and nothing pages; the gallery shows all five.
   Does each read right? A no names the screen, and step 10 or 11 reopens.

## The open items in reach

| Item | What this plan does |
| --- | --- |
| 629, the Show buttons' hidden names | closes, step 1 |
| 649, landing C's four leftovers | closes, step 3 |
| 647, the theme's weights and the 550 | closes, step 8 |
| 644, the ten-colour check's half | its header fix, step 8; drawing each colour stays open |
| 650, two walk titles | only if step 6 changes either spec |
| 306, 307, 498, 515 | leave: the confirm stays a page, light only, `parts/` untouched, the gallery is looked at, not pictured |
| 641, 642, 645, 646, 648 | leave: no step touches the node pin, the site, either pattern or the check's stylesheet |
