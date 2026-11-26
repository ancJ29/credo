# The logo in the header: the company's logo where the stand-in sits, a second logo for a coloured header, the pictures in records of their own

## At a glance

What it is for: the branding campaign's third milestone. The company's people see its logo in the
header on every screen, where a stand-in icon has sat since 3 November (items 76 and 103). The root,
or anyone given the settings right, keeps the logo and gains a second one, drawn on the coloured
header. Each picture leaves the settings for a record of its own, served at an address that names
the company, so milestone 4's icons reuse the route. The cheapest path: the person's photo already
is a record of its own with its read and save (`bff/src/routes/staff.ts#L734-L776`), copied; the door's
`LogoTile` and the header's `HeaderBrand` take an address instead of a data URL; each company's logo
moved at its first read. The price: about 158 machine minutes in eight steps, one landing with the
whole check and a review, your one walk run (618 pictures moved, 6 new), three looks.

**Your two asks:** "components should be viewable from the gallery before integration with BFF":
step 1 draws every new and changed part in the gallery on invented data, before any record or route;
point 1 is the look there. "after finished, walk should be updated properly": step 5 adds one scene,
the counts and its question; step 7 is your one run, over the six walks of a company's screens.

## The slice

One slice: the root opens Settings and uploads a logo for the coloured header; saved at once, the
header and the preview's wear it; with the header white, both wear the logo; signed out, the card
wears the logo as today. One logo alone sits on a white tile on the coloured header; none, the
stand-in. Stage 1 is the gallery and the fake (steps 1, 2); stage 2, the gates and the whole check;
stage 3, the gallery look and the walks page; stage 4, ridge. **Not in it:** the tab and phone-app
icons and the manifest (milestone 4, on this record and route).

## What the code holds

**1. The logo today.** One settings field, `logo`, a data URL or null (`shared/src/config.ts#L9-L10`),
any `image/…` within `MAX_LOGO_BYTES`, 200 KB (`#L45`, `#L68-L72`, `#L77`). The chooser reads it into the
draft (`ui/src/parts/Settings.tsx#L66-L75`, `#L136-L166`), saved with the rest
(`ui/src/pages/client/SettingsPage.tsx#L24-L40`). It rides every
boot's reply (`bff/src/app.ts#L332-L336`) and each save's activity entry twice (`#L354`), though the
log takes "never a photo's bytes" (`bff/src/audit.ts#L43`). The door draws it
(`ui/src/pages/SignIn.tsx#L58-L61`); the header draws `IconBrandAdobe` always (`ui/src/frame/Shell.tsx#L102`).
Item 76 parks "a client's own logo in the header" (`docs/open-items.md#L621-L625`); item 103 says the
door draws it and the shell never does (`#L707-L709`); a test pins the stand-in, "never the stored
one" (`ui/src/frame/Shell.test.tsx#L127-L133`), which this piece rewrites.

**2. The record, and the move** (choice 2), beside the person's photo (`shared/src/records.ts#L68-L70`):

- **Key** `tenant.<id>.picture.<kind>`, the kinds `logo` and `logo-on-colour` in one list in `shared`
  (milestone 4 adds two); **data** `{ picture }`, a data URL within the bound, as `StoredPhoto`. The
  readers of the whole prefix take it: the box move copies it (`bff/src/records/company-copy.ts#L26`),
  the delete sweeps it (`bff/src/records/clients.ts#L253-L264`), the seed's freshness check reads a
  company with one as filled (`scripts/src/demo/apply.ts#L171-L192`).
- **The settings lose `logo`**; a stored shape, read by the move and the freshness check alone, still
  takes an old one.
- **The move, in the settings' read** (`bff/src/app.ts#L313-L317`, under the boot, the save and the
  conflict): a stored data URL is written as the `logo` picture create-only, one already there kept (a
  newer upload, or a move beside it); then the settings without the key over the tag read, a moved tag
  read again, three times at most. A `logo` of null is dropped alike. An interruption between the two
  writes leaves the inline logo, and the next read finishes. No activity entry: no person changed
  anything.
- **Who has one:** every demo copy on ridge, the seed's monogram (`scripts/src/demo/company.ts#L9-L31`,
  `apply.ts#L286-L290`); the operator's create writes none (`clients.ts#L35-L38`).
