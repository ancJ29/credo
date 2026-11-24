# The settings page in sections: today's fields in four blocks, beside a preview of the header and the sign-in card

## At a glance

What it is for: the branding campaign's first milestone. A company's root, or anyone given the
settings right, finds today's fields in four titled blocks instead of one card: Identity (the
name), Pictures (the logo), Color and frame (the palettes, the colour, the three switches),
Languages; beside them, a preview of the header and the sign-in card in the look being typed,
before the save. Its people see nothing new; the back end does not change. The cheapest path: the
page's own form, `SectionCard` as it is, `DetailColumns` with one option more, the door's `DoorCard`, the
header's own brand taken out of `Shell` so the preview draws it too; one new piece, a scope that
draws its contents in another colour. The price: about 93 machine minutes in six steps, one landing
with the whole check and a review, your one walk run (48 pictures moved, 6 new), three looks.

**Your two asks, each a line of this plan:**

- "components should be viewable from the gallery before integration with BFF": step 1 draws the
  preview and the page in four blocks in the gallery, on invented data, before the page takes
  them; point 1 is the look there. No step touches the BFF.
- "after finished, walk should be updated properly": step 3 adds the preview's scene and rewords
  the settings question; step 5 is your one run.

## The slice

One slice, walkable when it ends: the root signs in, opens Settings from the menu, types a name and
picks Brick; the preview's header and card take both at once while the app around it keeps the saved
look; a save turns the whole app, as today; a reload shows the four blocks with what was saved.
Stage 1 is the gallery and the fake (steps 1 and 2); stage 2, each step's gate and the landing's
whole check; stage 3, the gallery look and the walks page; stage 4, ridge.

**Not in it:** the later fields (milestones 2 to 4); the logo in the header (milestone 3; items 76
and 103, `docs/open-items.md#L621`, `#L707`).

## What the code holds

**1. Today's page.** The wired page reads the record and saves it with its version
(`ui/src/pages/client/SettingsPage.tsx#L24-L40`), redrawn from the stored record by its key
(`#L56`); the route is `/settings` (`ui/src/ClientApp.tsx#L404-L416`), the menu offers it to whoever
`can(user, 'settings.canEdit')` (`ui/src/nav.ts#L50-L55`). The form holds one draft of the whole
record (`ui/src/parts/Settings.tsx#L61-L62`), saved whole on `submit`, a `SubmitEvent` already
(`#L87-L90`), refused unless the name, colour and languages are valid (`#L92`); its messages sit above
the one card, "Basic information" (`#L97-L114`), the save under it (`#L232`). Its tests: 21 cases in
`ui/src/parts/Settings.test.tsx` (none other matches `Settings*.test.tsx`), one in
`ui/src/pages/client/SettingsPage.test.tsx#L25`, the app's saves in `ui/src/App.test.tsx#L415-L547`,
the settings right in `ui/src/pages/client/Access.test.tsx#L73` and
`ui/src/pages/client/StaffPages.test.tsx#L327`; the mock draws it in fourteen states
of five screens (`ui/src/mock/screens.tsx#L98`, `#L154`, `#L166`, `#L208`, `#L220`).

**2. The design system.** A titled block is `SectionCard`, its title an `h3`
(`ui/src/components/organisms/SectionCard.tsx#L7-L24`,
`ui/src/components/molecules/SectionTitle.tsx#L19`), which `DetailCard` draws
(`ui/src/parts/DetailCards.tsx#L23-L37`); two columns, the main seven twelfths and the side five from
992 px, are `DetailColumns` (`#L11-L19`). Missing: a way to draw a part in a colour other than the
page's (the theme is the whole page's, `ui/src/design-system/CredoMantine.tsx#L20-L32`; the mock's
answer is an iframe a screen, `ui/src/mock/Frame.tsx#L114-L135`, too heavy for a field's preview), and
a preview. The gallery's settings page is a drawing of its own in one block
(`ui/src/design-system/Pages.tsx#L913-L992`), pinned by "236 case 12"
(`ui/src/design-system/Gallery.test.tsx#L2179-L2200`); the Pages group's list is pinned at `#L1660`.
New entries: `BrandPreview` in Pages, a state of `DetailColumns`, the settings page's three states
redrawn; `ColourScope` none, as `CredoMantine` has none.

