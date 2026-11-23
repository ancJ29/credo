# The password ways on the legacy's card: code or email, "remember me", every door in the legacy's look

## At a glance

What it is for: the sign-in campaign's first milestone. A company's people sign in by code or by an
email the root gave, on a card like the legacy's with its "Remember me" tick, and every door (the
company's sign-in, its QR landing, the operators' sign-in, their join page) stands on the legacy's
colour sweep, the language switch in its corner. Who sees it: every company's people and credo's
operators. The cheapest path: the legacy's card is already a gallery part, its tick drawn; one
frame draws all four doors; the BFF takes an email; the session handle is the device's, never a
cookie, so "Remember me" is a choice of browser storage, and the back end changes by one default.
The price: about 110 machine minutes in ten steps, one landing with the whole check and a review,
your one run of four walks (120 pictures moved, 6 new), three looks and one question.

**Your two asks, each a line of this plan:**

- "components should be viewable from the gallery before integration with BFF": steps 1 and 2 put
  every new part in the gallery on invented data before step 6 touches `shared` or `bff`; point 1
  is the look there.
- "after finished, walk should be updated properly": step 8 gives each new state its scene and
  question, the door question true on exactly the doors, no stale scene, the counts below true;
  step 9 is your one run.

## The slice

One slice, walkable when it ends: a person opens their company's address, sees the door on the
company's colour sweep with the switch in the corner and the card holding the logo, the name, the
one box for a code or an email, the password, "Remember me" ticked and the Sign in button; signs in
by code, or by an email the root gave in a company that never switched email off; unticked, the
sign-in lasts the tab. The operators' door, the join page and the QR landing wear the same door.
Stage 1 is step 5's door on the fake (the gallery comes first, as you asked, so the cheap end-to-end
build is step 5, not step 1); stage 2, each step's gate and the landing's whole check; stage 3, the
gallery look and the walks page; stage 4, ridge.

**Not in it:** the QR button and scan page (milestone 3), passkeys (2 and 4), QR on by default
(milestone 3, with its page); the buttons and words inside each card, which keep their own
gradient (`ui/src/pages/SignIn.tsx#L191-L199`), item 651's; a tick on the operators' door, whose
session already ends an hour unused and 12 hours from its start (`bff/src/calling/sessions.ts#L18-L24`).

## The brief, checked

**The piece's premises.** "The card, its tick and the frame drawn in the gallery first on invented
data": half true; the card and the tick are drawn, the frame is not (below), so step 1 draws it. "The
sign-in they call exists already": true, `bff/src/app.ts#L362-L380` takes an email and `#L385-L413`
signs in. "Only the email switch's default changes in the back end, which 'remember me' may
contradict": it does not. No cookie exists (`git grep -n -i cookie -- bff/src ui/src shared/src`: 0
lines); the handle comes back in the answer's body (`bff/src/app.ts#L410-L411`) and the device keeps
it in `localStorage` as `credo.session` (`ui/src/device.ts#L5`, `#L32-L34`, `ui/src/main.tsx#L21`). An
unticked sign-in keeps it in the tab's `sessionStorage` instead: no BFF change, so the flow page's
"Back end: nothing new" stands. **The legacy's tick ends no session at the browser's close:** it sets
a token's refresh life (`workspace/uis/base/src/lib/auth/createAuthStore.ts#L289-L293`), its handle
stays in `localStorage` (`workspace/uis/c-mngt/src/utils/authId.ts#L30-L33`) for a fixed week
(`workspace/uis/c-mngt/src/stores/useAuthStore.ts#L135-L137`). Unticked ending at the close is the
flow page's rule, which you said yes to, not a copy.

**What the gallery shows of the four parts the flow page names:**

