# The screens moved onto the parts, one pattern at a time

## At a glance

What it is for: your milestone of 11-21, "the app's screens moved onto the parts, one pattern at a
time". Piece 213 wrote each part's contract in the gallery; the screens still draw their own looks.
Here they move, one pattern a landing, until a screen's coder picks parts and passes content and
meaning, never a style. Seven landings, each walkable when it lands: the dialog's title at 600 first,
one screen, which proves your two picture runs; then messages, buttons, page states, status chips,
the page base, and number formats. Which screens move is read from the pinned styles file, never
guessed, and the walks page asks you about each again. The cheapest path builds on what exists: the
contracts, `Loaded`, `Notice`, `StatusBadge`, `ListTable`. The price: about 360 machine minutes, two
picture runs of yours a landing (one for the formats), a review once a push, and five looks.

## The slice

One slice: every screen of both apps drawn from the parts, a pattern a landing. Each passes four
stages: **1**, the part and one screen, the pinned file read; **2**, `ui`'s and `visual`'s gates and
the citation test, then your write run and your run with no flags; **3**, the walks page asks each
moved screen again, and your point; **4**, ridge after the day's push, the piece's card in
`docs/products.md`, a step a landing. Landing 1 has no card step (a card cannot end a session) and
landing 7 none (nothing to see); stage 2's runs stand in.

**Not in it:** the doors' looks (`SignInFrame`, `DoorCard`, the three gradient buttons) and the
colours, gaps and icon sizes no part here takes, all item 651's; dark mode (item 307); a confirm as
a page (item 306).

## The brief, checked

Recounted on this tree; S is
`-- ui/src ':!ui/src/design-system' ':!ui/src/components' ':!ui/src/mock' ':!*.test.*'`, so a
count stays the screens' once the parts draw Mantine's own.

| 213's count | The grep (S unless named) | Here | Where it differs, and why |
| --- | --- | --- | --- |
| 96 messages | `git grep -cP '<Alert\b'` | 96 in 32 files: red 46, orange 24, green 20, gray 2, yellow 1, three by a condition; spoken `alert` 87, `status` 5, `note` 4 | holds |
| 88 finding a message by role | `git grep -nP "ByRole\(\s*'alert'" -- ui visual walk`, then `'status'` | 282 and 30: 58 in `walk/specs`, 254 in the ui and visual tests | the walk's 58 hold; the ui's "30 in 16 files" had no grep. A move changes about 43: 24 ui lines in 10 files and 13 walk lines in 6 specs find a green or gray message as `alert`, which becomes `status`; 6 find the two builds' line as `status`, which becomes `alert` |
| 109 buttons | `git grep -cP '<Button\b'` | 109 in 43 files, the looks item 655 lists | holds |
| 41 titles | `git grep -cP '<Title \{\.\.\.TYPE\.pageTitle\}'` | 41 in 32 files, one the sign-in door's (`ui/src/pages/SignIn.tsx#L128`) | holds |
| 18 action rows | `git grep -hP -A1 '<Group\b'` S, then `grep -cE '^\s*<Button\b'` | 23, and 4 behind a condition's line: 27 | 213's had no grep |
| 14 back links | `git grep -nP 't\([\x27\x60][\w.${}]*\.back[\x27\x60]\)'` | 14: 12 a `Button`, 2 an `Anchor` | holds; "11 as a button" missed `ui/src/pages/client/PersonPage.tsx#L415`'s, its tag six lines up |
| 12 tables | `git grep -cP 'minWidth=\{'` | 12 | holds |
| five formats | `git grep -c 'new Intl.NumberFormat'` | 5 in 4 files | holds |

Also read: item 650 is the walk titles, not the finders; it rides landing 2, which edits
`piece-1.spec.ts` and `piece-2.spec.ts` (its trigger). `StateBadge` is at
`ui/src/parts/OrderParts.tsx#L39`; the one `Modal` at `ui/src/parts/SessionEnded.tsx#L24`.

## The order, and why

