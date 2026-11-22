# The gallery's missing pages, the phone's drawn at its width

## At a glance

What it is for: the campaign's third milestone, "the missing pages added to the gallery", for the
staff of a small business in Vietnam and the driver on a phone. The gallery shows one kind of page
today, a record's. It gains eight, each drawn from its parts with what "a new page of this kind must
have": the list, the driver's phone page, the form, the day sheet, the import, the menu, the confirm
and the settings page. A phone page is drawn 390 px wide in a frame whose breakpoints are the
phone's, on the computer the gallery is for. The cheapest path: the mock's frame already draws a
screen at a phone's width; five pages draw parts in `main`, three wait for piece 231's last landing.
The screens stay. The price: about 97 machine minutes in two landings, one whole check, no picture
run, no review, one look of yours.

## The slice

One slice: the gallery's Pages group, every kind of page the app's screens are, walkable in a
browser when it ends. Four stages a landing: **1**, a page entry from its real first screen; **2**,
`ui`'s and `visual`'s gates and the citation test, the pinned file unchanged, landing 1 with the
whole check; **3**, your one look at step 10; **4**, ridge after the day's push, where the gallery
ships in the app's bundle.

**The screens stay.** Why: the charter's rule ("A kind of page is written when its first page is
built … and a person looks at it before a second page of that kind is built", `guideline.ts`) asks
your look first; a screen's move costs walk pictures, a picture run and a review (QA rule 5), past a
day; and the list page's first screen already is the shape (`ListPage.tsx#L25-L51`). The move is
item 651's, the milestone behind.

**Not in it:** the colour names and the empty Rules group (their piece, ahead); the lists' cards at
the phone width on the screens (a new item); dark mode (307); a confirm dialog (306).

## The brief, checked

Recounted at `e4c0505b`, over the screens with no tests:

```bash
S=(-- 'ui/src/pages/*.tsx' 'ui/src/parts/*.tsx' ':!*.test.*')
n() { echo "$1 $(git grep -ohP "$1" "${S[@]}" | wc -l) in $(git grep -lP "$1" "${S[@]}" | wc -l)"; }
```

- **The day sheet is not a customer a block** (piece 230): its blocks are a driver each
  (`DeliveriesPage.tsx#L60`) or a part of one driver's day (`DriverDayPage.tsx#L128`, `#L139`,
  `#L148`, `#L183`, `#L208`), and its one number field is the cash handed in (`#L186`), not a
  quantity. Both pages are the office's.
- **The driver's phone pages are two.** The memo adds `DriverDayPage`, whose route is the office's
  (`ClientApp.tsx#L336`); the phone's are `#L306` and `#L310`.
- **The confirm page's last press is red in two of five.** `n 'meaning="danger"'` reads 3 in 2
  (`DeleteClientPage.tsx#L122`, `#L155`, `DeleteOperatorPage.tsx#L81`); the move, the root password
  and the link end on a main (`MoveClientPage.tsx#L221`, `RootPasswordPage.tsx#L151`,
  `OperatorLinkPage.tsx#L110`), the last two on a value to copy (`RootPasswordPage.tsx#L104`,
  `OperatorLinkPage.tsx#L89`).
- **These hold:** `n '<ListTable(?![\w.])'` 1 in 1 (`ListPage.tsx#L48`); `n 'hiddenFrom="sm"'` 1 in
  1 (`StaffListPage.tsx#L243`); `n 'meaning="main" submit'` 11 in 11, the seven forms among them;
  `n 'accept="\.xlsx"'` 2 in 2; `n 'className=\{classes\.moreRow\}'` 3 in 1.
- **Item 662's line is `Settings.tsx#L147`**, not `#L150`.
- **No walk reads the gallery:** `git grep -n -i gallery -- visual walk scripts` finds nothing.
- **The mock's `Frame` cannot be drawn in the gallery as it is**: it starts a `MemoryRouter`
  (`ui/src/mock/Frame.tsx#L38`), which react-router 8.4 refuses inside the gallery's router.

## Each page, its screens and its parts

