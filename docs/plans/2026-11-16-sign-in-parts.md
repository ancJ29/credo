# The sign-in's parts: the design system's first real components

## At a glance

What it is for, in the human's words of 2026-11-16: "plz help me plan for components that can
support these pages, I think we can use this for design system starting point", pointing at the old
app's `/login` and `/login-via-qr-code`, captured that day on a demo company. The two pages are built
from thirteen parts; five become components, two become theme entries of Mantine's own parts,
and the rest the new app already draws or does not need. Each shows in the gallery, drawn in its states.

**Changed 2026-11-16 18:5x, the human, after looking at the gallery:** "I think no need for legacy
part". Read as: the gallery shows only our parts, with no picture of the old app's beside any of them;
steps 1 and 2 built that pane, step 3b took it out, and the lines below that spoke of it are struck
or reworded. Open item 516 (the pane's pictures) is moot.

No screen changes: the gallery is the only caller, and its door card drawn as the two legacy pages
is the mock of the doors' next version. Whether the doors take the parts is the question that ends
this page. The price: about 46 machine minutes and one look.

## The slice

One slice, walkable in the gallery when it ends: the legacy's two sign-in cards rebuilt from parts,
each part drawn in the gallery. It lands after the design system's landing 2, since
it is cut from that branch (`design-system`, `0f788579`) and carries its commits. Stage 3 is the
gallery in the human's browser; stage 4 is not stood up, since nothing ships.

The legacy's lines below are the old repo's `workspace/uis/`: `base/src/components/auth/` for the
shared parts (`auth/ui/…`, `auth/pages/…`), `c-mngt/src/` for the two pages. The new app's are this tree's.

## How each app signs a person in, measured

- **The new app, a client's person:** a name (their code, or the email the root gives,
  `shared/src/signins.ts#L6-L7`) and a password, `ui/src/ClientApp.tsx#L205-L208` (`submit` calls `api.signIn`), drawn by `SignIn`. **Or a
  QR code** the root issues for one person (`bff/src/routes/staff.ts#L815-L820`), good once for 15
  minutes (`shared/src/signins.ts#L29`): the phone's camera opens `/login?client-code=…&qr=…`
  (`qrLink`, `#L35-L36`), the app signs in on opening it (`ClientApp.tsx#L137-L174`), and
  `ui/src/pages/client/QrLanding.tsx` shows the wait or the refusal.
- **The new app, the operator:** a passkey (`OperatorSignIn`, `ui/src/OperatorApp.tsx#L167`), the
  first made from a join link (`JoinPage`, `#L62`).
- **The old app:** a name or code and a password, with "remember me" on by default
  (`c-mngt/src/pages/auth/SignInPage.tsx#L81`); or a login link, opened as `?token=…`
  (`c-mngt/src/pages/auth/AccessViaQRCodePage.tsx#L114`), scanned inside the app by camera or
  picture (`#L282-L302`), or typed (`#L231-L270`). The QR picture is that page; `auth/pages/LoginViaQRCodeUI.tsx`,
  a code shown on a desktop, is drawn by nothing in `c-mngt`.

