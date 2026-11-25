# Passkeys kept and removed: one's own list and removal, and the root's removal of a person's

## At a glance

What it is for: the sign-in campaign's fourth milestone. A company's person, the root too, opens
"Passkeys" in the user menu (More on a phone), sees each passkey's device, day added and day last
used, and removes one; the root sees on a person's page how many they hold and removes them all, for
a lost phone. A removed passkey signs in no one from then on, and its person is signed out on their
other devices. Who sees it: every company's people, phones first. The cheapest path: the operators'
list lends its columns, words and remove route, the archive its end of a person's sessions, the
password change the acting device's new session; new are the device's name and the root's count.
Neither the sign-in card nor the header's brand moves. The price: about 150 machine minutes in ten
steps, one landing with the whole check and a review, your one walk run (24 pictures moved, 42 new),
three looks and two told decisions.

**Your two asks, each a line of this plan:** "components should be viewable from the gallery before
integration with BFF": step 1 draws every new part on invented data before step 5 writes a route,
and point 1 is the look there. "after finished, walk should be updated properly": step 7 adds seven
scenes with their questions and true counts, no stale scene; step 9 is your one run.

## The slice

One slice, walkable when it ends: Nguyễn Thị Lan opens Passkeys from the user menu, sees her two (an
iPhone's, used; a PC's, never), removes one after a question, and a sign-in by it is refused at the
door. The root opens a person's page, reads "Passkeys held: 2", removes them all after a question,
and that person is signed out and their passkeys refused. Stage 1 is the fake (steps 3 and 4, after
the gallery); stage 2, each step's gate and the landing's whole check; stage 3, the gallery look and
the walks page; stage 4, ridge.

**Not in it:** the QR button and the sign-in card (milestone 3); dropping the password; item 677
(`docs/open-items.md#L2309-L2311`), whose page already says passkeys are off; a password change that
drops the passkeys (item 679's other half, `#L2313-L2315`, kept open); the phone forgetting a removed
passkey, whose press meets the refusal.

## The brief, checked

**The records (question 1).** A stored passkey holds its id, public key, counter, transports, the day
added and the day last used, and no device (`shared/src/records.ts#L172-L181`); a person's record
lists them with the challenges spent (`#L198-L203`). "Last used" is written at every sign-in, with
the counter (`bff/src/records/passkeys.ts#L77-L80`), null from the add
(`bff/src/calling/passkeys.ts#L76-L87`). **A list lacks the device.** Decided: the BFF names it at
the add from the `User-Agent`, which ridge's front door passes to `/api/*`
(`ops/env.yml#L715-L717`, `#L786`), by one function in `shared` ("iPhone · Safari", "Windows ·
Chrome", else none), kept on a company's passkey alone, so the operators' records do not move. One
added before, yours on ridge among them, reads "Device not recorded".

**What already lists and removes (question 2).** The operators' own page shows the days added and last
used, "none is named", each removable but the last (`ui/src/pages/operator/PasskeysPage.tsx#L29-L31`);
the list answers `passkeyItemSchema` (`shared/src/wire.ts#L425-L431`); the remove finds the passkey,
404 for none, 409 for the last, written over the tag (`bff/src/routes/operator-auth.ts#L388-L413`).
**Reused:** that item with `device` added, the columns' words (`ui/src/i18n/en.ts#L267-L276`), the
find-and-write. **Not reused:** the touch each act asks (`wire.ts#L388-L391`) and the last one's
refusal (`operator-auth.ts#L401`): an operator has no password; a company's person keeps theirs.

**One's own (question 3).** `GET /api/auth/passkeys` and `DELETE /api/auth/passkeys/:id` in
`signInRoutes` (`shared/src/signins.ts#L72-L83`), in `bff/src/routes/own-passkeys.ts` beside the add,
the owner the session's (`#L145`), 404 where passkeys are off (`#L81-L84`); the store's removal over
the tag, as the add's (`bff/src/records/passkeys.ts#L30-L49`). **The guard is the session alone, not
the add's recent sign-in** (`own-passkeys.ts#L166`): an add can let a thief in, a removal only takes a
way in away, and the password stays. With one passkey left a person sees the same Remove; after it,
"no passkey yet" and the add. The list is a new page, `/passkeys`; the add page at `/passkey` gains a
way back; the menu's line becomes "Passkeys" (`ui/src/ClientApp.tsx#L317`, `#L356`).

**The root's (question 4).** `GET` and `DELETE` on `/api/employees/:id/passkeys`, the count and the
removal of all. **The root alone**, not "whoever the root gives the right": a password and a QR code
are the root's alone, in no list of rights (`shared/src/permissions.ts#L3-L5`,
`bff/src/routes/staff.ts#L617`); point 5. Its own company only: the person is found in the company the
call names (`staff.ts#L869`), another's id a 404, as for the person's other acts
(`bff/src/routes/cross-tenant.route.test.ts#L279`). A "Passkeys" panel after the QR's, for the root,
the person not archived, passkeys on and one held (`ui/src/pages/client/PersonPage.tsx#L551-L576`),
asks first as the archive does (`#L259-L272`). None held, no panel: no page the walks picture moves.

**Refused at once (question 5).** A removed passkey's sign-in finds no passkey: the one 401
(`bff/src/records/passkeys.ts#L72-L73`, `own-passkeys.ts#L134`), the door's "This passkey does not
open an account here" (`en.ts#L21-L22`). **A session it made ends too** (point 4): a session holds no
passkey, only the sign-in record's generation, compared at every call (`bff/src/app.ts#L280`), so a
removal mints a new one. One's own gives the removing device a new session, as a password change does
(`app.ts#L489-L502`, `ui/src/pages/client/OwnPasswordPage.tsx#L20-L21`); the root's ends all of the
person's, as an archive does (`staff.ts#L565-L572`, `bff/src/records/staff-records.ts#L83-L98`). The
passkey goes first, so a failure after leaves it refused.

**Steady pictures.** A picture is the whole page (`walk/support.ts#L67`) and the stack's clock real,
so a passkey a walk adds shows the run's day, which is why the operators' walk pictures only the data
set's (`walk/specs/operator-passkeys.spec.ts#L29-L35`). So the data set gives Lan (EMP-0001) two at
fixed noon-UTC days before its 4 November (`shared/src/demo.ts#L51-L62`, `#L571`), written by the
generator as the operators' are (`scripts/src/generator.ts#L414-L427`); no scene today opens her page.

**Pins that go red:** the menu's word (`ui/src/design-system/Gallery.test.tsx#L547-L554`,
`#L578-L580`); 775 keys (`scripts/src/words.test.ts#L43`, `#L64`); the route lists
(`bff/tests/route-list.test.ts#L52-L55`, `bff/src/operator.route.test.ts#L390-L397`); the walks'
counts (`visual/src/walks.test.ts#L450-L475`) and headings (`visual/src/words.test.tsx#L216-L220`).
Every new button holds "Remove", which `getByRole` matches in part: each new finder is `exact`. The
gallery names no one of the data set (`scripts/src/fake.test.ts#L55`).

