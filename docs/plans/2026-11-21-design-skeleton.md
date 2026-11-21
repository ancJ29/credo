# The design guideline's skeleton: one home, written from the ground up before any screen moves

## At a glance

What it is for: your goal, "decide the design once, so whoever codes a screen makes as few
look-and-feel choices as possible, and the app stays consistent anyway", and your word that the
guideline reaches its shape before the app's code moves. It writes the five layers you said yes to:
a charter, every value with its use, the rules for what a screen tells and offers, the base every
kind of page is built from, and the parts, added on the way. One home,
`ui/src/design-system/guideline.ts`, which a coder or an agent reads as text and the gallery draws
for you. Three landings, each judged by you in the gallery as the guideline; no screen of the app
moves and no picture run of yours is asked. Moving the screens is the next milestone. The cheapest
path builds on the gallery's workbench and step 1's use lines; the price, about 170 machine minutes
and three reviews.

## The slice

One slice: a screen's coder opens the guideline and finds each look-and-feel choice made, or knows
to ask. Three landings on `pre-merge`, each walkable in the gallery at its address, locally and on
ridge: **1**, the floor (the charter, every value with its use); **2**, the rules (messages, page
states, conflict, actions, statuses, confirms); **3**, the page base and what each part serves.
Step 2 is the cheap end to end: the file, its first page in the gallery, the line agents read.
Stages: each step's gates; the gallery locally; the gallery is the report you judge; ridge's
gallery, where the design agent rereads each landing from its recap.

**Not in it:** a kind of page, a phone rule and the words' voice, which you set aside ("plz ignore
this kind of use-case focus questions now ... When a usecase came, we'll discuss on the detail
level then"); toasts and the `number` style (your answers of 11-20); dark mode (item 307); any
screen moved, `FormMessage` and `PageState` included.

## The guideline's home

