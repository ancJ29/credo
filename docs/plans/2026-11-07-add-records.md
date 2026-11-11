# A clerk adds a customer and a product

## At a glance

A new customer telephones and the order-taker adds it from the Customers list, then stocks a new product from the
Products list, with nobody signing in as the root and nobody building a spreadsheet. Today the only way into either
list is the root's Excel import (`bff/src/routes/lists.ts#L140-L141`), and neither list page draws an Add
(`ui/src/ListPage.tsx#L22-L31`, the whole page): a person with `orders.canEdit` has no path at all.

The cheapest safe path is **the editable detail pages of 11-07, copied**: their forms already hold every field,
every rule and every notice this needs, and an add is such a form plus one editable code box. The server side is
the import's own inner body, lifted out of its loop into one route registered over the kind table, so it serves
both lists at once. **Price:** no new infrastructure, $0 a month; about 100 machine minutes and one 18-minute
picture run.

## The slice

One slice for **both** lists, because the server work is one block, not two: `registerList` is generic over a
`ListKind` and registered twice (`bff/src/routes/lists.ts#L97-L100`, `#L240-L241`), so `app.post(kind.route, …)` written
once gives customers and products their add together. Splitting the lists would write that route twice, or build it
for one caller and leave the second list's page waiting on it.

- **The wire: nothing new.** The body is `addCustomerRequestSchema` / `addProductRequestSchema`, which the import
  already parses each row with (`shared/src/lists.ts#L71-L85`, `bff/src/routes/lists.ts#L59`, `#L76`); the answer is
  `customerDocSchema` / `productDocSchema` (`shared/src/lists.ts#L38`, `#L51`), as the detail page reads.
- **One route per list, from one registration** (`bff/src/routes/lists.ts`): `POST /api/customers` and `POST /api/products`
  for whoever may edit orders. Its body is the import's row rule, its code search the import's own `codes` set
  (`#L144`, `#L152-L156`), its write the import's `write` under a fresh id (`#L115-L127`, `#L157`). The import
  keeps its `mustBeRoot` untouched.
- **Two add pages**, each thin around the detail page's existing form component: the code box editable instead of
  read-only (`ui/src/CustomerPage.tsx#L157`, `ui/src/ProductPage.tsx#L207`), no version, and a "that code is taken"
  notice beside the saved/failed/forbidden three. On success the clerk lands on the new record's own page, as
  adding a person does (`ui/src/AddPersonPage.tsx#L104`).
- **The Add button** on both list pages for whoever may edit orders, beside the Import the root alone sees.
- **The fake** gains the two calls and an `addCustomer:409` cue, by the cue machinery already there
  (`ui/src/fake.ts#L114`, `#L201`, `#L269`, `#L822`).

Decided here, each from what the repository already holds rather than from preference:

- **The fields are exactly the import's columns** (`ui/src/listSheet.ts#L31`, `#L46`): a customer's code, name,
  phone, address and note; a product's code, name, unit, price, stock switch and note. *Why:* the two ways into one
  list must put the same record in it, or a clerk's customer and an imported one are different animals.
- **Required are exactly the import's `needed`** (`#L32`, `#L47`): a customer's code and name; a product's code,
  name, unit and price. The stock switch starts **on** (changed at step 7 from off: the import reads a blank stock cell as yes,
  `ui/src/listSheet.ts#L73`, and the two ways in must agree) — it is a boolean, whether stock is kept, with no third
  state (`shared/src/lists.ts#L32`) — and the phone, address and note are free, an empty one writing no key at all
  (`mergeExtra`, as every save already does).
- **The code is typed, never generated.** Adding a person may leave it empty for the next number
  (`ui/src/AddPersonPage.tsx#L62-L63`), but these lists have no number series and the import demands a code in
  every row. Its rule is the shared one the import's rows use (`shared/src/lists.ts#L70-L72`), capitalised on the
  server before the list is searched (`bff/src/routes/lists.ts#L152`). 👤 4.