**Prose that goes false:** `docs/partners/words.md#L55`, `docs/products.md#L30-L31`,
`docs/memo/bff.md#L426-L441`; item 679 narrowed; `docs/decisions.md` gains points 4 and 5.

## The case table

Rows 1 to 11 are business rows, each seen red before its code.

| # | The case: one behaviour, one sentence | Held by |
| --- | --- | --- |
| 1 | A person's list shows each passkey's device, day added and day last used, and nothing of its key | BFF route, `bff/src/passkeys-kept.route.test.ts` (new) |
| 2 | A passkey added is named by the browser that added it; one stored before reads none | the same; `shared/src/devices.test.ts` (new) |
| 3 | A removed passkey's sign-in is the one 401, and the person's other passkey still signs in | the same |
| 4 | One's own removal ends the person's other sessions, and the removing device keeps a new one | the same |
| 5 | The last passkey is removed like any other, and the password still signs in | the same |
| 6 | A person removes only their own: another's passkey id is a 404, and it still signs in | the same |
| 7 | The root reads a person's count and removes all; they sign in no one, the person's sessions end, the root's not | the same |
| 8 | Only the root: a person holding every right gets a 403 to the count and the removal, and nothing moves | the same |
| 9 | Another company's person is a 404 to the count and the removal, and their passkeys still sign in | BFF route, `cross-tenant.route.test.ts` |
| 10 | Where passkeys are off, the list, both removals and the count answer 404 | `passkeys-kept.route.test.ts` |
| 11 | The activity writes "passkey removed" for one's own and "passkeys removed" for the root's | the same, `shared/src/activity.ts` |
| 12 | The operators' list, add and removal answer as before | the operator route tests, only the route-list pin's new lines |
| 13 | The menu's "Passkeys" opens the list, in the user menu and on More, and the add page leads back to it | ui, `Shell.test.tsx`, `App.test.tsx`, `OwnPasskeyPage.test.tsx` |
| 14 | The list draws each row and its Remove, "Device not recorded", the empty line and the way to add, and passkeys off | ui, `OwnPasskeysPage.test.tsx` (new) |
| 15 | A Remove asks first; "Keep it" keeps; a removal says so, takes the new session, drops the row; a failure is told | the same |
| 16 | The person's panel shows for the root alone where one is held, asks first and tells the outcome | ui, `SignIns.test.tsx` |
| 17 | The fake lists, removes and then refuses a removed passkey, and the root's removal empties a list | ui, `fake.test.tsx` |
| 18 | The gallery draws the list's states, the question and the panel in the dictionary's words | ui, `Gallery.test.tsx` |
| 19 | A stack's company holds the data set's two passkeys for EMP-0001 at their days | scripts, `generator.test.ts` |
| 20 | The office's walk holds 10 screens, the admin's staff walk 33, piece 2's walks 47 | visual, `walks.test.ts` |
| 21 | The new scenes' steps replay on the real router | ui (WK6), `SignIns.test.tsx` |

