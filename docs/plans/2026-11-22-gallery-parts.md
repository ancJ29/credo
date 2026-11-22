# The gallery's missing parts, its samples in Vietnamese first

## At a glance

What it is for: the campaign's second milestone, "the missing parts added to the gallery, each with
its use", for the staff of a small business in Vietnam, who read Vietnamese. Piece 230's list names
eleven parts the screens draw and the gallery lacks, and every sample is English. Here the samples
turn Vietnamese first, with a switch to English; then each part joins by the charter's rule of three:
five become parts of ours (a table, a panel, a menu row, a copy button, a tag), six are Mantine's own
as the theme already dresses them (fields with the filter bar, choices, the frame's menus, photos and
the QR code, links, a dialog). The cheapest path: the theme already decides most looks, and the
screens stay as they are. The price: about 126 machine minutes in three landings, no picture run, no
review, one look of yours at the end.

## The slice

One slice: the gallery, every sample in Vietnamese or English, and the eleven parts each with its
use, walkable in a browser when it ends. Each landing passes four stages: **1**, the cheap build (the
switch on the page base first; a part from its entry); **2**, `ui`'s and `visual`'s gates and the
citation test, `visual/src/resolved.pinned.txt` unchanged, since no screen moves; **3**, your one look
at step 11, landings 1 and 2 having none of their own, since a no there reopens one step; **4**,
ridge after the day's push, where the gallery ships in the app's bundle, its products row and card
updated at step 11.