**`ui/src/design-system/guideline.ts`, plain words in typed data, no markup.** A coder or an agent
reads it top to bottom as text, no samples between the rules; the typecheck holds its shape (a
value, a status or a part with no line, or a rule not saying what holds it, is a type error); the
gallery draws it, so you read the same words beside the samples, the gallery your yes of 11-20
asked for. A part's use lines stay on its gallery entry (step 1): a part arrives on the way with
its entry, and names the rule or slot it serves. *Rejected:* a Markdown page, which the gallery
cannot draw without a renderer in the app's bundle or one of our own, its shape held by nothing;
the rules as entries in `ui/src/design-system/entries.tsx` (the memo's "a gallery entry is the
guideline"), among 526 lines of the samples' markup.

The read's nine homes: `ui/CLAUDE.md`'s rules move in and it points there; values and checks stay
where they are, each named by its rule; the memo's argument for the text on a colour stays; items
306 and 307 become rules; the legacy app and other screens are out by the gap rule.

## The brief, checked

- **Counts:** 96 `<Alert` in 32 files and 109 `<Button` in 43 hold, screens only; colour names
  and gaps about 190 and 150. By colour and role: red 45 `alert`; orange 18 `alert`, 3 `status`,
  3 `note`; green 19 `alert`, 1 `status`; gray 2, yellow 1, three by a condition.
- **The parts:** of the gallery's 11, two are reached by a screen's file, `PageHeader` through
  `ui/src/parts/PageShell.tsx#L10` and `SectionCard` through `ui/src/parts/DetailCards.tsx`;
  `BackLink`, `StatusBadge`, `DetailField` and `DoorCard` have no caller at all.
- **The gallery's cases 4 and 6** pin today's four groups and Values as the first page
  (`ui/src/design-system/Gallery.test.tsx#L67`, `#L98`): step 2 changes both on purpose.
- **The dialog's row** in `docs/decisions.md` linked the first version's landing 2; it now links
  the next milestone, where the 600 lands.

## The steps

Each step's gate is `bash ops/gate.sh ui`, `bash ops/gate.sh visual` and the citation test,
`pnpm --filter @credo/scripts exec vitest run src/citations.test.ts`; each case red once. Every
step after 1 also ends with `visual/src/resolved.pinned.txt` unchanged and `git diff --name-only
pre-merge...HEAD -- ui/src/frame ui/src/pages ui/src/parts ui/src/components` printing nothing.
Sizes are rows of the same shape in `worktrees/runs.tsv`. The review before `main` is the
orchestrator's at each landing, about 20 minutes, not a step. One recap,
`docs/recaps/2026-11-21-design-skeleton.md`, begun at step 6 and added to at each landing.

**Landing 1: the floor** (layers 0, 1 and the parts' use lines).

- [x] **1. The use lines.** The fields, the 14 entries' lines, the panel; cases 1 to 3; item 629 (the
      Show buttons pressed by their visible words). _Done when:_ the gates exit 0 and `git diff
      --name-only pre-merge...HEAD -- ui/src/frame ui/src/pages ui/src/parts ui/src/components` prints
      nothing. **17 min** (203's step 1, a new field and its cases).
      _Evidence:_ `6ce0fd4e` (the pre-main review of piece 215's after, taken in: `CredoMantine`
      memoises `themeOf(colour)` on `colour`, no case of its own, held by the gates), then the
      step's commit. Reds on the Gallery test file, 13:55: item 629's finders on the old hidden names
      (two cases red), case 1 on an entry with no use line and on one with four, case 2 on an
      `instead` naming no entry and on a link to the wrong address, case 3 on a changed heading;
      green 34 of 34. The gates exit 0 at 13:58 (`ui`) and 13:59 (`visual`), the diff of the done
      check printing nothing.
- [x] **2. The home and the charter.** `guideline.ts` and its rule type: what the rule says, why,
      what holds it (a check's file, or review), and whether the app follows it yet or which item
      moves it. The charter: your goal; what credo is (one platform many small and medium
      companies in Vietnam share, its modules added over time, not one trade's app); where a coder
      looks (the page base, a rule, a part, a value; never another screen or the legacy app); a gap
      is asked and its answer written here as a rule the first time; a part joins `components/` at
      its third use, the rule of three being for code; light only (item 307). The gallery's first
      group, Start here, the charter at the bare address, its words a plate drawn from the file, on
      the workbench as it is. `ui/CLAUDE.md`'s two long bullets (`#L42-L65`) keep each directory's
      sentence; their rules (a role, never a shade; text by name; the levels; the rule of three)
      move into the guideline, one line pointing there; `docs/conventions/code.md`'s C16 and
      `docs/memo/ui-code.md`'s new-screen list gain "its look from the guideline". Cases 4 to 7 and
      18. _Done when:_ the gates exit 0, `grep -c "numbered shade" ui/CLAUDE.md` prints 0. **17 min**
      (203's step 1, a rule and its gallery entry, no screen changed).
      _Evidence:_ the step's commit. `guideline.ts` holds `GUIDELINE`, whose `charter` has the goal,
      what credo is, where to look and six rules, each typed with what holds it and whether the app
      follows it; the gallery's first group Start here draws it as a plate (`Charter.tsx`); the list
      holds the seven groups, Rules and Pages empty until landings 2 and 3. Reds on the Gallery and
      guideline test files, 14:33 to 14:34: case 4 on Foundations and Rules swapped; case 5 on the
      bare address opening the second entry (case 7 with it); case 6 on a check whose file is gone,
      and on an item not listed; case 7 on the credo words cut by one letter; case 18 on the
      exported name changed, in the citation test. `ui/CLAUDE.md` holds 0 of "numbered shade".
- [x] **3. Values explains, and the meanings.** Each role, `on-*` value and wash its purpose line,
      typed over its table's keys; each swatch its value as `credoVariables` writes it for the
      chosen colour (jsdom has no computed style); each `TYPE` style its size, line height, weight,
      spacing and use, its name in plain letters; text takes a style, a `size` or `fw` on `Text`
      only where none fits, with a comment why. `TONES` in `tokens.ts`: danger red, success green,
      warning orange, info gray; a screen names a meaning or a role, never a Mantine colour (not
      yet). Cases 8 to 10. _Done when:_ the gates exit 0. **19 min** (203's step 5, a table in
      `tokens.ts` that Values draws).
      _Evidence:_ the step's commit. `guideline.ts` holds `GUIDELINE.values`: a use line for each of the
      25 roles, `on-*` values and washes, each of the six text styles and each of the four meanings,
      typed over their tables' keys (`RoleName`, `keyof typeof TYPE`, `keyof typeof TONES`), and the
      two notes where the Mantine colour names and the text rule are not yet followed. `TONES` in
      `tokens.ts` is now the one place the names `red`, `green`, `orange` and `gray` are written for a
      meaning; Values draws them as its Meanings state (`Values.tsx`), with each role's value as
      `credoVariables` writes it and each style's size, line height, weight and spacing read from the
      theme. Reds on the Gallery test file, 14:51: case 9 on the value read from the table, case 10
      on the spacing fixed at 0, case 8 on a tone's colour changed and on a use line not drawn, and
      case 8's types on a role with no line (the typecheck). The gates exit 0 at 14:58 (`ui`) and
      15:00 (`visual`).
- [ ] **4. Every value by its use.** Spacing steps by what they separate; the widths the screens
      draw (440, 420, 240, 560, 320), one a use; icon sizes (14 px on 29 of 44, five others);
      corners and shadows; formats, each in its one place: money `useMoney`
      (`ui/src/parts/OrderParts.tsx#L23`), dates and times `ui/src/day.ts` (8 `new Intl.` in 5
      files: not yet). Case 8. _Done when:_ the gates exit 0. **17 min** (203's step 1).
- [ ] **5. One key, one value, the leftovers.** `TYPE` on `size` (a `Text`'s `size` also sets its
      line height, which `fz` drops; on a `Title`, `size: 'xs'` keeps the level's); `FRAME_VALUES`'
      `menu-size` and `link-size` one value; item 649; item 647's three theme weights read `WEIGHTS`
      (the 550 waits). Case 11. _Done when:_ the gates exit 0, `grep -c "fz:"
      ui/src/design-system/tokens.ts` prints 0. **10 min** (203's step 10, small leftovers).
- [ ] **6. Landing 1.** The recap begun; the gallery's row and card in `docs/products.md`. No picture
      run: the pinned file holds its 0, and the gallery is looked at, not pictured (item 515).
      _Done when:_ the citation test exits 0. **15 min** (203's step 11). Your point 1.

**Landing 2: the rules** (layer 3), from `pre-merge` at landing 1.

- [ ] **7. What a screen tells the person.** A Rules group. Messages: four kinds, each its meaning
      and spoken role, error and warning `alert` (18 of 24 warnings do today; one that follows an
      act must be heard), success and info `status` (19 of 20 green ones speak `alert`: not yet);
      full width, no margin of its own, under the buttons that caused it, one at a time, words from
      the dictionary; no toasts, no yellow. Page states: loading and failed by `Loaded`
      (`ui/src/frame/Loaded.tsx#L12`, 26 uses), forbidden and nothing by `Notice`
      (`ui/src/pages/client/Notice.tsx#L6`), empty (what the list is for, its add action where the
      person may add), not found; never a blank page. Conflict: the layout most of its ten screens
      draw. Samples from Mantine's `Alert`, `Loaded` and `Notice`. Case 13. _Done when:_ the gates
      exit 0. **17 min** (203's step 1).
- [ ] **8. What a screen offers, and how a status reads.** Actions, your yes: one main button a page,
      filled; plain (`default`) for the rest; quiet (`subtle`) inside content; red only at a
      delete's last step; each of today's variants mapped; their place; the `docs/decisions.md` row
      with your "YES". A confirm is a page (item 306). Statuses: one map from every status the
      records carry (`shared/src/orders.ts`'s `ORDER_STATES` and `REQUEST_STATES`, a person
      archived or not) to a meaning and a word, typed over the unions; `STATE_COLOUR`'s teal and
      blue (`ui/src/parts/OrderParts.tsx#L29`) and the staff chips
      (`ui/src/pages/client/StaffListPage.tsx#L143-L145`) not yet; the winner among them and
      `StatusBadge` named. Cases 14, 15. _Done when:_ the gates exit 0. **17 min** (203's step 1).
- [ ] **9. Landing 2.** The recap's lines, the gallery's card. _Done when:_ the citation test exits
      0. **15 min** (203's step 11). Your point 2.

**Landing 3: the page base and what each part serves** (layers 2 and 4), from `pre-merge` at
landing 2.

- [ ] **10. The page base.** A Pages group, one entry: the frame (`ui/src/frame/Shell.tsx#L130`: its
      header, menu, phone bar below `sm`, padding `md`) and a page's slots in order: the header row
      (back link, title, status, actions, as `PageShell`'s), the state in the body's place, the
      body's blocks (`ui/src/parts/DetailCards.tsx#L11-L40`), the message's place and the main
      button's, each slot's gap and width. One back link: the winner of `BackLink` and the three
      forms drawn by hand. Drawn as a page labelled slot by slot, from those real pieces on sample
      words. Case 16. _Done when:_ the gates exit 0. **17 min** (203's step 1).
- [ ] **11. A new kind of page, and what each part serves.** A kind of page is written in the
      guideline at its first page, when its use case comes, from the base's slots, and judged by you
      in the gallery before its second; none named now. Each part's entry names the rule or slot it
      serves, typed over the guideline's names; each duplicate's winner named on the other's entry
      (`DoorCard` or `ui/src/pages/SignIn.tsx`'s `SignInFrame`, `DetailField` or `FieldPair`, step
      8's badge). Case 17. _Done when:_ the gates exit 0. **11 min** (213's step 1, a field on every
      entry and its case).
- [ ] **12. Landing 3.** The recap's lines, the gallery's card; one open item listing, rule by rule,
      the screens not yet following the guideline, with counts: the next milestone's list. _Done
      when:_ the citation test exits 0. **15 min** (203's step 11). Your point 3.

## The cases

| # | The case | Held by |
| --- | --- | --- |
| 1 | Every entry carries one to three use lines and one to three don't-use lines | `ui/src/design-system/Gallery.test.tsx` |
| 2 | An entry's `instead` names an entry that exists, and the panel links to its address | same |
| 3 | The side panel shows the part's use lines under its description | same |
| 4 | The list shows Start here, Foundations, Rules, Pages, then the three levels, in that order | same, today's case 4 changed |
| 5 | The bare address opens the charter, and the list marks it current | same, today's case 6 changed |
| 6 | Every rule says what holds it, a check whose file exists or review, and whether the app follows it or which item moves it | `guideline.test.ts`, reading the files as `literals.test.ts` does |
| 7 | Each guideline page draws its words from `guideline.ts`, the same text | `Gallery.test.tsx` |
| 8 | Every role, `on-*` value, wash, style, meaning, spacing step, width, icon size and corner has one use line | the types over each table's keys, the typecheck |
| 9 | Values draws each role's value for the chosen colour, as `credoVariables` writes it | `Gallery.test.tsx` |
| 10 | Values draws each style's size, line height, weight and spacing, its name in plain letters | same |
| 11 | The theme's heading, page-title and field-label weights read `WEIGHTS` | `ui/src/design-system/appTheme.test.tsx` |
| 12 | No step moves a screen's resolved style on any of the ten colours | `visual/src/resolved.test.ts`, the pinned file |
| 13 | The gallery draws each message kind in its colour and role, and each page state | `Gallery.test.tsx` |
| 14 | Every status the records carry has one meaning and one word | the type over the shared unions |
| 15 | Every button variant a screen draws today maps to one of the four kinds | `guideline.test.ts`, reading the screens |
| 16 | The page base names each slot, and each slot's part is a gallery entry or a named piece that exists | `Gallery.test.tsx` |
| 17 | Every part's entry names the rule or slot it serves | the type over the guideline's names |
| 18 | `ui/CLAUDE.md` points to the guideline by a name the file declares | the citation test |

## What moves, and what must not

No screen of the app: the pinned file (131 screens on ten colours) unchanged at every step, no walk
picture moved, no walks-page question asked again. The gallery moves, which is the point, judged by
you. A red in `resolved.test.ts` is a step that touched a screen; no case is edited to fit a move.

## The next milestone: the screens moved to the guideline

Its own plan, one rule at a time (no kind of page is named until its use case comes), each after
your look at that rule, each a landing with your two picture runs:

1. **The dialog at 600** (your answer): `TOKENS.dialogTitle` reads `WEIGHTS.emphasis`, the pinned
   diff naming `operator-passkeys/pk-6-sign-in-ended` alone; item 647 closes, item 644's header fix
   rides along. The smallest move, which proves the runs.
2. **Messages:** `FormMessage` arrives with its 96; the 88 test and walk lines that find a message
   by its role follow it; the two yellow ones turn orange; `Alert` refused; item 650 if `piece-1`'s
   or `piece-2`'s spec changes.
3. **Page states:** `PageState`, drawn by `Loaded` and `Notice`; five `Loader`s, the empty texts,
   the not-found message; `Loader` refused.
4. **Actions:** the 109 buttons; other variants refused.
5. **Statuses:** `StateBadge` and the chips read the map.
6. **The page base:** 41 page titles drawn by hand, 18 action rows, 14 back links.
7. **Formats:** 8 sites, no picture expected.

Rough size by the first version's rows (a part 17, its move 15, a landing 17, your two runs about
22 each): about 50 machine minutes and two runs a rule, the dialog and the formats about 20.

## The first version: kept and dropped

**Kept:** step 1 as built; its corrections (96 messages, not the memo's about 85; `TYPE` on `size`
for the line height; one dialog in the app; `STATE_COLOUR` already a map on six pages; the mock
harness drawing piece 1's screens alone); its finders; the dialog's 600; its item numbers; its
Values and leftovers steps, now 3 and 5.

**Dropped:** its landings 2 and 3 as written (the 96 messages and the page states moved, `Alert`
and `Loader` refused), which moved the app's code before the page base and the action rules
existed: the rules are this milestone's, the moves the next's. `FormMessage` and `PageState` built
now: a part arrives with its first screens, since four of the gallery's eleven have no caller,
each beside a form the app draws its own way. Its four picture runs. The page patterns placed last, after
the moves. Its `ui/CLAUDE.md` additions, which now move into the guideline.

## The human's points

1. **The floor (step 6).** The gallery opens on Start here: your goal, what credo is, where a coder
   looks first, and that a gap is asked, then written as a rule. Values gives every colour, text
   style, gap, width, icon size and corner its use. Could a coder pick each without asking? A no
   names the line, and step 2, 3 or 4 reopens.
2. **The rules (step 9).** The Rules group says what a screen tells the person (four kinds of
   message; loading, empty, failed, forbidden, not found; someone saved first) and what it offers
   (your four kinds of button, a status's colour, a confirm on its own page), with samples. Does
   each read as the one way you want? A no names the rule, and step 7 or 8 reopens.
3. **The page base (step 12).** The Pages group draws one page, its parts named: the header row
   (back link, title, status, actions), the body's blocks, where a state, a message and the main
   button sit. Each kind of page is added from it when its use case comes, judged here first. Is
   this the base to build on? A no names the slot, and step 10 or 11 reopens.

## The open items in reach

| Item | What this plan does |
| --- | --- |
| 629 | fixed, step 1 |
| 649 | closes, step 5 |
| 647 | its theme half, step 5; the 550 in the next milestone |
| 644, 650 | the next milestone |
| 306, 307 | written as rules, steps 8 and 2; both stay parked for their triggers |
| 498, 515, 641, 642, 645, 646, 648 | leave: no step touches them |
| new | step 12's list of the screens not yet following the guideline |
