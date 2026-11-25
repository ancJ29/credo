# The company's name everywhere: the tab, the formatted name in the header and on the card, the description, the page in the language shown

## At a glance

What it is for: the branding campaign's second milestone, each company's own name where its people
look. The root, or anyone given the settings right, gains two Identity fields: a formatted name (a
bold part, a second colour, a line break, typed as HTML and cleaned of the rest) with a live preview,
and a short description. Its people see the company's name in the tab instead of "Credo", the
formatted name in the header and on the sign-in card, the description under it on the card, and the
page marked in the language shown. The cheapest path: two fields on the one settings record and its
save, already wired; React's own `<title>`; one new atom that cleans and draws the name, no new
dependency; one part for the Identity block. The price: about 133 machine minutes in seven steps, one
landing with the whole check and a review, your one walk run (54 pictures moved, 18 new), three looks.

**Your two asks:** "components should be viewable from the gallery before integration with BFF":
step 1 draws every new and changed part in the gallery on invented data, before the record or a page
changes; point 1 is the look there. "after finished, walk should be updated properly": step 4 adds
three scenes, the tab's and the language's checks and the counts; step 6 is your one run.

## The slice

One slice: the root opens Settings, types a formatted name and a description; the field's preview and
the preview's header and card take them before the save; a save puts the formatted name in the
header; signing out shows it on the card with the description; the tab says the plain name throughout,
the page is marked `vi` or `en` as shown. Stage 1 is the gallery and the fake (steps 1 to 3); stage 2,
each step's gate and the whole check; stage 3, the gallery look and the walks page; stage 4, ridge.
**Not in it:** the logo in the header (milestone 3); the phone app's name, description and icons
(milestone 4); a company's passkey under its own name (item 683, step 5).

## What the code holds

**1. Where a company's people see "Credo".**

| Where | Today | After |
| --- | --- | --- |
| The tab | `<title>Credo</title>` (`ui/index.html#L6`), no icon or manifest; code draws one title, the gallery's (`ui/src/design-system/Gallery.tsx#L329`) | the plain name once the settings are known, "Credo" before (point 4) |
| The header | `HeaderBrand` (`ui/src/frame/Shell.tsx#L90-L105`), given the name at `#L176` | the formatted name where set |
| The sign-in, the QR landing | `SignInFrame` (`ui/src/pages/SignIn.tsx#L51-L63`) through `BrandBand` (`ui/src/components/molecules/BrandBand.tsx#L18-L20`) | the formatted name and the description |
| The failure and unknown-company screens | `Boot`'s heading `t('app.name')` (`ui/src/frame/Boot.tsx#L29-L31`, `ui/src/i18n/en.ts#L3`) | stay "Credo" (point 4) |
| The operators' console and doors | `CREDO_BRAND` (`ui/src/brand.ts#L14`, `ui/src/frame/OperatorPage.tsx#L26`, `ui/src/pages/operator/OperatorSignIn.tsx#L25`, `ui/src/pages/operator/JoinPage.tsx#L84`) | stay |
| A company's new passkey | the relying party "Credo" (`bff/src/calling/passkeys.ts#L17`, `#L42`, from `bff/src/routes/own-passkeys.ts#L147-L151`) | item 683: the settings are read only in `app.ts`'s closure (`bff/src/app.ts#L313-L317`) until milestone 4's manifest |

