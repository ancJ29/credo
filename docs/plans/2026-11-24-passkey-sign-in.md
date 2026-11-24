# Signing in by passkey: each of a company's people adds their own and signs in by it

## At a glance

What it is for: the sign-in campaign's second milestone. Every company's person, the root too, adds
a passkey from the user menu beside "Change password", then signs in by "Sign in with a passkey" under
the card's "or" and their face, finger or phone PIN. Who sees it: every company's people, phones
first. The cheapest path: the operators' passkeys lend the library calls, the signed challenge, the
passkey's stored shape, the browser door, the fake device and both test authenticators; a company
gets its own record, four routes and its own address as the passkey's home. The password stays
(point 1 of the flow page); passkeys are on until a root unticks them (its point 3). The price: about
160 machine minutes in ten steps, one landing with the whole check and a review, your one walk run
(42 pictures moved, 30 new), three looks and one told decision.

**Your two asks, each a line of this plan:**

- "components should be viewable from the gallery before integration with BFF": step 1 draws the
  card's button, the menu's new line and the add page's two states on invented data, before step 5
  writes any route; point 1 is the look there.
- "after finished, walk should be updated properly": step 7 gives the five new scenes their
  questions, the counts and the door question true, no stale scene; step 9 is your one run.

## The slice

One slice, walkable when it ends: a person signs in by code, email or QR code, opens the user menu
(More on a phone), "Add a passkey", presses its one button and gives a touch; signs out; presses
"Sign in with a passkey" on the door and lands on their first page. The root the same. Stage 1 is the
fake (steps 3 and 4; the gallery comes first, as you asked); stage 2, each step's gate and the
landing's whole check; stage 3, the gallery look and the walks page; stage 4, ridge.