**Where they differ:** the new app has no page to scan a code inside the app or type one, no button
on its sign-in that leads to one, and no "remember me" (the only lines of `ui/src`, `bff/src` and
`shared/src` that say "remember" are about the fake's switch, `ui/src/fake.ts`). Its QR way is real but reached only by the phone's camera, outside the app.

## The parts

| Part | The legacy: picture, code | The new app now | Level, file | Tokens |
| --- | --- | --- | --- | --- |
| Logo tile | the card's head, all four pictures; `auth/ui/AuthCard.tsx#L77-L97`: 44 px, corners 10, a brand-2 line, hidden when the logo fails | bare at 36 px in the coloured header, an icon when none (`ui/src/pages/SignIn.tsx#L79-L83`, `ui/src/frame/Shell.tsx#L149`) | atom, `components/atoms/LogoTile.tsx` | new `logoTile` (44, 10); `brand-2` |
| Brand band | the card's head; `AuthCard.tsx#L68-L118`: brand-0 ground, 28 over 40 at the sides, the name at 700 and `md`, a brand-1 line (`#L115`) | the name is the header's title, 600 at `h4` (`SignIn.tsx#L84-L86`), outside the card | molecule (holds the tile), `molecules/BrandBand.tsx` | `brand-0`, `brand-1`; new `doorPadding` |
| Door heading | both titles, the link page's subtitle; `auth/ui/AuthHeader.tsx#L16-L20` (`h3`, 700, centred), `AuthSubtitle.tsx#L12` (`sm`, dimmed, centred, 32 below) | the frame's title, `h2` at 700 (`SignIn.tsx#L126-L128`); hints as loose dimmed text (`OperatorSignIn.tsx#L35-L37`, `JoinPage.tsx#L132`, `QrLanding.tsx#L33`) | atom (holds none of ours), `atoms/DoorHeading.tsx` | new `doorSubtitleGap` (32) |
| Back link | the link page's foot; `auth/ui/AuthFooterLink.tsx#L24-L33`, `AuthLink.tsx#L14`: an arrow at 14, `sm`, brand-7 (`base/src/utils/color.ts#L31-L33`) | none; the QR landing's way back is a button (`QrLanding.tsx#L34`) | atom, `atoms/BackLink.tsx` | `brand-7` |
| Door card | the whole card; `AuthCard.tsx#L40-L64`: shadow `xl`, corners `md`, a neutral-3 line, a 4-px bar at 90° from brand-7 to brand-9 (`#L50-L55`), a body at 40 (28 under the band) | `SignInFrame`'s card: shadow `lg`, a default line, 32 (24 and 20 on a phone), no bar, no band (`SignIn.tsx#L118-L125`); four doors draw it | organism, `organisms/DoorCard.tsx` | new `doorBar` (4), `doorBarGradient` (90°); `neutral-3` |
| Gradient button | both pages' main act; `auth/ui/AuthButton.tsx#L31-L40`: full width, `md`, corners `md`, 135° from brand-7 to brand-9 | the same values by hand, `style={{ background: BRAND_GRADIENT }}`, in three doors (`SignIn.tsx#L202`, `OperatorSignIn.tsx#L43`, `JoinPage.tsx#L138`) | none: Mantine's `variant="gradient"`, the theme's `defaultGradient` | `brand-7`, `brand-9` |
| Labelled divider | "or" on `/login`, "hoặc" on the link page; `auth/ui/AuthDivider.tsx#L7-L16` | none | none: Mantine's `Divider`, its label centred, `sm`, dimmed by the theme | dimmed |
| The other way's button | `auth/pages/LoginUI.tsx#L129-L137`, `AccessViaQRCodePage.tsx#L220-L228`: Mantine's default variant, an icon | Mantine's default button, in the gallery (`ui/src/design-system/Gallery.tsx#L89`) | nothing to build | — |
| Fields with an icon | `auth/ui/AuthInput.tsx#L8-L18` | the same Mantine fields and line, icons at 18 (`SignIn.tsx#L174-L196`) | nothing to build | — |
| Remember me | `LoginUI.tsx#L106-L112` | no such choice | the gallery's state only, Mantine's checkbox; item 542 | — |
| Error line | `auth/ui/AuthError.tsx#L11`: red text, `sm`, centred | a red `Alert`, `role="alert"` (`SignIn.tsx#L162-L171`) | the new app's kept | — |
| Ground, language switch | `auth/ui/AuthLayout.tsx#L39-L57`: 135° from neutral-0 to neutral-1, the switch floating top right | flat neutral-1 (`SignIn.tsx#L26`) under the app's coloured header with its switch (`#L69-L109`) | template, `SignInFrame`, unchanged; the question below | — |
| Scanner, typed code | opened from the link page, not in the pictures | none; item 543 | not in this piece | — |

## Decided for the parts

Each line is the machine's decision, with its reason, vetoed on sight.

- **Sentence case, and no part changes a word's case.** Each part draws its words as given; the
  gallery writes them as Vietnamese writes them, the first word and names capitalised, as the new
  app's dictionary already writes every door's words (`ui/src/i18n/vi.ts#L11-L19`). The legacy's
  Title Case ("Đăng Nhập Bằng Liên Kết", "Quét Mã QR", "Nhập Mã Thủ Công",
  `c-mngt/src/i18n/locales/vi/auth.json`'s `auth.magicLink`) is not copied: one page in one form,
  where the legacy shows two. The new app's one Title Case word, English "Sign In"
  (`ui/src/i18n/en.ts#L16`), copied from the legacy, becomes "Sign in" when the doors take the
  parts, since `ui/src/i18n/words.test.tsx` pins every door's words.
- **The divider's word is always its caller's; nothing holds a default.** The untranslated "or"
  is `AuthDivider`'s default (`AuthDivider.tsx#L7`), reached by `LoginUI.tsx#L128` calling it with
  no label, while the link page passes its own word (`AccessViaQRCodePage.tsx#L218`). With no
  default, a missing word is an empty divider, never English on a Vietnamese page. The word joins the
  dictionary as `auth.or` when a door first draws one.
- **Mantine stays the base:** the gradient and the divider are entries in `designThemeOf`
  (`ui/src/design-system/theme.ts#L10-L24`), not wrappers, as `ui/CLAUDE.md#L45-L46` asks. Mantine
  9.6.3's Button takes `theme.defaultGradient` for its gradient variant (read in its
  `theme.types.d.ts` and `Button.d.ts`).
- **The levels by the written rule** (`ui/CLAUDE.md#L47-L55`): an atom holds none of ours, so the
  heading is an atom though it is two Mantine parts; the band holds the tile, the card the band.
- **These five join at the human's ask, as the six samples joined as the day-one set**; the rule
  of three binds every part after them. The back link and the divider have no door to draw them,
  since no door offers a second way in; the gallery's two pages are their caller until one does.
  The count goes from 6 to 11, under landing 4's 16 (`docs/plans/2026-11-12-design-system.md#L132-L136`), so the gallery
  stays one page.
- **The gallery first, and it is the doors' mock.** Collaboration's hand-off 1 starts a UI's next
  version as a static mock; the door card's two states, drawn from the parts, are that mock, so the
  doors' later piece starts from them, not from a hand-drawn page that would drift from the parts.
  Its phone width and refusals are added there.
- **The gallery's two pages are the legacy's cards whole**, its checkbox and its link button
  included, since the look asked is whether the parts rebuild the pages; a door draws only what it
  has a behaviour for.
- **No pane of the old app's pictures (the human's words of 2026-11-16 18:5x, quoted above).** Steps 1
  and 2 cut four pictures from the day's capture and drew them under "Legacy" beside their parts;
  step 3b took the pane, its map and the pictures out, and the gallery draws only our parts. The
  parts' look is judged by eye against the old app's pages, as the human's point 1 says.