- **A code the list already holds is refused, nothing written, and the page says so keeping every field as
  typed** — 409, as a taken staff code is answered (`bff/src/routes/staff.ts#L209`) and mapped to a result rather than an
  error (`#L71`). *Rejected:* adding anyway under a second id, which would break the uniqueness rule every
  imported row is held to.
- **`orders.canEdit` gates the add, and no new permission is made.** The catalogue holds eight ids and no
  `orders.canCreate` (`shared/src/permissions.ts#L9-L17`; the plan first said seven and cited `#L10-L16`, one line
  short of `deliveries.canDeliver` — corrected at step 7, the decision unaffected; for the recap); `orders.canEdit` is already the right that *makes*
  records here and already corrects these two (`bff/src/routes/lists.ts#L213`). A new id would cost the catalogue, the
  permission editor, the labels and every role's defaults — its own milestone. 👤 2.
- **A clerk sets no id and no version:** the id is the server's fresh uuid and the body is a strict object, so
  either one sent is a refusal, not a silent drop.
- **Not fixed here:** uniqueness is read-then-write, a record's key being its uuid and not its code
  (`bff/src/routes/lists.ts#L116`, `#L157`), so two adds of one code at one instant can both land — as two simultaneous
  imports can today. Filed as an open item at step 7; *trigger:* a client reporting a doubled code.

## What a merged tree must satisfy

The invariants, not a file list:

1. No record reaches either list without the server checking `orders.canEdit` before it parses the body; the
   import's root-only check is unchanged, and `grep -c 'page.user.root' ui/src/ListPage.tsx` still reads 1.
2. A clerk's add and the root's import agree: the same required fields, the same code rule, the same
   capitalisation, the same refusal of a code already held, and nothing written when refused.
3. The code is the only value an add sets that a save cannot, and every other field's rule is read from the one
   shared schema, so the add form and the save form cannot drift apart.
4. The seventeen existing `admin-lists` screens keep their ids; new ones are appended, each with a scene in
   `visual/src/walks.ts`, an opening in `walk/specs/lists.spec.ts` and a first heading in
   `visual/src/words.test.tsx`.

## The case table

| # | The case | Held by |
| --- | --- | --- |
| 1 | An add whose code the list does not hold writes one record under a fresh id and answers it with its version | BFF route, `bff/src/routes/lists.route.test.ts`; red first |
| 2 | An add whose code the list already holds is refused 409 and writes nothing — in either case, whichever the code was typed in | BFF route; red first |
| 3 | Whoever may see orders but not edit them cannot add: 403, nothing written, the body never parsed | BFF route; red first |
| 4 | An add carrying an id, a version or an unknown field is refused and writes nothing | BFF route; red first |
| 5 | An add whose write landed and whose answer was lost answers the record, and no second record appears | BFF route; red first |
| 6 | The root's import still refuses whoever is not the root, and still answers one result a row | BFF route; red first |
| 7 | A customer add with no code, a code of the wrong shape, or no name is refused on the page and makes no call | unit, `ui/src/ListPage.test.tsx`; red first |
| 8 | A product add with no unit, no price, a minus price or a fractional price is refused on the page and makes no call | unit, same file; red first |
| 9 | A taken code shows its own notice and keeps every field as typed | unit, same file; red first |
| 10 | A product added with the stock switch untouched is sent with `stocked` true, as the import reads a blank stock cell (changed at step 7) | unit, same file; red first |
| 11 | Whoever may see orders but not edit sees no Add on either list; whoever may edit sees one on both | unit, same file; red first |
| 12 | Every new word reads in both languages, and each new screen's first heading is in the map | `visual/src/words.test.tsx` |

## What moves

