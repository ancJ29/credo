# A company's own sign-up: a company asks for its address and root, and opens once an operator approves it

## At a glance

What it is for: the sign-in campaign's fifth milestone. Someone with no company in credo yet opens
the sign-up page, types the company's name, the address it wants, their name and phone and the root's
password, and sends it; the company opens only once a credo operator approves it in the console, and
until then its address says it is waiting. Who sees it: a company about to start, and the operators.
The cheapest path: the operators' "add a client" already makes a company whole (`createClient`), so
approval is that call with the root's password the requester chose; the request itself is one small
record beside the client index, which makes nothing of a company until then. The sign-in card and the
header's brand do not change. The price: about 150 machine minutes in ten steps, 79 of them before
the walks; one landing with the whole check and a review, your one walk run, three looks and one told
decision.

**Your two asks, each a line of this plan:** "components should be viewable from the gallery before
integration with BFF": step 1 draws every new part on invented data, before step 5 writes a route;
point 1 is the look there. "after finished, walk should be updated properly": step 8 adds the scenes
with their questions and true counts; step 9 is your one run. **Your word of 25 November:** the coder
stops after step 7; steps 8 to 10, the walks and the long checks, wait for you.

**Your answer, a fact here:** a company that signs itself up starts using the app only once a credo
operator approves it (your "yes", 25 November 11:45); the new app sends no mail. Step 1 writes it in
`docs/decisions.md`.

## The slice

One slice, walkable when it ends: a stranger opens `/sign-up`, sends "Gạch Men Phú Quý" at the
address `phu-quy`; that address now says it is waiting; an operator opens Clients, sees it under
"Waiting for approval" with the requester's name and phone, presses Approve; the company is listed,
its address opens its door, and the root signs in with the password they chose. A refusal instead
removes the request and frees the address. Stage 1 is the fake (steps 3 and 4, after the gallery);
stage 2, each step's gate and the landing's whole check; stage 3, the gallery look and the walks page;
stage 4, ridge.