- **The error stays the new app's red `Alert`**: the doors' tests find it by its `role="alert"`,
  which a screen reader announces; the legacy's red line is plain text, announced by nothing.
- **The card's own gradient runs at 90°**, a token of its own: `tokens.ts`'s `brandGradient` says it
  draws "the card's top bar" (`ui/src/design-system/tokens.ts#L20-L22`), but the legacy's bar runs at
  90° and its button at 135°; the comment is corrected in step 4.

## The cases

| # | The case: one behaviour, one sentence | Held by |
| --- | --- | --- |
| 1 | A logo tile draws the logo in a 44-px tile with corners of 10 and a brand-2 line, and draws nothing when there is no logo or it fails to load | `ui/src/components/atoms/LogoTile.test.tsx` |
| 2 | A brand band draws the tile beside the company's name, bold and centred on the brand's palest shade with a brand-1 line beneath, and the name alone with no logo | `ui/src/components/molecules/BrandBand.test.tsx` |
| 3 | A door heading draws its title as a heading, bold and centred, and a subtitle beneath only when given | `ui/src/components/atoms/DoorHeading.test.tsx` |
| 4 | A back link goes where its caller says, its arrow before its words, in brand-7 | `ui/src/components/atoms/BackLink.test.tsx` |
| 5 | A door card draws a 4-px bar in the brand's gradient across its top, the brand band, then what it holds | `ui/src/components/organisms/DoorCard.test.tsx` |
| 6 | A gradient button draws the brand from shade 7 to shade 9 at 135°, with no colour of its own | `ui/src/design-system/theme.test.tsx` |
| 7 | A labelled divider draws its word centred, small and dimmed, and a divider given no word draws none | the same |
| 8 | ~~The gallery draws a part's legacy picture beside it under "Legacy"~~ struck 2026-11-16: no pane; the gallery's test now asserts it draws none | `ui/src/design-system/Gallery.test.tsx` |
| 9 | The gallery shows every component of the three folders under its level's heading, the five new ones included | the same, its first case |
| 10 | No new part writes a colour or imports from a level above its own | `literals.test.ts` and `eslint.config.js`, as they stand |
| 11 | No screen of the app changes | `git diff --name-only --diff-filter=MDR pre-merge...HEAD -- ui visual walk \| grep -vcE '^ui/src/(components\|design-system)/'` counts 0, and `pnpm --filter @credo/visual check` exits 0 |