Each page is an entry in Pages under a new kind, "Kinds of page", drawn from parts only, its words
read by key where a screen says them and from `samples.ts` where none does, with one use line and
its "must have" lines. Its parts are in the gallery in `main` unless marked L3 (piece 231's landing
3) or missing.

1. **The list page.** Screens: `ListPage.tsx#L25-L51`, `OrdersPage.tsx#L57`,
   `StaffListPage.tsx#L276`, `ClientsPage.tsx#L52`, `OperatorsPage.tsx#L37`, `PasskeysPage.tsx#L91`.
   Parts: `PageShell`, `ActionRow`, `ActionButton`, `ListTable`, `DataTable`, `StatusBadge`,
   `PageState`, Fields' filter bar, `Panel`. States: a list; filtered, with a status; empty;
   loading; failed; at the phone width. Must have: the title with its acts beside it, the add the
   main; a kind's records in `ListTable`, any other table in `DataTable`; a status as a
   `StatusBadge` column; empty said by `PageState` with its add; at the phone width a card a row, the
   name and its chip first, the other columns as captions.
2. **The phone page.** Screens: `MyDeliveriesPage.tsx#L28-L62`, `MyDeliveryPage.tsx#L94-L161`.
   Parts: `PageHeader`, `PageShell`, `Panel`, `DataTable`, `StatusBadge`, `FormMessage`,
   `ActionButton`; a photo and a phone link, Mantine's own. Missing: an address on `Panel`, as the
   driver's card is one link (`MyDeliveriesPage.tsx#L38-L46`). States: the driver walk's six
   (`walk/specs/driver.spec.ts#L192-L233`). Must have: the phone's width; one main press a state,
   under what it acts on, the other under it; the money to collect in bold under the goods; every
   press at least 36 px tall, today's least (`ActionButton.tsx#L38`'s `size: 'sm'`, Mantine's
   `--button-height-sm`).
