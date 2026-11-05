# The order's page on the cards, recap, 2026-11-06

## At a glance

[The plan](../plans/2026-11-06-orders-cards.md), steps 1 to 4 on `wip-orders-cards`: the order's page reads in two columns of cards, as the person's and the customer's pages do. A re-lay, not a build: orders were the only detail page that already existed.

| | Before | After |
| --- | --- | --- |
| Draft, PC | one stack of panels | day, customer, lines, save left; confirm and cancel right |
| Confirmed or cancelled, PC | one stack | facts and lines left; delivery request and its steps right |
| New order | one stack | one column at the full width |

## What shipped

- **The legacy order page has no two-column layout to copy.** It is a 2,465-line tabbed page whose only split is 6/6 inside one tab. The campaign line said "onto the old app's PC layout"; for orders that original does not exist, and the authority is this app's own frame (`ui/src/DetailCards.tsx`).
- **The cut:** `main` is the day, the customer and the lines; `side` is the delivery request and its steps. The frame went inside `FormFields` and the read branch (`d96f810`), so the form's `dirty` state was not lifted out; one frame round the whole page would have been a rewrite priced like a build. `ui/src/OrderParts.tsx` is untouched: `DeliveryPage` and `MyDeliveryPage` draw its panels too.
- **Item 99, the first of its two fixes:** a falsy `side` counts as absent, the new order's `side={existing && <OrderActions/>}` being `null`. The second was not made, so the person's page, which passes an always-truthy `<Stack>`, still can draw a blank half: item 106. Item 99 is done on the half made.

## Rejected and what remains

- Deferred: item 106 (that residue) and item 107 (the column tests count every grid column in the document).
- **Moved but not added:** 8 screens of "An order, sent to a driver" (2, 3, 4, 7, 8, 9, 10, 11; 48 pictures), all already answered yes before. No walk screen was added or renumbered; `walk/specs/orders.spec.ts` is untouched. Screens 1, 5, 6 and 12 did not move.

## Evidence

- Review, Opus: may merge, no High or Medium (`0b36369`, corrected by `acc8b60`). It proved the re-lay changed no behaviour by a token multiset diff of both versions of the page (handlers, api calls, setters, guards, every `key={}` and `t('…')`): all 71 entries identical but the two reused title keys the plan authorises.
- The gate: `orders-cards-step4-check2-20261106-0035.log`, `== exit 0`; shared 154, bff 556, ui 777, visual 197, scripts 277.
- The look build `walks/2026-11-06-003322-d96f81021`; its hashes were identical to the earlier uncommitted build.
- The human's look: <!-- FILL: the human's answer on the eight re-laid screens -->
- The full run: <!-- FILL: result and minutes of the full run, log name -->
