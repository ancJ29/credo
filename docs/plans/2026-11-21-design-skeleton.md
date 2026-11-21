# The design guideline's skeleton: one home, written from the ground up before any screen moves

## At a glance

What it is for: your goal, "decide the design once, so whoever codes a screen makes as few
look-and-feel choices as possible, and the app stays consistent anyway", the guideline in its shape
before the app's code moves. Your correction sets two readers: a screen's coder picks parts and
passes them content and meaning ("main action", "danger", a status), never a style; each part
decides its look from the theme, which a design-system coder owns. So the guideline is a charter,
every value with its use, and each part's contract: what it takes from a screen, what it decides
itself. One home, `ui/src/design-system/guideline.ts`, read as text and drawn by the gallery. Three
landings, each judged by you in the gallery; no screen moves until the next milestone. Landings 2
and 3: about 110 machine minutes and two reviews.

## The slice

One slice: a screen's coder finds in the guideline the part for each thing a screen shows and
passes it content and meaning, or knows to ask. Three landings on `pre-merge`, each walkable in the
gallery locally and on ridge: **1**, the floor (the charter, every value with its use); **2**, the
parts a screen tells and offers with; **3**, the page's parts. Step 2 is the cheap end to end.
Stages: each step's gates; the gallery locally, the report you judge; ridge's gallery, the design
agent's reread.

**Not in it:** a kind of page, a phone rule and the words' voice, until a use case comes; toasts
and the `number` style; dark mode (item 307); any screen moved; a part to come's code.

## The guideline's home

**`ui/src/design-system/guideline.ts`, plain words in typed data, no markup.** The typecheck
holds its shape (a value, a status or a part with no line, or a rule not saying what
holds it, is a type error); the gallery draws it beside the samples. A part's use lines and
contract are drawn on its entry; a part to come has both first, its code arriving with its first
screens. *Rejected:* a Markdown page, its shape held by nothing; the rules among `entries.tsx`'s
526 lines of markup.

## The brief, checked

Of the gallery's 11 parts, screens reach `PageHeader` and `SectionCard` alone
(`ui/src/parts/PageShell.tsx#L10`, `ui/src/parts/DetailCards.tsx`); 109 `<Button` and 96 `<Alert`
hold; 14 back links are drawn by hand, 11 as a button, none by `BackLink`.

## The steps