## The steps

Each step's check is `pnpm --filter @credo/ui check` and the citation test,
`pnpm --filter @credo/scripts exec vitest run src/citations.test.ts`; each case is seen red once,
its rule's line changed and put back. Sizes are the runs log's rows of the same shape: the design
system's step 1, a page, a part and its tests through the ui gate, 6 minutes; its step 2, five parts,
4; its review, fix, reread and recap, 12, 3, 9 and 2.

- [x] **1. The pane and the logo tile, end to end.** `design-system` taken in first, since another
      lane is fixing landing 2 in `tokens.ts` and the gallery. The tile's picture cut;
      `legacy.ts` and the pane (case 8, red first); `LogoTile` and its test (case 1); its tokens.
      _Done when:_ both checks exit 0, and in one invocation Vite's dev server on a spare port,
      `curl -sf` of `/gallery.html` and of the tile's picture, then stopped. **6 min.**
      _Done, 2026-11-16:_ `design-system` taken in (`f9f153af`); the tile's picture cut 44 by 44 from the PC sign-in capture
      with Playwright's PNG codec; case 8 seen red (pane's block off), case 1 seen red (failed-load check off);
      `pnpm --filter @credo/ui check` exit 0, the citation test exit 0, the serve probe (Vite on 5391, gallery and picture) exit 0. 14 min.
      The pane and its pictures were taken out in step 3b (the human's words of 2026-11-16 18:5x); the tile stays.
- [x] **2. The theme's two.** `defaultGradient` and the divider's label in `designThemeOf`
      (cases 6 and 7); the gallery's Mantine group draws the gradient button and the default button
      each with an icon, and the divider worded "hoặc". _Done when:_ both
      checks exit 0, and `grep -c 'BRAND_GRADIENT' ui/src/pages/SignIn.tsx` still counts 3, no door
      touched. **4 min.**
      _Done, 2026-11-16:_ cases 6 and 7 each seen red once (the `defaultGradient` line removed; the divider's label style
      emptied); the gallery draws the gradient button, the default button and the "hoặc" divider, each with
      a picture of the old app's beside it (since taken out, step 3b); the case's test file became `theme.test.tsx` (JSX); both
      checks exit 0; `grep -c 'BRAND_GRADIENT' ui/src/pages/SignIn.tsx` counts 3, no door touched. 8 min.
- [x] **3. The heading, the back link and the band.** `DoorHeading`, `BackLink`, `BrandBand`, a
      test beside each (cases 2 to 4), each drawn in the gallery. _Done when:_ both checks exit 0 and
      `ls ui/src/components/*/*.tsx | grep -vc test` counts 10. **4 min.**
      _Done, 2026-11-16:_ cases 2, 3 and 4 each seen red once (the band's ground removed, the subtitle always drawn,
      the link's colour shifted to brand-6; one run, one failing test each); the count is 10; both checks exit 0 after 3b. 8 min.
- [x] **3b. The Legacy pane taken out** (the human's words of 2026-11-16 18:5x, above). The `Beside` helper's
      legacy half, `legacy.ts`, the four pictures under `design-system/legacy/`, case 8's test and every test
      looking for "Legacy" or a legacy picture; steps 1 and 2's ticks stay as history. _Done when:_ `grep -rnE
      'legacy\.ts|LEGACY\b|design-system/legacy/' ui` finds none, both checks exit 0. **8 min.**
      _Done, 2026-11-16:_ none found by the grep; the gallery's test asserts it draws no "Legacy" text or picture
      (written in step 4, see its correction) and still shows the gradient button, default button and "hoặc" divider; both checks exit 0. 8 min.
      Nothing outside `ui/src/design-system/`, `ui/src/components/` and this plan changed.
- [x] **4. The door card and the two pages.** `DoorCard` and its test (case 5); its gallery entry
      draws two states, the sign-in and the link page, in sentence case; `brandGradient`'s comment corrected. _Done when:_ both
      checks exit 0, the count is 11, and step 1's serve probe exits 0. **6 min.**
      _Done, 2026-11-16:_ case 5 seen red once (the band left out of the card); `DoorCard` draws the 4-px bar at
      90°, the band and the body at 28 over 40; the gallery's entry draws the sign-in and the link page in
      sentence case, no picture of the old app's; `brandGradient`'s comment says 135° and the bar's own 90°; the
      count is 11; both checks exit 0; the serve probe, Vite on port 5472, fetched `/gallery.html` and
      `src/components/organisms/DoorCard.tsx` and both exited 0 (step 1's fetched a picture step 3b deleted). 12 min.
      Correction to 3b's line above: the test that the gallery draws no "Legacy" was not yet in step 3b's commit
      (the command that wrote it was refused); it and the tests for the three Mantine rows were written in this step.
- [x] **5. Review and landing.** Another model reads steps 1 to 4; one fix pass; `pre-merge` taken
      in; case 11; the recap; `docs/memo/ui-code.md#L69` corrected, since four doors draw
      `SignInFrame`, not one; item 516 closed as moot; point 1. _Done
      when:_ case 11 counts 0, the checks exit 0 after the fix, and the branch merges. **26 min.**
      _Progress, 2026-11-16:_ the review (opus, at `99643cfd`) said may merge with eight Lows; the one fix pass
      fixed all eight; `pre-merge` taken in (`c9e7a711`, no conflict); case 11 counts 0; the memo's levels count
      and its frame line corrected; item 516 closed as moot, 553 written for the doors' later piece. Done: the review's verdict (may merge, at `99643cfd`) and the fix commit `1cbca5e2`; case 11 counts 0; after the fix pass the ui package's check and the visual package's check each exited 0; the recap is `docs/recaps/2026-11-16-sign-in-parts.md`. The landing on `pre-merge` follows; point 1 is still unasked.

About 46 machine minutes, and one look.

## Keeping every test and walk green

- **No door changes, so no walk picture is asked again.** The parts are drawn by the gallery
  alone; `designThemeOf` is read by the gallery and by tests only, and no screen draws
  `variant="gradient"` or a labelled divider (both grep 0), so its two new entries move nothing even
  after landing 3 makes it the app's theme.
- **`tokens.ts` gains keys and changes no value** the frame reads; `Gallery.tsx` and `tokens.ts` are
  the files this branch shares with landing 2's fix pass, so step 1 takes that in before anything.

## The human's points

1. **The parts, judged against the old app's pages (step 5).** You open the gallery (in the piece's `ui/`,
   `pnpm exec vite --open /gallery.html`). Each new part is drawn in its states, and the card is drawn twice, as the two sign-in pages, in sentence case with "hoặc" on
   both. Do the parts read as the old app's, judged by eye? A yes opens the question below; a no names the part,
   and its step reopens.

## Not in this piece, and named rather than dropped

- **Remember me** (item 542) and **scanning or typing a code inside the app** (item 543): each a way
  of signing in the new app lacks, not a part; a door draws its control with its behaviour.
- **The parts' phone width and the doors' refusals**, when the doors take the parts.

## The question: do the doors take these parts now?

Whether the new app's own sign-in screens are redrawn from these parts in this piece or a later one
is yours. **The recommendation: a later piece, opened by your yes at point 1.** Taking them undoes
your look of 2026-11-05, the doors under the app's coloured header
(`docs/plans/2026-11-05-signin-look.md#L21-L25`), chosen before the old sign-in was ever captured
(its recap, `#L14`), and moves the doors' walk pictures (48 that day). The gallery shows both first,
at no screen's cost, and its two pages are the later piece's mock.