**Not in it:** one's list of passkeys, their removal and the root's (milestone 4); the QR button
(milestone 3); dropping the password (point 1's no); item 30, the operators' add in Safari (below).

## The brief, checked

**"Modelled on the operators' own, so the work is to share that code": half true.** Shared:
`@simplewebauthn/server` 14.0.3 and `/browser` 14.0.0 (`pnpm-workspace.yaml#L44-L46`), the challenge
signed and never stored (`bff/src/calling/challenge.ts#L23-L31`), the stored passkey
(`shared/src/records.ts#L171-L178`), the browser door (`ui/src/browserPasskeys.ts#L18-L27`), the fake
device (`ui/src/fake.ts#L158-L162`), the walk's virtual authenticator (`walk/support.ts#L138-L185`) and
the route tests' software one, which claims any origin (`bff/tests/authenticator.ts#L43-L54`). The
four library calls move out of `registerOperatorAuth` into one file, each caller passing its own
origin and relying party; the operators pass theirs as today, their tests unchanged (row 14). The
store, the routes, the address and the add's guard are the company's own, as below.

**"Whether ridge's address accepts a passkey": not as the code stands.** The relying party is
`APP_ORIGIN`'s host (`bff/src/routes/operator-auth.ts#L77`) and every check expects that origin
(`#L194-L195`, `#L230-L231`): on ridge `operator.<Domain>` (`ops/env.yml#L1118-L1124`), while a company
opens at `<code>.<Domain>` (`shared/src/wire.ts#L213-L218`), where a browser refuses a ceremony for
another name. So a company's ceremonies take its own origin, made from `APP_ORIGIN` and its code by
`clientAddress`, never from the request's host (`bff/src/app.ts#L96-L97`); locally that is
`localhost` for all. Item 291's fix needs the same (`docs/open-items.md#L1382`).

**"Whether Safari on an iPhone accepts it": not measurable here** (no browser). WebKit's page
(https://webkit.org/blog/11312/meet-face-id-and-touch-id-for-the-web/) says Face ID and Touch ID need a
user gesture, carried through a fetch until it "will expire after 10 seconds", and nothing of a second
ceremony on one click, which the operators' add runs (`ui/src/pages/operator/PasskeysPage.tsx#L41-L48`,
item 30, `docs/open-items.md#L248-L262`). **Decided:** each company press runs one ceremony on options
asked when the screen opened; options past four minutes (a challenge lives five, `challenge.ts#L19`)
are asked again in the press, one fetch. This avoids item 30's shape and leaves item 30 parked: the
console is Chrome-only by your 30 October call. Point 3 is the proof.

**Where a person's passkeys are kept:** one record an owner, `tenant.<id>.passkeys.<handle>`, the
passkeys and the challenges spent in five minutes, as the operator's account keeps them without its
link and generation (`shared/src/records.ts#L186-L192`). The handle, the WebAuthn user id, is the
person's minted id, or the company's own for the root (sign-in name `root`,
`bff/src/records/clients.ts#L23`): UUIDs, unique where `localhost` is every company's relying party.
Not on the sign-in record, each write of which ends the person's other sessions
(`bff/src/app.ts#L469-L472`), while each passkey sign-in moves a counter. It sits in the company's box
(`app.ts#L213-L221`), goes with its deletion, and reads to the demo seed as "not fresh", rightly
(`scripts/src/demo/apply.ts#L171-L191`).

**The refusals, one 401 at the sign-in**, as the QR sign-in's (`app.ts#L415-L418`): no record under the
company the header names; a passkey it lacks, or one the library refuses; a challenge spent, or made
for another company or purpose; a person archived or no longer named by their sign-in record
(`app.ts#L236-L267`, `#L440-L445`); passkeys switched off. An operator's passkey names no company
owner, a company's handle no roster line (`operator-auth.ts#L297-L303`).

**The add's guard** (point 4): the operators' add asks a touch so "a stolen session cannot put the
thief's passkey in" (`shared/src/wire.ts#L388-L391`); a first passkey has nothing to touch, so the add
takes a session issued in the last ten minutes, by its own `issuedAt`
(`bff/src/calling/sessions.ts#L75-L86`), else a 403.

**The switch:** `passkey`, optional in `staffFieldsSchema` (`shared/src/fields.ts#L70-L83`), read as
on by `staffConfig` (`shared/src/staff.ts#L158-L168`); a third tick under "Sign-in methods"
(`ui/src/parts/StaffFieldsEditor.tsx#L160-L179`). The save sends every switch, filled from
`staffConfig` (`#L41-L45`, `#L90`), so from the landing a save keeps what the tick shows. **Unlike email,
no company holds a saved choice today:** the strict schema has no such key
(`grep -c -i passkey shared/src/fields.ts shared/src/staff.ts`: 0 and 0), so every company starts on.
Off is off for the root too. Item 675's passkey half closes (`docs/open-items.md#L2297-L2299`).

**The screens.** The card: a labelled divider and a full-width default button, the legacy's shape
(the legacy app's `workspace/uis/base/src/components/auth/pages/LoginUI.tsx#L126-L139`), which the
gallery's card draws already with a sample link (`ui/src/design-system/entries.tsx#L118-L125`); "Sign
in with a passkey" / "Đăng nhập bằng khóa truy cập" (the operators' Vietnamese, `ui/src/i18n/vi.ts#L233`),
shown where the options answered, so a company with passkeys off (404) keeps today's door. "Add a
passkey" follows "Change password" in the user menu and on More (`ui/src/frame/Shell.tsx#L112-L113`);
its page sits at `/passkey` beside `/password` (`ui/src/ClientApp.tsx#L253-L261`), of the confirm
page's kind (`ui/src/design-system/Pages.tsx#L876-L879`).

**Finders that go red:** Playwright's `getByRole('button', { name })` matches part of a name, so
"Sign in" meets "Sign in with a passkey": `walk/specs/piece-1.spec.ts#L94`, `#L105`, `#L109`, `#L116`
take `exact: true` (`git grep -n -E "getByRole\('button', \{ name: words\.auth\.submit \}\)" -- walk/specs`: 4).
Testing Library reads a string name whole, so the ui tests stand.

**Prose that goes false:** `docs/partners/words.md#L55` (a passkey is an operator's);
`docs/products.md#L30` and `#L86` (756 words); `docs/decisions.md#L18` (item 675); the door question
(`visual/src/walks.ts#L324-L325`, item 674, `docs/open-items.md#L2293-L2295`); `lists-9-more`'s
sentence (`walks.ts#L1398`); `docs/memo/bff.md` gains the company's passkeys (`#L411-L416`).

## The case table

Rows 1 to 13 are business rows, each seen red before its code.

| # | The case: one behaviour, one sentence | Held by |
| --- | --- | --- |
| 1 | A setup that never set the passkey switch has passkeys on, and one holding `passkey: false` keeps them off | unit, `shared/src/staff.test.ts` |
| 2 | The staff setup draws the passkey tick ticked where it was never set, and a save keeps an untick | ui, `StaffSetupPage.test.tsx` |
| 3 | A person signed in within ten minutes adds a passkey, and next time signs in by it as themselves with nothing typed | BFF route, `bff/src/passkey-sign-in.route.test.ts` (new) |
| 4 | The root adds one and signs in by it as the root | the same |
| 5 | A session issued more than ten minutes ago is refused the add with a 403 | the same |
| 6 | Where passkeys are switched off, both options calls and the add answer 404, and a passkey held signs in no one | the same |
| 7 | A person who has left signs in by no passkey, and switched back on signs in by it again | the same |
| 8 | A passkey or a token of one company signs in no one at another | the same, two companies |
| 9 | An operator's passkey signs in no company's person, and a company's passkey no operator | the same |
| 10 | The same answer sent twice signs in once | the same |
| 11 | A passkey already held is not added again | the same |
| 12 | A company's ceremony is checked against its own address, `<code>.<Domain>` beside the operators' `operator.<Domain>`, and one made at the operators' address is refused | the same, the software authenticator claiming each origin |
| 13 | An add is written in the company's activity as "passkey added"; a sign-in writes nothing | the same, `shared/src/activity.ts` |
| 14 | The operators' sign-in, join, add and remove answer as before | BFF, the operator route tests, unchanged |
| 15 | The door draws "or" and "Sign in with a passkey" where the options came, and nothing where they answered 404 | ui, `SignIn.test.tsx`, `App.test.tsx` |
| 16 | A press signs in; not given, refused and unavailable are each told, the form kept | ui, `App.test.tsx` |
| 17 | Options older than four minutes are asked again within the press | ui, `App.test.tsx` |
| 18 | "Add a passkey" follows "Change password" in the user menu and on More, for a person and the root | ui, `Shell.test.tsx`, `App.test.tsx` |
| 19 | The add page asks its options on opening, and each of its outcomes is told | ui, `OwnPasskeyPage.test.tsx` (new) |
| 20 | The fake adds and signs in by passkey, refuses where none was added, and answers 404 where off | ui, `fake.test.tsx` |
| 21 | The gallery draws the card's button, the menu's line and the add page's two states in the dictionary's words | ui, `Gallery.test.tsx` |
| 22 | The admin's staff walk holds 29 screens and piece 2's walks 40 | visual, `visual/src/walks.test.ts` (`#L447-L460`) |
| 23 | The new scenes' steps replay on the real router | ui (WK6) |

## The steps

Sizes are the last rows of each step's shape in the runs log. Each gate is the touched package's
`pnpm --filter @credo/<pkg> check`, exit 0 by its own code, plus the citation test. "The pinned diff" is
`git diff -U0 -- visual/src/resolved.pinned.txt | grep '^+[a-z]' | cut -d' ' -f1 | sort -u`.

- [x] **1. The gallery.** The card's Sign-in state gets "or" and "Sign in with a passkey" in the
      dictionary's words (`auth.or`, `auth.passkey`), the sample link button gone (milestone 3 brings its
      own); the user menu sample (`ui/src/design-system/Menus.tsx#L61`) and the menu page sample
      (`Pages.tsx#L787`) gain `user.passkey`; the confirm page's entry gains two states at the phone's
      width, "A passkey to add" and "A passkey added" (`ownPasskey.*`); both dictionaries, the count in
      `scripts/src/words.test.ts`. Row 21 red first. _Done when:_ `ui`'s and `visual`'s gates, the pinned
      diff empty. **10 min** (241.1's steps 1 and 2: 10, 7). Then point 1.
      _Done 2026-11-24 08:58:_ `ui`'s and `visual`'s gates, the citation test and the scripts' `words.test.ts` and
      `fake.test.ts` each exit 0; the pinned diff empty; row 21 red on the old dictionary, then green. Eight
      keys (`auth.or`, `auth.passkey`, `user.passkey`, `ownPasskey.title`, `text`, `submit`, `added`,
      `addedText`): 764 words; the gallery's `useLink` sample gone with its button, the card's key icon is
      `IconKey`; the menu's line links to `/passkey`.
- [x] **2. The wire and the switch.** In `shared`: four routes in `signInRoutes` (the sign-in's options
      and sign-in, the add's options and add), the add's request `{ token, response }`, `passkey` in the
      fields, `employee.passkey` in `ACTIONS` (`shared/src/activity.ts#L30-L34`); the setup's third tick.
      Rows 1 and 2 red first. _Done when:_ `shared`'s, `ui`'s and `visual`'s gates, the pinned diff
      naming `setup-1-departments-positions` and `setup-2-fields` alone. **15 min** (piece 151's red-first
      fix steps: 7, 13, 15; 241.1's step 6 took 35, most of it item 671's timeouts, fixed since).
      _Done 2026-11-24 09:23:_ `shared`'s, `ui`'s and `visual`'s gates and the citation test (with the scripts' `words.test.ts`)
      each exit 0; the pinned diff names `setup-1-departments-positions` and `setup-2-fields` alone; rows 1
      and 2 each red on the old code (two cases, one case), then green. Four routes under `signInRoutes`
      (`/api/auth/passkey/options`, `/sign-in`, `/add-options`, `/add`); the add's request
      `ownPasskeyAddRequestSchema` is `{ token, response }`, the sign-in's the operators' `passkeySignInRequestSchema`;
      `employee.passkey` is "passkey added"; `setup.fieldPasskey` makes the dictionaries 765 keys.
- [ ] **3. The door's button, on the fake.** `SignIn` takes the passkey's state and press; `ClientApp`
      asks the options as the door opens, keeps them with their time and runs one ceremony a press; the
      two calls in `ui/src/api.ts` and their fake answers (the fake keeps in the tab whose its one
      credential is); the mock's door draws the button (`ui/src/mock/screens.tsx#L44-L56`); piece 1's
      pictures wait on it (WK5); the four finders `exact`. Rows 15 to 17. _Done when:_ `ui`'s, `visual`'s
      and `walk`'s gates, the pinned diff naming `1-sign-in`, `2-sign-in-refused`, `12-sign-in-wait` and
      `staff-24-email-sign-in` alone. **14 min** (241.1's step 5: 14).
- [ ] **4. The add page, on the fake.** `ui/src/pages/client/OwnPasskeyPage.tsx` at `/passkey`, of the
      confirm kind; `Shell`'s menu link for everyone signed in; its two api calls and their fake answers.
      Rows 18 to 20. _Done when:_ `ui`'s and `visual`'s gates, the pinned diff naming `lists-9-more`
      alone. **14 min** (the same row).
- [ ] **5. The add, in the BFF.** `bff/src/calling/passkeys.ts`, the library's four calls taking an
      origin and a relying party, `registerOperatorAuth` calling them with its own; `bff/src/records/passkeys.ts`,
      the owner's record over its tag; the add's two routes behind `forClient`, the sign-in check handing on
      the session's `issuedAt`; the company's origin by `clientAddress`; the route list
      (`bff/tests/route-list.test.ts#L75-L85`). Rows 3's add half, 5, 6's add half, 11, 12 and 13 red first.
      _Done when:_ `bff`'s gate, and `git diff --stat pre-merge -- bff/src/operator.route.test.ts 'bff/src/routes/operator-*.route.test.ts'`
      prints nothing (row 14). **20 min** (piece 125's step 4: 20; piece 127's route step: 18).
- [ ] **6. The sign-in by passkey, in the BFF.** Its two routes, the one 401, the spend and the counter
      in one write with its tag, the session issued as a password's is. Rows 3's sign-in half, 4, 6 to 10
      red first. _Done when:_ `bff`'s gate. **18 min** (piece 127's route step: 18; piece 128's step 4: 15).
- [ ] **7. The walk.** As "The walk" below; rows 22 and 23. _Done when:_ `visual`'s, `walk`'s and `ui`'s
      gates, row 22 red on the old counts, row 23 replayed. **20 min** (241.1's step 8: 14 for one scene;
      five here, the full lane's authenticator copied from the passkeys walk).
- [ ] **8. The prose.** As "Prose that goes false"; items 674 and 675 marked fixed. _Done when:_ the
      citation test. **5 min** (241.1's step 7: 1; piece 142's three pages: 2).
- [ ] **9. Your walk run, then the bases.** The run line below, green; the bases committed alone, each
      walk's count matching the log; the same walks without flags, 0 moved. **2 min** (241.1's 9b: 1).
- [ ] **10. The recap and the landing.** The recap and its products rows; `pre-merge` taken in, the
      gates again, the landing; the whole check, since the landing touches `shared` and five packages
      (`docs/conventions/qa.md#L262-L267`); `pre-main-review` before `main`, sign-in being worth one
      (`qa.md#L103-L108`). **43 min** (a recap 3; a whole check and a review about 20 each).

## The walk

**Today:** the operators' passkeys walk, 36 pictures
(`ls walk/specs/operator-passkeys.spec.ts-snapshots | wc -l`: 36), the fake device on the fake lane and
Chromium's virtual authenticator on the stack, its failures cued on the fake and made on the stack by an
unverified authenticator or a stranger's passkey (`walk/specs/operator-passkeys.spec.ts#L97-L109`,
`walk/support.ts#L151-L167`). It stays as it is: the null proof that the operators' sign-in did not move.

**Moved:** seven scenes, 42 pictures, the four company doors (the button), the setup's two (the tick)
and More (the line):

```bash
ls walk/specs/*-snapshots | grep -c -E '^(1-sign-in|2-sign-in-refused|12-sign-in-wait|staff-24-email-sign-in|setup-1-departments-positions|setup-2-fields|lists-9-more)-'
```

**New:** five scenes appended to the admin's staff walk after `staff-24-email-sign-in`
(`visual/src/walks.ts#L1122-L1143`), in `visual/src/walks.ts` and `walk/specs/piece-2.spec.ts`, 30
pictures. Trần Văn Hùng, just signed in by his email in scene 24, goes on:

| Scene | What it shows | Its question |
| --- | --- | --- |
| `staff-25-add-passkey` | the add page, before the press | Would a person know from this page what a passkey is, and that their password stays? |
| `staff-26-passkey-added` | after the touch | Does it say plainly that the passkey is added, and how to use it next time? |
| `staff-27-passkey-sign-in` | signed out, the button pressed: his first page | Did the passkey open the person's own first page, with nothing typed? |
| `staff-28-passkey-not-given` | the door, the device giving none | Would a person know to try again? |
| `staff-29-passkey-refused` | the door, a passkey that opens nothing here | Would a person whose passkey is not taken know to use their password? |

Scenes 28 and 29 are the operators' two failures copied: a cue on the fake, the unverified
authenticator and the stranger on the stack. Each of the stack's six tests adds Hùng a passkey on its
own authenticator, so a pass needs no reset. Switched off, sign in again and already here stay in the
machine's tests: the stack cannot age a session, and switching passkeys off mid-pass would refuse the
next test's add. No walk is added or retitled; the admin's staff walk goes from 24 to 29 screens,
piece 2's walks from 35 to 40. The door question gains the button and item 674's
fix: "…the language switch in the corner, and on a company's sign-in 'Remember me' ticked and 'Sign in
with a passkey' under 'or'?" `lists-9-more` reads "then the password, the passkey and sign-out".

**Your one run** (step 9), then `--write`'s bases committed, then the same walks with no flags:

```bash
bash walk/run.sh piece-1 piece-2 admin-lists passkeys --moved 1-sign-in,2-sign-in-refused,12-sign-in-wait,staff-24-email-sign-in,setup-1-departments-positions,setup-2-fields,lists-9-more --write
```

You will see "== verdict: green": 42 pictures moved, all named, 30 listed new, the passkeys walk 0.

## Your points

1. **The parts in the gallery** (after step 1; it stops nothing). In this piece's worktree run
   `pnpm fake`, open the address on the first line it prints (the second ends in `/?fake`, which the
   gallery path cannot follow) with `/48b74d079/gallery` after it: Organisms, `DoorCard`'s
   Sign-in state; Menus; Pages, the menu page and the confirm page's two new states. Does the button
   read like the legacy's "Use login link", and would a person know what "Add a passkey" does? A no
   reopens the part before any screen takes it.
2. **The walks page** (after step 9). Twelve screens ask: the four company doors with the new button,
   the setup's two with the passkey tick, More with its new line, and the five new ones, from adding a
   passkey to one refused. A no reopens the piece while the rest goes on.
3. **On ridge** (the milestone's one look, after your push), on your -3 copy: your iPhone in Safari,
   then a PC in Chrome. On each, sign in by code, "Add a passkey" from the menu (More on the phone),
   sign out, "Sign in with a passkey"; then once as the root. Does each press work the first time, and
   does it read like the legacy's? A no on the iPhone alone reopens the ceremony's shape: a press for
   each touch, item 30's fix.
4. **Decided by the machine, 2026-11-24** (no signed client yet, so details are the machine's,
   `docs/decisions.md`'s 2026-10-30 row; told in the chat). **May adding a passkey ask only for a
   sign-in in the last ten minutes, not a password?** A phone left signed in for days cannot add a
   thief's passkey, and a driver who signs in by QR has no password to type. **Recommendation: yes.** A
   no makes the add ask the password wherever the person holds one.
