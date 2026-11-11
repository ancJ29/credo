# The order's page re-laid on the old app's cards

## At a glance

The office opens an order and reads it as the old app lays a record out: its facts in a column of
cards, what is to be done with it beside them. **The order is the only one of the three lists that
has a page already** (`ui/src/OrderPage.tsx`, open item 98), so this milestone **re-lays markup that
works onto the frame the person's and the customer's pages proved** (`ui/src/DetailCards.tsx`): its
four bordered blocks (`#L146`, `#L162`, `#L359`, `#L366`) become `DetailCard`s inside
`DetailColumns`, and the steps an order offers move to the right column. No route, no field, no word,
no new walk screen. The page, its 31 tests and its twelve-screen walk are all in place, and that is
where it costs less than its two siblings. **Price:** $0 a month, about 43 machine minutes, and 48
pictures already said yes to are redrawn.

## The slice

- **The draft's form**, `main`: the day and the customer (`#L146-L161`), the lines and the total
  (`#L162-L247`), the save under them. `side`: the steps, `OrderActions` (`#L257`) — confirm and
  cancel. A new order offers none, so its `side` is absent and `main` takes the full twelve.
- **An order read**, `main`: the day and the customer block (`#L359-L364`), then the lines in a card
  titled `orders.lines` as the form's is. `side`: the delivery request (`#L366-L385`), titled
  `orders.sentTitle`, and the steps the state allows.
- **A falsy `side` counts as absent** — open item 99 (`docs/open-items.md#L657`), whose trigger is
  the next detail page: `side === undefined` (`ui/src/DetailCards.tsx#L12-L13`) draws a blank 5/12
  for `null` or `false`, and `side={existing && <OrderActions/>}` is exactly that. **The item closes
  with this merge**, the new order its first live case, and the person's page's own blank half
  (`ui/src/PersonPage.tsx#L552`) goes with it.
- Left alone: every word, call and state (save, confirm, send again, cancel, the conflict, the
  refusals); the orders list; `bff/`, `shared/`, `services/c-storage/`; the walk and the mock; and the panels
  in `ui/src/OrderParts.tsx`, which draw their own bordered block with a level-3 title already and
  are shared with `ui/src/DeliveryPage.tsx` and `ui/src/MyDeliveryPage.tsx`, so converting them would
  move screens 6 and 12 for nothing.

Decided here:

- **The page's state stays put.** `FormFields` draws the frame itself, so `dirty` need not be lifted
  out to disable confirm. *Rejected:* one frame around the whole page, which lifts the form's state
  up — a rewrite priced like a build, in a step that re-lays.
- **The two branches read the same**, so the read view's lines gain the title the form's have and the
  request card its own where a dimmed line stood alone; both keys are in both languages already
  (`ui/src/i18n/en.ts#L706`, `#L740`). **No new word, no back link, no edit in place** — the last is
  its own slice once the three pages match.

## The case table

| # | The case | Held by |
| --- | --- | --- |
| 1 | A draft is two columns from 992: day, customer and lines left, the steps right | unit, `ui/src/OrdersPages.test.tsx`; red first |
| 2 | A new order, offering no step, is one column at the full width, no blank half | unit, `OrdersPages.test.tsx`; red first |
| 3 | A `side` of `null` or `false` draws one column, as an absent one does | unit, `ui/src/DetailCards.test.tsx`; red first |
| 4 | An order read puts facts and lines left, request and steps right, in every state | unit, `OrdersPages.test.tsx`; red first |
| 5 | The lines table's five columns do not scroll in the 7/12 column at 1280 | the walk, screens 3 and 11 |
| 6 | Every block is a `DetailCard`: `grep -c withBorder ui/src/OrderPage.tsx` is 0, from 4 | the grep |
| 7 | No behaviour moved: the orders suite unchanged; `git diff --stat main` names nothing under `bff/`, `shared/`, `services/c-storage/`, `walk/`, `visual/` | the suite; the diff |
| 8 | Eight screens move and no ninth: 1, 5, 6 and 12 keep their versions | `pnpm report` against `main`'s |

## What moves

"An order, sent to a driver" (`visual/src/walks.ts#L1325`): screens **2, 3, 4, 7, 8, 9, 10 and 11**,
every one that shows the order's page. **8 screens, 48 pictures** (vi and en at 390, 768, 1280),
**all already said yes to**: this milestone redraws approved pictures instead of adding new ones.
Untouched: 1 the list, 5 the requests, 6 a request, 12 the proof. The spec is not edited, so its rule
that a record is reached by clicking the list's link and never by a data-set id
(`walk/specs/orders.spec.ts#L194-L199`) holds by itself.

**Beside it:** lane A re-lays the products page at the same time. Three rules: **append, never
insert, renumber nothing** — lane A has the lists walk, this one the orders walk, neither touches the
other's spec; **`main` comes in before the gate**, step 4's first act, since both lanes write
`docs/products.md` and `docs/open-items.md` (this lane leaves `ui/src/ClientApp.tsx`, the third
meeting place, alone); and **the Mac runs one whole check and one picture build at a time**, so the
gate and the full run may wait on the sibling, read the lock each time, and never break it.

## Steps