Piece 213's order with one swap, buttons before page states: **1** the dialog, **2** `FormMessage`,
**3** `ActionButton`, **4** `PageState`, **5** `StatusBadge`, **6** the page base, **7** the formats.
The dialog stays first: one value and one screen prove your two runs on the smallest move. A failed
page state is a message and a retry button, so `PageState` after `FormMessage` and `ActionButton`
is drawn from finished parts, once; the page base draws `PageState`, `BackLink` and `StatusBadge`.
The formats depend on nothing and move no picture.

## What each landing touches

| # | Files | Pictures that move (the pinned diff is the list; measured where named) | Tests that follow | Items |
| --- | --- | --- | --- | --- |
| 1 | `ui/src/design-system/tokens.ts#L85`, `appTheme.test.tsx#L109`, the session-ended entry of `ui/src/frame/__snapshots__/frameKept.test.tsx.snap` | `passkeys`: `pk-6-sign-in-ended` alone | those two | 647 |
| 2 | the part; 30 screen files | `office-orders` `orders-15-photo-missing`, `services` `sv-2-two-builds` (yellow to warning), `piece-1` `2-sign-in-refused`, `12-sign-in-wait` (`ui/src/pages/SignIn.tsx#L165`, `#L170` lose their margin), `delete-client` `dc-1-page` (its intro's kind) | the 43 finders above, in 7 walk specs and 10 ui test files; the two `note` finders | 644, 650, 651 |
| 3 | the part; 40 files | nearly every walk: 17 buttons lose an `xs` or `lg` size, 9 an `alignSelf` | 213's case 15 (`guideline.test.ts`, `Gallery.test.tsx#L951`); 3 lines read `.mantine-Button-loader`, which stays | 655 |
| 4 | the part; `Loaded`, `Notice`, `Boot`, the three other loaders, four empty lists, `ui/src/pages/client/RecordPage.tsx#L136` | `piece-2` `office-3-forbidden`, `office-4-nothing`; `operator` `op-7-list-failed`; `piece-1` `6-service-down` | the loader finders of four ui test files | 651 |
| 5 | `StatusBadge.tsx`, `OrderParts.tsx`, six call sites, `StaffListPage.tsx#L143-L145`, `PersonPage.tsx#L407` | `office-orders`, `driver-deliveries`, `office-reconcile` (confirmed teal and waiting blue become orange), `piece-2` (the chips turn light) | `StaffPages.test.tsx#L75-L85`, which reads a chip's look | 651 |
| 6 | the parts; 38 files | every walk | none by role: 21 ui lines find a back link as a `link`, as `BackLink` is | 651, 653 |
| 7 | `listSheet.ts`, `OrderPage.tsx`, `OrderParts.tsx`, `ProductForm.tsx`, a number's place | none | none | 652 |

## The steps

Each step's gates: `pnpm --filter @credo/ui check`, `pnpm --filter @credo/visual check`, the
citation test; each case red once. A step that moves a screen rewrites the pinned file
(`RESOLVED_WRITE=1`); its diff names exactly the screens the tick lists (case 18) and is your
`--moved` list. No landing edits a file in `ui`'s `exports`. Sizes, piece 213's rows: a part from its
entry 14 (steps 7, 8, 10: 13, 16, 14), contracts 7 (step 11), a landing 4 (steps 9, 12). No 213 step
moved a screen: a pass of about 45 sites is its step 5's 20, and the bases with two log reads 5,
piece 203's step 8. Your runs: about 20 each for a few walks, longer for twelve. One recap.

**Landing 1: the dialog's title at 600.**

- [x] **1. The value.** `TOKENS.dialogTitle` reads `WEIGHTS.emphasis`, its comment and test with it;
      the snapshot rewritten and read. Case 1. _Done when:_ the gates exit 0 and the pinned diff is 10
      lines, all `operator-passkeys/pk-6-sign-in-ended`. **20 min** (213's step 5). _Done 2026-11-21: case 1 seen red on the old 550, then green; the pinned diff is 10 colours of `operator-passkeys/pk-6-sign-in-ended`, no other screen._
- [x] **2. Landing 1.** The recap begun; your `bash walk/run.sh passkeys --moved pk-6-sign-in-ended
      --write`, the six bases committed alone, then `bash walk/run.sh passkeys`. _Done when:_ the
      second reads green, every count 0. **9 min**, and your two runs. _Done 2026-11-21: the recap begun and item 647 closed; your second picture run of landing 1 read green, every picture as committed, every count 0._

**Landing 2: messages.**

- [x] **3. The part and one screen.** `FormMessage`'s contract gains what its sites need: `title`
      (content; `DeleteClientPage.tsx#L138`, `MoveClientPage.tsx#L159`) and `standing` (meaning: a
      note there from the page's load, spoken `note`, four sites). The part in
      `components/molecules/`, its entry drawn from it; the settings page's saved line moved. Cases 2,
      3, 19. _Done when:_ the gates exit 0, the pinned file unchanged. **14 min**. _Done 2026-11-21: `FormMessage` built in `components/molecules/` with `title` and `standing`, its entry drawn from it, the settings page's saved line moved (now spoken `status`; its finders in `Settings.test.tsx`, `App.test.tsx` and `walk/specs/piece-1.spec.ts` follow); cases 2, 3 and 19 each seen red once; the gates and the citation test exit 0, the pinned file unchanged._
- [x] **4. The client's.** The 47 in `pages/client/` and `SignIn.tsx`, each kind read from its colour
      and words, the finders with them. Case 4. _Done when:_ the gates exit 0. **20 min**. _Done 2026-11-21: the 47 moved onto `FormMessage` (red to error, orange to warning, green to success or saved, gray to info; the recount holds, 48 `<Alert` with `RecordPage.tsx#L136`'s not-found line, landing 4's, left), the part's `children` widened to a node for the five messages that hold an act beside their words; 18 ui finders, 7 of `visual`'s words test and 10 walk-spec finders of green messages follow from `alert` to `status`; case 4 seen red once on the unmoved finders (16 tests), then green; the pinned diff is 40 lines, all `admin-setup` `2-sign-in-refused` and `12-sign-in-wait` (the walks page's two screens of `piece-1`, which lose the margin), no other screen; the gates, the walk check and the citation test exit 0._
- [x] **5. The rest.** The 45 in `parts/` and `pages/operator/`; the nine whose colour or role
      disagrees with a kind (four notes, three orange status lines, two yellows) set by their words,
      named in the tick; item 650 after its grep; item 644's line,
      `visual/src/resolved.test.ts#L4-L5`. _Done when:_ the gates and `pnpm --filter @credo/walk
      check` exit 0, `git grep -cP '<Alert\b'` S counts 3 (`Loaded`, `Boot`, the not-found line:
      landing 4's). **20 min**. _Done 2026-11-21: the 45 in `parts/` and `pages/operator/` recount holds (17 files) and are on `FormMessage`; `<Alert` in S counts 3. The nine whose colour or role disagreed are set by their words: four notes, all `warning` and `standing` (the delete page's unfinished-deletion line and its intro, which was red and is now orange, the move page's two), three orange status lines (the two delete-progress counts and the move progress) set `info`, spoken `status` and gray, and two yellows (the missing delivery photo and the two builds) set `warning`, the two builds now spoken `alert`. The page's grey "archived" line (`PersonPage.tsx#L411`) is a note from the page's load, so `info` and `standing`, spoken `note`. `FormMessage` takes the whole width of its column by its own code (case 20, its contract line saying so), so the nine messages that had `w="100%"` in a left-aligned stack keep their width with no wrapper, and the messages that shrank to their words there now span. Six green messages that were spoken `alert` are `success` or `saved` and now `status`; their finders in 5 ui tests, `visual`'s words test (2 lines) and the services walk spec (2) follow, 8 ui tests seen red once on the unmoved finders. Item 650: the titles say twelve and thirty-four, the second header's sum and picture count with them; item 644: the header says which half is held. The pinned diff against step 4 is 56 screens, 10 colours each, style hashes (the part's width declaration appears wherever a message is drawn), by `walk/run.sh` walk name: `admin-lists` lists-4, 5, 8, 14, 15, 16, 17, 19; `piece-1` (folder `admin-setup`) 2-sign-in-refused, 4-saved, 7-save-failed, 8-save-conflict, 10-saved-white, 11-menu-icons, 12-sign-in-wait; `piece-2` (folders `admin-staff` and `office-staff`) staff-3, 6, 9, 10, 11, 15, 17, 21, 22 and office-6-password, office-7-password-wrong; `driver-deliveries` driver-4, 5, 6; `office-orders` orders-4, 8, 9, 14; `office-reconcile` reconcile-5, 7, 8; `delete-client` dc-1, 2, 3 (the intro's kind too); `passkeys` pk-3, 4, 5, 6; `root-password` rp-2, 3, 4; `services` sv-1, 2, 3, 4 (sv-2 yellow to orange, now spoken `alert`); `operator` op-3, 4, 9; `team` tm-3, 4, 6. `office-orders` `orders-15-photo-missing` moves unseen by the pinned file (yellow to orange): its message shows only when the proof image's `onError` fires, which the static draw never does, so it joins `--moved` by hand. Both gates, the walk check and the citation test exit 0._
- [x] **6. Landing 2.** The card begun (a saved line); the whole check; your two runs over `piece-1
      piece-2 admin-lists office-orders driver-deliveries office-reconcile services delete-client`.
      _Done when:_ the second reads green, every count 0. **9 min**, the whole check's 20, your runs.
      Your point 1. _Done 2026-11-22: your write run over all twelve walks, after `main` was taken in at `3d913754`, read green, and its pictures are committed alone at `9d6b319b`; your second picture run, over the four walks whose pictures changed (`piece-1`, `office-orders`, `services`, `delete-client`), read green, every count as asked. Left to the landing: the whole check on `pre-merge`, the review before `main`, and your point 1, open._

**Landing 3: buttons.**

- [x] **7. The part and one page.** `ActionButton`'s contract gains an address (27 are links),
      `submit` (16), `busy` (33 `loading`), `disabled` (15), an icon (4), and "its width its words'"
      (12 `alignSelf`, 3 on back links). The part in `components/atoms/`, its entry drawn from it; the
      settings page moved. Cases 5, 6, 19. _Done when:_ the gates exit 0. **14 min**. _Done 2026-11-22: `ActionButton` built in `components/atoms/` (meaning, words, `onClick`, and the new `to`, `submit`, `busy`, `disabled`, `icon`), its entry drawn from it and no longer to come; the recounts on the `<Button` tags hold (109 buttons: 27 links, 16 `submit`, 33 `loading`, 15 `disabled`, 4 icons, 12 `alignSelf`, 3 of them on back links). Its width is its words' by `width: fit-content`, not `alignSelf`, so a button in a row keeps its place; its label weight is read from `WEIGHTS.emphasis`; its contract's place line now says the one-main-action rule is the screens' check, not the part's code, and the entry's use lines say a move that is itself the act takes an address. The settings page's four buttons moved (the conflict reload, the logo choice, its removal, the save, whose `Group` wrapper is gone); the reload sits in `FormMessage`'s new `act` take, which lays it out under the words (item 658's fix, begun: `children` stays a node until the six other sites move). Cases 5, 6 and 19 each seen red once on a stub, then green; the pinned diff is 8 screens, 10 colours each, all the settings page's: `admin-setup` 3-settings, 4-saved, 5-language-menu, 7-save-failed, 8-save-conflict, 10-saved-white, 11-menu-icons and `office-staff` office-5-settings; the gates and the citation test exit 0._
- [x] **8. The client's.** The 45 in `pages/client/` (5 back links left); a page drawing two main
      actions named in the tick. Case 7. _Done when:_ the gates exit 0. **20 min**. _Done 2026-11-22: the recount holds, 50 `<Button` tags in the 17 files of `pages/client/` (tests left out; `grep -oP '<Button\b'` per file), 45 moved onto `ActionButton`, 5 left that say `.back`: the back links of `AddRecordPage`, `RecordPage` and `PersonPage`, and the done step's link of `ImportPage` and `ListImportPage`, whose look is picked by what is left to add. Case 7 (`guideline.test.ts`) seen red once on a stub, then green: no page file names the main meaning outright twice, but the five listed with their count and why (`AddPersonPage` 2, `ImportPage` 3, `ListImportPage` 3, `MyDeliveryPage` 2, `PersonPage` 2: each pair or triple sits in states the page never draws together, except `PersonPage`'s, whose lock confirm shows beside the record's save while asked); a meaning picked by a condition is not counted. Meanings read from the page: the import's rest-to-add, add and read are main, its other-file and template other; the driver's take-a-photo and send are main, the retake other; the close-the-day confirm of `DriverDayPage` (red before) is main, not danger, since closing a day is no delete, and the same for `PersonPage`'s lock confirm (red before, main when unlocking); `PersonPage`'s password set (filled before) is other beside its own make-one, the record's save being the page's main; the line remove of `OrderPage` (red subtle before) is quiet, a danger being a delete's last step; the add and remove of a unit in `StaffSetupPage` stay other. The four messages that held a button (the conflict reloads of `PersonPage`, `RecordPage` and `StaffSetupPage`, the open-order of `DeliveryPage`'s cancelled line) moved onto `FormMessage`'s `act`, their `Stack` wrappers gone (item 658: three sites left, in `parts/`). The three row buttons that carry a name for the screen reader (`DeliveriesPage` open, `OrderPage` remove, `StaffSetupPage` remove) needed a take the part lacked: `label`, added to the part, its contract and its entry. The driver's two `lg` buttons and the `xs` reloads are now `sm`, the remove in an order's table lost `compact-sm`. `ui`'s case 15 floors (more than 100 looks, 4 distinct) now read 10 and 1, the screens left drawing 15 by landing 3's end; `frameKept`'s `ways` snapshot, the person page's markup, rewritten and read (button styles only). The pinned diff is 56 screens, 10 colours each: `piece-2` (folders `admin-staff`, `admin-staff-setup`, `office-staff`, `phone-sign-in`) staff-1 to 20, 22 and 23, setup-1 and 2, office-1, 2, 6 and 7, phone-2; `admin-lists` lists-1, 2, 3, 5, 6, 7, 15, 17; `office-orders` orders-1, 2, 3, 5, 8, 9, 10, 13, 14; `driver-deliveries` driver-2, 3, 5; `office-reconcile` reconcile-1, 2, 3, 4, 6, 7, 8. The gates and the citation test exit 0._
- [x] **9. Parts and frame.** The 26 in `parts/` and `frame/` (`ClientMade.tsx`'s back link left).
      _Done when:_ the gates exit 0. **20 min**. _Done 2026-11-22: the recount by `grep -oP '<Button\b'` per file (tests left out) is 23, not 26: `ClientMade` 2, `OrderParts` 5, `StaffFieldsEditor` 4, `SignInPanels` 3, `SessionEnded` 2, and one each in `CopyText`, `CustomerForm`, `NewClient`, `PhotoPanel`, `ProductForm`, `frame/Boot` and `frame/Loaded` (`Settings`' four moved at step 7); 22 moved onto `ActionButton`, the back link of `ClientMade` left. The forms' saves, the new client's make, a send's submit and the session's continue are main (a part drawn on a page names it only once, case 7 holds); the cancel panel's confirm (red before) is other, since cancelling an order or a request is no delete and the page's main is its send, and its keep and open are other; `CopyText`'s copy, the email's set and remove, the QR show, the photo choice, `ClientMade`'s another, `Loaded`'s retry and the three adds and the field remove of the staff set-up are other, the option remove (subtle before) quiet; `Boot`'s retry is main, being the only act of its screen, while `Loaded`'s, drawn in place of a page's content under pages that keep their own main, is other. `size="xs"` on the copy and the option buttons is now `sm`, the six `alignSelf` are the part's width. Props kept: the three `aria-label`s are `label`, the photo choice passes its `onClick` from `FileButton`. One message in `parts/` still held a button, `OutcomeAlert`'s theirs button, now on `FormMessage`'s `act`: item 658's seventh and last site (six moved at steps 7 and 8; the brief's three in `parts/` was one). The pinned diff is 50 screens, 10 colours each: `admin-lists` lists-10 to 21; `piece-1` (folder `admin-setup`) 6-service-down; `piece-2` (folders `admin-staff-setup`, `admin-staff`, `office-staff`) setup-1, setup-2, staff-4, 5, 6, 7, 10, 11, 13, 15, 17, 18, 23, office-2-add; `office-orders` orders-3, 4, 6, 7, 8, 9, 10, 13, 14; `operator` (folder `operator-setup`) op-2, 3, 4, 5, 7, 8, 9, 10; `passkeys` pk-6; `services` sv-5; `root-password` rp-3; `team` tm-3, tm-4; `delete-client` dc-4. The cancel panel's asked state (confirm and keep, drawn only after a press) and the copy's "copied" word are not drawn by the static pass. The gates and the citation test exit 0._
- [x] **10. Operator, and landing 3.** The 23 in `pages/operator/` (6 back links, 2 doors left); the
      card's step; your two runs over the pinned diff's walks. _Done when:_ `git grep -cP '<Button\b'` S
      counts 15 (12 back links, 3 doors) and your second run reads green. **29 min**. Your point 2. _Built 2026-11-22, its runs to come: the recount holds, 31 `<Button` tags in 12 of the 14 files of `pages/operator/` (tests left out), 23 moved onto `ActionButton`, 6 back links left (`AddOperatorPage`, `DeleteClientPage`, `DeleteOperatorPage`, `MoveClientPage`, `OperatorLinkPage`, `RootPasswordPage`) and 2 doors (the gradient buttons of `JoinPage` and `OperatorSignIn`); `git grep -cP '<Button\b'` over S counts 15 (12 back links, 3 doors), from 38. Meanings read from the page: the adds, makes, sets and the move's go-on are main, and the join page's retry (its screen's only act) too; the delete and the colleague's delete confirm are danger, and so is the resume of an unfinished client deletion (it carries out the delete the page already asked for, with no further step); the row buttons of the clients list (root password, move, delete) and of the team list (new link, delete) are other, the delete of a row being a link to its confirm page, not the delete's last step (red outline before); the move's stop is other (red outline before, a stop being no delete); the passkey remove in a row is other, and the services page's check-now is other, not main, since the page checks by itself each minute. The seven row buttons keep their screen-reader names as `label`; the `xs` size is now `sm`. `MoveClientPage` names the main meaning three times (the go-on after a stop and after a failure, and the send: one drawn at a time), so case 7's list takes it with 3. `FormMessage`'s `children` is not narrowed: one site still passes a node, `PersonPage`'s shown password (words and a read-only field); `DeliveryPage`'s cancelled line, whose open-order button step 8's note counted as moved but left in its own `Stack`, moved onto `act` in a second commit of this step (no pinned hash moves, the line shows only after a cancel); item 658 stays open with its trigger updated, and `act` still takes any node. The pinned diff of this step is 19 screens, 10 colours each: `operator` (folder `operator-setup`) op-5, op-7; `passkeys` pk-2; `services` sv-1 to sv-4; `root-password` rp-1, rp-2, rp-4; `team` tm-1, tm-2, tm-3, tm-5, tm-6; `delete-client` dc-1 to dc-4; from landing 2's `cf72c169` the moved list is 107 pictures in all 12 walks, each with base pictures, no screen drawing a button only in a state the static pass never reaches (the cancel panel's asked state and the copy's copied word are in no picture). The card is in `docs/products.md`, begun, and names the person page's two main actions while its lock confirm is open._ _Done 2026-11-22: the recount of 15 holds (12 back links, 3 doors); your write run over all twelve walks read green and its 306 pictures are committed alone; the review before `main` asked three wording fixes, made, and its reread says they hold; your second picture run, over the eleven walks whose pictures changed after the fixes (`root-password` read no change in the write run on the same code), read green with no picture moved against the new bases. Left to the landing: its place on `pre-merge`, its checks there, and your point 2, your look at the buttons, still open._

**Landing 4: page states.**

- [ ] **11. The part.** `PageState` in `components/organisms/`, its failed state a `FormMessage` and
      an `ActionButton` retry; `Loaded` and `Notice` draw through it, their 34 uses unedited. Its
      contract: `add` only where the heading offers none (the four empty lists' pages do). Cases 8,
      9. _Done when:_ the gates exit 0. **14 min**.
- [ ] **12. The rest, and landing 4.** `Boot`, the loaders of `QrLanding`, `JoinPage` and
      `ServicesPage`, four empty lists, the not-found line; the check of case 10; the card's step;
      your runs. _Done when:_ `git grep -cP '<(Alert|Loader)\b'` S counts 0, your second run green.
      **29 min**. Your point 3.

**Landing 5: status chips.**

- [ ] **13. The chips, and landing 5.** `StateBadge`'s six calls and the two staff chips draw
      `StatusBadge`; `StateBadge` goes. The person page's "Resigned" passes `inactive`, the list's
      word (one word a status, 213's case 14), unless your point 4 says no; `staff-8-left` joins
      `--moved` by hand (the pinned file hashes no words). Case 11; the card; your runs. _Done when:_
      `git grep -cP '<StateBadge\b'` counts 0, your second run green. **29 min**. Your point 4.

**Landing 6: the page base.**

- [ ] **14. The contracts.** `PageShell` takes a back link and a record's status; `ActionRow`, a part
      to come (a block's buttons in order; it decides their gap and side), and `TableScroll` (a
      table's least width, `WIDTHS.table`) get entries and contracts. Case 19. _Done when:_ the gates
      exit 0. **7 min**.
- [ ] **15. The parts.** `PageShell` draws `BackLink` and `StatusBadge`; `ActionRow` and
      `TableScroll` built from their entries. Cases 12 to 14. _Done when:_ the gates exit 0. **14 min**.
- [ ] **16. Titles and back links.** The 41 titles through `PageShell` or `PageHeader`; a way back at
      a page's head through `PageShell`, a flow's last act (the four turning filled when done) an
      `ActionButton`; the finders follow. _Done when:_ the gates exit 0. **20 min**.
- [ ] **17. Rows, tables, and landing 6.** The 27 rows and 12 widths; the check of case 15; the card;
      your runs, every walk. _Done when:_ `git grep -cP '<Title \{\.\.\.TYPE\.pageTitle\}|minWidth=\{'`
      S counts 1, the sign-in door's title, your second run green. **29 min**. Your point 5.

**Landing 7: the formats.**

- [ ] **18. A number's place, and landing 7.** `ui/src/number.ts` beside `day.ts`: a number, a price,
      a number's marks; `useMoney` and the four sites read it. Cases 16, 17. The recap closed; your one
      run, `bash walk/run.sh admin-lists office-orders driver-deliveries office-reconcile`. _Done
      when:_ the pinned file unchanged, the run green, every count 0. **20 min** (14, and 6).

## The cases

| # | The case | Held by |
| --- | --- | --- |
| 1 | The dialog's title weight is `WEIGHTS.emphasis` | `ui/src/design-system/appTheme.test.tsx` |
| 2 | Each kind draws its tone and speaks its role: error and warning `alert`; success, saved and info `status`; a standing note `note` | `FormMessage.test.tsx` |
| 3 | A title, where given, sits above the words | same |
| 4 | Each screen's message keeps its words and its kind's role | the moved finders |
| 5 | Each meaning draws its look at one size and its words' width: main filled, other default, quiet subtle, danger red filled | `ActionButton.test.tsx` |
| 6 | An address makes a link; busy shows the loader, takes no second press; submit sends its form | same |
| 7 | No page file names the main meaning twice outside a condition | `guideline.test.ts`, reading the screens |
| 8 | Each state draws its title, words and role; failed offers a retry, empty an add only where given | `PageState.test.tsx` |
| 9 | `Loaded` and `Notice` draw through `PageState` | their tests |
| 10 | No screen draws Mantine's `Alert` or `Loader` | `guideline.test.ts` |
| 11 | Every order, request and person status on a screen is a `StatusBadge` | `StaffPages.test.tsx`, `OrdersPages.test.tsx`, by `data-status` |
| 12 | `PageShell` draws a back link and a status by its title when given | `PageShell.test.tsx` |
| 13 | `ActionRow` draws its buttons in order at its block's end | `ActionRow.test.tsx` |
| 14 | Every table's least width is `WIDTHS.table` | `TableScroll.test.tsx` |
| 15 | No screen draws a page title, a least width or a `Button`; the three door files named until item 651 | `guideline.test.ts` |
| 16 | A number, a price and a number's marks read one place, the text unchanged for the data set's numbers | `number.test.ts` |
| 17 | No screen writes `new Intl` | `ui/src/design-system/literals.test.ts` |
| 18 | Each landing's pinned diff names exactly the screens its tick lists | `visual/src/resolved.test.ts`, the diff read |
| 19 | Every take a contract gains is a content or a meaning, never a style | 213's case 20, `guideline.test.ts` |

Cases 10 and 15 are `ui` tests, not lint: a rule in the root's `eslint.config.js` would call the
whole check for what a `ui` test holds.

## Checks before `main`

**The whole check** (QA's rule on `pre-merge`): landing 2 alone, whose code touches `ui` and `walk`'s
specs. The others' code is `ui`'s; the pinned file and the bases they also change are read by
`visual`'s gate and your runs. Each day's push gets its own, as QA says.

**The review before `main`** (rule 5, once a push over what `main` gained): landings 2 to 6, code a
user meets on every screen; about 40 minutes with its fix pass and reread (213's review-1 to
rework-1d). Landing 1 (one design-system value) and 7 (no screen moved) need none.

## The human's points

The work goes on past each look; a no reopens its landing.

1. **Messages (step 6).** The walks page asks again each screen whose message moved: a yellow
   warning now orange, the delete page's intro orange as a warning, the sign-in refusal without its
   gap below; a saved line is now spoken as a status. Does each message read as the one way you
   want? A yes keeps it; a no names the screen, and step 4 or 5 reopens.
2. **Buttons (step 10).** Each screen's buttons are drawn by meaning: one filled main action a page,
   others in the default look, quiet ones subtle, red only at a delete's last step, all one size.
   Does each page show its next step as its one filled button? A yes keeps it; a no names the screen
   and the button, and step 8, 9 or 10 reopens.
3. **Page states (step 12).** Loading, failed, forbidden, nothing yet and not found are drawn by one
   part: a failed load's message and its retry in the default look, the start page's retry no longer
   filled. Does each state read the same on every page? A yes keeps it; a no names the screen, and
   step 11 or 12 reopens.
4. **Status chips (step 13).** Orders, requests and people wear one light chip each: confirmed and
   waiting orange, done green, cancelled red, a draft or an inactive person gray. The person page
   reads Inactive, the list's word, where it read Resigned. Is one word a status right? A yes keeps
   it; a no keeps Resigned as the person page's own word, and step 13 reopens.
5. **The page base (step 17).** Every page is drawn from the base: its title, a back link above it
   (an arrow and words), its status beside, its buttons in one row, its tables scrolling below one
   width; nearly every screen is asked again. Is this the one page you want? A yes keeps it; a no
   names the slot, and step 14 to 17 reopens.

## The open items in reach

| Item | What this plan does |
| --- | --- |
| 647 | closes, step 1 |
| 644 | closes, step 5: the first move of a colour the resolver computes, so the header says which half is held |
| 650 | closes, step 5, after its grep |
| 655 | closes at step 17, where case 15 refuses a raw `Button` |
| 651 | messages, states, chips and page base, steps 3 to 17; its colours, gaps, icon sizes and doors stay |
| 653 | closes, step 17 |
| 652 | closes, step 18 |
| 306, 307 | stay parked |