| Part | In the gallery today | New |
| --- | --- | --- |
| the logo and the name atop the card | `DoorCard`'s band (`BrandBand`, `LogoTile`), the legacy's card already: a 4 px bar, the band, the body (`ui/src/components/organisms/DoorCard.tsx#L16-L26`; the legacy's `workspace/uis/base/src/components/auth/ui/AuthCard.tsx#L49-L63`) | no |
| the tick | `DoorCard`'s Sign-in state, Mantine's own `Checkbox` with a sample word (`ui/src/design-system/entries.tsx#L113`, `samples.ts#L87`, `#L143`) | the dictionary's word |
| the colour sweep | nothing; the legacy's is a 135° gradient over the screen (`workspace/uis/base/src/components/auth/ui/AuthLayout.tsx#L39-L46`) | `DoorPage` |
| the switch in the corner | drawn by the screens' own frame in its header (`ui/src/pages/SignIn.tsx#L89-L110`), never in the gallery; the legacy's sits at the top right (`AuthLayout.tsx#L48-L57`) | inside `DoorPage` |

`DoorPage` is shown in three states on invented data: a company's door in two languages (the
gallery's sample company, `SAMPLES`), credo's own door with no logo (`CREDO_BRAND`), a door of one
language with no switch. Its props are `@credo/shared`'s types (`Brand` is `TenantConfig`'s name and
logo, `ui/src/brand.ts#L4`; `Language`), and no name comes from the data set, which
`scripts/src/fake.test.ts` refuses in the bundle that holds the gallery's chunk.

**The email default.** It lives in one line, `staffConfig`'s `email: false`
(`shared/src/staff.ts#L161`), which all seven readers go through (`git grep -n 'fields.email' --
bff/src ui/src ':!*.test.*'`: 7 lines). "Never set" is a stored setup whose `fields` holds no `email`
key (`shared/src/fields.ts#L72-L75`), or no setup at all (`bff/src/records/staff-records.ts#L42-L44`);
"saved" is the key there, true or false. Decided: that is the saved choice. **Measured, it is wider
than your words:** the setup page sends all seven switches at every save
(`ui/src/parts/StaffFieldsEditor.tsx#L42`, `#L90`), so a root who saved the page for anything since
the switch arrived (29 October) holds `email: false` and keeps it. No signed client is on credo; the
data set's setup has no email key (`shared/src/demo.ts#L217-L223`), nor has the demo copies' seed
(`scripts/src/demo/scenarios.ts#L171-L178`). **No one's sign-in changes:** an email signs in only
through the claim the root's email route writes (`bff/src/app.ts#L369-L373`), which refused while
off (`bff/src/routes/staff.ts#L828-L830`); no person of the data set holds one (`grep -c -E "email: '"
shared/src/demo.ts`: 0). What changes: the root's person page gains the email box
(`ui/src/pages/client/PersonPage.tsx#L564`), and the setup draws the tick ticked.

**The frame is four screens', not three:** `git grep -n -E '<SignInFrame$' -- ui/src ':!*.test.*'`: 4
(`ui/src/pages/SignIn.tsx#L158`, `ui/src/pages/client/QrLanding.tsx#L26`,
`ui/src/pages/operator/JoinPage.tsx#L83`, `ui/src/pages/operator/OperatorSignIn.tsx#L24`), the QR
landing the brief's fourth. Decided: `SignInFrame` keeps its name and props and draws the parts, so
the four screens stay as they are and `ui/CLAUDE.md#L36`, which cites it, stays true.

**The headings, decided:** the walks find the company's door by its name as the first heading
(`git grep -n -E "level: 1, name: '(Minh Phát|Credo)'" -- walk/specs`: 2) and a door's title as the
second (`walk/specs/operator-passkeys.spec.ts#L70`, `walk/specs/piece-2.spec.ts#L224`), while
`BrandBand` draws the name as text (`ui/src/components/molecules/BrandBand.tsx#L18-L20`) and
`DoorHeading` the title as the third (`ui/src/components/atoms/DoorHeading.tsx#L8`). The two parts
take today's levels, their look unchanged, so no finder moves.