3. **The form page.** Screens: `AddPersonPage.tsx#L249`, `AddRecordPage.tsx#L115`, `NewOrderPage`
   (`OrderParts.tsx#L194`), `OwnPasswordPage.tsx#L84`, `AddOperatorPage.tsx#L121`,
   `NewClient.tsx#L89`, `StaffSetupPage.tsx#L165`. Parts: `PageShell`, `DetailColumns`,
   `SectionCard`, `FieldPair`, Fields, Choices, `Panel`, `FormMessage`, `ActionButton`. States: a new
   record; refused; one block; made. Must have: the way back above the title; fields in titled
   blocks, two a row; a field's refusal on its field, a whole form's above the blocks (code.md's C4);
   one main at the foot; after a save, what was made.
4. **The day sheet.** Screens: `DeliveriesPage.tsx#L37-L134`, `DriverDayPage.tsx#L116-L258`. Parts:
   `PageHeader`, `PageShell`, `Panel`, `DataTable`, `StatusBadge`, Fields, `ActionRow`,
   `ActionButton`, `FormMessage`. States: the day's drivers; one driver's day; closed. Must have: the
   day under the title or in its field; a titled `Panel` a block; totals at the right, through
   `DataTable`; the close asked once, in its own block.
5. **The import page.** Screens: `ImportPage.tsx#L234-L340`, `ListImportPage.tsx`. Parts:
   `PageHeader`, `Panel`, Fields, `DataTable`, `ActionRow`, `ActionButton`, `FormMessage`. Missing:
   a file field (`n 'type="file"'` 3 in 3, the third the camera), which Fields gains. States: choose;
   the preview; done. Must have: one step drawn at a time, one main each; the preview counts what
   will be added; a row's result by its meaning (`TONES`), never a colour's name.
6. **The menu page.** Screen: `MorePage.tsx#L20-L44`. Parts: `PageHeader`, `Panel`, `MenuRow` (L3).
   States: the company's More; no other pages. Must have: the phone's width; the pages first, the
   person's links and sign-out last, each a `MenuRow`.
7. **The confirm page.** Screens: the five above. Parts: `PageHeader`, `FormMessage`, `Panel`,
   Fields, `ActionRow`, `ActionButton`, `CopyText` with its field (L3). States: a delete; a change;
   made. Must have: what will happen first, a standing warning; one thing to type where the act
   cannot be undone; red only at a delete's last press; a made value read-only beside its copy button.
8. **The settings page.** Screens: `SettingsPage.tsx`, `Settings.tsx#L95-L252`. Parts: `PageHeader`,
   `SectionCard`, Fields, Choices, `FormMessage`, `ActionButton`, the logo (L3's photos). Missing:
   the colour field (`n '<ColorInput(?![\w.])'` 1 in 1, `Settings.tsx#L184`), which Fields gains.
   States: the basics; saved; refused. Must have: titled blocks; the save stays and says saved; a
   refusal through `FormMessage`, the logo's too.

## The phone's width

The gallery is for a computer (2026-11-19, `ui/src/computer.ts`'s `isComputer`), and stays so: a
phone page is a plate on the computer's stage. A box 390 px wide is not enough, since Mantine's
`hiddenFrom` and the grids answer to the window, not the box; an iframe is the one box whose width
is the window's, which is why `Frame` (`ui/src/mock/Frame.tsx#L46-L52`) draws `pnpm mock`'s screens
in one at `WIDTHS.phone` (`shared/src/widths.ts`). Its router is what the gallery cannot take, so
its iframe half becomes `Viewport` in the same file: the frame, the page's styles copied in, the
height fitted, the look and words of the gallery's pick. `Frame` draws `Viewport` round its router,
so the mock draws the same; the gallery's own router reaches the page through the portal. One home,
no copy: a second iframe would be a second way to fit a height.

## The order, and why

**1**, the phone's frame: three pages need it. **2**, the phone page, the review's first finding and
the driver's whole day, then the list page, whose phone state uses step 2's address on `Panel`.
**3**, the form (seven screens), the day sheet and the import page: every part in `main`. **4**, after
piece 231's landing 3 is in `pre-merge`: the menu (`MenuRow`), the confirm (`CopyText` with its
field) and the settings (the logo), then the recap and your look.

## What each landing touches

| # | Files | Tests that follow | Pictures |
| --- | --- | --- | --- |
| 1 | `ui/src/mock/Frame.tsx`; in `ui/src/design-system/`, `entries.tsx`, `Gallery.tsx`, `Fields.tsx`, `samples.ts`, a new `Pages.tsx`; `components/organisms/Panel.tsx` and `guideline.ts`'s contract | `Frame.test.tsx`, `MockPage.test.tsx` unchanged; `Gallery.test.tsx#L1069` (29 entries, 34 after, 41 with landing 3 in), `Panel.test.tsx` | none |
| 2 | `entries.tsx`, `Pages.tsx`, `Fields.tsx`, `samples.ts` | the same count, 44 after | none |

Both lanes edit `Gallery.test.tsx#L1069`, and the colour piece its headings (`#L95-L103`): each
takes `pre-merge` in before its gate.

## The steps

Each step's gates: `pnpm --filter @credo/ui check`, `pnpm --filter @credo/visual check` and the
citation test, each case seen red once, `git diff --exit-code -- visual/src/resolved.pinned.txt`.
`glance.sh --size build` gives 5 from small steps of another shape, so each size is piece 231's row
of the same shape: a gallery-wide mechanism 16 (its step 1), a part's take with its entry 11 (step
4), an entry of six states 10 (step 3), of four 4 (step 6), a recap 5 (213's step 12).

**Landing 1: the phone's frame and five pages.**

- [x] **1. The phone's frame.** `Viewport` out of `Frame`; a phone plate; the kind "Kinds of page";
      `Entry` gains `mustHave`, drawn under "A new page of this kind must have", since case 1 of the
      gallery's test caps use lines at three, and they say when, not what. Cases 1 to 3. _Done
      when:_ the gates exit 0 and `pnpm --filter @credo/scripts exec vitest run src/citations.test.ts
      src/counts.test.ts` exits 0 (`counts.ts` names `Frame.tsx` a site of the widths). **16 min**.
      _Done 2026-11-22, the gates from 21:55:_ `Viewport` is in `ui/src/mock/Frame.tsx`, `Frame` draws it round its router; `Entry` gains `mustHave` and a state `phone`, `KIND_OF_PAGE` names the kind; cases 1 to 3 each seen red by a mutation; the three gates, the pinned file and the words and fake tests ran on this tree. Items 667 and 668 filed.
- [x] **2. The phone page.** `Panel` takes `to` (content: the address the block opens); the six
      states in the phone's frame. Cases 4, 5, 13. _Done when:_ the gates exit 0. **11 min**.
      _Done 2026-11-22, the gates from 22:29:_ `Panel` takes `to` (one link over the block), its contract and entry say it; `Pages.tsx` draws the entry `The phone page` (kind "Kinds of page", 30 entries now) in six phone frames; cases 4, 5 and 13 each seen red by a mutation, case 3's guard red once on the entry; the three gates, the pinned file and the words and fake tests ran on this tree. Item 668 read: stays open, the entry draws the call as the screen does.
- [x] **3. The list page.** Six states, the last in the phone's frame, a `Panel` with `to` a row.
      Case 6. _Done when:_ the gates exit 0. **10 min**.
      _Done 2026-11-22, the gates from 22:50:_ `Pages.tsx` draws the entry `The list page` (kind "Kinds of page", 31 entries now) in six states: the customers' list in `ListTable` with its acts, the staff list filtered with `Fields`' filter bar and a `StatusBadge` column in `DataTable`, empty with `PageState`'s add, loading, failed, and at the phone's width a `Panel` with `to` a card a row, the name and its chip first; the cards' addresses lead out of the gallery as step 2's do; `FilterBar` is now exported from `Fields.tsx`; case 6 seen red by four mutations (the chip, the card's address, the add's main, the empty's add); the three gates, the pinned file and the words and fake tests ran on this tree. Item 667 read: stays open for the look at step 10.
- [x] **4. The form page.** Its four states. Case 7. _Done when:_ the gates exit 0. **10 min**.
      _Done 2026-11-22, the gates from 23:09:_ `Pages.tsx` draws the entry `The form page` (kind "Kinds of page", 32 entries now) in four states: a new record (the way back above the title, three titled blocks two a row, one main at the foot), refused (a whole form's message above the blocks and the code's refusal on its field), one block (the own password's) and made (the credentials read-only, the profile the main); case 7 seen red by six mutations (the way back, the field's refusal, the message, the read-only, the foot's main, the made message); the three gates, the pinned file and the words and fake tests ran on this tree. `NewOrderPage` is in `OrderPage.tsx#L431`, not `OrderParts.tsx#L194`.
- [ ] **5. The day sheet.** Its three states. Case 8. _Done when:_ the gates exit 0. **10 min**.
- [ ] **6. The import page, and landing 1.** Fields' file kind; its three states; the recap begun.
      Cases 9, 13. _Done when:_ the gates exit 0, `pnpm --filter @credo/scripts exec vitest run
      src/fake.test.ts` exits 0, and `grep -cE 'c="(red|green|orange|gray|yellow)"'
      ui/src/design-system/Pages.tsx` reads 0. **10 min**.

**Landing 2: after piece 231's landing 3.**

- [ ] **7. The menu page.** Its two states in the phone's frame, from `MenuRow`. Case 10. _Done when:_
      the gates exit 0. **4 min**.
- [ ] **8. The confirm page.** Its three states, the made one with `CopyText` in its field. Case 11.
      _Done when:_ the gates exit 0. **10 min**.
- [ ] **9. The settings page.** Fields' colour kind; its three states, the logo from landing 3's
      photos. Cases 12, 13. _Done when:_ the gates exit 0. **11 min**.
- [ ] **10. The recap, and the look.** The recap closed; the gallery's row and card in
      `docs/products.md` name the kinds of page; item 651 gains each kind's screens as the move's
      targets. Your points 1 and 2, together. _Done when:_ the citation test and
      `src/fake.test.ts` exit 0. **5 min**.

## The cases

| # | The case | Held by |
| --- | --- | --- |
| 1 | A phone plate draws its page in an iframe 390 px wide, the page's styles copied in, its height fitted, in the gallery's colour and language | `Frame.test.tsx`, `Viewport`'s cases |
| 2 | The mock's frame draws as before: its router at its address | `Frame.test.tsx`, `MockPage.test.tsx`, unchanged |
| 3 | Every kind of page's entry draws its must-have lines under their heading | `Gallery.test.tsx` |
| 4 | A panel given an address is one link over the block, its words in their colour | `Panel.test.tsx` |
| 5 | The phone page draws the walk's six screens: the cards each opening its request, one main press a state, the photo's send and take again, the proof | `Gallery.test.tsx` |
| 6 | The list page draws its acts, table, status column, filter bar, empty, loading and failed, and a card a row at the phone width | `Gallery.test.tsx` |
| 7 | The form page draws blocks of fields, a field's refusal on the field and a whole form's above, one main at the foot, the made state | `Gallery.test.tsx` |
| 8 | The day sheet draws a panel a driver and a part of the day, totals at the right, the cash field and the close's ask | `Gallery.test.tsx` |
| 9 | The import page draws choose, the preview with each row's result by meaning, and done, one main each | `Gallery.test.tsx` |
| 10 | The menu page draws its rows in panels, sign-out last, at the phone width | `Gallery.test.tsx` |
| 11 | The confirm page draws the warning first, red only on a delete, the made value with its copy button | `Gallery.test.tsx` |
| 12 | The settings page draws its block's fields and choices, saved, and a refusal as a message | `Gallery.test.tsx` |
| 13 | Fields draws a file and a colour field; `Panel`'s new take is a content | `Gallery.test.tsx`, `guideline.test.ts` |
| 14 | No step moves a screen | `visual/src/resolved.test.ts`, the pinned file unchanged |
| 15 | No sample names the data set's company or people | `scripts/src/fake.test.ts` |

## Checks before `main`

**The whole check:** landing 1 calls it. `Frame.tsx` holds `Stage`, which `visual` imports through
`@credo/ui/mock` (`ui/package.json`'s `exports`), so a change there can break more than `ui`.
Landing 2 touches `ui` alone (and `.md`): `ui`'s and `visual`'s gates and the citation test.

**The review before `main`:** none of its own. Rule 5: a gallery page moves no screen, and the mock
is not served; the pinned file holds that nothing moved. If `pre-merge` holds work worth a review
when `main` moves, that one review reads these commits with it.

## The human's points

Asked together at step 10, one look: the gallery by `pnpm fake` in the piece's worktree, at
`/48b74d079/gallery` on the address it prints, on a computer; on ridge after the push. The work goes
on past it; a no reopens its step.

1. **The phone's pages (steps 2, 3, 7).** The driver's day and one delivery, drawn as a phone shows
   them: the cards, one main press a step, the photo before it is sent; the menu page; a list at the
   phone's width as a card a row. Does each read as your driver and staff would use them? A yes
   keeps cards as the phone's rule for a list, and the item that moves the lists opens; a no makes
   the sideways table the rule, and the item names the staff list instead.
2. **The office's pages (steps 3 to 6, 8, 9).** The list, the form, the day sheet, the import, the
   confirm and the settings page, each with what a new page of its kind must have. Does each read
   as the pages your staff use? A yes keeps them as the screens' targets (item 651); a no names
   the page, and its step reopens.

## The open items in reach

| Item | What this plan does |
| --- | --- |
| 651 | stays: step 10 adds each kind's screens; the move is the milestone behind |
| 662 | stays, the colour piece's: the settings page draws a logo refusal as the fix says, through `FormMessage` |
| 515 | stays parked: no yes is kept against a gallery picture |
| 306 | stays: the confirm is a page, as the item says, not a dialog |
| 555 | not in reach: the pages sit in the gallery's chunk (`ui/src/App.tsx#L45`) |
| new | the lists that scroll at the phone width (`ListPage`, the orders, the operator's three) and the staff list's own card, onto step 3's rule; filed by the orchestrator |
