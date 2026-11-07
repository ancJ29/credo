# Editing an order on its page

## At a glance

**The order page is already editable, and this piece finishes it.** A draft's customer and lines
have been editable since 11-01: the form (`ui/src/OrderPage.tsx#L57-L259`), the save over the version
it was read at (`bff/src/orders.ts#L280-L300`), the conflict notice, the route tests and five walk
screens all exist. What is missing is the money. The form draws a saved draft at **today's** product
prices while Confirm sends the **saved** ones, so the page's total and the paperwork a driver carries
can differ — `docs/open-items.md` item 36, finding 5, parked with the trigger "the orders are next
touched". Three more parked findings sit on the same save path.

The cheapest safe path is therefore no new route and no new form: a saved draft is drawn at the
prices it was agreed at, a line whose price has moved since is marked, and a save reprices it on
purpose. **Price:** nothing new to run, $0 a month; about 95 machine minutes and one 17-minute
picture run; one screen re-asked and two added.

## The slice

- **The states, settled and held by tests, not changed.** A draft is editable; confirmed, fulfilled
  and cancelled are not. Both halves already refuse — the page draws the form only for a draft and an
  editor (`ui/src/OrderPage.tsx#L464`), and the route answers 409 unless the version matches **and**
  the state is `draft` (`#L290`). The piece asserts each of the three refused states (👤 2).
- **The page** (`ui/src/OrderPage.tsx`): a saved draft's lines drawn from `order.lines`' own prices,
  a line whose product's price has moved marked with what a save would make it, and the order's
  stored `extra` sent back in place of `{}` (item 36, finding 4; the fix it names, down to the
  expression).
- **The wire** (`shared/src/orders.ts`): a re-save schema beside `saveOrderRequestSchema`, its
  `version` a required `tagSchema`, so a malformed version is a 400 and not a false conflict; and the
  create route refusing a body that carries one (item 36 finding 8 and item 35's first bullet, which
  that finding asks to be done beside it).
- **The route** (`bff/src/orders.ts`): the lost-answer recovery it lacks — see the write shape below.
- **The data set** (`shared/src/demo.ts`): one more draft, taken yesterday, one of whose lines was
  priced before the product list changed. `OrderSpec` gains an optional saved price for a line
  (`#L569-L579`); every demo order is priced from `DEMO_PRODUCTS` at generation today (`#L762-L768`),
  so without this fixture no screen can show what is being fixed. Both lanes take it from the one
  data set — the fake build and the stack's generator (`scripts/src/generator.ts#L271`) — so the new
  screens need no cue and no lane of their own.

## The write shape an order takes

Today's architecture review found the write recovery in four shapes here, none shared. **An order's
save takes none of them whole, and the reason is in the code:** `bff/src/lists.ts#L192-L195` says the
customer route's re-read-and-compare holds "only while a customer's code and id never change", and
names "an order's status" as the case to re-think. An order has one.