**The screens stay.** No screen moves onto a new part here. Why: moving 79 fields, 33 panels, 15
tables and 9 links is piece 222's shape, about 360 machine minutes and two picture runs a landing, past
a day; the gallery, which no walk draws, needs no picture run and no review (QA's rule 5); and the
pages milestone draws these parts next, so each has a caller. The move is a milestone behind the
pages; item 651 is its record, and each new contract's `followed` names it.

**Not in it:** the screens' move (item 651); the page shapes (milestone 3); dark mode (item 307); a
confirm dialog part (item 306).

## The brief, checked

Recounted at `2ae77051`. Each count below is `n` with its pattern, files after "in"; S, the screens,
leaves out the design system, the parts of ours, the mock and the tests, so a count stays the
screens' once the parts draw Mantine's own:

```bash
S=(-- 'ui/src/*.tsx' ':!ui/src/design-system' ':!ui/src/components' ':!ui/src/mock' ':!*.test.*')
n() { echo "$1 $(git grep -ohP "$1" "${S[@]}" | wc -l) in $(git grep -lP "$1" "${S[@]}" | wc -l)"; }
```

Where piece 230's detail differs, or the brief's premise does:
- Tables: `n '<Table(?![\w.])'` reads 15 in 12, not 16: the detail's sixteenth is a type,
  `Promise<Table>` in `ui/src/importFile.ts#L7`.
- Panels `n '<Paper(?![\w.])'` 33 in 23, links `n '<Anchor(?![\w.])'` 9 in 8, badges
  `n '<Badge(?![\w.])'` 5 in 4: the detail's 35 in 25, 11 and 6 counted the parts' own (`SectionCard`,
  `DoorCard`, `BackLink`'s two, `StatusBadge`). The orchestrator's 54 fields and 45 panels in all of
  `ui/src` add the gallery's 2 and the design system's 10. The other counts hold.
- The filter bar is drawn twice (`ui/src/pages/client/StaffListPage.tsx#L133-L215`,
  `ui/src/pages/client/DeliveriesPage.tsx#L40`): under three, so no part. `ProofPhoto` is
  `ui/src/parts/OrderParts.tsx#L239`, its image `#L252`.
- No walk, `visual` or `scripts` test reads the gallery (`git grep -n -i gallery -- visual walk
  scripts` finds nothing), so no walk picture moves. `scripts/src/words.test.ts` reads the
  dictionaries (755 keys, `#L43`); `scripts/src/fake.test.ts`'s first case reads the built bundle,
  the gallery's chunk with it, and refuses the data set's company there (`#L55`). So the samples go in
  neither the dictionary nor the data set.
- Twelve finders in `ui/src/design-system/Gallery.test.tsx` read a sample's English word (`#L244`,
  `#L245`, `#L260`, `#L261`, `#L951-L953`, `#L1007-L1017`, `#L1086`, `#L1087`, `#L1088`, `#L1092`,
  `#L1100`, `#L1121`); nine read Vietnamese and hold under the default (`#L231-L232`, `#L257-L259`,
  `#L267-L270`). `ui/src/App.test.tsx`'s gallery cases find only the "Design system" heading.

## Each part, and the rule that decides it

The charter's rule of three (`ui/src/design-system/guideline.ts`, the rule "A part joins
`ui/src/components/` at its third use"): a part of ours at its third use, never one that decides
nothing of Mantine's look, and every look decided in the design system before its first use. The
theme (`ui/src/design-system/appTheme.ts`'s `themeOf`) already dresses the fields, the tick box, the
badge, a table row under the pointer and the dialog; `cssVariables.ts`'s `credoVariables` the link.

| Part | Today, `n` pattern and count | It becomes | The rule that decides |
| --- | --- | --- | --- |
| Text field | `<TextInput(?![\w.])` 52 in 23, `<PasswordInput(?![\w.])` 8, `<NumberInput(?![\w.])` 3, `<Textarea(?![\w.])` 4, `<NativeSelect(?![\w.])` 12 in 8 | Fields, Mantine's own | it would decide nothing the theme's `Input`, `InputWrapper` and `PasswordInput` do not |
| Filter bar | the staff list's search and three drop-downs, the deliveries' day (the brief's list) | a state of Fields | two uses |
| Choices | `<Checkbox(?![\w.])` 10 in 3, `<Switch(?![\w.])` 4, `<Radio\.Group(?![\w.])` 2, `<SegmentedControl(?![\w.])` 1 | Choices, Mantine's own | the theme dresses the tick box; nothing more to decide |
| Table | `<Table(?![\w.])` 15 in 12; `ta="right"` 32 in 8; `<Table\.Tfoot>` 3; `<Table highlightOnHover` 6 | `DataTable`, a molecule drawn in `TableScroll` | 15 uses; no part decides a number's side, a total line or which rows light |
| Panel | `<Paper(?![\w.])` 33 in 23, `<Paper withBorder p="md"` 24; `<Title order=\{3\}` 15 in 6 | `Panel`, an organism | 33 uses, each writing its own edge and padding |
| Menu tile | `className=\{classes\.moreRow\}` 3 in 1; `<Menu(?![\w.])` 2 in 1 | `MenuRow`, an atom; Menus, Mantine's own | three rows, their look a screen stylesheet's (`ui/src/frame/frame.module.css`'s `.moreRow`); two menus |
| Copy button | `<CopyText(?![\w.])` 5 in 5; `rightSectionWidth=\{96\}` 4 | `CopyText` joins `components/molecules/`, taking `field` | five uses in `ui/src/parts/`; four draw one read-only field round it, its face `styles=\{READ_ONLY\}` 9 in 7 |
| Tag | `<Badge(?![\w.])` 5 in 4: four light, no status (`OperatorsPage.tsx#L55`, `ServicesPage.tsx#L174`, `#L186`, `PermissionEditor.tsx#L72`), one the frame's | `Tag`, an atom | four uses, each picking its look and colour |
| Code and photo | `<Image(?![\w.])` 5, `<FileButton(?![\w.])` 2, `<QrCode(?![\w.])` 1, `<PhotoPanel(?![\w.])` 1, `<ProofPhoto(?![\w.])` 2 | Photos and codes, Mantine's own and `ui/src/parts/QrCode.tsx`'s `QrCode` | each under three |
| Text link | `<Anchor(?![\w.])` 9 in 8 | Links, Mantine's own | the theme writes its colour (`--mantine-color-anchor`) |
| Dialog | `<Modal(?![\w.])` 1 (`ui/src/parts/SessionEnded.tsx#L27`) | Dialog, Mantine's own | one use; the theme's `Modal` decides it |

Mantine's own entries sit in Foundations under a kind, "Mantine's own", which the present entry
"Mantine, in the theme" joins, its address unchanged; a part of ours sits in its level with its
contract, its look read from the theme's tables, `followed` item 651.

## The samples in Vietnamese

- **Default and switch.** The gallery opens in Vietnamese. A "Sample language" picker, Mantine's own
  as the colour theme's is, sits beside it in the right column and on the no-part page, its names
  `ui/src/i18n/index.ts`'s `LANGUAGE_NAMES`, remembered as the theme is (`Gallery.tsx`'s `remembered`
  and `remember`); a stored value no language has opens on Vietnamese.
- **Where the words come from.** The stage is drawn inside one `I18nextProvider` of `createI18n` in
  the picked language. A sample that says what a screen says reads the dictionary by its key, so the
  gallery shows the very word and length a phone meets; a sample no screen says (a person, a shop, a
  message's sample) reads `ui/src/design-system/samples.ts`, one table of both languages, importing
  nothing of the data set. The gallery's own words (names, descriptions, use lines, props, the
  charter, the values' notes, the frame's slot names) stay English: they are the coder's.
- **What changes.** The two English instances (`ui/src/design-system/entries.tsx#L64`,
  `PageBase.tsx#L17`) and `PageBase.tsx#L107` and `#L192`'s `language="en"` go;
  `Contract.tsx#L65`'s `WORDS` and every entry whose plates hold words read by language, 20 of the
  25: all but the charter, the values, On the brand, `LogoTile` (its caption is the gallery's) and
  `BrandBand` (a company's name, one in both). The values' Formats state, which draws no value today
  (`Values.tsx#L288-L296`), draws a price, a number's marks, a day and a time through `number.ts` and
  `day.ts`.

## The order, and why

**1**, the samples: every new entry is drawn in them, and you asked for them first. **2**, what the
pages draw, in the detail's order: fields with the filter bar, the table, the panel, the choices; the
form, import, day-sheet and settings pages need them (piece 230's detail, "For milestones 2 and 3"),
so landing 2 on `pre-merge` lets the pages milestone start. **3**, the menu row and the copy button,
which the menu and confirm pages need, then the tag, photos and codes, links and the dialog, which no
page shape needs.

## What each landing touches

| # | Files | Tests that follow | Pictures |
| --- | --- | --- | --- |
| 1 | `Gallery.tsx`, `entries.tsx`, `PageBase.tsx`, `Contract.tsx`, `Values.tsx`, a new `samples.ts`, all in `ui/src/design-system/` | the 21 sample finders above, read by key | none: the pinned file unchanged |
| 2 | `entries.tsx`, `guideline.ts`, `components/molecules/DataTable.tsx`, `components/organisms/Panel.tsx`, their tests | `Gallery.test.tsx#L102` (Foundations 3, now 5) and `#L1142` (20 parts, now 22) | none |
| 3 | `components/atoms/MenuRow.tsx` and `Tag.tsx`, `CopyText.tsx` moved, five imports, `entries.tsx`, `guideline.ts` | the same two counts (9 and 25); `scripts/src/counts.test.ts`, as a file moves | none |

## The steps

Each step's gates: `pnpm --filter @credo/ui check`, `pnpm --filter @credo/visual check` and the
citation test, each case seen red once, `visual/src/resolved.pinned.txt` unchanged. Sizes are the
same shapes' last rows: the gallery's provider 13 (piece 215's fix), words across the entries 14
(213's step 4), entries with no code 9 (222's step 14), parts from their entries 12 (222's step 15), a
part and its importers 14 (222's step 7), five entries 14 (213's step 10), a recap 5 (213's step 12).

**Landing 1: the samples in Vietnamese.**

- [x] **1. The switch and the base.** The picker and its remembered pick, the stage in the picked
      language's provider, `samples.ts`; the page base's two states and `ListTable` drawn by
      language. Cases 1, 2. _Done when:_ the gates exit 0 and `git grep -n "createI18n('en')" --
      ui/src/design-system/PageBase.tsx` finds nothing. **13 min**.
      _Evidence:_ `Gallery.tsx` holds the "Sample language" picker beside the colour theme (Vietnamese
      first, remembered under `credo-gallery-language`, an unknown value opening on Vietnamese) and the
      stage in one `createI18n(language)` provider; `samples.ts` holds the words no screen says;
      `PageBase.tsx` keeps no `createI18n('en')` and draws its two states and `ListTable` by language.
      Case 1 red once each for the default, the kept pick and the fixed provider; case 2 red once each
      for the back link's key, the samples table and `ListTable`'s language, green with none; the
      `ui` gate and the two `scripts` tests (`words.test.ts`, `fake.test.ts`) exit 0 on this tree.
- [x] **2. Every entry, and landing 1.** The other entries' words by language, the Formats state's
      four values; the finders read by key; the recap begun. Cases 3, 4. _Done when:_ the gates exit
      0, `git grep -n -E "createI18n\(.en.\)|language=.en." -- ui/src/design-system` finds nothing,
      and `pnpm --filter @credo/scripts exec vitest run src/words.test.ts src/fake.test.ts` exits 0.
      **14 min**.
      _Evidence:_ every entry whose plates hold words draws them by language: the sign-in and link
      states, the door heading, back link, field label, detail field, section title and card, page
      header, status chips, buttons and rows, messages, page states and the table's headings, each
      reading the dictionary by key where a screen says it and `samples.ts` where none does, and
      the Mantine entry's own button, field and badge; the stage's one provider replaces
      `entries.tsx`'s English instance, and `useLanguage` moved to `samples.ts`. The Formats state
      draws a price, a number's marks, a day and a time in the picked language. The 4 cases
      whose English finders went red on the new words read by key; case 3 red once for
      a heading that followed the pick, case 4 red once each for the day, the marks, the price and
      the time written in the wrong language; the `ui` gate and the two `scripts` tests exit 0 on
      this tree, and the grep finds nothing.

**Landing 2: what the pages draw.**

- [x] **3. Fields.** The kind "Mantine's own"; Fields: text, password, number, long text and
      drop-down, each with a label, a hint, an error and read-only, and the staff list's filter bar.
      Case 5. _Done when:_ the gates exit 0. **9 min**.
      _Evidence:_ the new entry Fields sits in Foundations under the kind "Mantine's own", which "Mantine,
      in the theme" joins at its address; its six states draw text, password, number, long text and
      drop-down each as a label with a hint, with an error and read-only, and the staff list's filter bar
      of a search and three drop-downs, the words read from the dictionary by key where a screen says
      them and from `samples.ts` where none does. Case 5 red once each for the read-only face dropped,
      the error dropped and the filter bar's position drop-down dropped, green with none; the `ui` gate
      exits 0 on this tree.
- [x] **4. The table.** `DataTable` in `components/molecules/`: takes columns (each a heading, and
      whether it holds a number: a meaning), rows and a total (content); decides a number's side, the
      total line at `WEIGHTS.emphasis`, every row lit under the pointer at the theme's colour, drawn
      in `TableScroll`. Its entry (an order's lines with a total; a list whose name opens a page) and
      contract. Cases 6, 13, 14. _Done when:_ the gates exit 0. **12 min**.
      _Evidence:_ `components/molecules/DataTable.tsx` takes columns (a heading, and whether it holds a
      number), rows (a cell for each column, a name that opens a page being a link) and a total; it sets
      a number column's heading, cells and total at the right, the total line at `WEIGHTS.emphasis`,
      every row lit under the pointer at the theme's colour, all in `TableScroll`. Its entry
      sits among the molecules with two states, an order's lines with a total and a list whose names
      open a page, its words read by key where a screen says them and from `samples.ts` where none does;
      its contract's takes are a meaning and two contents, and `DataTable` and `ListTable` name each
      other. Case 6 red once each for the heading's side, the body cells' side, the total cells' side,
      the total's weight, the rows' lighting and the frame, a link cell's navigation red once; case 13
      red once each for an entry without its contract and a take that is a style; case 14 red once each
      for either entry not naming the other, green with none; the `ui` gate exits 0 on this tree.
- [x] **5. The panel.** `Panel` in `components/organisms/`: takes a title and what it holds (content);
      decides its edge (`ROLES.border`), its padding and gap (`SPACING.md`), the title a level-3
      heading, none where none is given. Its entry and contract; `SectionCard`'s "Content with no
      title" line (`entries.tsx#L645`) names `Panel`. Cases 7, 13, 14. _Done when:_ the gates exit
      0. **12 min**.
      _Evidence:_ `components/organisms/Panel.tsx` takes an optional title and what it holds; it draws a
      bordered block at `ROLES.border`, its padding and the gap under its title at `SPACING.md`, the
      title a level-3 heading and no heading where none is given. Its entry sits among the organisms
      with two states, a titled panel and an untitled one, its words read by key where a screen says
      them and from `samples.ts` where none does; its contract's takes are two contents, and `Panel`
      and `SectionCard` name each other (`SectionCard`'s "Content with no title" line now names
      `Panel`). Case 7 red once each for the edge, the padding, the gap, the title's level, a heading
      drawn with no title and the title under its content; case 13 red once each for an entry
      without its contract and a take that is a style; case 14 red once each for either entry not
      naming the other, green with none; the `ui` gate exits 0 on this tree.
- [x] **6. Choices, and landing 2.** Choices: a tick box and a list of them, a switch, a one-of-many
      list and the segmented pick, as the settings page and the permission editor draw them; the
      recap's line. Case 8. _Done when:_ the gates exit 0 with Foundations at 5 and 22 parts. **9
      min**.
      _Evidence:_ the new entry Choices sits in Foundations under the kind "Mantine's own" with four
      states: a list of tick boxes (the settings page's languages) and a permission's tick box with its
      "needs" line, the three switches, the six-palette one-of-many list and the permission editor's
      segmented pick, the words read by key. Foundations now counts 5 and the gallery 29 entries, and
      the parts stay 22 (Choices is Mantine's own, no part of ours). Case 8 red once each for the
      first switch drawn off, the languages' tick dropped, the palette's pick dropped, the segmented
      pick on another value, the "needs" line dropped and a sixth palette missing, green with none; the
      recap's landing 2 line is written; the `ui` gate exits 0 on this tree.

**Landing 3: the rest.**

- [x] **7. The menu row, and menus.** `MenuRow` in `components/atoms/`: takes words, an icon and an
      address or a press; decides its padding, gap and size, the line between rows and its hover, as
      `.moreRow` and `.go` draw them, which stay `MorePage`'s until the move. Menus: the frame's
      language and person menus, opened by a press. Cases 9, 12, 13. _Done when:_ the gates exit 0.
      **12 min**.
      _Evidence:_ `components/atoms/MenuRow.tsx` takes an optional icon, an address or a press and its
      words; it draws the icon at 20, the words and, only where it opens an address, an arrow at
      `ICON_SIZES.field`, and its stylesheet `MenuRow.module.css` holds the gap and padding at
      `SPACING.sm` and `SPACING.md`, the menu size, the line between rows and the lit row, as
      `.moreRow` and `.go` draw them, which stay `MorePage`'s. Its entry sits among the atoms with
      two states, a way on and an act, and its contract; the new entry Menus sits in Foundations
      under "Mantine's own" with the frame's language menu and person menu, each closed until a press
      opens it. Foundations now counts 6, the gallery 31 entries and the parts 23. Case 9 red once
      each for the arrow's size, the icon's size, the address, the press, the gap, the line, the
      hover and the arrow drawn on the wrong row; case 12 red once each for a menu open with no press,
      the picked language's mark and the person menu's item; case 13 red once for an entry with
      no contract and once for a take that is a style; the two entries naming each other red once;
      all green with none, each file diffed against its backup; the `ui` gate exits 0 on this tree.
- [x] **8. The copy button.** `git mv ui/src/parts/CopyText.tsx ui/src/components/molecules/`, its
      five imports with it; it takes `field` (content: the label of a read-only field that shows the
      value in the code face, the button at its right, as `ClientMade.tsx#L21`'s `Field` draws it), its
      code face one value of `tokens.ts`; its entry (alone in a row; in its field), contract (`used`)
      and test. Cases 10, 13, 16. _Done when:_ the gates exit 0 and `pnpm --filter @credo/scripts exec
      vitest run src/citations.test.ts src/counts.test.ts` exits 0. **14 min**.
      _Evidence:_ `CopyText` moved by `git mv` from `ui/src/parts/` to `ui/src/components/molecules/`
      (a rename in the commit); `git grep -nP "^import \{ CopyText \} from" -- ui/src` found five lines
      before (four `'../../parts/CopyText'`, one `'./CopyText'`) and five after, all
      `components/molecules/CopyText`, and no screen's markup moved. It takes `field` (content): given
      one, it draws a read-only field of that label with the value in the code face, `TOKENS.codeFace`
      (a new value of `tokens.ts`, which joins the tables a contract decides from), the button at its
      right; none draws the button alone. Its entry sits among the molecules with two states, alone in
      a row and in its field, and its contract (`used`, `followed` item 651); the entry names
      `ActionButton` for a button that does more than copy. Foundations stays 6, the gallery now holds 32 entries and the parts 24.
      Case 10 red once each for the read-only face dropped, the value copied wrong, the copied word
      dropped, the code face another font, the field's label dropped, the button left out of the field
      and the gallery's field state not drawn; case 13 red once each for an entry with no contract (the
      two gallery suites failing whole) and a take that is a style; case 16 red once for the button's
      name losing what it copies, which reddens the four operator screens' own tests and `ClientMade`'s;
      green with none, each file diffed against its backup; the `ui` and `visual` gates, the citation,
      counts, words and fake tests exit 0 on this tree.
- [x] **9. The tag.** `Tag` in `components/atoms/`: takes words and a meaning (the brand's, or a tone
      of `TONES`); decides the light look and the chip's size (`SIZES.chip`). Its entry (a colleague's
      "you", a permission's "custom", a build that differs, a service's state) and contract. Cases
      11, 13, 14. _Done when:_ the gates exit 0. **12 min**.
      _Evidence:_ `components/atoms/Tag.tsx` takes `meaning` (`brand`, the default, or a tone of
      `TONES`) and its words; it draws Mantine's light badge at `SIZES.chip`, no colour set for the
      brand and `TONES[meaning]` for a meaning. Its entry sits among the atoms with two states, in
      the brand's tone (a colleague's "you", a permission's "custom") and in a meaning's tone (a
      service's healthy, unresponsive and unreachable, a build that differs), and its contract
      (`followed` item 651, no screen draws it yet: the four light badges stay in their screens, case
      15). Counts recounted on this tree as the plan names them: `TONES` four keys, `SIZES.chip` 12,
      four light badges with no status in `OperatorsPage.tsx#L55`, `ServicesPage.tsx#L174` and
      `#L186`, `PermissionEditor.tsx#L72`, as planned. The gallery now holds 33 entries and the parts
      25; `StatusBadge`'s entry names `Tag` as its winner for a word that is no status, and `Tag`'s
      names `StatusBadge`. Case 11 red once each for the badge filled, the size dropped, the brand
      drawn in a tone, a meaning drawn in the wrong tone and a gallery sample in the wrong tone; case
      13 red once each for an entry with no contract (whole suites failing), a take that is a style
      and a contract with no entry; case 14 red once each for each entry's naming of the other left
      out; green with none, each file diffed against its backup; the `ui` and `visual` gates, the
      citation, words and fake tests and the pinned file's diff exit 0 on this tree (22:04 to 22:10).
- [x] **10. Photos and codes, links, the dialog.** A person's photo with its choose button, a
      delivery's proof, a company's logo, the sign-in QR code; a name link in a row, a phone link, a
      link in a sentence; a dialog a press opens, in the ended session's words. Item 507 closes. Case
      12. _Done when:_ the gates exit 0 with Foundations at 9 and 25 parts. **14 min**.
      _Evidence:_ three new entries sit in Foundations under "Mantine's own", no part of ours: Photos and
      codes (`design-system/Photos.tsx`: a person's photo at 96 with its choose button and the avatar
      where none is held, a delivery's proof under its title, a company's logo at 48 with its choose
      button, the sign-in QR code, the words read by key), Links (`Links.tsx`: a name link in a row, a
      phone link, a link in a sentence) and Dialog (`Dialog.tsx`: a button that opens the ended
      session's dialog, in its title, text and two ways on, each of which closes it). Foundations now
      counts 9, the gallery 36 entries and the parts stay 25. Counts recounted on this tree: `<Image` 5,
      `<FileButton` 2, `<QrCode` 1, `<PhotoPanel` 1, `<ProofPhoto` 2 and `<Modal` 1 as planned; `<Anchor`
      is 11 in 9 files outside the gallery (not 9 in 8: `BackLink` writes two and the staff list two),
      and the sites the samples copy are `ListTable`, `MyDeliveryPage#L25` and `DeliveryPage#L98`.
      Case 12 red once each for the photo's choose button worded as its hint, the QR code's name
      worded as the link's, the phone link's address keeping its spaces and the dialog's press opening
      nothing, green with none, each file diffed against its backup; no screen moved. Item 507 closes.
- [x] **11. The recap, and the look.** The recap closed; the gallery's row and card in
      `docs/products.md` name the samples' languages and the new parts; item 651 gains the new parts'
      site counts, item 515 the line below. Your points 1 to 3, together. _Done when:_ the citation
      test exits 0. **5 min**.
      _Evidence:_ the recap holds landing 3 (steps 7 to 10) with a marker for landing 3's checks on
      `pre-merge` and one for your look, neither yet known; the gallery's row and card in
      `docs/products.md` name the samples' languages and the new parts, its state saying landing 3 is
      on `gallery-parts`; item 651 gained the five parts' site counts, each with its grep beside it
      (`<Table` 15 in 12, `<Paper` 33 in 23, `moreRow` 3 in 1, `<CopyText` 5 in 5, `<Badge` 5 in 4),
      item 515 its line; no box is left unticked but this one, and the citation test exits 0 on this
      tree.

## The cases

| # | The case | Held by |
| --- | --- | --- |
| 1 | The samples are Vietnamese first and English once picked; the pick is kept, and an unknown one opens on Vietnamese | `Gallery.test.tsx` |
| 2 | A sample a screen says reads the dictionary by key; one no screen says reads `samples.ts` | `Gallery.test.tsx` |
| 3 | The gallery's own words stay English whatever the pick | `Gallery.test.tsx` |
| 4 | The Formats state draws a price, a number's marks, a day and a time in the picked language | `Gallery.test.tsx` |
| 5 | Fields draws five kinds with a label, a hint, an error and read-only, and the filter bar | `Gallery.test.tsx` |
| 6 | A number column and the total sit at the right; every row lights under the pointer | `DataTable.test.tsx` |
| 7 | A panel draws its edge and padding, its title over what it holds, no heading where none is given | `Panel.test.tsx` |
| 8 | Choices draws the tick box, the switch, the one-of-many list and the segmented pick | `Gallery.test.tsx` |
| 9 | A menu row draws its icon, words and way on, a line between rows; it opens its address or acts | `MenuRow.test.tsx` |
| 10 | The copy button copies its value and says the copied word; given a field, the value shows read-only beside it | `CopyText.test.tsx` |
| 11 | A tag draws its words light at the chip's size, in the brand's tone or its meaning's | `Tag.test.tsx` |
| 12 | Menus, photos and codes, links and the dialog draw Mantine's own; the dialog opens on a press | `Gallery.test.tsx` |
| 13 | Each new part has its entry in its level and a contract whose every take is a content or a meaning | `Gallery.test.tsx`'s cases 4 and 17, `guideline.test.ts` |
| 14 | Each pair's winner is named on the other's entry: `Panel` and `SectionCard`, `DataTable` and `ListTable`, `Tag` and `StatusBadge` | `Gallery.test.tsx` |
| 15 | No step moves a screen | `visual/src/resolved.test.ts`, the pinned file unchanged |
| 16 | The five screens that copy draw the same from the part's new home | their own tests, unchanged |

## Checks before `main`

**The whole check:** no landing calls it. Each touches `ui` alone (and `.md`), no file in
`ui/package.json`'s `exports` (`src/importDemo.ts`, `src/mock/index.ts`, `src/scene.ts`,
`src/i18n/index.ts`), no root config, no lockfile. A landing's check on `pre-merge` is `ui`'s and
`visual`'s gates and the citation test, landing 1's with step 2's two `scripts` tests and landing 3's
with `counts.test.ts`; the day's push gets its own whole check, as QA says.

**The review before `main`:** none of its own. Rule 5: a gallery part moves no screen, so its check
is its gates and your look; the copy button's move edits five import lines, and the pinned file holds
that no screen moved. If `pre-merge` holds other work worth a review when `main` moves, that one
review reads these commits with it.

## The human's points

Asked together at step 11, one look: the gallery opened by `pnpm fake` in the piece's worktree, at
`/48b74d079/gallery` on the address it prints, on a computer; on ridge after the push. The work goes
on past it; a no reopens its step.

1. **The samples in Vietnamese (step 2).** Every sample opens in Vietnamese: the buttons, messages,
   tables, names and amounts a staff member reads, in the app's own words; a picker beside the colour
   theme turns them English, the descriptions staying English for the coder. Do they read as your
   staff would read them? A yes keeps Vietnamese first; a no names the entry, and step 1 or 2
   reopens.
2. **The five new parts (steps 4, 5, 7, 8, 9).** The table, its numbers and total at the right and
   its rows lit under the pointer; the framed panel; the phone menu's row; the copy button in its
   field; the small tag; each with when to use it. Does each look the way the screens should draw it?
   A yes keeps it for the screens' move; a no names the part, and its step reopens.
3. **Mantine's own, as the theme dresses it (steps 3, 6, 7, 10).** Fields with a hint and an error,
   the filter bar, the choices, the frame's menus, a photo and the QR code, links, a dialog a press
   opens. Does each read as the app's own? A yes keeps them; a no names the entry, and its look is
   decided in the theme at its step, which moves every screen that draws it.

## The open items in reach

| Item | What this plan does |
| --- | --- |
| 507 | closes: its table half at step 4, its dialog at step 10 |
| 651 | stays: the five contracts name it; step 11 adds their site counts; its move is the milestone behind the pages |
| 515 | stays parked: its trigger, a change to a part no walk shows, fires here, but this look is the gallery itself, and no yes is kept against a picture; step 11 says so in the item |
| 555 | not in reach: the new parts sit in the gallery's chunk, which only its address loads (`ui/src/App.tsx#L45`) |
| 306, 307, 505 | stay: the dialog entry is Mantine's own, not a confirm part; light only; each new file is read as the others are |
