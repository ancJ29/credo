# Editing a product on its page

## At a glance

The office opens a product from the Products list and corrects its name, unit, price, stock or note there, instead of
going back to the old app. The page is the one built on 11-06 (`ui/src/ProductPage.tsx`), its values made editable.
This is the second of the three detail pages to become editable, after the customer page.

The cheapest safe path is that page, copied, because it merged into `main` today: the wire
(`shared/src/lists.ts#L38-L48`), the two routes with their one re-read and their 409
(`bff/src/lists.ts#L155-L203`), the forced-race test (`bff/src/lists.route.test.ts#L606-L695`), the page's three
notices (`ui/src/CustomerPage.tsx#L71-L99`), the fake's two calls (`ui/src/fake.ts#L807-L830`) and the walk's two
appended screens (`walk/specs/lists.spec.ts#L250-L266`). **Price:** no new infrastructure, $0 a month; 80 machine
minutes and one picture run of about 17. The page also stops reading every product to show one.

## The slice

- **The wire**, beside the customer's: `productDocSchema` (`{ product, version }`),
  `saveProductRequestSchema` (`{ version, name, unit, price, stocked, extra }`), and `productRoutes.one` beside
  `customerRoutes` (`shared/src/wire.ts#L45-L48`).
- **Two routes, products only**: `GET` and `PUT /api/products/:id`, by **generalising the customer's `readCustomer`,
  `mustRead` and `PUT` over the `ListKind` table already in that file (`bff/src/lists.ts#L26-L59`)**, which gains a
  save schema and an `apply` that builds the updated record from the body. *Rejected:* a second copy of the route and
  of the comment at its compare (`#L192-L195`) — that comment is the one home of what the recovery assumes, and a copy
  of it is the line that rots. *Price:* it moves the customer's proved path, so its ten cases are the regression gate,
  unchanged (row 7).
- **The compare holds harder here.** `updated` overwrites every field the body sent, so for a product only `id` and
  `code` come from the read — the two the comment names as immutable. Its wording widens to "a record's".
- **The page**: the same cards, their values in inputs, one Save, the three notices. The note card is drawn for
  whoever may edit, empty or not (`editable || note`), as the customer's is — so **screen 13 becomes two columns**.
- **The fake** gains `getProduct` and `saveProduct` with a version a product, and the `saveProduct:409` and `:503`
  cues.

## Decided here: the numbers

**The stock is not a number.** `shared/src/lists.ts#L31-L32` holds `stocked: z.boolean()` — whether stock is kept, not
a level — so it is a `Switch` (`ui/src/Settings.tsx#L214-L218`), with no number question at all. **The only number is
the price:** `priceSchema` (`#L23`), a whole number of đồng from 1 to 10¹².

**The check lives in both places; the rule lives once.** The route parses the body with `priceSchema`, so a crafted
body is a 400 and nothing is written — the authority, as the permission is. The form stops a bad value becoming a
call, and on submit `priceSchema.safeParse` decides, never a second rule of its own. The box is a `NumberInput` with
`allowDecimal={false} allowNegative={false} min={1} max={PRICE_MAX}`, the order form's props
(`ui/src/OrderPage.tsx#L173-L183`), described by the words already written for the import's price column
(`lists.write.price`, both languages). So: **no number** (letters pasted), the box yields nothing; **a negative**, the
minus cannot be typed and a pasted `-5` fails `min(1)`; **empty**, required, there is no "no price"; **decimals**, the
mark cannot be typed and a pasted `95000.5` fails `.int()`. Each shows one word and makes no call, and **none is
rounded** — a rounded price is money changed without the office asking. **The thousands mark stays**, from
`Intl.NumberFormat(i18n.language)`, so the box reads as today's text does and `95.000` is 95000, the rule the import's
help already states; *rejected:* plain digits, which change how money reads for nothing. The unit is `unitSchema`:
required, trimmed, at most 20, refused by both the same way.

## The case table

| # | The case | Held by |
| --- | --- | --- |
| 1 | A name, unit, price, stock and note saved over the version read are stored, and the answer carries the product and its new version | BFF route, `bff/src/lists.route.test.ts`; red first |
| 2 | A save over a version that moved writes nothing and answers 409 with the product as it is now | BFF route; red first |
| 3 | A save whose write landed and whose answer was lost counts as saved, not as a conflict | BFF route; red first |
| 4 | Whoever may see orders but not edit them cannot save: 403, and nothing written | BFF route; red first |
| 5 | A save carrying a code, an id or an unknown field is refused and writes nothing | BFF route; red first |
| 6 | A price that is not whole and above zero, or an empty or over-long unit, is refused: 400, nothing written | BFF route; red first |
| 7 | The customer's own ten cases pass unchanged against the generalised route | BFF route, its tests as they stand |
| 8 | A non-number, a negative, a decimal or an empty price is refused on the page and makes no call; a whole one saves as whole đồng | unit, `ui/src/ListPage.test.tsx`; red first |
| 9 | The stock switch saves `true` and `false`; whoever may not edit sees every value, no Save and no movable switch | unit, same file; red first |
| 10 | An emptied note removes its key from `extra`; a key the form never shows survives a save | unit, same file; red first |
| 11 | A note that would push `extra` past its 8 KB is refused on the page, and no call is made | unit, same file; red first |
| 12 | Someone else saving first shows the notice and its reload, and keeps what was typed | unit, same file; red first |
| 13 | The cards are still `DetailCard` (`grep -c withBorder ui/src/ProductPage.tsx` is 0); every new word reads in both languages | the grep; `visual/src/words.test.tsx` |