So the save keeps the shape it has — an immediate 409 carrying the order as it is now, refusing on
the version **and** on the state (`bff/src/orders.ts#L290`), which none of the four does — and
borrows only the **lost-answer** half of `lists.ts#L189-L198`: a `putRecord` that throws is read
again once. The compare is over the whole record the route built, `state` and `request` included, so
another writer's confirm can never read as our save; two offices typing the same correction can, and
that is the record both asked for. *Rejected:* `reconciliations.ts#L37`, which claims a key nobody
else owns, where this write overwrites one; and `staff.ts#L265`'s bounded retry, right for raising a
number (already what `orders.ts#L162` does for the order's own) but here it would overwrite the save
it lost to.

## The case table

| # | The case | Held by |
| --- | --- | --- |
| 1 | A draft's save stores the customer, the lines and the order's own `extra`, and answers the order with its new version | BFF route, `bff/src/orders.route.test.ts`; red first |
| 2 | A save whose write landed and whose answer was lost counts as saved, the stored record compared whole | BFF route, `orders-records.route.test.ts`; red first |
| 3 | A save over a version that moved writes nothing and answers 409 with the order as it is now | BFF route; holds today, one assertion added |
| 4 | A save of a confirmed, a fulfilled and a cancelled order each writes nothing and answers 409 with the order as it is now | BFF route; red first |
| 5 | A `version` that is not a tag is refused 400, never read as a conflict | BFF route; red first |
| 6 | A first save carrying a `version` is refused 400 and no order is made | BFF route; red first |
| 7 | A save reprices every line at the products' prices as they are now, and its answer's total is the repriced one | BFF route; red first |
| 8 | A saved draft's lines are drawn at the prices they were saved at, never at the list's prices today | unit, `ui/src/OrdersPages.test.tsx`; red first |
| 9 | A line whose product's price has moved since is marked with what a save would make it; a line whose price has not moved is not marked | unit, same file; red first |
| 10 | A save keeps the `extra` keys the form never shows | unit, same file; red first |
| 11 | A confirmed, a fulfilled and a cancelled order draw no form, no Save and no marker | unit, same file; red first |
| 12 | Every new word reads in both languages, and the cards are still `DetailCard` (`grep -c withBorder ui/src/OrderPage.tsx` is 0) | `visual/src/words.test.tsx`; the grep |
| 13 | The orders walk draws fourteen screens, in both lanes and both languages, screens 13 and 14 without a cue | the walk, `walk/specs/orders.spec.ts` (👤 1) |

## What moves, and what must not

Two screens are **appended as 13 and 14**, never inserted, or the twelve ids renumber and lose their
yeses. Their titles, as the walks page will read them:

- **13. A draft taken before a price changed: its own prices, and the line that has moved.**
- **14. The draft saved again: the moved line repriced, and a new total.**

Of the twelve that exist, **only screen 1, the orders list, moves**, and only because the data set
gains a row. Screens 2 to 12 must come back byte-identical: each draws either today's draft, whose
saved prices equal the list's, so the new drawing moves no pixel, or a delivery request, untouched
here. **3 screens, 18 pictures** (vi and en at 390, 768 and 1280). Each new screen needs its scene in
`visual/src/walks.ts`, its id in that file's test, its opening in `walk/specs/orders.spec.ts` (whose
"twelve screens" becomes fourteen) and its first heading in `visual/src/words.test.tsx`. No other
walk opens an order (`grep -n "'/orders" visual/src/walks.ts` names this one alone).

The four writes beside the save — confirm, send, cancel and deliver — keep their shapes. Item 35's
false conflict on send, and item 36's findings 3, 6 and 7, stay parked with the triggers they carry.

## Steps

**A package's gate, named once.** No package here has a `check` script; only the root does
(`package.json`). So [QA](../conventions/qa.md) rule 6's five steps, scoped to `<pkg>`, are
`pnpm --filter <pkg> run typecheck`, `pnpm exec eslint .`, `pnpm exec prettier --check .`,
`pnpm --filter <pkg> run test` and `pnpm exec knip`; the last three have no per-package form here.

- [x] **1. This plan.** 🤖 Opus, about 15 minutes. Done when: committed, under 2,000 words, no local
      path and no name. Evidence: committed in `94dabef7`; 1,899 words by a count of word tokens (`wc -w`
      says 2,039 because it counts table pipes and rules); grep for a local path or a name finds none.
- [x] **2. The page and the data set, the cheap end to end.** 🤖 Sonnet, about 30 minutes. Done when:
      rows 8 to 12 each red once, then green; `@credo/shared`, `@credo/ui` and `@credo/visual` gated
      at 100 %; `pnpm fake` serves the new draft's page; `pnpm report` builds, and against `main`'s
      build exactly screens 1, 13 and 14 differ. Evidence: rows 8 to 11 red then green by single-file
      runs (row 11 is a guard, red by one mutation), row 12 by `visual`'s words and walks tests; the
      gate over `main` taken in, every step exit 0, in
      `logs/edit-order-step2-gate4-1107-1736.log` (an earlier run met one timeout in a file the
      change cannot reach, green alone and green on rerun, in `...gate3-1107-1733.log`); `pnpm fake`
      served the build holding the new words and the saved price, in one invocation, in
      `logs/edit-order-step2-fake.log`; the two `walks.json` of `pnpm report` against `main` differ
      in screen 1's version and in the two added screens 13 and 14, and in nothing else.