- **A reader of the old field.** The BFF ships first, `index.html` last (`ops/app.sh#L144-L150`): a page
  loaded in that minute runs the old bundle, whose strict parse (`shared/src/wire.ts#L130-L133`,
  `ui/src/api.ts#L295-L299`) refuses the new reply, so it says unavailable until a reload, as on
  milestone 2's landing. A tab open across the deploy saving the settings sends `logo`: a 400, said as
  refused (`SettingsPage.tsx#L36`). After the move nothing reads it.

**3. The address and the route** (choice 3). The app sends the company's code as a header
(`bff/src/app.ts#L214-L223`), which an `img` never does, so the address names it:
`/api/pictures/<code>/<kind>?v=<tag>`, the tag c-storage gave the record.

- **Checks:** the front door's key (`bff/src/server.ts#L54-L55`); the code and the company, by the
  header's resolution taking the code (404 unknown, 503 a closed box); the kind; the record. No
  sign-in: the card shows the logo before one, and milestone 4's phone fetches with none.
- **Answer:** the bytes, the data URL's type, `X-Content-Type-Options: nosniff` and
  `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox`, or an SVG opened
  at the app's own address runs its scripts there.
- **Caching:** CloudFront caches no `/api/*` (`ops/env.yml#L774-L786`), so the browser does:
  `public, max-age=31536000, immutable` at the record's tag, `no-cache` at another.
- **On Lambda** the adapter sends a body as text unless its type is listed binary (`@fastify/aws-lambda`
  6.4.2, `pnpm-workspace.yaml#L36`, its `index.js#L231`), breaking every picture on ridge and in no
  local check; `createLambdaHandler` (`bff/src/lambda.ts#L8-L13`) passes `enforceBase64` for `image/…`,
  the BFF compressing nothing. The local front passes bytes (`scripts/src/running/front.ts#L88`).
- **The settings' reply** gains `pictures`, each kind's address and tag or null, from one list of the
  prefix, all null by default at the UI's wire boundary. **The save**, `PUT /api/pictures/<kind>` with
  the company in the header: the settings right, `{ picture, version }`, null removing; 400, 403, a 409
  with the current; its entry `config.picture`, no bytes, as the photo's (`staff.ts#L771-L772`); the
  reply the settings' doc. The header's `img` takes that address; the fake, the data URL itself.

**4. Which logo, where** (point 5). The legacy: a dark header takes the dark-ground logo, else the logo,
else its own white mark; a light one the logo, else its mark (legacy
`workspace/uis/c-mngt/src/layouts/AppLayout/PCAppLayout.tsx#L41-L44`). Here, on the switch "white
header" (`Shell.tsx#L158`, `#L185`):

| Where | Both set | Only the logo | Only the coloured header's | None |
| --- | --- | --- | --- | --- |
| Coloured header | the coloured header's, bare | the logo on a white tile | the coloured header's, bare | the stand-in |
| White header | the logo | the logo | the stand-in | the stand-in |
| The card | the logo | the logo | nothing | nothing |

In the stand-in's 36-pixel square, contained, `alt` empty beside the heading's name, at a phone's and
a PC's width; one that fails to load draws the stand-in. The console's `CREDO_BRAND` has none
(`ui/src/brand.ts#L15`).

**5. The screens.** `Brand` (`brand.ts#L4-L5`) takes `logo` and `logoOnColour` as addresses from the
reply's `pictures`, for the header (`ui/src/ClientApp.tsx#L352-L354`), the QR landing and the sign-in
(`#L339-L342`, `#L502-L503`): the card's is the same record. The preview
(`ui/src/parts/BrandPreview.tsx#L12-L53`) gives `HeaderBrand` both, so it chooses as the header does.
**A picture saves at its choice**, by its own call, as the person's photo does
(`ui/src/parts/PhotoPanel.tsx#L27-L29`); the page's key is the settings' version
(`SettingsPage.tsx#L56`), which a picture does not move, so text typed and unsaved stays.