Every row is the machine's ([QA](../conventions/qa.md) rule 1); the human's 👤 points are the looks below.

## What moves

The lists walk holds **fifteen** screens. Screens **12** and **13** move — their values are boxes now, and 13 draws
an empty note card, so it is two columns where it was one — and two are **appended as 16 and 17**, never inserted, or
the fifteen ids renumber and lose the yeses already given. **4 screens, 24 pictures** (vi and en at 390, 768, 1280).
As the walks page will title them:

- **16, "A product saved: a new price typed and saved, a green notice"** — the price, since it is the one field this
  piece had to decide about; on the product with no note (`DV-001`, the delivery fee).
- **17, "Someone else saved the product first, what was typed kept"** — cued on the fake lane, and on the stack lane a
  genuine second save through the real API, by generalising `someoneSavesFirst` (`walk/specs/lists.spec.ts#L49-L64`)
  to a list rather than copying it.
- **12** retitled "…each to type in, with a Save", **13** "A product with no note: an empty note card to write one
  into", and 13's assertion flips from "no note heading" to a note box that is empty.

Each needs its scene in `visual/src/walks.ts`, its opening in the spec and its first heading in
`visual/src/words.test.tsx`; both pick the two products by the note rule, not by index, so nothing else moves. The
spec's header comment and test name read fifteen and become seventeen (17 × 2 × 3 = 102).

**Beside it:** item 118's trigger is this piece, so the product form gets the cap and the 400 a word of its own
(row 11); the item stays open for the customer form, which this piece must not touch. Items 34 and 105 are triggered
too and are **not** taken — 34 is the import's rows, 105 a shared export reaching three packages — since either spends
this slice's budget in a file it has no other reason to open. Both keep their triggers for line 64.3.

## What this piece does not do

No change to the product list page, none to the customer page, no new permission, no renumbering, and nothing of the
order page, which is milestone 3.

## Steps

- [ ] **1. This plan.** 🤖 Opus, 12 minutes. Done when: committed; `wc -w` read; `git grep -nE '/Users/|~/'` over it
  empty. **No prettier check is claimed:** `*.md` is in `.prettierignore`, so a green on this file inspects nothing.
- [x] **2. The form on invented data, the cheap end to end.** 🤖 Sonnet, 28 minutes: the two wire schemas and the
  route name, the fake's two calls, the page's form and three notices, the words in both dictionaries, the two new
  scenes and the spec's four. The look comes off this build, so a no costs no server work. Done when: rows 8 to 13
  each red once, then green; three packages' five gate steps green at 100 % —
  `pnpm --filter @credo/shared --filter @credo/ui --filter @credo/visual run typecheck && eslint . && prettier --check . && pnpm --filter @credo/shared --filter @credo/ui --filter @credo/visual run test && knip`;
  `pnpm fake` serves the page; `pnpm report` builds, and against `main`'s build exactly screens 12, 13, 16 and 17
  differ.
  *Done 2026-11-07 (21 minutes of work, gate log `20261107-1424-edit-product-step2-gate.log`, `== exit 0`):* typecheck
  of shared, ui, visual and, beyond the plan, walk; `eslint .`; `prettier --check .`; the three packages' tests at 100 %
  (shared 158, ui 803, visual 203); knip: all six steps ran and exited 0. Rows 8 to 12 each seen red by one named
  mutation of the page, then green; row 13 by the `withBorder` grep and the words test. **Departure from the plan:** the
  price box keeps `allowDecimal` and `allowNegative` and clamps nothing (`clampBehavior="none"`), because with the order
  form's props the box itself cut a pasted `95000.5` to 95000 and dropped the minus of `-5`, the rounding the plan
  forbids; the shared `priceSchema` now refuses both on submit, with one word. *Pictures:* `pnpm report` built from the
  committed tree `cf216840` (`walks/2026-11-07-142818-cf2168402`, 122 screens) against `main`'s `deb805aa` (120): screens
  12 and 13 differ, 16 and 17 are new, no other screen's version moved. Gate log first two runs red (a type error and
  four lint errors of this step's tests, then a branch-coverage gap in the page), fixed; the third is the green one.