**Not in it:** a mail of any kind; a request that ends by itself after some days (the bound below
caps the pile instead); a person signing themselves into an existing company (the flow page's "Left
out"); a link on a company's sign-in card, since a company's door is for its own people, so no step
waits on piece 250.2.

## The brief, checked

**How a company is made today.** An operator's `POST /api/operator/clients` (`bff/src/app.ts#L598-L625`)
takes a code, a name and a box (`shared/src/wire.ts#L177-L192`) and calls `createClient`
(`bff/src/records/clients.ts#L60-L100`): a code kept, held or still being deleted is "taken"
(`#L78-L82`); the settings and a root with a minted first password are written under a fresh id
(`#L83-L96`); the code's index line is written last with "only if none", so it alone makes the company
(`#L97-L99`). The console shows the password once. **Reused whole:** `createClient`, given the root's
password hash from the request in place of a minted one, so approval returns no password; its "taken"
checks; the list (`app.ts#L566-L569`); the operator's session check.

**What a waiting company is in the store.** Not a company: one record, `signUp.<code>`, on the home
store beside the client index, holding the name, the requester's name and phone, the root's password
as its hash alone, and when it was sent; no id, no settings, no root, no index line, so no company
route can reach it (`resolveTenant` finds the index or answers 404, `app.ts#L214-L222`). Written with
"only if none", so two sign-ups of one address leave one. `createClient` refuses a code that has a
waiting request too, so an operator's own add cannot take it meanwhile.

**What its requester sees while it waits.** After the send, a card: sent, an operator will check and
call, and once approved, open the address and sign in as root with that password. At the address: a
"waiting for approval" screen in credo's own colour, with no form. It comes from the boot: today a 404
on the settings reads as unknown (`ui/src/ClientApp.tsx#L119-L121`), drawn by `UnknownClient`
(`ui/src/pages/client/UnknownClient.tsx#L8-L24`); the 404 gains a `details: 'waiting'` where a request
is held, and the boot a "waiting" phase. Nothing signs in until approval.

**The operators' approval and refusal.** On Clients (`ui/src/pages/operator/ClientsPage.tsx#L37-L50`),
above the list where any wait: "Waiting for approval", each row its name, address, contact and day,
with Approve and Refuse; Refuse asks first. Routes: `GET /api/operator/sign-ups`,
`POST /api/operator/sign-ups/:code/approve` (writes `client.create`, as the add does, `#L600`,
`#L615-L618`), `DELETE /api/operator/sign-ups/:code` (exempt: a refused request names no client,
`bff/src/audit.ts#L86`). Any signed-in operator, no touch, as the add. Approval makes the company,
then removes the request; a code made meanwhile answers 409 and the request stays for a refusal.

**Where the sign-up is reached.** `/sign-up` at any address, chosen by its path before the company's
boot as the gallery's is (`ui/src/App.tsx#L41-L42`, `#L49-L66`), drawn on the door's frame with
credo's own brand as the operators' door is (`ui/src/pages/operator/OperatorSignIn.tsx#L25`). The
address naming no company, `www.<Domain>` (kept, `shared/src/records.ts#L99`; served by the front
door's `*.<Domain>`, `ops/env.yml#L734-L736`), shows `UnknownClient`, which gains the link "Sign up
your company". **Not on the sign-in card**, so nothing here waits on 250.2's card.

**The public route's abuse surface.** `POST /api/sign-up` takes no session and no company header, so
anyone can call it. **Its limits, each a business row red first:** at most 20 requests waiting at
once, counted before any hash, past which a 503 says "try later" and writes nothing; the fields
bounded by their schemas (the code by `clientCodeSchema`, the name as a record's, 1 to 200, the
contact's name to 100, the phone to 20 of digits, spaces and `+`); the password by the app's own rule
(`shared/src/staff.ts#L32-L33`), kept only as its hash; a code kept, taken, being deleted or waiting is
a 409 that writes nothing; the stage's throttle over the whole API, 10 a second, 50 at a burst
(`ops/env.yml#L628-L630`). The bound is the hard ceiling: a flood fills 20 requests of a few hundred
bytes and is then refused, until an operator refuses them. The audit has no company to write to;
the route is exempt and logs nothing of the password.

**Told decision (point 4):** the requester chooses the root's password at sign-up, so the operator
never hands one on; the console's own add still mints and shows one.

**Pins that go red:** the route lists (`bff/tests/route-list.test.ts#L52-L55`,
`bff/src/operator.route.test.ts#L390-L397`); the dictionaries' keys (`scripts/src/words.test.ts#L43`,
`#L64`); the gallery's state lists (`ui/src/design-system/Gallery.test.tsx`); the data set's
company names kept out of the app's bundle (`scripts/src/fake.test.ts#L55`).

**Prose that goes false:** `docs/products.md#L49` (an operator adds a client); `docs/memo/bff.md`'s
clients section gains the request and its bound; `docs/decisions.md` gains your answer (step 1).

## The case table

Rows 1 to 12 are business rows, each seen red before its code.

| # | The case: one behaviour, one sentence | Held by |
| --- | --- | --- |
| 1 | A sign-up writes one waiting request and nothing of a company: no index line, settings or root | BFF route, `bff/src/sign-up.route.test.ts` (new) |
| 2 | A waiting company's address answers every company call with the 404 marked waiting, and its root cannot sign in | the same |
| 3 | An operator's approval makes the company with the root's chosen password, the root signs in by it, and the request is gone | the same |
| 4 | A refusal removes the request and frees the address, and nothing of a company was written | the same |
| 5 | A sign-up for a code kept, taken, being deleted or already waiting is a 409 and writes nothing | the same |
| 6 | Two sign-ups of one code at once leave one request | the same |
| 7 | With 20 requests waiting, a sign-up is a 503 and writes nothing | the same |
| 8 | A sign-up past a field's bound, or with a password the rule refuses, is a 400 and writes nothing | the same |
| 9 | The request keeps the password as its hash alone, and no list or answer carries it | the same |
| 10 | Only a signed-in operator lists, approves or refuses: no session, or a company's root, is a 401 | the same |
| 11 | An approval of a code made meanwhile is a 409, and the request stays | the same |
| 12 | An operator's own add refuses a code that is waiting | BFF route, the clients route test |
| 13 | The approval is written in the company's activity as "client made" | the same as row 3, `shared/src/activity.ts` |
| 14 | The sign-up page sends the form, says a code taken, a field refused and a full queue, and shows the sent card | ui, `SignUpPage.test.tsx` (new) |
| 15 | `/sign-up` draws the page at any address, before any company's boot | ui, `App.test.tsx` |
| 16 | The boot draws the waiting screen where the 404 says waiting, and the unknown screen with its sign-up link otherwise | ui, `UnknownClient.test.tsx`, `App.test.tsx` |
| 17 | Clients lists the waiting requests above the companies, approves one, and asks before a refusal | ui, `ClientsPage.test.tsx` |
| 18 | The fake takes a sign-up, shows it waiting, approves and refuses it as the BFF does | ui, `fake.test.tsx` |
| 19 | The gallery draws the sign-up's states, the waiting screen and the console's rows in the dictionary's words | ui, `Gallery.test.tsx` |
| 20 | A stack holds the data set's one waiting request at its day, as the fake does | scripts, `generator.test.ts` |
| 21 | The walks' counts hold the new scenes | visual, `walks.test.ts` |
| 22 | The new scenes' steps replay on the real router | ui (WK6) |

## The steps

Sizes are the last rows of each step's shape in the runs log, piece 241.2's first. Each gate is the
touched package's `pnpm --filter @credo/<pkg> check`, exit 0 by its own code, plus the citation test;
each step starts by taking `pre-merge` in, so 250.2's door parts are under it once landed. "The pinned
diff" is `git diff -U0 -- visual/src/resolved.pinned.txt | grep '^+[a-z]' | cut -d' ' -f1 | sort -u`.

- [x] **1. Your answer, then the gallery.** The `docs/decisions.md` row in your words above. Then, on
      invented names: `DoorCard`'s "A company's sign-up", "An address taken" and "Sent for approval",
      `UnknownClient`'s link and "Waiting for approval"; the list page's "Waiting for approval" and
      "A refusal asked"; the words below. Row 19 red first. _Done when:_ the citation test, `ui`'s and
      `visual`'s gates, the scripts' `words.test.ts` and `fake.test.ts`, the pinned diff empty. **11 min**
      (241.2's step 1: 9; 241.1's step 7, a decisions row: 1). Then point 1.
      _Done 2026-11-25 14:27:_ the citation test, `ui`'s and `visual`'s gates and the scripts' `words.test.ts` and
      `fake.test.ts` each exit 0, the gates run after the last edit; the pinned diff empty; row 19 red on the
      old gallery (no new state), then green. The decisions row is `docs/decisions.md`'s first. 25 keys (818
      words), not about 26. Two states of the unknown and waiting screens sit in `DoorPage`'s entry, not a new
      entry; `DoorCard`'s own file is untouched, three states are added to its gallery entry.
- [x] **2. The wire and the data set.** In `shared`: the five routes, the request's and the list's
      schemas with their bounds, the record's key and schema, the bound of 20, one waiting request in
      the data set at a fixed noon-UTC day. _Done when:_ `shared`'s, `ui`'s and `visual`'s gates, the
      pinned diff empty. **17 min** (241.2's step 2: 17).
      _Done 2026-11-25 15:03:_ `shared`'s, `ui`'s and `visual`'s gates, each run after the last edit, and the citation
      test, run last, each exit 0; the pinned diff empty; the step's cases red (no `signups` module, no
      `DEMO_SIGN_UPS`), then green. New: `shared/src/signups.ts` (the request's and the list's schemas, the
      record's, the bound of 20, the waiting detail, the routes), `recordKeys.signUp` and `signUpPrefix`,
      `DEMO_SIGN_UPS` (one request, sent 3 November at noon UTC). The routes are four paths, not five: the
      public send and the operator's list, refusal and approval.
- [x] **3. The sign-up and the waiting screen, on the fake.** `ui/src/pages/SignUpPage.tsx`, the path
      in `App.tsx`, the boot's waiting phase and its screen, `UnknownClient`'s link, the api calls and
      their fake answers. Rows 14 to 16, 18's first half. _Done when:_ `ui`'s and `visual`'s gates,
      the pinned diff naming `9-unknown-company` alone. **13 min** (241.2's step 3: 13).
      _Done 2026-11-25 15:52:_ `ui`'s and `visual`'s gates, each run after the last edit, and the citation test, run
      last, each exit 0; the pinned diff names `9-unknown-company` alone; rows 14 to 16 and 18's first half
      red (no sign-up call, no page), then green. `UnknownClient` is now credo's door card with the link, and
      `WaitingClient` its twin; the gallery draws both as the app does. A 503 on the send says "too many
      companies are waiting", which a storage outage also earns: kept as it stands, for the review.
- [x] **4. The console's waiting list, on the fake.** Clients' block, Approve, Refuse and its question;
      the fake's approval making the company. Rows 17, 18's second half. _Done when:_ `ui`'s and
      `visual`'s gates, the pinned diff naming `op-5-dashboard` alone. **11 min** (241.2's step 4: 11).
      _Done 2026-11-25 16:19:_ `ui`'s and `visual`'s gates, each run after the last edit, and the citation test, run
      last, each exit 0; rows 17 and 18's second half red (no list, approve or refuse call, no block), then
      green. **The pinned diff names two screens, not one:** `op-5-dashboard` and `dc-4-gone`, the clients' list
      the delete walk ends on, which now carries the data set's waiting company above it. A third, `op-7-list-failed`,
      was moved by the first build and held still by showing the block only while the clients' list is read.
      Step 8's moved list and the run line gain `dc-4-gone`.
- [x] **5. The sign-up and the waiting answer, in the BFF.** `bff/src/routes/sign-up.ts` and
      `bff/src/records/sign-ups.ts`; `resolveTenant`'s waiting detail; `createClient`'s check of a
      waiting code. Rows 1, 2, 5 to 9, 12. _Done when:_ `bff`'s and `shared`'s gates, the operators'
      tests moved only in the route-list pin. **14 min** (241.2's steps 5 and 5b: 10 and 4).
      _Done 2026-11-25 17:03:_ `bff`'s and `shared`'s gates, each run after the last edit, and the citation test, run
      last, each exit 0; rows 1, 2, 5 to 9 and 12 red (no route, no waiting detail, a waiting code made), then
      green in `bff/src/sign-up.route.test.ts`. The operators' route tests moved by their one route-list line
      (`/api/sign-up (POST)`, read against the merge-base with `pre-merge`, since `pre-merge` has moved on); the
      route lists read declared 35, exempt 19, total 54. The order in the route is: the body under its schema,
      the queue counted (503 at 20), the code looked up (409), then the password hashed and the request written
      only where none sits. The count and the write are not one step, so a burst may pass 20 by the requests in
      flight; the stage's throttle bounds it. `tenants.route.test.ts` reads one more key of an unknown address
      (the waiting record's).
- [x] **6. The approval and the refusal, in the BFF.** The three operator routes; `createClient`
      taking a password hash. Rows 3, 4, 10, 11, 13. _Done when:_ `bff`'s gate; the route lists at their
      new counts, each new route named. **8 min** (241.2's step 6: 8).
      _Done 2026-11-25 17:23:_ `bff`'s gate, run after the last edit, and the citation test, run last, each exit 0;
      rows 3, 4, 10, 11 and 13 red (no operator route), then green in `bff/src/sign-up-approval.route.test.ts`.
      The route lists read declared 36, exempt 20, total 56: `POST /api/operator/sign-ups/:code/approve` is the
      one declared (`client.create`), `DELETE /api/operator/sign-ups/:code` the one exempt, and the list is a
      `GET`; the operators' route-test diff by the merge-base is added lines only. `createClient` and the new
      `createClientFromSignUp` share one writer; the second takes the request's `passwordHash` (so no first
      password is returned) and lets its own waiting request stand; the hash is carried over unchanged, so
      the root signs in by the password chosen. The request is
      removed after the company is made, and a failure to remove it leaves a harmless request on a code the
      company holds.
- [x] **7. The prose.** As "Prose that goes false"; the memo's request, bound and refusals. _Done
      when:_ the citation test. **5 min** (241.2's step 8: 5).
      _Done 2026-11-25 22:38:_ the citation test exits 0, run last. `docs/products.md`'s Frame and Clients row gains the waiting
      list, its approval and refusal; `docs/memo/bff.md` gains a section on the public route, its bound and
      the three operator routes; `docs/decisions.md` already holds your answer (step 1).

### Waiting for your word: the walks and the long checks

- [x] **8. The walk.** The doors' walk (`walk/specs/piece-1.spec.ts`, beside its unknown company) gains
      four scenes, the form, an address taken, sent, the address waiting; the operator's walk gains
      three, the waiting list, the refusal asked, an approval; the generator writes the data set's
      request. No new walk, so `walk/run.sh`'s list stays. Rows 20 to 22. _Done when:_
      `visual`'s, `walk`'s, `ui`'s and `scripts`' gates, the pinned diff naming the new scenes and the
      two moved alone. **20 min** (241.2's step 7: 14; piece 125's step 4, a seed change through the
      scripts' gate: 20).
      _Done 2026-11-25 22:21:_ `walk`'s, `visual`'s, `ui`'s and `scripts`' gates, each run after the last edit it
      reads, each exit 0; row 20 red (the list empty), then green in `generator.test.ts`; row 21
      held by `walks.test.ts`'s new counts (the doors' walk 20, the operator's 13); row 22 replayed in
      `SignUpPage.test.tsx` and `OperatorWalk.test.tsx`; the pinned diff names the seven new scenes
      alone, `9-unknown-company`, `op-5-dashboard` and `dc-4-gone` having moved in steps 3 and 4. The
      moved list of step 9 is those three. The sign-up scenes' names are `17-sign-up` to
      `20-address-waiting`, the operator's `op-11-waiting` to `op-13-approved`. The capture test's
      small walk is now the first walk's mock screens alone, no walk being mock-only any more.

- [ ] **9. Your walk run, then the bases.** The run line below, green; the bases committed alone; the
      same walks without flags, 0 moved. **2 min** (241.2's: 1 and 1).
- [ ] **10. The recap and the landing.** The recap and its products row; the landing; the whole check,
      as it touches `shared` and five more packages (`docs/conventions/qa.md#L262-L267`);
      `pre-main-review` before `main`, a public route that makes records being worth one
      (`qa.md#L106`), and its one fix pass. **52 min** (a recap 5; a whole check about 20; 241.2's
      review 13, fix 12, reread 2).

**The walk run** (step 9), its moved list read off step 8's pinned diff:

```bash
bash walk/run.sh piece-1 operator --moved 9-unknown-company,op-5-dashboard --write
```

You will see "== verdict: green", 12 pictures moved, all named, and the new scenes listed new.

## The words

About 26 keys, English / Vietnamese; the password's rule, the fields' refusals and "Back to sign-in"
reuse the add-person and sign-in words. `signUp`: `title` "Sign up your company" / "Đăng ký công ty
của bạn" (the unknown page's link too); `intro` "Your company gets its own address. A credo operator
checks each new company before it opens." / "Công ty của bạn sẽ có địa chỉ riêng. Nhân viên credo
kiểm tra từng công ty mới trước khi mở."; `name` "Company name" / "Tên công ty"; `code` "Address" /
"Địa chỉ"; `codeHint` "Small letters, digits and dashes; your company opens at this address." / "Chữ
thường, số và dấu gạch ngang; công ty của bạn mở tại địa chỉ này."; `contactName` "Your name" / "Tên
của bạn"; `contactPhone` "Your phone, for the operator to call" / "Số điện thoại để nhân viên gọi
lại"; `password` "Root password" / "Mật khẩu quản trị"; `submit` "Send for approval" / "Gửi để
duyệt"; `taken` "That address is taken. Choose another." / "Địa chỉ này đã có người dùng. Hãy chọn
địa chỉ khác."; `full` "Too many companies are waiting. Please try again later." / "Có quá nhiều công
ty đang chờ. Vui lòng thử lại sau."; `sentTitle` "Sent for approval" / "Đã gửi để duyệt"; `sentText`
"A credo operator will check {{name}} and call you. Once approved, open {{address}} and sign in as
root with your password." / "Nhân viên credo sẽ kiểm tra {{name}} và gọi cho bạn. Khi được duyệt, hãy
mở {{address}} và đăng nhập bằng tài khoản root với mật khẩu của bạn."; `waitingTitle` "Waiting for
approval" / "Đang chờ duyệt"; `waitingText` "This company has signed up and opens once a credo
operator approves it." / "Công ty này đã đăng ký và sẽ mở khi nhân viên credo duyệt." `operator`:
`waitingTitle` (the same words); `colContact` "Contact" / "Liên hệ"; `colAsked` "Asked on" / "Ngày
đăng ký"; `approve` "Approve" / "Duyệt"; `refuse` "Refuse" / "Từ chối"; `refuseAsk` "Refuse {{name}}?
The request is removed and its address freed." / "Từ chối {{name}}? Yêu cầu sẽ bị xóa và địa chỉ được
trả lại."; `refuseConfirm` "Refuse this company" / "Từ chối công ty này"; `refuseCancel` "Keep it
waiting" / "Giữ lại chờ duyệt"; `approved` "{{name}} is approved and open at its address." / "{{name}}
đã được duyệt và mở tại địa chỉ của mình."; `approveFailed` "The company could not be made. Please
try again." / "Không tạo được công ty. Vui lòng thử lại."

## Your points

1. **The parts in the gallery** (after step 1; it stops nothing). In this piece's worktree run
   `pnpm fake`, open the address on its first line with `/48b74d079/gallery` after it: DoorCard's
   three new states and the waiting screen; the list page's waiting rows. Would a stranger know what
   happens after they send, and would an operator know whom to call? A no reopens the part.
2. **The walks page** (after step 9, at your word). The doors' four new screens, the operator's three
   and the two moved (the unknown page's link, Clients with a company waiting). A no reopens the piece
   while the rest goes on.
3. **On ridge** (after your push): on your phone open `www.` before the domain, "Sign up your
   company", send one; open its address: waiting. On a PC in the console approve it; on the phone sign
   in as root with the password you chose. Then send a second and refuse it: its address is unknown
   again. Does each step say plainly where the company stands?
4. **Decided by the machine, 2026-11-25** (no signed client yet, `docs/decisions.md`'s 2026-10-30 row;
   told in the chat). **May the requester choose the root's password at sign-up?** The operator then
   never hands a password on by phone, and it is kept as its hash alone until approval.
   **Recommendation: yes.** A no makes approval mint a first password and show it once, for the
   operator to pass on, as the console's add does.