**The tab, never blank.** React 19.3.1 (`pnpm-workspace.yaml#L69`) takes over the page's first
`<title>` (`react-dom`'s `cjs/react-dom-client.production.js#L10569-L10581`) and removes it when its
drawing leaves (`#L10219-L10224`). A failed sign-in drops the settings (`ui/src/ClientApp.tsx#L247-L248`),
so a title drawn only after them would blank the tab: both branches draw one, `CREDO_BRAND.name`
before (`#L213-L224`), `config.name` after (`#L337`). The console draws none and keeps the page's.

**2. The page's language.** Fixed `lang="vi"` (`ui/index.html#L2`); the language shown is chosen at
`ClientApp.tsx#L90-L91` and starts the words in `Providers` (`ui/src/frame/Providers.tsx#L25-L26`);
only the mock's frame marks a page (`ui/src/mock/Frame.tsx#L78`). `Providers` will set `lang` on the
element that carries the colour scheme, its `root` or the page's own, whenever the language changes.
The walks page's versions read the body's markup (`visual/src/words.tsx#L89`) and no stylesheet in
`ui/src` reads a language (`:lang(`, `hyphens`): no version or pixel moves.

**3. The record and its save.** One record, `tenant.<id>.config` (`shared/src/records.ts#L28`), typed
and parsed by `shared/src/config.ts#L7-L22`, `#L64-L78`, as the BFF reads it (`bff/src/app.ts#L313-L317`),
its one PUT stores it (`#L338-L357`) and the UI reads it (`ui/src/api.ts#L319-L322`). The cost:

- `formattedName` and `description` in the type, each `.default('')` as the switches are
  (`config.ts#L69-L71`): a record stored before reads both empty.
- `formattedName` kept as typed, at most 1,000 characters (legacy `workspace/uis/base/src/types/schema.ts#L44`);
  `description` trimmed, at most 200; both bounds exported and given to the fields as `maxLength`; past
  them the BFF's 400, which the page says as refused (`ui/src/pages/client/SettingsPage.tsx#L35-L36`).
- Empty in `startingConfig` (`bff/src/records/clients.ts#L35-L47`), the seed's company
  (`scripts/src/demo/company.ts#L19-L28`), `DEMO_CONFIG` (`shared/src/demo.ts#L27-L36`), which the fake
  saves whole (`ui/src/fake.ts#L693-L700`), the mock's fixtures and 30 test literals in 17 files
  (`git grep -c -E "defaultLanguage: '(vi|en)'" -- '*.ts' '*.tsx'`, summed).
- **The walks' company keeps both empty**, or every door and header would move now and again for
  milestone 3's logo; the walk types its own, the mock's `FORMATTED` the same.

**4. The cleaning, the injection surface.** No cleaner exists: no `dangerouslySetInnerHTML`,
sanitiser or `DOMParser` in `ui/src`, `shared/src` or `bff/src` (one `DOMParser` in
`visual/src/capture.ts#L236`); DOMPurify is locked only for the docs site's diagrams
(`pnpm-lock.yaml#L4311`, `#L14188`). So no dependency and no install of yours: one atom, `BrandName`
in `ui/src/components/atoms/`, cleans at each draw and builds what it keeps as React elements.

- **Kept:** `b` and `strong`; a `span` whose `style` is exactly one `color` of `#rrggbb`
  (`isHexColour`, `shared/src/config.ts#L24`); `br`. **Unwrapped** to their text: every other element.
  **Dropped** with their text: `script`, `style`, `template`, comments; every other attribute.
- **Parsed** by the browser's `DOMParser`, as the legacy's cleaner (legacy
  `workspace/uis/base/src/utils/sanitize-html.ts#L119`): a document that runs nothing, only the parts
  built from it reaching the page. Nothing left but space draws the plain name.
- **Readers:** the drawing `aria-hidden`, the plain name beside it in Mantine's `VisuallyHidden`; the
  tab and the logo's `alt` (`BrandBand.tsx#L17`) are plain already.
- **At draw, not on save:** the BFF has no DOM, so a save-side clean is a hand tokenizer and a
  serializer whose output must re-parse within the bound (1,000 `&` become 5,000 characters, and a
  stored record that does not parse stops every boot, `bff/src/app.ts#L315-L316`), guarding no reader:
  every draw goes through `BrandName`. Revisit when something else draws it (a mail, a document).

**5. The sign-in knows the company first.** The boot asks the settings before who is signed in
(`ui/src/ClientApp.tsx#L102-L118`); the GET needs only the company, from the address, the link or the
device (`#L155-L157`, `#L103`), sent as the header the BFF resolves (`bff/src/app.ts#L215-L223`,
`#L332-L336`); the sign-in and the QR landing get the whole record (`ClientApp.tsx#L339-L340`,
`#L500-L501`). The fields ride it: `Brand` (`ui/src/brand.ts#L4`) takes them, `CREDO_BRAND` empty.

**6. The parts.** New: `BrandName` (plain or formatted, a meaning take for whether its colours show)
and `IdentityFields` (`ui/src/parts/`: the name, the formatted name with its hint and preview, the
description; drawn by the form and the gallery's settings page). Changed: `HeaderBrand` takes the
formatted name; `BrandBand` and `DoorCard` take it and the description, a caption under the name;
`SignInFrame` passes them; `BrandPreview` passes both. **Where nothing is set, each draws today's
markup**, the null proof. Samples are invented (`An Phat`, `ui/src/design-system/samples.ts#L71`: the bundle
refuses the data set's names, `scripts/src/fake.test.ts#L55`); the settings page's states
(`ui/src/design-system/Pages.tsx#L918`, `#L1012-L1016`) draw `IdentityFields`, plus "A formatted name";
each take gets its contract line (`ui/src/design-system/guideline.ts#L816`, `#L1190`, `#L1247`) and its
props (`ui/src/design-system/entries.tsx#L798`, `#L821`, `#L1044`, `#L1118`).

**7. The words.** Five keys in both dictionaries, 775 to 780 (the hint's tags typed as text):

| Key | English | Vietnamese |
| --- | --- | --- |
| `settings.formattedName` | Name with formatting | Tên có định dạng |
| `settings.formattedNameHint` | Optional, in HTML: bold `<b>`, a colour `<span style="color:#rrggbb">` and a line break `<br>` are kept, the rest dropped; the tab and screen readers keep the name above. | Không bắt buộc, bằng HTML: giữ chữ đậm `<b>`, một màu `<span style="color:#rrggbb">` và xuống dòng `<br>`, phần khác bị bỏ; tab trình duyệt và trình đọc màn hình dùng tên ở trên. |
| `settings.formattedNamePreview` | Shown as | Hiển thị |
| `settings.description` | Description | Mô tả |
| `settings.descriptionHint` | A short line under the name on the sign-in card. | Một dòng ngắn dưới tên trên thẻ đăng nhập. |

`#rrggbb`, never a colour: lint refuses a hex in a script outside the design system and the mock
(`eslint.config.js#L15`, `#L85-L91`). Read by `scripts/src/words.test.ts#L43`, `#L48`, `#L64`, `#L412`,
`#L422`, `#L423` (775, 776, 777 become 780, 781, 782) and `ui/src/i18n/i18n.test.ts#L11`, `#L25`.

**8. The ceremony.** The landing touches `shared`, `bff`, `scripts`, `ui`, `visual` and `walk`: the
whole check on `pre-merge` (`docs/conventions/qa.md#L262`), and `pre-main-review` once, a screen a user
meets and a field drawn from typed markup (`qa.md#L106`). Not needed: `make check`, `bash ops/test.sh`.

## Decided by the machine

1. **Cleaned at draw, in one atom, by the browser's parser**; no dependency (4 above).
2. **On the coloured header the colours give way to its text colour** (`--credo-on-header`,
   `ui/src/frame/Shell.tsx#L86`), the bold part and the break kept: a second colour typed for a light
   ground vanishes on one brand colour. On the white header and the card, as typed. Point 1 asks it.
3. **The walks' company keeps both empty**; **the bounds** are 1,000 (the legacy's) and 200.

## The case table

Rows 1 to 12 are each seen red before their code; rows 5 to 8 are the cleaning's.

| # | The case: one behaviour, one sentence | Held by |
| --- | --- | --- |
| 1 | The tab says "Credo" while the settings load, when the service fails and for an unknown company, and the plain name once they are known, signed out or in, over a title already in the head | ui, `App.test.tsx` |
| 2 | The page is marked in the language shown, and again when a person switches | ui, `Providers.test.tsx`, `App.test.tsx` |
| 3 | The header and the card draw the formatted name where set, and the plain name in today's markup where none is or nothing is left after cleaning | ui, `BrandName.test.tsx`, `Shell.test.tsx`, `BrandBand.test.tsx` |
| 4 | The card draws the description under the name, nothing where none is set, on the sign-in and the QR landing | ui, `BrandBand.test.tsx`, `SignIn.test.tsx` |
| 5 | A heading holding a formatted name is read, and found, by the plain name | ui, `BrandName.test.tsx` |
| 6 | The cleaning keeps a bold part, a span's one `#rrggbb` colour and a line break, unwraps every other element to its text, and drops `script`, `style`, `template` and comments with their text | ui, `BrandName.test.tsx` |
| 7 | No attribute survives but that colour (an `onclick`, an `href`, a style of two declarations, a colour by name, a `url(`); an `img`, `svg` or `iframe` draws no element; `window.alert` is never called | ui, `BrandName.test.tsx` |
| 8 | No app file in `ui/src`, its tests aside, sets markup from a string: no `dangerouslySetInnerHTML`, `innerHTML =`, `outerHTML =` or `insertAdjacentHTML` | ui, `literals.test.ts` |
| 9 | A save keeps the formatted name as typed and the description trimmed; a record stored before, and a new company, read both empty | shared, `config.test.ts`; bff, `config.route.test.ts`, `operator.route.test.ts` |
| 10 | A formatted name past 1,000 characters or a description past 200 is refused with a 400, the record as it was | shared, `config.test.ts`; bff, `config.route.test.ts` |
| 11 | The Identity block holds the name, the formatted name with its hint and preview, and the description; typing redraws that preview and the preview's header and card before any save | ui, `IdentityFields.test.tsx`, `Settings.test.tsx` |
| 12 | On the coloured header the formatted name's colours give way to its text colour, bold and break kept; on the white header, as typed | ui, `Shell.test.tsx` |
| 13 | Each field saves as before: the 25 cases of `Settings.test.tsx` stand | ui, its diff against `pre-merge` adding lines only |
| 14 | The operators' console and doors keep "Credo" and no description | ui, `OperatorApp.test.tsx` |
| 15 | The gallery draws each new state of 6 above | ui, `Gallery.test.tsx` |
| 16 | Every door and header draws as before where nothing is set | visual, the pinned diff empty in steps 1 and 2 |
| 17 | Both dictionaries hold 780 keys, every Vietnamese one its own | scripts, `words.test.ts`; ui, `i18n.test.ts` |
| 18 | The admin's setup walk holds 16 screens, 14 to 16 on the main path, each from its mock state | visual, `walks.test.ts` |
| 19 | In a browser the tab says the name on the sign-in and "Credo" on the two failure screens, the page marked in the language walked | walk, `piece-1.spec.ts` |

## The steps

Sizes are the last rows of each step's shape in the runs log. Each gate is the touched package's
`pnpm --filter @credo/<pkg> check`, exit 0 by its own code, plus the citation test. "The pinned diff"
is `git diff -U0 -- visual/src/resolved.pinned.txt | grep '^+[a-z]' | cut -d' ' -f1 | sort -u`.

- [x] **1. The gallery.** `BrandName` with its cleaning; `HeaderBrand`, `BrandBand`, `DoorCard` and
      `BrandPreview` taking the new contents as strings, so `shared` waits; `IdentityFields`; the
      gallery's states, contracts and entries; the five keys. Rows 3 and 5 to 8 at the parts, 12, 15 and
      17 red first; row 16 the null proof. _Done when:_ `ui`'s, `visual`'s and `scripts`' gates; the
      pinned diff empty. **29 min** (250.1's step 1: 29). Then point 1.
      _Done 2026-11-25, build 250.2 step 1, sonnet:_ `ui`'s, `visual`'s and `scripts`' gates each exit 0 (the runs of 11:59 to 12:17); rows 3, 5 to 8, 12, 15 and 17 seen red first on the old code in one run (11:49), row 8 by a planted `innerHTML` file; row 16 the null proof, the pinned diff empty; `HeaderBrand` takes `formatted`, `BrandBand` and `DoorCard` `formatted` and `description`, `BrandPreview` both; `DoorCard` gains no state, so its two-state tests stand.
- [x] **2. The record.** The two fields and their bounds in `shared`; both empty in `startingConfig`,
      the seed's company, `DEMO_CONFIG`, the mock's fixtures and the test literals. Rows 9 and 10 red
      first. _Done when:_ `shared`'s, `bff`'s, `scripts`', `ui`'s and `visual`'s gates; the pinned diff
      empty. **17 min** (241.2's step 2: 17, a shared shape through three gates).
      _Done 2026-11-25, build 250.2 step 2, sonnet:_ `shared`'s, `bff`'s, `scripts`', `ui`'s and `visual`'s gates each exit 0 (the runs of 12:22 to 12:44, much of it waiting on the lock and the load); rows 9 and 10 seen red first in `shared` (12:21, five cases), the `bff` cases written beside them and read green by the gate; the pinned diff empty.
- [x] **3. The screens, on the fake.** `Brand` takes the fields; `Shell` and `SignInFrame` pass them;
      `Settings` draws `IdentityFields` and `BrandPreview` from the draft; `ClientApp` draws the tab's
      title in both branches; `Providers` marks the language; the mock's `FORMATTED` and three states
      (screen 3 "formatted", its frame in `TYPED`; screens 4 and 1 "formatted"). Rows 1 to 4, 11, 13 and
      14 red first. _Done when:_ `ui`'s and `visual`'s gates; the pinned diff naming the nine settings
      screens below alone (90 lines); `git diff pre-merge -- ui/src/parts/Settings.test.tsx | grep -c '^-[^-]'`
      0. **21 min** (250.1's step 2: 21).
      _Done 2026-11-25, build 250.2 step 3, sonnet:_ `ui`'s and `visual`'s gates each exit 0 (the runs of 12:54 to 12:59); rows 1 to 4 and 11 seen red first on the old code (12:47, 11 cases), rows 3 and 14 the null proofs in part (the parts of step 1 already drew them); the pinned diff names the nine settings screens alone, 90 lines; `Settings.test.tsx` differs from `pre-merge` by one removed line, `getAllByRole('textbox')` counting 4 where it counted 2, since the Identity block adds two fields (the row's count was 0).
- [x] **4. The walk.** As below; rows 18 and 19; item 681's fix. _Done when:_ `visual`'s, `walk`'s and
      `ui`'s gates; row 18 red on the old counts; the pinned diff naming the three new screens alone
      (30 lines); each new step replayed in jsdom on the real router. **16 min** (250.1's step 3: 16).
      _Done 2026-11-25, build 250.2 step 4, sonnet:_ `visual`'s, `walk`'s and `ui`'s gates each exit 0 (the runs of 13:11 to 13:15); row 18 seen red on the old counts (13:02, two cases); the pinned diff names `14-formatted-typed`, `15-formatted-saved` and `16-formatted-card` alone, 30 lines; the new steps replayed in jsdom on the real router in `App.test.tsx`; item 681's `exact: true` is in the spec; no walk run, no base written.
- [x] **5. The prose.** `docs/products.md#L35`'s Settings row gains the two fields, the tab and the
      language; `docs/memo/ui.md` gains the surprise: the formatted name is stored as typed and drawn
      only through `BrandName`, which cleans it at each draw. Item 681 `[FIXED]`; item 683 filed: a
      company's new passkey is made for the relying party "Credo", the machine's, `[DEFERRED]` to
      milestone 4's plan, whose manifest reads the settings in the BFF. _Done when:_ the citation test.
      **5 min** (241.2's step 8: 5, prose and two items).
      _Done 2026-11-25, build 250.2 step 5, sonnet:_ the Settings row of `docs/products.md` names the two fields, the tab and the language; `docs/memo/ui.md` holds the surprise; item 681 `[FIXED]`, item 683 filed `[DEFERRED]`; `pre-merge` is an ancestor of the branch; the words line of `docs/products.md` already read 780, so no word count moved; the citation test exit 0 (the run of 13:17).
- [x] **6. Your walk run, then the bases.** The run below, green; the bases committed alone, each
      walk's count matching the log; the same walks without flags, 0 moved. **2 min** (250.1's step 5: 2).
      _Done 2026-11-25, build 250.2 step 6, sonnet:_ your walk run of 25 November (14:40 to 14:55) green: the admin walk's 96 pictures moved none from the first pass to the second, 48 moved against the old bases and 18 are new; the office's 240 pictures moved none either way and 6 moved against the bases, `office-5-settings`; the bases commit holds those 72 pictures alone, 48 moved and 18 new for piece 1 and 6 moved for piece 2, as the run's comparison lines say; the second run without flags was not made, the same run's two passes at 0 moved standing for it, as piece 250.1's step 5 did. An earlier run of 13:41 went red in piece 1 on the new step 16's wait, fixed in the spec.
- [ ] **7. The recap and the landing.** The recap and its products row; `pre-merge` taken in, the
      gates again, the landing; the whole check; `pre-main-review` before `main`, at most once a push.
      **43 min** (250.1's step 6: a recap 3; a whole check and a review about 20 each).

Total: 133 minutes, 43 of them the landing's.

## The walk

**Moved:** every screen that draws the settings page: eight of the admin's setup walk, run by
`piece-1` (`walk/run.sh#L46`; `visual/src/walks.ts#L334-L484`), and `office-5-settings`, run by
`piece-2` (`walk/specs/piece-2.spec.ts#L554-L562`). 54 pictures:

```bash
ls walk/specs/piece-1.spec.ts-snapshots walk/specs/piece-2.spec.ts-snapshots | grep -c -E '^(3-settings|4-saved|5-language-menu|7-save-failed|8-save-conflict|10-saved-white|11-menu-icons|13-preview|office-5-settings)-'
```

**New:** three scenes on the main path, after `4-saved` (`walk/specs/piece-1.spec.ts#L169-L173`), the
header in Brick. Beside `NEW_NAME` (`#L34`) the root types `NEW_FORMATTED`,
`<b>Minh Phát</b><br><span style="color:#1d3557">Sài Gòn</span>`, and `NEW_DESCRIPTION`, "Vật liệu
xây dựng, giao tận công trình" (14); saves (15); signs out (16); signs in and opens Settings as screen
3 does (`#L114-L123`), before `5-language-menu`. 18 pictures; 13 screens become 16, pinned at
`visual/src/walks.test.ts#L57`, `#L85`, and named in `piece-1.spec.ts#L15-L18`, `#L238`, `#L242`.

| Scene | What it shows | Its question |
| --- | --- | --- |
| `14-formatted-typed` | both fields typed; their preview and the preview's header and card in them | Do the previews show the name with its bold part, second colour and line break before the save? |
| `15-formatted-saved` | saved: the header's name formatted, in the header's own colour | Does the header show the company's formatted name, readable on its colour? |
| `16-formatted-card` | signed out: the card's name in its colours, the description under it | Does the card show the formatted name and the description as the company would want them? |

Each question is a key of `visual/site/questions-vi.json` (`#L4`), with its Vietnamese. Checked in the
browser, no picture: the tab says "Minh Phát" at `1-sign-in` (`#L88`), `NEW_NAME` at `4-saved`, "Credo"
at `6-service-down` and `9-unknown-company` (`#L223`, `#L231`); `lang` is the language walked, then the
other after the switch (`#L211-L217`). Item 681 (`docs/open-items.md#L2321`): `exact: true` on the
finder at `#L131`. Headings keep the plain name for a reader, so every finder by name stands.

**Your one run** (step 6), then `--write`'s bases committed, then the same walks with no flags:

```bash
bash walk/run.sh piece-1 piece-2 --moved 3-settings,4-saved,5-language-menu,7-save-failed,8-save-conflict,10-saved-white,11-menu-icons,13-preview,office-5-settings --write
```

You will see "== verdict: green": 54 pictures moved, all named, 18 listed new.

## Your points

1. **The parts in the gallery** (after step 1; it stops nothing). In this piece's worktree run
   `pnpm fake`, open the address on the first line it prints with `/48b74d079/gallery` after it:
   Atoms, "BrandName"; Molecules, "BrandBand"; Pages, "BrandPreview" and "The settings page", "A
   formatted name". Does the name read as the company's, and on the coloured header is it right that
   its colours give way to the header's own, the bold part and break kept? **Recommendation: yes.** A
   no to the colours draws them as typed there too, one line in `HeaderBrand`.
2. **The walks page** (after step 6). Twelve screens ask: the nine that draw the settings page, now
   with the two fields, and the three new ones, the name typed with its preview, saved in the
   header, and on the signed-out card with the description. **Recommendation: yes**, screen by
   screen. A no reopens the piece while the rest goes on.
3. **On ridge** (the milestone's one look, after your push), on your -3 copy, a phone and a PC: set a
   two-colour name and a description, save, sign out: the card shows both; the tab says the company's
   name, in both languages. Does the name read as the company's? **Recommendation: yes.** A no reopens
   the part it names; milestone 3 waits only where it draws on it.