"Customers and products from Excel": screens **1** and **6** move — each list gains an Add — and **four are
appended as 18 to 21**, never inserted, or the seventeen ids renumber and lose their yeses. 18 is the empty customer
form, 19 a code already in the list refused, 20 the empty product form, 21 the customer added, on its own page.
**6 screens, 36 pictures** (both languages at 390, 768, 1280). The walk signs in as the root
(`walk/specs/lists.spec.ts#L87-L112`), who sees the Add as any editor does, so it cannot show the refused view —
case 11 holds that. The spec's test name says "seventeen screens" (`#L316`) and becomes twenty-one. Screen 19 is
cued on the fake lane; the stack lane adds a second record with a code it just used.

## Steps

- [ ] **1. This plan.** 🤖 Opus, 10 minutes. Done when: committed, about 2,000 words or under, no local path.
- [x] **2. The two forms on invented data, the cheap end to end.** 🤖 Sonnet, about 35 minutes: the two api
  methods, the fake's two calls and its taken cue, the two add pages around the existing form components, the Add
  buttons, the words in both dictionaries, the four scenes and the spec's four screens. The look comes off this
  build, so a no costs no server work. Done when: rows 7 to 12 each red once from a named mutation, then green;
  `pnpm -r run typecheck`, the tests of `shared`, `ui` and `visual` at 100 %, eslint and prettier (there is no
  per-package `check` script: only the root has one, `package.json#L10`); `pnpm fake` serves both add pages;
  `pnpm report` builds, and against `main`'s build exactly screens 1, 6, 18, 19, 20 and 21 differ.
  *Ticked 2026-11-07 (code in `c3698f6e`):* rows 7 to 12 each red from one named mutation, then green (the
  gate's last line, log `20261107-2258-clerk-add-records-step2-gate.log`: `== exit 0 ( typecheck 0 eslint 0 prettier
  0 test-shared 0 test-ui 0 test-visual 0 test-scripts 0 knip 0 )`, ui and visual at 100 %); `pnpm fake` served both
  pages and was down at the end of its command; the report built from the committed tree against `main`'s, and
  exactly screens 1, 6 (markup differs) and 18 to 21 (new) differ out of 128 against 124, the other 122 equal,
  css and styles equal. *The plan's misreads:* the spec's header and test name had to read twenty-one (done), and
  the form markup of screens 10 to 17 stayed identical only because the code box's two new attributes are written
  in add mode alone.
- [ ] **3. The look** (👤 1, 👤 2, 👤 4); the machine goes straight on to step 4 and does not wait for it.
- [x] **4. The route against the real c-storage.** 🤖 Sonnet, about 20 minutes: one `app.post` on the kind's own
  route inside `registerList`, lifting the import's row-parse, code search and write out of its loop so both paths
  share them; nothing of the pages changes, since step 2 bound them to the shared schemas, not to a route still
  moving. Done when: rows 1 to 6 each red once, then green (`bff/tests/` builds the real c-storage per file);
  `bff`'s typecheck and tests at 100 %. Watch the route list some tests read as text.
  *Ticked 2026-11-07:* the import's inner body is now `addOne` in `registerList` and both the import's loop and the
  new `app.post(kind.route)` call it (no second copy); rows 1 to 6 each red from one named mutation, then green
  (the gate's last line, log `20261107-231321-clerk-add-records-step4-bff-gate.log`: `== exit 0 (typecheck 0 eslint 0 prettier 0 test 0)`, bff 602 tests, 100 % on
  all four figures; knip is the whole repo's, left to step 5). *The plan's misreads:* the route list the test reads as
  text was `bff/src/operator.route.test.ts` (two lines gained `POST`); and row 6 was not a guard in fact, since the
  existing refusal test used a person with only `orders.canView`, so swapping the import's root check for
  `orders.canEdit` stayed green until a test with a person holding every permission was added.
- [x] **5. The gates.** 🤖 Sonnet, about 15 minutes: `main` taken in, then the whole `pnpm check` once under the
  shared lock, `== exit 0`. **The one place the whole gate runs:** the walk and the report typecheck against this
  piece's changes, so no single package's gate can clear it.
  *Ticked 2026-11-07:* `main` (`5ea0be17`) was already an ancestor of the branch, so taking it in was a no-op. The
  five steps ran separately under the lock at load 2.07, 3 m 38 s (log
  `20261107-231928-clerk-add-records-step5-whole-check.log`, last line `== exit 0 (typecheck 0 eslint 0 prettier 0 test 0
  knip 0)`); the log holds no warning or error line; the lock was free at the end.
- [ ] **6. One review.** 🤖 Opus, about 10 minutes, not the build's model. Done when: each finding tagged here.
- [x] **7. The fix pass.** 🤖 Sonnet, about 8 minutes: the review's named changes, the read-then-write item filed,
  and the stale "The root's" comment on the list read corrected (`ui/src/api.ts#L542`, untrue since the list opened
  to `orders.canView`). Done when: the gates of the touched packages exit 0.
  Done 2026-11-07 (commit `0876e2eb`): the add form's stock switch starts on (agrees with the import's blank cell);
  `/customers/new` and `/products/new` also need the list's `mayOpen`; the permission count corrected to eight;
  items 146 to 148 filed. The whole check, run as five separate steps, log
  `logs/20261107-233422-clerk-add-records-step7-whole-check.log`: `== exit 0 (typecheck 0 eslint 0 prettier 0 test 0
  knip 0)` (the first run, `20261107-233125`, was red on one unrelated `OrdersPages` case under load, green alone and
  on the rerun). `pnpm report` against main's rebuilt report: screens 1, 6 moved, 18 to 21 new, nothing else; the
  stale "The root's" comment on the two list reads (`ui/src/api.ts#L546`, `#L578`) now says who may see orders
  (comment-only; prettier checked, the gate not rerun for it).