## The steps

Sizes are the last rows of each step's shape in the runs log, piece 241.2's first. Each gate is the
touched package's `pnpm --filter @credo/<pkg> check`, exit 0 by its own code, plus the citation
test. "The pinned diff" is
`git diff -U0 -- visual/src/resolved.pinned.txt | grep '^+[a-z]' | cut -d' ' -f1 | sort -u`.

- [x] **1. The gallery.** In the confirm page's entry (`ui/src/design-system/Pages.tsx#L908-L915`),
      beside the add page's two states, which gain the way back: "Your passkeys", "A removal asked",
      "A passkey removed" and "No passkey yet" at the phone's width, "A person's passkeys" and "Their
      removal asked" at a PC's, on the gallery's own names and days; the menu's "Passkeys"; the words
      below, their count in `scripts/src/words.test.ts`. Row 18 red first. _Done when:_ `ui`'s and
      `visual`'s gates, the scripts' `words.test.ts` and `fake.test.ts`, the pinned diff naming
      `lists-9-more` alone. **10 min** (241.2's step 1: 9; 241.1's: 10). Then point 1.
      _Done 2026-11-25 12:29:_ `ui`'s and `visual`'s gates, the citation test and the scripts' `words.test.ts` and
      `fake.test.ts` each exit 0; row 18 red with no new state, then green. Eighteen keys (793 words) and
      `user.passkey` changed; the gallery's menu row links to `/passkeys`. The pinned diff is empty, not
      `lists-9-more`: the hash holds resolved styles, never text, so the word's move shows in the walk's
      pixels alone.