Each step's gate is `bash ops/gate.sh ui`, `bash ops/gate.sh visual` and the citation test,
`pnpm --filter @credo/scripts exec vitest run src/citations.test.ts`; each case red once. Every
step after 1 also ends with `visual/src/resolved.pinned.txt` unchanged (step 1's diff cannot hold:
step 6's slip). Sizes are `worktrees/runs.tsv`'s rows of the same shape, this piece's first. The
review before `main` is the orchestrator's at landing 1 only, about 20 minutes: landings 2 and 3 move `main` on `ui`'s and `visual`'s own checks and the citation test, with no whole check and no review (QA's rule of 11-21). One recap,
`docs/recaps/2026-11-21-design-skeleton.md`, added to at each landing.

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
      companies in Vietnam share, its modules added over time, not one trade's app); where each
      reader looks (a screen's coder: a part, the page base, a rule; a design-system coder: a
      value; never another screen or the legacy app); a gap
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
      spacing and use, its name in plain letters; inside a part, text takes a style, a `size` or
      `fw` on `Text` only where none fits, with a comment why. `TONES` in `tokens.ts`: danger red,
      success green, warning orange, info gray; a screen passes a meaning and a part reads a role,
      never a Mantine colour (not
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
- [x] **4. Every value by its use.** Spacing steps by what they separate; the widths the screens
      draw (440, 420, 240, 560, 320), one a use; icon sizes (14 px on 29 of 44, five others);
      corners and shadows; formats, each in its one place: money `useMoney`
      (`ui/src/parts/OrderParts.tsx#L23`), dates and times `ui/src/day.ts` (8 `new Intl.` in 5
      files: not yet). Case 8. _Done when:_ the gates exit 0. **17 min** (203's step 1).
      _Evidence:_ the step's commit. `GUIDELINE.values` gains a use line for each of the five
      spacing steps, the five widths (card 440, column 560, field 420, amount 320, date 240), the
      five icon sizes (inline 14, field 16, button 18, bar 22, mark 36), the five corners, the four
      shadows and the three formats (money, date, time), each typed over its table's keys
      (`SPACING`, `RADII`, and the new `WIDTHS` and `ICON_SIZES` in `tokens.ts`); Values draws each
      as a state (Spacing, Widths, Icons, Corners and shadows, Formats) in place of the old Gaps
      line. Recounted: the icons are 30 at 14 px of 45 (not 29 of 44), with five other sizes; the
      `new Intl.` outside `day.ts` and the tests are 5 `NumberFormat` in 4 files (8 in 5 files is
      with `day.ts`'s 3). Two notes say what is not yet (the screens write the widths and icon
      sizes as numbers; the 5 `new Intl.` sites). Reds on the Gallery test file, 15:10: case 8 on a
      width drawn one more than its table, and on an icon drawn with a corner's line; the
      typecheck on a corner with no line; green 41 of 41.
- [x] **5. One key, one value, the leftovers.** `TYPE` on `size` (a `Text`'s `size` also sets its
      line height, which `fz` drops; on a `Title`, `size: 'xs'` keeps the level's); `FRAME_VALUES`'
      `menu-size` and `link-size` one value; item 649; item 647's three theme weights read `WEIGHTS`
      (the 550 waits). Case 11. _Done when:_ the gates exit 0, `grep -c "fz:"
      ui/src/design-system/tokens.ts` prints 0. **10 min** (203's step 10, small leftovers).
      _Evidence:_ the step's commit. `TYPE.sectionLabel` reads `size`, the one `fz` left, so
      `grep -c "fz:"` prints 0; the frame's `link-size` and `menu-weight` are gone, its stylesheets
      reading `menu-size` and `weight-emphasis`; the theme's headings, page title and field label read
      `WEIGHTS`. Item 649 is fixed (the lint message and its comment, `WEIGHTS` on the Values entry,
      the gallery's `SIZES` renamed and its rule column on `TOKENS.primaryShade`, the repeated `fw`
      of the sign-in title dropped; `TYPE.body` stays, typed in the guideline); item 647's theme half
      is fixed, its 550 waits. Case 11 red on the Gallery's neighbour, `appTheme.test.tsx`, 15:21,
      with the three weights moved one off. The one `frameKept` snapshot moved by the heading's
      `size` (the same font size, written by its own variable); the pinned file unchanged.
- [x] **6. Landing 1.** The recap begun; the gallery's row and card in `docs/products.md`. No picture
      run: the pinned file holds its 0, and the gallery is looked at, not pictured (item 515).
      _Done when:_ the citation test exits 0. **15 min** (203's step 11). Your point 1.
      _Evidence:_ the step's commit. `docs/recaps/2026-11-21-design-skeleton.md` is begun, landing 1
      only, with markers for the whole check, the review before `main` and your look at point 1;
      the gallery's row in `docs/products.md` and its card now say Start here, Values by use and the
      entries' use lines. The step's own check: the citation test exits 0, the recap within 400
      words, prettier clean. Plan slip: step 5 changed five files under `ui/src/frame`,
      `ui/src/pages` and `ui/src/parts` (same resolved styles, the pinned file unchanged), so the
      "prints nothing" diff for steps after 1 cannot hold as written.
- [x] **6b. Landing 1's rework.** The review before `main`'s six blocks, its afters and the
      human's correction (a screen's coder picks parts only; the values are the design-system coder's
      reference). _Done when:_ the gates exit 0. **25 min** (the rows of steps 2 to 5, more text, less
      code).
      _Evidence:_ the step's commit. The charter names two readers, and a rule "a screen picks parts,
      never a style" stands second, held by review, `followed` item 651; the rule on colour says what
      its check holds (a shade, a white) and allows Mantine's own slots and an avatar's `initials`;
      the rule of three names its folders and "never to wrap a Mantine part alone"; the light rule names its check.
      The notes each name an open item (651 to 654 filed; a test reads every "not yet" against the
      listed items) and each draws in its own state of Values; the overlapping use lines are
      separated; the test titles of this piece say "213 case N". Reds, 16:16 to 16:17: the "not yet"
      test on a note that named no item, case 8's notes on a note drawn in another state.

**Landing 2: the parts a screen tells and offers with** (layer 3, each rule a part's contract),
from `pre-merge` at landing 1.

- [x] **7. The contract, and the parts that tell.** The contract's type in `guideline.ts`: the part,
      what it takes (each prop a content or a meaning, its line), what it decides (keys of the
      theme's tables), the rule or slot it serves, what holds it, whether the app follows it. Each
      entry draws it, Takes and Decides; a part to come has its entry, drawn from Mantine at the
      values it decides, `followed` naming the item that builds it. `WEIGHTS` and `SIZES` gain
      their use lines (item 654). The rules speak to their reader: the text rule and
      `tokens.ts#L27`'s "a screen picks a role" say a part, a screen's running text the theme's
      body; the rule of three's "never to wrap a Mantine part alone" becomes "never a part that
      decides nothing of Mantine's", its first six named (`StatusBadge`, then `FieldLabel`,
      `DetailField`, `SectionTitle`, `SectionCard`, `PageHeader`: `c1bb597b`, `199eea92`). Parts:
      `FormMessage`, `PageState`. Cases 13, 19 to 21. _Done when:_ the gates exit 0. **18 min**
      (213's step 3, a typed table the gallery draws).
      _Evidence:_ the step's commit. `guideline.ts` holds the contract's type (`Contract`: the part, its
      `takes`, its `decides` as keys typed over the theme's tables, what it `fixes` in its own code,
      its states, the rule it `serves`, what holds it, `followed`) and `GUIDELINE.contracts`, one row a
      part, the one table a redraw edits; the gallery's panel draws Takes and Decides under a part's
      Props, and the entries of `FormMessage` (Molecules) and `PageState` (Organisms) are drawn from
      Mantine at the tone and role of each kind and state their row names, `followed` item 651. The
      Values page gains its Weights and Sizes states, each with its use line (item 654 fixed). The text
      rule speaks to a part and a screen's running text, `tokens.ts#L27` to a part; the rule of three
      names its first six and says "never a part that decides nothing of Mantine's look". Reds on the
      Gallery and guideline test files, 17:02 to 17:03: case 13 on every kind drawn red and on every
      kind spoken as an alert; case 19 on a contract for an entry that does not exist and on a rule
      it does not serve; case 20 on a take named `variant`; case 21 on a key not in its table and on
      a weight with no use line (and the typecheck on it). `docs/products.md`'s gallery row no longer
      says landing 1 is not landed. Gates run on the committed tree, their verdicts in the report.
- [x] **8. The parts that offer, and a status.** `ActionButton`, its four meanings your yes, with the
      `docs/decisions.md` row; today's 109 buttons mapped (about 50 `default`, 6 `subtle`, 4
      `outline`, 9 red, the rest filled); one main action a page; a confirm is a page (item 306).
      `StatusBadge` moved to its contract, no screen reaching it; `StateBadge`
      (`ui/src/parts/OrderParts.tsx#L29`) and the staff chips
      (`ui/src/pages/client/StaffListPage.tsx#L141-L145`) not yet, item 651. Cases 14, 15. _Done
      when:_ the gates exit 0. **16 min** (213's step 2, a type and its entry).
      _Evidence:_ the step's commit. `GUIDELINE.contracts` gains `ActionButton` (Atoms, a part to come
      drawn from Mantine, `followed` item 655: takes its meaning, its words and its act; decides a
      danger's red and its label's weight; fixes its look by meaning, its size and its place) and
      `StatusBadge` (takes a `status`; decides its tone from `TONES`; fixes its word and its look);
      `GUIDELINE.buttons` maps each look the screens draw a `Button` in to one of the four meanings,
      and the charter gains the rule "a page has one main action" (held by review, followed item
      655). `StatusBadge` is rebuilt over `Status`, the order, request and person statuses, its tone
      and its word the part's (`STATUS_TONE`, a type error where a status lacks one), no screen
      reaching it; the gallery's entry draws the three groups of statuses and says it is built and
      the screens do not use it yet (item 651, which keeps `StateBadge` and the staff chips). The
      `docs/decisions.md` row for the four meanings and one main action a page is the human's "6. One
      main button per page, YES"; item 655 holds the move. Counts on the tree: 109 `Button`s outside
      the design system, 49 `default` and 1 more `default` in red, 40 filled and 4 filled in red and
      1 by a condition, 6 `subtle` (3, 2 gray, 1 red), 4 `outline` in red, 4 whose variant a
      condition picks: red on 11 in all, 9 where the `subtle` and `default` red are left out. Reds
      17:39 to 17:41: case 14 on the old `StatusBadge` (no `STATUSES`, no `status` prop), case 15 on
      a table with `outline red` taken out and case 14's contract check on a tone changed. No screen's
      code, no walk picture moved; the gallery gains the `ActionButton` entry.
- [x] **9. Landing 2.** The recap's lines, the gallery's card. _Done when:_ the citation test exits
      0. **3 min** (the recap kind's last three rows; 213's step 6 took 1). Your point 2.
      _Evidence:_ the step's commit. The recap holds landings 1 and 2 and names landing 3 (steps 10 to
      12) as to come; its two markers for the whole check and the review stay for the piece's last
      landing, its line says landings 2 and 3 are checked by `ui`'s and `visual`'s own checks and the
      citation test; point 1 is filled from your yes and point 2 is open. The products row and the
      gallery's card gain landing 2's parts.

**Landing 3: the page's parts** (layers 2 and 4), from `pre-merge` at landing 2.

- [x] **10. The page base, from parts.** A Pages group, one entry: the frame
      (`ui/src/frame/Shell.tsx#L130`: header, menu, phone bar below `sm`, padding `md`), then a page
      drawn from parts only on sample words, slot by slot. Parts: `PageShell`, `PageHeader`,
      `SectionCard`, `DetailColumns`, `FieldPair`, `BackLink` (the winner over the 14 by hand), the
      table part `ListTable` with a `WIDTHS` key for a table's least width (item 653); their code
      unchanged. Case 16. _Done when:_ the gates exit 0. **18 min** (213's step 3).
      _Evidence:_ the step's commit. The Pages group holds five entries: `The page base` (two plates,
      the frame drawn as its header, menu, page and phone bar, then a page from parts only: back
      link, title, the main action, a status, two blocks, a field pair, a table, a message) and
      `PageShell`, `DetailColumns`, `FieldPair` and `ListTable`; `PageHeader`, `SectionCard` and
      `BackLink` keep their levels. `GUIDELINE.contracts` gains the seven rows; `WIDTHS` gains `table`
      (640) with its use line, which `ListTable`'s contract decides (item 653's trigger; the part's code
      is unchanged and still writes 640); `Contract` gains `used`, so a built part the screens already
      draw says "Built and in use", and `BackLink`, which no screen draws, says it is not used yet.
      Plan slips found: `Shell.tsx#L130` holds (`<AppShell`), the 14 back links by hand hold (as a
      button or a link, none a `BackLink`), but the least widths sum to 12, not 14 (item 653 corrected);
      cases 1, 8 and 13 had counts and a subject that the new entries move (18 entries to 23, five
      widths to six, `BackLink` no longer the part with no contract: `FieldLabel` is). Case 16 red at
      18:03, before the code, on the Pages group being empty; no screen's code moved.
- [x] **11. Every other part, and a new kind of page.** `FieldLabel`, `DoorHeading`, `LogoTile`,
      `BrandBand`, `DetailField`, `SectionTitle`, `DoorCard`; each duplicate's winner named on the
      other's entry (`DoorCard` or `ui/src/pages/SignIn.tsx#L66`'s `SignInFrame`, `DetailField` or
      `FieldPair`). A kind of page is written at its first page, from the base's slots, judged by
      you before its second. Case 17. _Done when:_ the gates exit 0. **11 min** (213's step 1, a
      field on every entry).
      _Evidence:_ the step's commit. `GUIDELINE.contracts` gains the seven rows, so every part's entry
      (18 of the Atoms, Molecules, Organisms and Pages) draws Takes and Decides; `DoorCard`'s entry
      names `SignInFrame` (its own card, item 651), `DetailField`'s and `FieldPair`'s each name the
      other (the plan's "DetailField or FieldPair" read as the field and the row that holds two);
      `SectionTitle` and `DoorCard` follow item 651 (the icon's size passed by callers; no screen
      draws `DoorCard`). The charter gains two rules: a part's look and the feedback's route, the
      human's two answers of 18:08 and 18:09 (the decisions row), and a kind of page written at its
      first page; the design-system coder's line takes the feedback. Case 17 red at 18:17 on the
      entries' contracts and the charter's words, before the code; case 13's "part with no contract"
      is now Values. No screen's code moved.
- [ ] **12. Landing 3.** The recap's lines, the gallery's card; item 651's own text recounted part
      by part, the next milestone's list in its one home. _Done when:_ the citation test exits 0.
      **3 min**. Your point 3.

### The parts' contracts

| Part (step) | Takes from a screen | Decides from the theme | Entry |
| --- | --- | --- | --- |
| `FormMessage`, to come (7) | its kind (error, warning, success, info, saved first), its words | tone; spoken role (`alert` for error, warning, conflict, else `status`); full width, no margin, under its buttons, one at a time | Molecules, from `Alert` |
| `PageState`, to come (7) | loading; failed, its retry; forbidden; nothing; empty, its add act; not found | loader, message, retry button, least height, title style | Organisms, from `ui/src/frame/Loaded.tsx#L12`, `ui/src/pages/client/Notice.tsx#L6` |
| `ActionButton`, to come (8) | main, other, quiet or danger; words; its act | variant (filled, `default`, `subtle`, red filled at a delete's last step), size, weight | Atoms, from `Button` |
| `StatusBadge` (8) | a status, typed over `shared/src/orders.ts#L62`'s and `#L92`'s and archived or not | tone, word, look | Atoms |
| `PageShell` (10) | title, back link, status, actions, state, body | the header row's order and gaps, where a message and the main action sit | Pages |
| `PageHeader` (10) | title, actions | title style, alignment | Organisms |
| `SectionCard` (10) | icon (not its size), title, contents | border, padding, gap, icon size, tile | Organisms |
| `DetailColumns`, `FieldPair` (10) | main and side blocks; a row's fields | columns by width, gaps | Pages |
| `BackLink` (10) | address, words | arrow, size, colour, gap | Atoms |
| `ListTable` (10) | kind, columns, rows | least width, money column's side, hover | Pages |
| `FieldLabel`, `DoorHeading` (11) | words; title, subtitle | styles, gap | Atoms |
| `LogoTile`, `BrandBand` (11) | logo, alt; name, logo | tile size, corner, line; wash, line, weight | Atoms, Molecules |
| `DetailField`, `SectionTitle` (11) | label, value; icon (not its size), label | label style, a dash for none; icon size, tile | Molecules |
| `DoorCard` (11) | name, logo, contents | gradient bar, band, padding, width, shadow | Organisms |

Held by cases 19 to 21 for every row, and its step's case. Not yet, item 651: `PageShell` takes no
back link or status, and `SectionCard`'s and `SectionTitle`'s callers pass the icon's size;
`ListTable`'s least width, item 653.

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
| 13 | `FormMessage`'s and `PageState`'s entries draw each kind and state at its contract's tone and role | `Gallery.test.tsx` |
| 14 | `StatusBadge` takes every status the records carry, one tone and word each | the type over the shared unions |
| 15 | Every button variant a screen draws maps to one of `ActionButton`'s four meanings | `guideline.test.ts`, reading the screens |
| 16 | Each slot of the page base is an entry with a contract | `Gallery.test.tsx` |
| 17 | Every part's entry draws its contract | the type over the parts' names |
| 18 | `ui/CLAUDE.md` points to the guideline by a name the file declares | the citation test |
| 19 | Every contract names an existing entry and the rule or slot it serves | `guideline.test.ts` |
| 20 | No contract takes a style (colour, size, gap, weight, width, variant, corner); a built part that follows has its takes typed over its props | same, the typecheck |
| 21 | Every decides is a theme table's key; `WEIGHTS` and `SIZES` key each a use line | the types over the keys |

## What moves, and what must not

No screen: the pinned file (131 screens on ten colours) unchanged at every step, no walk picture
moved. The gallery moves, judged by you; no case is edited to fit a move.

## The next milestone: the screens moved to the guideline

Its own plan, one part a landing, each with your two picture runs: **1** the dialog at 600
(`TOKENS.dialogTitle` reads `WEIGHTS.emphasis`; items 647 and 644), which proves the runs; **2**
`FormMessage`, its 96 and the 88 lines finding a message by role (item 650); **3** `PageState`; **4**
`ActionButton`, the 109 buttons; **5** `StatusBadge`; **6** the page base: 41 titles, 18 action
rows, 14 back links, 14 tables; **7** the formats (item 652). About 50 machine minutes and two runs
a part, the dialog and the formats about 20.

## Earlier versions

**The second, moved by this third:** landings 2 and 3's rules became parts' contracts, on your
correction that a screen's coder picks parts only; a part to come gets its entry and contract now,
its code with its screens; items 653 and 654 came in; the steps' diff check dropped; your point 1
asked again.

## The human's points

1. **The floor, on the parts' shape (asked again).** Start here names two readers: a screen's coder
   picks parts and passes content and meaning, never a style; a design-system coder owns each
   part's look, from Values. Landings 2 and 3 give every part a contract. Would a screen's coder
   build a page from the parts' entries alone, with no style to choose, and would a design-system
   coder find each value's use? A no names the reader: step 6b, 3 or 4 reopens, or the contracts
   are redrawn before step 7.
2. **The parts that tell and offer (step 9).** `FormMessage`, `PageState`, `ActionButton` and
   `StatusBadge` each show what a screen gives (a message's kind and words; a page's state; main,
   other, quiet or danger; a status) and what each decides (colour, spoken role, place, variant,
   word). Does each read as the one way you want, nothing left for a screen to choose? A no names
   the part, and step 7 or 8 reopens.
3. **The page's parts (step 12).** The Pages group draws one page from parts only, each slot named
   (back link, title, status, actions, the body's blocks, the table, a state, a message, the main
   action), and every entry shows its contract. Is this the base a new page is built from, with no
   style chosen in the page? A no names the slot or the part, and step 10 or 11 reopens.

## The open items in reach

| Item | What this plan does |
| --- | --- |
| 629 | fixed, step 1 |
| 649 | closes, step 5 |
| 647 | its theme half, step 5; the 550 in the next milestone |
| 654 | step 7: a contract naming a weight or a size needs its use line |
| 653 | step 10: the table part's contract and `WIDTHS` key; the 14 screens' widths, next milestone |
| 651 | next milestone: the screens' move moves pictures and needs your runs; step 12 recounts it |
| 652 | next milestone: no part here writes a number; its place comes with the four sites it moves |
| 644, 650 | the next milestone |
| 306, 307 | written as rules, steps 8 and 2; both parked for their triggers |
| 498, 515, 641, 642, 645, 646, 648 | leave: no step touches them |