- [ ] **1. This plan.** 🤖 Opus, 8 minutes. Done when: committed, about 1,000 words, no local path.
- [x] **2. The re-lay on the fake.** 🤖 Sonnet, about 18 minutes: `DetailCards`'s falsy `side`, then
  `ui/src/OrderPage.tsx`'s four blocks and its two frames. Done when: rows 1 to 4 each red once then
  green; rows 6 and 7; ui at 100 %, lint, knip and tsc clean; `pnpm report` builds, and against
  `main`'s build exactly the eight screens' versions differ.
  Evidence (2026-11-06): rows 1 to 4 each seen red first, then green (8 new tests: 2 in
  `DetailCards.test.tsx`, 6 in `OrdersPages.test.tsx`), the 31 existing orders tests green; row 6
  `grep -c withBorder` 4 to 0; ui 63 files, 777 tests, 100 % on all four, `tsc`, eslint, prettier and
  knip clean, `== exit 0`; `pnpm report` against a scratch build of `main`: 116 screens each, exactly
  `office-orders` screens 2, 3, 4, 7, 8, 9, 10, 11 differ (8 screens, 48 pictures), 1, 5, 6, 12 and
  every other walk identical.
- [x] **3. The look** (👤 1); the machine goes on.
  Evidence (2026-11-06): the human's yes at 00:58 on all eight re-laid screens, each pinned to the new
  version hash, 8 of 8 matched, on build `walks/2026-11-06-003322-d96f81021`.
- [x] **4. The gate.** 🤖 Sonnet, about 11 minutes: `main` taken in first, then the whole
  `pnpm check` under the lock, `== exit 0`.
  Evidence (2026-11-06): `main` taken in first: "Already up to date", still `f8162ac`. The whole
  `pnpm check` ended `== exit 0` (`logs/orders-cards-step4-check2-20261106-0035.log`): shared 154,
  bff 556, ui 777, visual 197, scripts 277 tests. The first run (`...-check-20261106-0029.log`) was
  red on two timeouts in files this piece never touched (`SignIns.test.tsx`,
  `StaffSetupPage.test.tsx`), a load stall: both passed alone, then the whole check passed. Look
  build from the committed tree: `walks/2026-11-06-003322-d96f81021`. Against a scratch build of
  `main`, `office-orders` screens 2, 3, 4, 7, 8, 9, 10, 11 moved (hash, `main` then new: 2
  `5bda319e2094` to `f95bf8224263`; 3 `980745a1ba08` to `ed30e4e97c80`; 4 `47611a2df466` to
  `20999ee71eb9`; 7 `b00cd312e71d` to `bed83638ef72`; 8 `95970495f383` to `d5a1eb0a8e27`; 9
  `fd1ab58fc205` to `170a38c3b364`; 10 `0a1a4c14d8dd` to `9ebb1c49ce19`; 11 `dec1f8c55116` to
  `bcdddcb21c27`); screens 1, 5, 6, 12 and every other walk unmoved. The hashes equal those of the
  step-2 build made from the uncommitted tree.
  Re-run after `main` moved (2026-11-06): the full run refused until `main` is merged in, so `main`
  (`314c5e1`, the products page) was taken in (`096be0a`; only `docs/products.md` and
  `docs/open-items.md` conflicted, both kept from each lane), then the whole `pnpm check` on the
  merged tree ended `== exit 0` (`logs/orders-cards-step4-merged-check-20261106-0930.log`): shared
  154, bff 556, ui 783, visual 199, scripts 277 tests.
- [x] **5. One review.** 🤖 Opus, about 5 minutes, not the build's model. Done when: each finding
  tagged here, and item 99 marked done with its commit.
  Evidence (2026-11-06): may merge, no High or Medium (`0b36369`, corrected by `acc8b60`); item 99
  marked done on the first of its two fixes, items 106 and 107 raised and deferred.
- [x] **6. The full run** (👤 2): the one-off about 2 minutes, the run about 17. Done when: run 1
  green, its `raw.txt` naming the eight screens alone; run 2 every count 0; 48 bases committed.
  Evidence (2026-11-06): `20261106-0938-orders-cards-full-run.log` green, 29m32s; run 1 29m25s, 35
  comparisons; run 2 5s, 12 byte comparisons, every count 0. Bases `826bc8c`. 26 pictures moved across
  seven screens, not 48 across eight: `orders-2-new` none (item 99's fix), the rest by pixels.
- [x] **7. The recap.** 🤖 Sonnet, about 1 minute. Done when: committed, under 400 words, the orders
  row true.

Total: about 62 minutes, 43 the machine's.

## The human's points

👤 **1. The look, after step 2.** On the walks page, open "An order, sent to a driver". Screen 3,
"Confirm: the driver and the day, today chosen", on PC: the day, the customer and the lines left, the
confirm and the cancel beside them. Then screen 11, "An order fulfilled: its request delivered":
facts and lines left, the delivery request right. Then screen 2, "A new order: a customer, two
products at their prices, the total": one column at the full width, no blank half. You approved these
pictures already; the one question is whether the new arrangement still reads right. A yes holds; a
no becomes a case, fixed before step 6.

👤 **2. The full run, step 6.** One command in your terminal, about 17 minutes, nothing else testing;
it may wait on the other lane, which shares the machine. It rewrites the bases of eight screens, 48
pictures, because their layout moved and nothing else did. Green starts the recap; a red names each
moved screen, and the machine finds why before any base is kept.