**6. The parts, on invented data.** New: `HeaderLogo`, an atom (the choice above, the tile, the
stand-in); `PictureField` in `ui/src/parts/` (a label, the picture or none, choose, remove, the
refusal and the outcome), taking the logo's field out of `Settings.tsx#L136-L166`; milestone 4 draws
it twice more. Changed: `HeaderBrand`, `BrandPreview`. Gallery: `HeaderLogo`'s columns above on a
coloured and a white ground; `BrandPreview`'s "A logo for the coloured header"; the settings page's
states (`ui/src/design-system/Pages.tsx#L957-L972`) with two fields; a white sample mark beside
`SAMPLE_LOGO` (`ui/src/design-system/entries.tsx#L100-L101`), invented, as the bundle refuses the data
set's names (`scripts/src/fake.test.ts#L54-L57`). Where nothing is set, each draws today's markup.

**7. The words.** Five keys in both dictionaries, 780 to 785, in the dictionary's "color":

| Key | English | Vietnamese |
| --- | --- | --- |
| `settings.logoOnColour` | Logo for the colored header | Logo cho thanh tiêu đề màu |
| `settings.logoOnColourHint` | Optional: a light version, shown on the colored header in place of the logo. | Không bắt buộc: bản màu sáng, hiển thị trên thanh tiêu đề màu thay cho logo. |
| `settings.logoOnColourNone` | No logo for the colored header | Chưa tải lên logo cho thanh tiêu đề màu |
| `settings.logoOnColourChoose` | Upload logo for the colored header | Tải lên logo cho thanh tiêu đề màu |
| `settings.logoOnColourRemove` | Remove logo for the colored header | Xóa logo cho thanh tiêu đề màu |

The refusals reuse `settings.logoTooLarge` and `settings.logoNotImage`. Read by
`scripts/src/words.test.ts#L43`, `#L48`, `#L64`, `#L412`, `#L422-L423` (780, 781, 782 become 785, 786,
787), `ui/src/i18n/i18n.test.ts` and `docs/products.md#L87`. No walk presses a logo button by name.

**8. Tests that pin what moves**, beside the stand-in's: the settings page's state counts its pictures
(`ui/src/design-system/Gallery.test.tsx#L2211-L2213`); `Settings.test.tsx#L159` and `#L179` read the
first `img`, which becomes the preview header's; `git grep -c -P "\blogo: " -- '*.ts' '*.tsx'` gives
41 lines in 29 files, the dictionaries' two and `config.ts`'s three among them.

**9. The ceremony.** `shared`, `bff`, `scripts`, `ui`, `visual` and `walk`: the whole check on
`pre-merge` (`docs/conventions/qa.md#L262`), and `pre-main-review` once: every screen, a client's data
moved, a public route (`qa.md#L106`). No template changes: no `make check`, no `bash ops/test.sh`.

## Decided by the machine

1. **A record per kind, its tag in the address, the bytes from the BFF**; no object store, whose
   settings a box may lack (choice 2); four pictures of 200 KB fit one list.
2. **The move in the settings' read**, picture first: no script for you on ridge.
3. **A picture saves at its choice**, as the photo does: one press saving three records needs a
   partial failure the page cannot say.
4. **One logo on a white tile on the coloured header** (point 1); the stand-in kept where none
   applies, so no screen without a logo moves.
5. **The walks' company keeps its one logo** (`shared/src/demo.ts#L21-L23`), now a picture; one new
   scene uploads the second.

## The case table

Rows 1 to 6 are the move's, each seen red before its code; rows 7 to 13, the route's and the save's.