**3. The preview, without a second copy.** The card is `DoorCard` as it stands: it takes a name, a
logo and what it holds (`ui/src/components/organisms/DoorCard.tsx#L7-L27`). The header is not a
part: its bar and brand are lines of `Shell` (`ui/src/frame/Shell.tsx#L144-L164`), inside a whole
`AppShell` that reads the router (`#L111`, `#L134`). **The narrowest seam:** the bar's look (its
classes, `data-white` and gradient, `#L145-L149`) and the brand group (the stand-in icon and the name,
`#L153-L164`) leave `Shell` as `headerLook` and `HeaderBrand` in the same file, `Shell` drawing them as
before; the preview draws them in a `div`. The colour: `ColourScope`, beside `CredoMantine`, gives
its contents the draft's theme by `MantineThemeProvider` and writes that theme's brand and primary
variables, from Mantine's `defaultCssVariablesResolver`, and every `--credo-*` one, from
`credoVariables` (`ui/src/design-system/cssVariables.ts#L27-L67`), on its own element; Mantine 9.6.3
(`pnpm-workspace.yaml#L38`) exports both, and the resolver gave 371 variables for a brand theme
when run here. The header's gradient and the card's tint read those variables
(`ui/src/design-system/appTheme.ts#L64`, `#L67`).

**Hidden from a reader, outside the form.** The preview repeats two first headings, the header's
name (`Shell.tsx#L155-L163`) and the card's (`ui/src/components/molecules/BrandBand.tsx#L18-L20`);
the app's test reads the one `h1` (`App.test.tsx#L443`) and the walk the one `header`, `alert` and
`status` (`walk/specs/piece-1.spec.ts#L136`, `#L168`, `#L169`, `#L189`). So the two pictures are
`aria-hidden` and `inert`, drawn in a `div`, never a `header`; only the block's title and two captions
are read. It sits beside the form, as `DetailColumns`' side, and holds no field.

**4. No `bff`, no `shared`.** Every field exists (`shared/src/config.ts#L64-L78`); the page imports
`isHexColour` as today (`#L24`). The landing touches `ui`, `visual`, `walk` and `scripts` (the words
count), so the whole check runs on `pre-merge` (`docs/conventions/qa.md#L262`), and `ui`'s exported
dictionary and mock (`ui/package.json#L41-L46`) would call it alone. `pre-main-review` once: the
settings page is a screen a user meets, rule 5's "worth it" (`qa.md#L106`). Not needed: `bff`'s and
`shared`'s gates, c-storage's `make check`, `bash ops/test.sh`.