- [ ] **8. The picture run** (👤 3): one command in the human's terminal, about 18 minutes. Done when: run 1 green,
  its `raw.txt` naming those six screens alone; run 2 every count 0; 36 bases committed.
- [ ] **9. The recap.** 🤖 Sonnet, about 3 minutes. Done when: committed, under 400 words, the products row true.

About 100 machine minutes, and one 18-minute run of the human's. Closes item 135 and the one product gap of the
client-readiness read; opens one item for the read-then-write code race.

## The human's points

👤 **1. The look, after step 2.** On the walks page, open "Customers and products from Excel". Screen 18: an empty
customer form in the same cards as yesterday's editable page, with one box that was never editable before — the
code. Screen 19: the code typed is already in the list, so an orange notice says so and everything typed stays in
its box. Screen 20: the same for a product, with the unit, the price and the stock switch (on since step 7, so re-look at it in step 8). Screen 21: the customer
added, on its own page. A yes holds; a no becomes a case, fixed before step 8. **No mock is drawn for this:** the
form, the cards and the notices were all judged on 11-07 on the three editable pages, so a mock would re-ask a
settled question and cost a round.

👤 **2. Who may add a customer or a product, at the same look.** The Add appears for anyone who may take and edit
orders — the office's order-takers — who already correct these same records on their pages.
**Recommendation: yes, keep it there.** It needs no new permission and no setting to turn on. A no means a
permission of its own, which costs the catalogue a new entry, the staff setup a new switch and every person's page
a new line, and becomes its own milestone.

👤 **3. The picture run, step 8.** One command in your terminal, about 18 minutes, nothing else testing: the six
screens' base pictures written, then a second run compared byte for byte. Green starts the recap. A red names each
moved screen, and the machine finds why before any base is kept.

👤 **4. Whether a clerk types the customer's code, at the same look.** The form asks for a code like KH-003 or
SP-012 and refuses one already in use. **Recommendation: yes, typed.** Every imported row already carries its own
code, so the office chooses them today, and they often come from what the business used before. A no means the
system numbers them instead, which needs a counter per list and a rule for an imported code colliding with a
generated one — a piece of its own. This is the one rule here a real client's own habits could overturn.