| # | The case: one behaviour, one sentence | Held by |
| --- | --- | --- |
| 1 | A stored logo is moved at the settings' first read: its picture holds the same data URL, the settings hold no `logo`, the reply names it | bff, `pictures.route.test.ts` |
| 2 | A move stopped after the picture's write loses nothing: the next read finishes it | bff, `pictures.route.test.ts` |
| 3 | A picture already stored is kept over an older inline logo | bff, `pictures.route.test.ts` |
| 4 | Two reads at once move it once, both replies naming the same picture | bff, `pictures.route.test.ts` |
| 5 | A stored `logo` of null is dropped, no picture made; the new shape is read with no write | bff, `pictures.route.test.ts` |
| 6 | A save sending `logo` is refused, 400, and stores nothing | shared, `config.test.ts`; bff, `config.route.test.ts` |
| 7 | The address answers the bytes with their type, `nosniff`, the sandboxing policy, and a year's cache at its tag, `no-cache` at another | bff, `pictures.route.test.ts` |
| 8 | It answers 404 for an unknown code, kind or picture, with no sign-in and no company header | bff, `pictures.route.test.ts` |
| 9 | On Lambda a picture arrives whole, base64-encoded | bff, `lambda.test.ts` |
| 10 | A picture's save takes an image within 200 KB from whoever holds the settings right, refusing one byte over or a non-image (400), no right (403), a moved version (409, the current) | bff, `pictures.route.test.ts` |
| 11 | A remove leaves the reply's picture null; the settings' save neither reads nor changes a picture | bff, `pictures.route.test.ts`, `config.route.test.ts` |
| 12 | No activity entry of a settings or a picture save holds a picture's bytes | bff, `pictures.route.test.ts` |
| 13 | The operator's create, the data set and the demo seed write no `logo` in the settings; the data set's and the seed's logos are pictures; a company the old create made reads as fresh | bff, `operator.route.test.ts`; scripts, `generator.test.ts`, `demo/apply.clients-touched.test.ts` |
| 14 | The header draws the logos as the table in 4 says, in the 36-pixel square, `alt` empty | ui, `HeaderLogo.test.tsx`, `Shell.test.tsx` |
| 15 | A logo that fails to load draws the stand-in | ui, `HeaderLogo.test.tsx` |
| 16 | The card draws the logo, never the coloured header's | ui, `BrandBand.test.tsx`, `SignIn.test.tsx` |
| 17 | The Pictures block holds both logos, each chosen, refused at the chooser, saved at once and removed; the app's header and the preview's wear it from the reply | ui, `PictureField.test.tsx`, `Settings.test.tsx`, `App.test.tsx` |
| 18 | Text typed and not saved stays across a picture's save | ui, `Settings.test.tsx` |
| 19 | The preview's header chooses as the app's does | ui, `BrandPreview.test.tsx` |
| 20 | The operators' console keeps the stand-in | ui, `OperatorApp.test.tsx` |
| 21 | The fake serves each picture as its data URL and keeps a save | ui, `fake.test.tsx` |
| 22 | The gallery draws `HeaderLogo`'s states and the new states of 6 | ui, `Gallery.test.tsx` |
| 23 | Where nothing is set, the header, every door and the preview draw as before | visual, the pinned diff empty in step 1 |
| 24 | Both dictionaries hold 785 keys, every Vietnamese one its own | scripts, `words.test.ts`; ui, `i18n.test.ts` |
| 25 | The admin's setup walk holds 21 screens, 13 on the main path and 8 on the wrong one, from its mock state | visual, `walks.test.ts` |
| 26 | A walk's picture waits for every image on the page to have loaded | walk, `support.ts`'s `shot`, typechecked; its run |

## The steps

Sizes are the last rows of each step's shape in the runs log. Each gate is the touched package's
`pnpm --filter @credo/<pkg> check`, exit 0 by its own code, plus the citation test. "The pinned diff"
is `git diff -U0 -- visual/src/resolved.pinned.txt | grep '^+[a-z]' | cut -d' ' -f1 | sort -u`.

- [x] **1. The gallery.** `HeaderLogo`, `PictureField`, `HeaderBrand` and `BrandPreview` taking
      addresses as strings, so `shared` waits; the sample; the states, contracts and entries; the five
      keys. Rows 14, 15, 19, 22 and 24 red first; row 23 the null proof. _Done when:_ `ui`'s, `visual`'s
      and `scripts`' gates; the pinned diff empty. **40 min** (250.2's step 1: 40). Then point 1.
      Done 25 November: `ui`'s gate 18:31, `visual`'s 18:36, `scripts`' 18:40, each exit 0; the pinned
      diff empty. `BrandPreview` takes the header's logos as `headerLogo` and `headerLogoOnColour`,
      beside `logo` for the card, since the settings page passes it the logo and one prop for both
      would have moved its 11 screens; step 2 passes them. Citation test at 18:48.