**Prose that goes false:** `docs/products.md#L31` (the doors' coloured header and grey ground);
`docs/memo/ui.md#L90` (the handle in `localStorage`); the walks page's door question
(`visual/src/walks.ts#L323-L324`); `DoorCard`'s "Not yet" line (`ui/src/design-system/guideline.ts#L1223`)
and its entry's line on `SignInFrame` (`entries.tsx#L1062`, pinned by `Gallery.test.tsx#L1608`). Your
yes of 23 November has no row in `docs/decisions.md` (`grep -c 2026-11-23 docs/decisions.md`: 0):
this piece settles it, so it writes the two.

## The case table

Rows 1 to 12 are business rows, each seen red before its code.

| # | The case: one behaviour, one sentence | Held by |
| --- | --- | --- |
| 1 | A setup that never set the email switch has the email sign-in on, and one holding `email: false` keeps it off | unit, `shared/src/staff.test.ts` (today's row at `#L301` reads off) |
| 2 | Where the switch was never set, the root gives a person an email and the person signs in by it | BFF route, `bff/src/sign-ins.route.test.ts` |
| 3 | Where the root saved it off, an email is the wrong code's 401 and the email route answers 403 | BFF route, the same file's rows at `#L306` and `#L324`, the second saving `email: false` itself |
| 4 | The fake signs in by email where the switch was never set, and not where it was saved off | ui, `ui/src/fake.test.tsx` (`#L703`) |
| 5 | The staff setup draws the email tick ticked where it was never set, and a save keeps it | ui, `ui/src/pages/client/StaffSetupPage.test.tsx` |
| 6 | The root's person page offers the email where the company never set the switch | ui, `ui/src/pages/SignIns.test.tsx` |
| 7 | "Remember me" starts ticked, and the request it sends is the name and the password alone | ui, `ui/src/pages/SignIn.test.tsx`, `ui/src/api.test.ts` |
| 8 | Ticked, the handle is kept on the device: another tab is signed in | ui, `ui/src/device.test.ts` |
| 9 | Unticked, the handle is the tab's: a reload is signed in, another tab is not | ui, `ui/src/device.test.ts` |
| 10 | A sign-out or a 401 clears the handle wherever it was kept | ui, `ui/src/device.test.ts`, `ui/src/App.test.tsx` |
| 11 | A password changed keeps the new session where the old one was | ui, `ui/src/App.test.tsx` |
| 12 | A QR code's sign-in keeps the phone's handle on the device, as today | ui, `ui/src/App.test.tsx` |
| 13 | Every door stands on its brand's sweep over the whole screen, a company's colour or credo's | ui, `SignIn.test.tsx`, cases 3 and 4 rewritten |
| 14 | Every door's card holds the band, the logo where there is one, the name as the first heading and the title as the second | ui, `SignIn.test.tsx`, case 1 rewritten |
| 15 | The switch sits in the screen's top corner, only for two languages, and changes the words, never what is sent | ui, `SignIn.test.tsx`, cases 6 and 7 kept |
| 16 | No door draws a side menu, the phone's bar or a header | ui, `SignIn.test.tsx`, case 2 widened |
| 17 | The gallery draws `DoorPage` in its three states and `DoorCard` holds the dictionary's tick | ui, `ui/src/design-system/Gallery.test.tsx` |
| 18 | `DoorCard` and `DoorPage` are drawn by the screens, and no line names a card of the screens' own | ui, `guideline.test.ts`, `Gallery.test.tsx` |
| 19 | The door question is asked of exactly the eight doors | visual, `visual/src/walks.test.ts` |
| 20 | The new scene's steps replay on the real router | ui, `SignIns.test.tsx` (WK6) |

## The steps

Sizes are the last rows of each step's shape in the runs log; none is cut below its row. Each gate
is the touched package's `pnpm --filter @credo/<pkg> check`, exit 0 from its own code, plus the
citation test, `pnpm --filter @credo/scripts exec vitest run src/citations.test.ts`.

- [x] **1. `DoorPage` in the gallery.** `ui/src/components/organisms/DoorPage.tsx`: the brand's sweep
      over the whole screen from the theme (`BRAND_GRADIENT`, `ui/src/design-system/appTheme.ts#L64`),
      today's switch moved into its top corner, the card centred; its entry (Organisms, kind Layout)
      in the three states above; its contract in `guideline.ts`. _Done when:_ `ui`'s gate, row 17's
      case seen red. **9 min** (piece 231's part, entry and contract steps: 5, 9, 11).
      _Done 2026-11-23 15:59:_ `ui`'s gate exit 0; row 17's case red with the entry absent, then green;
      `DoorPage` takes `languages` as `{ language, name }` pairs (a component may not import the
      language names) and no `brand`, the card being its child; `DoorCard`'s dictionary tick is step 2's.
- [x] **2. The card's headings and the tick's word.** `BrandBand`'s name and `DoorHeading`'s title
      take the first and second levels, their look pinned unchanged by their own tests; `auth.remember`
      in `ui/src/i18n/en.ts` and `vi.ts` ("Remember me", "Ghi nhớ đăng nhập", the legacy's); `DoorCard`'s
      Sign-in state reads it, the sample word gone. _Done when:_ `ui`'s gate. **6 min** (piece 240's
      steps 1 and 3: 6, 6). Then point 1, which stops nothing.
      _Done 2026-11-23 16:05:_ `ui`'s gate exit 0, `@credo/scripts`' `words.test.ts`, `fake.test.ts` and `citations.test.ts` exit 0;
      row 17's tick half red (`auth.remember` undefined), then green; `BrandBand`'s name is `Title` order 1
      in size md and `DoorHeading`'s `Title` order 2 in size h3, their look pinned by their own tests; the
      dictionary grows 755 to 756 keys, `words.test.ts` and `docs/products.md#L86` say so.
- [x] **3. The four doors on the parts.** `SignInFrame` draws `DoorPage`, `DoorCard` and `DoorHeading`
      round what it is given; rows 13 to 16 and 18; the "Not yet" and entry lines rewritten, `used` set.
      _Done when:_ `ui`'s and `visual`'s gates, and the pinned styles' diff names the nine doors alone:
      `git diff -U0 -- visual/src/resolved.pinned.txt | grep '^+[a-z]' | cut -d' ' -f1 | sort -u`.
      **10 min** (piece 222's screen moves: 12, 10, 10).
      _Done 2026-11-23 16:23:_ `ui`'s and `visual`'s gates exit 0, `words.test.ts`, `fake.test.ts` and `citations.test.ts` exit 0;
      rows 13, 14, 16 and 18 red on the old frame and the old contracts, then green (row 15's cases kept, renamed);
      the pinned diff names the nine doors alone; `SignInFrame` keeps its props and draws `DoorPage`, `DoorCard` and
      `DoorHeading` (the logo, where there is none, no longer an icon), both contracts `used`, the page title gone from
      the three door files' raw count.
- [x] **4. The handle where the tick says.** `createDeviceStore` takes the tab's storage beside the
      kept one (`localStorage` and `sessionStorage` in `ui/src/main.tsx`, the fake's one tab storage
      for both, `ui/src/fake.ts#L1599-L1603`); rows 8 to 10 red first; the memo's claim at
      `docs/memo/ui.md#L90` rewritten, with its hazard: a browser that reopens its tabs may bring an
      unticked one back signed in. _Done when:_ `ui`'s gate. **6 min** (piece 123's step 1, a sign-in
      state with its rule and words on the fake: 25 for three such parts).
      _Done 2026-11-23 16:28:_ `ui`'s gate exit 0, `@credo/scripts`' `words.test.ts`, `fake.test.ts` and `citations.test.ts` exit 0;
      row 9 and row 10's clearing red on the old store, then green (row 8 held on the old code, a
      ticked handle being the device's already); `createDeviceStore(kept, tab = kept)`, `setAuthId(id,
      remember = true)` writes one storage and clears the other, `authId` reads the tab's first; `main.tsx`
      passes `localStorage` and `sessionStorage`, the fake its one storage twice; row 10's `App.test.tsx`
      half and rows 11, 12 wait for step 5, which hands the tick to `ClientApp`; the memo's rule and hazard
      rewritten, the anchor in `docs/memo/bff.md` moved with its heading.
- [x] **5. The tick on the door, on the fake.** `SignIn` draws the tick ticked and hands it to
      `ClientApp`, which keeps the handle by it (`ui/src/ClientApp.tsx#L209`; `#L242` where the old one
      was; `#L160` on the device); rows 7, 11, 12 red first. _Done when:_ `ui`'s and `visual`'s gates,
      the pinned diff naming the three company doors alone (`1-sign-in`, `2-sign-in-refused`,
      `12-sign-in-wait`). **8 min** (the same row).
      _Done 2026-11-23 16:40:_ `ui`'s and `visual`'s gates exit 0, `@credo/scripts`' `words.test.ts`, `fake.test.ts` and `citations.test.ts` exit 0;
      row 7's tick case, row 11's tab case and row 10's tab-clearing case red on the old door and app, then green
      (row 11's device case, row 12 and the BFF request held on the old code, the device being the old default);
      `SignIn` draws the ticked `Checkbox` and hands `onSubmit(name, password, remember)`, `ClientApp` keeps
      the handle by it, a password change where the old handle sat (`device.remembered()`), a QR sign-in on the device;
      the pinned diff names the three company doors alone.
- [x] **6. Email on by default.** `staffConfig`'s one line; rows 1 to 6 red first; the describe at
      `bff/src/routes/staff-setup.route.test.ts#L159` no longer says email is off until turned on.
      _Done when:_ `shared`'s, `bff`'s, `ui`'s and `visual`'s gates, the pinned diff naming the eleven
      staff screens below alone. **13 min** (piece 151's red-first fix steps: 7, 13, 15).
      _Done 2026-11-23 17:19:_ `shared`'s, `bff`'s, `ui`'s and `visual`'s gates exit 0, `citations.test.ts` exit 0;
      rows 1, 2, 4, 5 and 6 red on the old default, then green (row 3's first half held on the old code, its
      second saving `email: false` itself); `staffConfig`'s `email: true` the one line, `fields.email` read by
      the seven readers unchanged; the describe at `staff-setup.route.test.ts#L159` says email is on until
      turned off; the pinned diff names the eleven staff screens alone; no stored data touched, the plan's reading held.
- [ ] **7. The prose.** Two rows in `docs/decisions.md` (email on by default, a saved choice kept;
      the legacy's look round every door, reversing 5 November's header, which rested on a legacy
      never read, `docs/recaps/2026-11-05-signin-look.md#L14`); `docs/products.md#L31`'s row true.
      _Done when:_ the citation test. **3 min** (piece 222's step 10c: 2).
- [ ] **8. The walk.** As "The walk" below. _Done when:_ `visual`'s, `walk`'s and `ui`'s gates, row
      19 seen red with the old list, row 20 replayed. **10 min** (piece 125's step 5, one scene with
      its fake and tests: 5, plus its gates).
- [ ] **9. Your walk run, then the bases.** The run line below, green; the bases committed alone,
      their count per walk matching the log; then the same walks without flags, 0 moved. **2 min**
      (piece 240's receipt and bases: 1, 1).
- [ ] **10. The recap and the landing.** The recap and its products row; `pre-merge` taken in, the
      gates again, the landing; the whole check, since the landing touches `shared` (which every
      package imports) and five packages (QA, "The whole check on `pre-merge`"); `pre-main-review`
      before `main`, since sign-in is worth one (QA rule 5). **43 min** (a recap 3; a whole check and
      a review about 20 each).

## The walk

**Today:** four walks picture the doors, nine scenes and 54 pictures, counted in this order:

```bash
git grep -n -E "at\('(1-sign-in|2-sign-in-refused|12-sign-in-wait|op-1-sign-in|pk-[1345]-[a-z-]+|phone-2-code-used)'\)" -- walk/specs
ls walk/specs/*-snapshots | grep -c -E '^(1-sign-in|2-sign-in-refused|12-sign-in-wait|op-1-sign-in|pk-1-join|pk-3-not-given|pk-4-no-operator|pk-5-link-dead|phone-2-code-used)-'
```

The email default moves eleven of piece 2's scenes, 66 pictures: the setup's two (its tick) and
nine of the root's person page (its email box). The email and QR scenes and the phone's open with
both switches on already, the office's scenes are not the root's, and the driver's walk saves both
on (`walk/specs/driver.spec.ts#L79`):

```bash
ls walk/specs/piece-2.spec.ts-snapshots | grep -c -E '^(setup-1-departments-positions|setup-2-fields|staff-(4-person|5-permissions|6-password|7-archive|10-save-conflict|11-save-failed|13-photo|15-code-changed|23-back-on))-'
```

The walks page asks 5 November's door question of nine screens (`grep -c 'question: SIGN_IN_LOOK'
visual/src/walks.ts`: 9): eight doors and `phone-1-signed-in`, a signed-in page
(`visual/src/walks.ts#L1229-L1237`).

**After:** the question rewritten for the legacy's look, its comment citing this plan: "Do the doors
read like the legacy app's: the colour sweeping the whole screen, the logo and the name atop the
card, the language switch in the corner, and on a company's door 'Remember me' ticked?" It is asked
of the eight doors (row 19, `visual/src/walks.test.ts#L39-L56`'s nine becoming eight); the wait
screen keeps its own; `phone-1-signed-in` gets one of its own, "Is the person's first page where a
phone should land after the code?", its picture unmoved. One scene is appended to the staff walk,
after `staff-23-back-on` (`visual/src/walks.ts#L1106-L1120`): `staff-24-email-sign-in`, number 24,
opened as the root without the switches, so it proves the default; the root gives Trần Văn Hùng an
email, signs out and types it in the one box, pictured before the press, an `expect` on his first
page after it, all in one page, since the fake keeps its records in the tab and a reopened page
forgets the email. Its question: "Would a person whose root gave them an email sign in by it here,
in the box where others type their code?" No walk is added or retitled; "Take on staff: their
records, sign-ins and import" holds the new scene.

**Your one run** (step 9), then `--write`'s bases committed, then the same four walks with no flags:

```bash
bash walk/run.sh piece-1 piece-2 operator passkeys --moved 1-sign-in,2-sign-in-refused,12-sign-in-wait,op-1-sign-in,pk-1-join,pk-3-not-given,pk-4-no-operator,pk-5-link-dead,phone-2-code-used,setup-1-departments-positions,setup-2-fields,staff-4-person,staff-5-permissions,staff-6-password,staff-7-archive,staff-10-save-conflict,staff-11-save-failed,staff-13-photo,staff-15-code-changed,staff-23-back-on --write
```

You will see "== verdict: green": 120 pictures moved, all named, and 6 listed new, the new scene's.

## Your points

1. **The door in the gallery** (after step 2; it stops nothing). In this piece's worktree run
   `pnpm fake`, open the address it prints with `/48b74d079/gallery` after it, then Organisms,
   `DoorPage` and `DoorCard`. Does it read like the legacy's sign-in: the sweep, the logo and name
   atop the card, the switch in the corner, "Remember me" ticked? A no reopens the part before any
   screen takes it.
2. **The walks page** (after step 9). Twenty-one screens ask: the eight doors and the wait screen in
   the legacy's look, eleven staff screens where email now starts on (the setup's tick, the root's
   email box), and the new one, a person signing in by the email the root gave. A no reopens the
   piece while the rest goes on.
3. **On ridge** (the milestone's one look, after your push), as the flow page's section 1 says, on a
   phone and a PC beside the legacy's: sign in by a code; give a person an email and sign in by it;
   untick, close every window, reopen, open the address in a new tab: signed out. Does it read like
   the legacy's, and does each way let you in?
4. **May a browser that reopens its last tabs bring an unticked sign-in back?** Unticked, the
   sign-in belongs to its tab: a new tab or a closed browser asks again, but a browser set to reopen
   its tabs restores them signed in, as for any site. **Recommendation: yes.** A no adds one
   back-end step: an unticked sign-in also ends on the server after some hours.