**5. The words.** Seven keys in both dictionaries (`ui/src/i18n/en.ts#L49`, `vi.ts#L50`), 768 to 775:
`settings.identity` "Identity" / "Nhận diện", `settings.pictures` "Pictures" / "Hình ảnh",
`settings.frame` "Color and frame" / "Màu sắc và khung", `settings.languagesSection` "Languages" /
"Ngôn ngữ", `settings.preview` "Preview" / "Xem trước", `settings.previewHeader` "The header, as the
company's people see it" / "Thanh tiêu đề, như người dùng thấy", `settings.previewCard` "The sign-in
card, as the company's people see it" / "Thẻ đăng nhập, như người dùng thấy" (the mock's words,
"Color" in the dictionary's own spelling, as "Brand color"). `settings.basics` stays: three gallery
samples read it (`Gallery.test.tsx#L340`). The checks that read the dictionary:
`scripts/src/words.test.ts#L43`, `#L48`, `#L64` (768, 769 and 770 become 775, 776, 777),
`scripts/src/fake.test.ts#L42` (no data set's name in the bundle, which carries the gallery), and
`ui/src/i18n/i18n.test.ts#L11`, `#L25`.

**6. The walk** is below.

## Decided by the machine

1. **No places for the later fields.** Each later milestone adds its fields to the block the mock
   gives them; a field drawn now and marked "later" would be dead on ridge, its words written twice
   and its pictures moved twice.
2. **The mock's order kept**: on a phone the preview above the blocks, on a PC beside them and in
   view as the page scrolls; `DetailColumns` gains that one option.
3. **The preview wears the saved colour while the colour field holds no `#rrggbb`**, as while one is
   being typed.
4. **The white menu and the icon strip are not previewed**, as in the mock; the header and the card
   are.
5. **The card's preview stops at its title**: the fields under it carry nothing the settings set, and
   drawing them would copy the door's form or move every door's code.

## The case table

Rows 1 to 5 are business rows, each seen red before its code.

| # | The case: one behaviour, one sentence | Held by |
| --- | --- | --- |
| 1 | The page draws its fields in four titled blocks, Identity, Pictures, Color and frame, Languages, in that order, and one save after them, in both languages | ui, `Settings.test.tsx` |
| 2 | The preview's header and card draw the name, the logo, the colour and the white header as typed and chosen, before any save | ui, `Settings.test.tsx` |
| 3 | While the colour field holds no `#rrggbb`, the preview wears the saved colour | ui, `Settings.test.tsx` |
| 4 | Until the save the app around the page keeps the saved name and colour, and after it wears the new ones | ui, `App.test.tsx` |
| 5 | Each field saves as before: the 21 cases of `Settings.test.tsx` stand unchanged | ui, the same file, its diff against `pre-merge` adding lines only |
| 6 | The preview is hidden from a reader and takes no focus: no heading, alert, status or `header` of its own | ui, `Settings.test.tsx` |
| 7 | `ColourScope` draws its contents in the given colour's theme and leaves the page's as it was | ui, `ColourScope.test.tsx` (new) |
| 8 | `BrandPreview` draws the coloured header, the white one and a card with no logo | ui, `BrandPreview.test.tsx` (new) |
| 9 | `DetailColumns`' new option puts the side first below 992 px, `main` first without it | ui, `DetailCards.test.tsx` |
| 10 | The gallery draws `BrandPreview`'s states and the settings page's three states in four blocks with the preview | ui, `Gallery.test.tsx` |
| 11 | The header and every door draw as before | visual, the pinned diff empty in step 1 |
| 12 | Both dictionaries hold 775 keys, every Vietnamese one its own | scripts, `words.test.ts`; ui, `i18n.test.ts` |
| 13 | The admin's setup walk holds 13 screens, scene 13 on the main path and drawn from mock screen 3's typed state | visual, `walks.test.ts` |

## The steps

Sizes are the last rows of each step's shape in the runs log; `glance.sh --size build` gives 5 from
three small fix steps, a different shape. Each gate is the touched package's
`pnpm --filter @credo/<pkg> check`, exit 0 by its own code, plus the citation test. "The pinned diff"
is `git diff -U0 -- visual/src/resolved.pinned.txt | grep '^+[a-z]' | cut -d' ' -f1 | sort -u`.

- [ ] **1. The gallery.** `ColourScope` in `ui/src/design-system/`; `headerLook` and `HeaderBrand` out of
      `Shell`, which draws them as before; `ui/src/parts/BrandPreview.tsx` (the block "Preview", its
      two captions, the bar and `DoorCard` with the sign-in's title under a `ColourScope`, both hidden as
      above), its Pages entry in three states; `DetailColumns`' option and its state; the settings page's
      drawing in four `SectionCard`s with the preview; the seven keys. Rows 7 to 10 and 12 red first, row
      11 the null proof.
      _Done when:_ `ui`'s, `visual`'s and `scripts`' gates, the scripts' `fake.test.ts` among them; the
      pinned diff empty; `git diff -U0 pre-merge -- ui/src/frame/Shell.test.tsx` empty. **15 min** (piece
      236's step 1: 15, a part taken out of its file and drawn; 241.1's step 1: 10). Then point 1.
- [ ] **2. The page, on the fake.** `Settings.tsx` in `DetailColumns`, its new option on: the form as `main`, its four
      `DetailCard`s and the save, `submit` still a `SubmitEvent`; `BrandPreview` as `side`, from the draft;
      the mock's screen 3 gains a state "typed", the frame in `FILLED`, the form in `TYPED`
      (`ui/src/mock/fixtures.ts#L33`). Rows 1 to 6 red first. _Done when:_ `ui`'s and `visual`'s gates;
      the pinned diff naming `3-settings`, `4-saved`, `5-language-menu`, `7-save-failed`, `8-save-conflict`,
      `10-saved-white`, `11-menu-icons` and `office-5-settings` alone (80 lines, 8 screens on 10 colours);
      `git diff pre-merge -- ui/src/parts/Settings.test.tsx | grep -c '^-[^-]'` 0. **14 min** (241.1's step 5:
      14; 241.2's step 3: 13).
- [ ] **3. The walk.** As "The walk" below; row 13. _Done when:_ `visual`'s, `walk`'s and `ui`'s gates;
      row 13 red on the old counts; the pinned diff naming `13-preview` alone. **14 min** (241.1's step 8:
      14, one scene).
- [ ] **4. The prose.** `docs/products.md#L35`'s Settings row gains the four blocks and the preview; the
      recap's card for the look on ridge comes in step 6. _Done when:_ the citation test. **5 min**
      (241.2's step 8: 5).
- [ ] **5. Your walk run, then the bases.** The run line below, green; the bases committed alone, each
      walk's count matching the log; the same walks without flags, 0 moved. **2 min** (241.1's 9b: 1;
      241.2's bases: 1).
- [ ] **6. The recap and the landing.** The recap and its products row; `pre-merge` taken in, the
      gates again, the landing; the whole check, four packages touched (`qa.md#L262`);
      `pre-main-review` before `main` (`qa.md#L106`), at most once a push. **43 min** (241.2's step 10:
      a recap 3; a whole check and a review about 20 each).

Total: 93 minutes, 43 of them the landing's.

## The walk

**Moved:** every screen that draws the settings page: seven of the admin's setup walk, run by
`piece-1` (`walk/run.sh#L46`; `visual/src/walks.ts#L362-L457`, `walk/specs/piece-1.spec.ts#L114-L206`),
and the office's `office-5-settings`, run by `piece-2` (`walks.ts#L1285-L1295`,
`walk/specs/piece-2.spec.ts#L554-L562`). 48 pictures:

```bash
ls walk/specs/piece-1.spec.ts-snapshots walk/specs/piece-2.spec.ts-snapshots | grep -c -E '^(3-settings|4-saved|5-language-menu|7-save-failed|8-save-conflict|10-saved-white|11-menu-icons|office-5-settings)-'
```

**New:** one scene, `13-preview`, on the main path, taken in `piece-1.spec.ts` right after the name is
typed and Brick picked (`#L127-L129`), before the save is stubbed: the preview in the new name and
Brick, the header still the saved one. Mock screen 3's state "typed"; 6 pictures; the walk goes from
12 to 13 screens, its numbers pinned at `visual/src/walks.test.ts#L84-L94` and its states at `#L61-L64`.

| Scene | What it shows | Its question |
| --- | --- | --- |
| `3-settings` (reworded) | the four blocks, the preview beside | Does the page read in clear sections, the preview showing the header and the sign-in card? |
| `13-preview` (new) | a name typed and Brick picked, not saved | Do the preview's header and card show the new name and colour before the save, while the rest keeps the saved look? |

The other six keep their questions; their pictures move and ask again. Each English question is a
key of `visual/site/questions-vi.json` (`#L4`), the reworded one replaced and the new one added in
Vietnamese. No finder changes: the preview holds no `header`, and its headings and buttons are hidden
(`piece-1.spec.ts#L129`, `#L175`, `#L189`).

**Your one run** (step 5), then `--write`'s bases committed, then the same walks with no flags:

```bash
bash walk/run.sh piece-1 piece-2 --moved 3-settings,4-saved,5-language-menu,7-save-failed,8-save-conflict,10-saved-white,11-menu-icons,office-5-settings --write
```

You will see "== verdict: green": 48 pictures moved, all named, 6 listed new. Read against the
parser: both walks are its names (`walk/run.sh#L46-L47`); `--moved` takes one list with no leading
dash (`#L154-L157`), split on commas (`scripts/src/walks.ts#L56`) and matched to each picture's screen
without its language and width (`#L83-L84`); a picture with no base is listed new, never red.

## Your points

1. **The parts in the gallery** (after step 1; it stops nothing). In this piece's worktree run
   `pnpm fake`, open the address on the first line it prints (the second ends in `/?fake`, which the
   gallery path cannot follow) with `/48b74d079/gallery` after it:
   Pages, "BrandPreview" (a coloured header, a white one, a card with no logo), then "The settings
   page" in its three states. Does the page read in four clear blocks, and does the preview look like
   the header and the sign-in card? A no reopens the part before the page takes it.
2. **The walks page** (after step 5). Nine screens ask: the eight that draw the settings page, in
   blocks with the preview, and the new one where the preview shows a name and a colour not yet
   saved. A no reopens the piece while the rest goes on.
3. **On ridge** (the milestone's one look, after your push), on your -3 copy, on a phone and a PC,
   beside the legacy's client config: change each field, watch the preview, save, reload. Does the
   page read in clear sections, and does each field still save? A no reopens the page; the
   milestones after it wait only where they add to it.