- [ ] **2. The wire, the device's name, the data set.** In `shared`: the four routes, the list's item,
      `device` on a company's stored passkey, `deviceNameOf` and its tests, the two actions, Lan's two
      passkeys. Row 2's names red first. _Done when:_ `shared`'s, `ui`'s and `visual`'s gates, the
      pinned diff empty. **17 min** (241.2's step 2: 17).
- [ ] **3. Your passkeys, on the fake.** `ui/src/pages/client/OwnPasskeysPage.tsx` at `/passkeys`; the
      menu's path; the add page's way back; two api calls and their fake answers, each person's list
      in the tab, the fake's add naming its device, its sign-in refusing a removed credential. Rows 13
      to 15, 17's first half. _Done when:_ `ui`'s and `visual`'s gates, the pinned diff naming
      `staff-25-add-passkey`, `staff-26-passkey-added` and `staff-27-passkey-sign-in` alone. **13
      min** (241.2's step 3: 13).
- [ ] **4. The person's panel, on the fake.** `PasskeysPanel` in `ui/src/parts/SignInPanels.tsx`; the
      person's page reads the count for the root where passkeys are on (`PersonPage.tsx#L597-L602`);
      two api calls and their fake answers. Rows 16, 17's second half. _Done when:_ `ui`'s and
      `visual`'s gates, the pinned diff empty. **11 min** (241.2's step 4: 11).
- [ ] **5. One's own, in the BFF.** The two routes in `own-passkeys.ts`; the add names the device; the
      removal writes the record, then the sign-in record's new generation and the device's new
      session, the password change's lines made one function both call. Rows 1 to 6, 10 and 11's own
      halves. _Done when:_ `bff`'s and `shared`'s gates, and
      `git diff -U0 pre-merge -- bff/src/operator.route.test.ts 'bff/src/routes/operator-*.route.test.ts'`
      shows only added route-list lines (row 12). **14 min** (241.2's steps 5 and 5b: 10 and 4).
- [ ] **6. The root's, in the BFF.** Two routes in `bff/src/routes/staff.ts` beside the QR's:
      `mustBeRoot`, `mustFind`, the switch, then `endSessions`. Rows 7 to 9, 10 and 11's root halves.
      _Done when:_ `bff`'s gate; the same diff; the route lists at declared 35, exempt 18, total 53.
      **8 min** (241.2's step 6: 8).
- [ ] **7. The walk.** As "The walk" below; the generator writes Lan's two. Rows 19 to 21. _Done
      when:_ `visual`'s, `walk`'s, `ui`'s and `scripts`' gates, row 20 red on the old counts, row 21
      replayed, the pinned diff naming the seven new scenes alone. **20 min** (241.2's step 7: 14 for
      five scenes; piece 125's step 4, a seed change through the scripts' gate: 20).
- [ ] **8. The prose.** As "Prose that goes false". _Done when:_ the citation test. **5 min** (241.2's
      step 8: 5).
- [ ] **9. Your walk run, then the bases.** After `pre-merge` is taken in, so 250.2's bases are under
      it if 250.2 landed first: the run line below, green; the bases committed alone, each walk's
      count matching the log; the same walks without flags, 0 moved. **2 min** (241.2's: 1 and 1).
- [ ] **10. The recap and the landing.** The recap and its products row; `pre-merge` taken in, the
      gates again, the landing; the whole check, as it touches `shared` and five more packages
      (`docs/conventions/qa.md#L262-L267`); `pre-main-review` before `main`, sign-in being worth one
      (`qa.md#L106`), and its one fix pass. **52 min** (a recap 5: 241.2's 1 and 4; a whole check
      about 20; 241.2's review 13, fix 12, reread 2).

## The walk

**Moved:** four scenes, 24 pictures: the add page's way back in `staff-25-add-passkey`,
`staff-26-passkey-added` and `staff-27-passkey-sign-in`, More's "Passkeys" in `lists-9-more`:

```bash
ls walk/specs/*-snapshots | grep -c -E '^(staff-25-add-passkey|staff-26-passkey-added|staff-27-passkey-sign-in|lists-9-more)-'
```

**New:** seven scenes, 42 pictures, in `visual/src/walks.ts`, `walk/specs/piece-2.spec.ts` and
`visual/site/questions-vi.json`: three of Lan's after `office-7-password-wrong`, four after
`staff-29-passkey-refused`.

| Scene | What it shows | Its question |
| --- | --- | --- |
| `office-8-passkeys` | Lan's two: an iPhone's, last used 3 November; a PC's, never | Would a person tell their passkeys apart, and see how to remove one? |
| `office-9-passkey-remove-asked` | the PC's row asking first | Does the question say plainly what removing it does? |
| `office-10-passkey-removed` | one row left, and the message | Does it say the passkey is gone and the other ways in still work? |
| `staff-30-no-passkey` | Trần Văn Hùng's list, none yet, the way to add | Would a person with no passkey know how to add one? |
| `staff-31-person-passkeys` | the root on Lan's page, "Passkeys held: 2" | Would the root see that this person holds passkeys, and how to remove them for a lost phone? |
| `staff-32-person-passkeys-asked` | the root's question | Does it say the person will be signed out everywhere? |
| `staff-33-person-passkeys-removed` | removed, the person signed out | Does it say the passkeys are gone and the person signed out? |

Each scene opens on a company of its own. A removed passkey's refusal is `staff-29-passkey-refused`'s
picture already, so rows 3 and 7 hold it and point 3 takes it on a real phone. The office's walk goes
from 7 to 10 screens, the admin's staff walk from 29 to 33, piece 2's from 40 to 47; none on the
wrong path.

**Your one run** (step 9), then `--write`'s bases committed, then the same walks with no flags:

```bash
bash walk/run.sh piece-2 admin-lists --moved staff-25-add-passkey,staff-26-passkey-added,staff-27-passkey-sign-in,lists-9-more --write
```

You will see "== verdict: green": 24 pictures moved, all named, 42 listed new.

## The words

Eighteen new keys (775 to 793) and one changed, English / Vietnamese; the columns, "Never used", the
failure and passkeys off reuse the operators' and milestone 2's (`en.ts#L267-L276`, `#L561`):

- `user.passkey` "Add a passkey" becomes "Passkeys" / "Khóa truy cập".
- `ownPasskeys`: `title` "Your passkeys" / "Khóa truy cập của bạn" (the way back too); `text` "Each
  passkey signs you in on its device with your face, fingerprint or PIN. Your password keeps
  working." / "Mỗi khóa truy cập đăng nhập cho bạn trên thiết bị của nó bằng khuôn mặt, vân tay hoặc
  mã PIN. Mật khẩu của bạn vẫn dùng được."; `colDevice` "Device" / "Thiết bị"; `deviceUnknown`
  "Device not recorded" / "Không rõ thiết bị"; `none` "You have no passkey yet." / "Bạn chưa có khóa
  truy cập nào."; `remove` "Remove" / "Gỡ"; `removeAsk` "Remove this passkey? It will no longer sign
  you in, and your other devices will be signed out." / "Gỡ khóa truy cập này? Khóa sẽ không đăng
  nhập được nữa, và các thiết bị khác của bạn sẽ bị đăng xuất."; `removeConfirm` "Remove this
  passkey" / "Gỡ khóa truy cập này"; `removeCancel` "Keep it" / "Giữ lại"; `removed` "Passkey
  removed. Your other ways to sign in keep working." / "Đã gỡ khóa truy cập. Các cách đăng nhập khác
  của bạn vẫn dùng được."
- `person`: `passkeysTitle` "Passkeys" / "Khóa truy cập"; `passkeysHeld` "Passkeys held: {{count}}" /
  "Số khóa truy cập: {{count}}"; `passkeysText` "If a phone is lost, remove them all: {{name}} is
  signed out everywhere and signs in again without a passkey." / "Khi mất điện thoại, hãy gỡ hết:
  {{name}} bị đăng xuất trên mọi thiết bị và đăng nhập lại không cần khóa truy cập.";
  `passkeysRemove` "Remove all passkeys" / "Gỡ tất cả khóa truy cập"; `passkeysConfirm` "Remove
  {{name}}’s passkeys" / "Gỡ khóa truy cập của {{name}}"; `passkeysCancel` "Keep them" / "Giữ lại";
  `passkeysRemoved` "Passkeys removed. {{name}} is signed out everywhere." / "Đã gỡ khóa truy cập.
  {{name}} đã bị đăng xuất trên mọi thiết bị."; `passkeysFailed` "The passkeys could not be removed.
  Please try again." / "Không gỡ được khóa truy cập. Vui lòng thử lại."

## Your points

1. **The parts in the gallery** (after step 1; it stops nothing). In this piece's worktree run
   `pnpm fake`, open the address on its first line with `/48b74d079/gallery` after it: Pages, the
   confirm page's six new states; Menus. Would a person tell their passkeys apart, and does each
   question say what the removal does? A no reopens the part before any screen takes it.
2. **The walks page** (after step 9). Eleven screens ask: the add page's three with their way back,
   More with "Passkeys", and the seven new ones, from a person's own list to the root's removal. A
   no reopens the piece while the rest goes on.
3. **On ridge** (the milestone's one look, after your push), on your -3 copy. On your iPhone in
   Safari, as a person: Passkeys from More; remove the one of 24 November ("Device not recorded"),
   sign out, "Sign in with a passkey": refused. Sign in by code, add one ("iPhone · Safari"); then on
   a PC, as the root, remove that person's passkeys: the phone is signed out, its passkey refused.
   Does each refusal come at once? A no reopens the step it names.
4. **Decided by the machine, 2026-11-25** (no signed client yet, so details are the machine's,
   `docs/decisions.md`'s 2026-10-30 row; told in the chat). **May a removal sign its person out on
   every other device?** A session does not know which passkey made it, so all end or none, and a
   lost phone still signed in is what the removal is for; the removing device stays signed in.
   **Recommendation: yes.** A no keeps every session and refuses only the next sign-in.
5. **Decided by the machine, 2026-11-25** (as point 4). **May only the root remove a person's
   passkeys?** Setting a password and showing a QR code are the root's alone today, never a right
   given to others, and the flow page kept the QR right back until a company asks.
   **Recommendation: yes.** A no adds one right to the list the root gives, for the staff who may.