- [x] **3. The look** (👤 1, 👤 2, 👤 3). The machine goes straight on to step 4 and does not wait. Evidence: the human's yes on all three screens.
- [ ] **4. The wire and the route against the real c-storage.** 🤖 Sonnet, about 20 minutes: the
      re-save schema, the create's refusal, the lost-answer recovery. Nothing of the page changes —
      step 2 bound it to the wire, not to a route still moving. Done when: rows 1 to 7 each red once,
      then green (`bff/tests/` builds the real c-storage per file); `@credo/shared` and `@credo/bff`
      gated at 100 %. Evidence: `main` taken in clean (`docs/open-items.md` untouched, numbers in
      order); rows 2, 5 and 6 red on the old code by single-file runs, then green; rows 1, 4 and 7 and
      row 3's added assertion guard today's behaviour, each proved red by one mutation of the route
      (row 1 `extra` from the stored order, row 4 the `draft` check dropped, row 7 the lines kept
      unpriced, row 3 the version compare dropped) and reverted; the gate (shared and bff five steps
      by name, plus `pnpm -r run typecheck` over `ui`, `visual` and `walk`) every step exit 0 in
      `logs/20261107-1928-edit-order-step4-gate.log`; no `ui/` file changed.
- [ ] **5. The gates.** 🤖 Sonnet, about 15 minutes: `main` taken in, then the whole `pnpm check` once
      under the lock, `== exit 0`. **The one place the whole check runs:** `walk/` and `visual/`
      typecheck against this piece's changes in `ui/` and `shared/`, so no package's gate clears it.
- [ ] **6. One review.** 🤖 Opus, about 10 minutes, not the build's model. Done when: each finding
      tagged here `[FIXED]`, `[REJECTED]` or `[DEFERRED]` with its reason.
- [ ] **7. The picture run** (👤 4): one command, about 17 minutes. Done when: run 1 green, its
      `raw.txt` naming screens 1, 13 and 14 alone; run 2 every count 0; 18 pictures committed.
- [ ] **8. The recap.** 🤖 Sonnet, about 3 minutes. Done when: committed, under 400 words, the
      products row true.

About 93 machine minutes, which holds the 90 this piece was sized at. Closes item 36's findings 4, 5
and 8 and item 35's first bullet; opens nothing.

## The human's points

👤 **1. The look, after step 2.** On the walks page, open "An order, sent to a driver". Screen 13: a
draft taken yesterday, its lines at the prices they were agreed at, one of them marked because that
product's price has changed since, with what a save would make it. Screen 14: the same draft saved —
the marked line repriced and a new total. Screen 1, the orders list, has one more row. A yes holds; a
no becomes a case, fixed before step 7.

👤 **2. What an order lets the office change, and in which state. Recommendation: only a draft, and
only its customer and its lines — what the page already allows.** The reason is not caution: at
Confirm the delivery request takes its own copy of the customer, the lines and the total
(`bff/src/orders.ts#L329-L341`), and the driver's phone reads that copy, so correcting a confirmed
order could never change the paperwork being carried. A confirmed order is corrected by cancelling
and taking it again, which the page already offers. A no — a typo fixed on a confirmed order — costs
this piece nothing: a second, narrower save would be added and the request rewritten with it, its own
piece of about a day.

👤 **3. What a save should do to a price that has moved. Recommendation: the agreed price stands
until someone saves.** The draft shows what the customer was quoted, the moved line is marked, and
only a save takes today's price — so nothing is repriced behind the office's back, and confirming
without saving sends the agreed prices. A no ("always charge today's price") changes the route's
confirm and not the page: about 20 minutes and one more case, and screen 14's yes is re-asked.

👤 **4. The picture run, step 7.** One command in your terminal, about 17 minutes, nothing else
testing: the three screens' pictures written, then a second run compared byte for byte. Green starts
the recap. A red names each moved screen, and the machine finds why before any base is kept.