- [ ] **3. The look** (👤 1, 👤 2); the machine goes straight on to step 4 and does not wait for it.
- [x] **4. The routes against the real c-storage.** 🤖 Sonnet, 22 minutes: the `ListKind` generalisation and the two
  routes; nothing of the page changes, since step 2 bound it to the wire. Done when: rows 1 to 6 each red once, then
  green, row 7 green untouched, and `bff`'s five gate steps at 100 % —
  `GOPROXY=off GOFLAGS=-mod=mod pnpm --filter @credo/bff run typecheck && eslint . && prettier --check . && GOPROXY=off GOFLAGS=-mod=mod pnpm --filter @credo/bff run test && knip`.
  The stack lane's screen 17 can only run after this.
  *Done 2026-11-07 (about 8 minutes of work, gate log `20261107-1442-edit-product-step4-gate.log`, `== exit 0`; the tick
  and its code are in the same commit):* `ListKind` gained `one`, `save` and `apply`; `readCustomer`, `mustRead`, `idOf`
  and the PUT now sit inside `registerList` once, for both kinds, with the one compare comment widened to "a record's".
  Rows 1 to 6 (eleven cases) each seen red once, all 404 before the route existed, then green; row 7: the customer's ten
  cases untouched in the file and green. Gate: bff typecheck, `eslint .`, `prettier --check .`, tests (578, 100 % all
  four counts) and `knip` all exit 0 (eslint and prettier ran from `bff/`, so over that package; knip over the repo
  root, as the root script runs it). **Beyond the plan:** `bff/src/operator.route.test.ts` prints the route tree and
  gained the line `/api/products/:id (GET, HEAD, PUT)`. The 409 is the one place the answer's shape was touched: `current`
  is the kind's doc, as before for the customer. Not run: the walks, the page's gate, `pnpm check` (step 5).
- [x] **5. The gates.** 🤖 Sonnet, 10 minutes: `main` taken in, then the whole `pnpm check` once, in the background
  under the shared test lock, `== exit 0`. **The one place the whole gate runs:** `walk/` and `visual/` typecheck
  against this piece's changes in `ui/` and `shared/`, so no package's gate can clear it.
  *Done 2026-11-07 (about 15 minutes with the rerun; `main` had not moved, both at `deb805aa`, so nothing came in):* the
  five steps run one after another so none hides behind another's failure. Log `20261107-1539-edit-product-step5-check.log`
  (`== exit 1`): typecheck 0 (11s), eslint 0 (22s), prettier 0 (6s), knip 0 (1s), tests 1 after 387s - one case in
  `visual`, `admin-staff:staff-16-field-refused`, "the scene did not end in 30000 ms", in a walk this piece never
  touched, while the load stood at 9; the same `pnpm -r` run then stopped `scripts`. Rerun per package, one at a
  time, log `20261107-1546-edit-product-step5-rerun-tests.log` (`== exit 0`): shared 158, bff 578, ui 803 (all
  at 100 %), scripts 287, visual 203 passed. The first red is a 30 s timeout in an untouched file, not an assertion;
  one red seen once, so read as load, not proved by a second identical failure.
- [ ] **6. One review.** 🤖 Opus, 6 minutes, not the build's model, with the case table. Done when: each finding
  tagged `[FIXED]`, `[REJECTED]` or `[DEFERRED]` here.
- [ ] **7. The picture run** (👤 3): one command in the human's terminal, about 17 minutes —
  `bash walk/run.sh admin-lists --moved lists-12-product,lists-13-product-no-note,lists-16-product-saved,lists-17-product-conflict --write`.
  Done when: run 1 green, its `raw.txt` naming those four screens alone; run 2 every count 0; 24 bases committed.
- [ ] **8. The recap.** 🤖 Sonnet, 2 minutes. Done when: committed, under 400 words, the products row true.

80 machine minutes. Opens nothing; closes nothing — item 118 loses its product half and stays open for the customer's.

## The human's points

👤 **1. The look, after step 2.** On the walks page, open "Customers and products from Excel". Screen 12, a product
with a note: the same cards as yesterday, but name, unit, price and stock each in a box you can change, with a Save
under them; the price keeps its thousands mark and refuses anything but whole đồng. Screen 13, a product with no note:
an empty note card to write one into, so the page is two columns where it was one. Screen 16, a new price saved: a
green notice. Screen 17: someone else saved first — an orange notice, a button to see what they saved, and what you
typed still in the boxes. A yes holds; a no becomes a case, fixed before step 7.

👤 **2. Who may correct a product, at the same look.** Save appears for anyone who may take and edit orders — the
office's order-takers — the same right that gates correcting a customer, so nothing new has to be turned on.
**Recommendation: yes, keep it there.** This is the weaker of the piece's two decisions and is named as such: a price
is not a phone number, and a client may well want it behind a right of its own. A no does not
reopen this piece — it becomes its own milestone, a products right in the catalogue, a switch in the staff setup and a
line on every person's page.

👤 **3. The picture run, step 7.** One command in your terminal, about 17 minutes, nothing else testing on the Mac:
the four screens' base pictures written, then a second run compared byte for byte. Green starts the recap. A red names
each moved screen and its raw count, and the machine finds why before any base is kept.