- [x] **2. The screens, on the fake.** In `shared` the kinds and the reply's `pictures`; `Brand` from
      it; `Shell`, `SignInFrame` and the QR landing pass both; `Settings` draws two `PictureField`s,
      saving at choice; the fake's pictures; the BFF answering each null until step 3. Rows 16 to 18,
      20 and 21 red first. _Done when:_ `shared`'s, `bff`'s, `ui`'s and `visual`'s gates; the pinned
      diff naming the 96 signed-in company screens, no door or console one (960 lines). **13 min**
      (250.2's step 3: 13).
      Done 25 November: `shared`'s gate 19:01, `bff`'s 19:14, `ui`'s 19:19, `visual`'s 19:42, each exit
      0; the pinned diff names 96 screens, 960 lines, no door or console one. The settings' own `logo`
      stays in the settings until step 4, and the screens draw the pictures of the reply alone; the
      fake holds the data set's logo as its `logo` picture. `Settings` passes `BrandPreview` the
      pictures as `logo`, `headerLogo` and `headerLogoOnColour`. Rows 16 and 20 held on the old code
      and were seen red by a mutation (the card taking the coloured header's logo, the console's brand
      given a logo). Citation test at 19:50.
- [x] **3. The route and the save, in the BFF.** As 3 above, copied from the photo's; the Lambda
      handler's `enforceBase64`. Rows 7 to 12 red first. _Done when:_ `shared`'s and `bff`'s gates.
      **14 min** (241.2's step 5: 10, its fix 4).
      Done 25 November: `shared`'s gate 19:59, `bff`'s 20:09, each exit 0; no `ui` or `visual` gate, as
      `ui/src` did not change. The route is `GET /api/pictures/<code>/<kind>` and the save
      `PUT /api/pictures/<kind>`; the settings' reply names each picture from two reads, one a kind, not
      one list of the prefix. Citation test at 20:17.
- [x] **4. The move.** The settings lose `logo`; the stored shape; the move; `startingConfig`,
      `DEMO_CONFIG` and its picture, the generator, the seed's monogram through the route, the
      freshness check; the mock's fixtures and the literals of 8. Rows 1 to 6 and 13 red first.
      _Done when:_ `shared`'s, `bff`'s, `scripts`', `ui`'s and `visual`'s gates; the pinned diff as step
      2 left it. **25 min** (250.2's step 2: 25).
      Done 25 November: `shared`'s gate 20:48, `bff`'s 21:00, `scripts`' 21:03, `ui`'s 20:57, `visual`'s
      21:07, each exit 0; the pinned file untouched, so its diff is as step 2 left it. The move is in
      `readConfig`; a company made with a logo (the data set's) holds it through `createClient`'s
      `logo`. Rows 1 to 5 and 13's new cases red first; rows 6 and 13's old-create case held on the old
      code. Citation test at 21:14.
- [x] **5. The walk.** As below; rows 25 and 26. _Done when:_ `visual`'s, `walk`'s and `ui`'s gates;
      row 25 red on the old counts; the pinned diff naming `17-logo-on-colour` alone (10 lines); the new
      step replayed in jsdom on the real router. **15 min** (250.2's step 4: 15).
      Done 25 November: `ui`'s gate 23:31, `walk`'s 23:32, `visual`'s 23:34, each exit 0; the pinned diff
      names `17-logo-on-colour` alone, 10 lines, written once by `RESOLVED_WRITE` and read before the
      gate; row 25 red on the old counts at 23:19; the step replayed in jsdom by
      `SettingsLogoWalk.test.tsx`; row 26 held by the pin of `shot`'s top in `walks.test.ts`, red
      before it was moved to take the new wait. The spec's finders are guesses until the run. Citation
      test at 23:39.
- [x] **6. The prose.** `docs/products.md#L35`'s Settings row gains the second logo, the header and
      the save at choice, `#L87` 785 words; `docs/memo/bff.md` the surprises (the one public reply not
      JSON, its policy, its base64 on Lambda; a settings read that may write once); items 76 and 103
      `[FIXED]`. _Done when:_ the citation test. **4 min** (250.2's step 5: 4).
      Done 25 November: the words line already read 785 (step 1), so no count line moved; the citation test
      at 21:25.
- [x] **7. Your walk run, then the bases.** The run below, green; the bases committed alone, each
      walk's count matching the log, no door or console base among them. **3 min** (250.2's step 6: 3).
      Done 26 November: the human's walk run, started 14:13 and 22 minutes long, green, 17 comparisons,
      every raw count as asked; full-1 to the bases moved 618 and 6 new (piece-1 60 and 6, piece-2 258,
      admin-lists 126, office-orders 90, driver-deliveries 36, office-reconcile 48); the 624 changed
      files are exactly the screens the comparisons name, each walk's file count equal to its moved
      plus new, none a door or console base (the new six are `21-logo-on-colour`); the bases committed
      alone (1a8b713b).
- [ ] **8. The recap and the landing.** The recap and its products row; `pre-merge` taken in, the
      gates again, the landing; the whole check; `pre-main-review` before `main`, at most once a push.
      **44 min** (250.2's recap: 4; a whole check and a review about 20 each).

Total: 158 minutes, 44 of them the landing's.

## The walk

**Moved: every picture of a company's signed-in screen**, its header now drawing the logo. From the
snapshot folders, less the doors (piece 1's `1-sign-in`, `2-sign-in-refused`, `6-service-down`,
`9-unknown-company`, `12-sign-in-wait`, `16-formatted-card`; piece 2's `staff-24-email-sign-in`,
`staff-28-passkey-not-given`, `staff-29-passkey-refused`, `phone-2-code-used`): 103 screens, 618
pictures, in six walks (piece-1 60, piece-2 258, admin-lists 126, office-orders 90, driver-deliveries
36, office-reconcile 48). The doors draw the same bytes and do not move; the operators' walks wear the
stand-in. **The walks' company** has a logo (`shared/src/demo.ts#L21-L23`), on the door only today; it
keeps it, as a picture, and gains no second.

**New:** one scene on the main path after `15-formatted-saved` (`walk/specs/piece-1.spec.ts#L225-L246`),
the header in Brick: the root uploads a white mark, bytes from the spec, as the logo for the coloured
header; saved at once, the header and the preview's wear it (`21-logo-on-colour`, 6 pictures). After
it `5-language-menu` wears it, `10-saved-white` (`#L272-L278`) the logo on white; the restore
(`#L98-L108`) removes it. 20 screens become 21 (`visual/src/walks.test.ts#L89-L101`,
`piece-1.spec.ts#L16-L18`, `#L359`, `#L363`). `shot` (`walk/support.ts#L46-L89`) settles on two equal
pictures; it gains a wait for every image loaded, so a header taken before its logo arrives cannot
pass as settled.

| Scene | What it shows | Its question |
| --- | --- | --- |
| `21-logo-on-colour` | the logo for the coloured header just uploaded and saved; the header and the preview's header wearing it | Does the coloured header show the company's light logo, clear on its colour? |

The question is a key of `visual/site/questions-vi.json`, with its Vietnamese.

**Your one run** (step 7), then `--write`'s bases committed:

```bash
bash walk/run.sh piece-1 piece-2 admin-lists office-orders driver-deliveries office-reconcile --moved all --write
```

You will see "== verdict: green": 618 pictures moved and 6 new, none of them a door; your run of two
walks on 25 November took 15 minutes, and this one's minutes are read from its log.

## Your points

1. **The parts in the gallery** (after step 1; it stops nothing). In this piece's worktree run
   `pnpm fake`, open the address on the first line it prints with `/48b74d079/gallery` after it:
   Atoms, "HeaderLogo"; Pages, "BrandPreview" and "The settings page". Does a company's one logo read
   on the coloured header on its white tile, and the logo for the coloured header bare?
   **Recommendation: yes.** A no draws the one logo bare there, as the legacy does, one line in
   `HeaderLogo`.
2. **The walks page** (after step 7). 104 screens ask: every signed-in screen with the logo in its
   header, the settings screens with the second logo's field, and the new one, the light logo on the
   coloured header. **Recommendation: yes**, screen by screen. A no reopens the piece while the rest
   goes on.
3. **On ridge** (the milestone's one look, after your push), on your -3 copy, a phone and a PC: its
   monogram, uploaded before this landing, is in the header at once; upload a light logo for the
   coloured header; open three screens, the header coloured, then white. Is it the company's logo,
   readable on both headers? **Recommendation: yes.** A no reopens the part it names; milestone 4
   waits only where it draws on it.
