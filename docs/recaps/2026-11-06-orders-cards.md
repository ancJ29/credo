# The order's page on the cards, recap, 2026-11-06

## At a glance

[The plan](../plans/2026-11-06-orders-cards.md): the order's page reads in two columns of cards, like the other detail pages. A re-lay, not a build.

| | Before | After |
| --- | --- | --- |
| Order, PC | one stack | day, customer, lines left; delivery request and its steps right |
| New order | one stack | one column at the full width |

## What shipped

- **The legacy order page has no two-column layout to copy:** 2,465 lines, tabbed, its only split 6/6 inside one tab. The campaign said "the old app's PC layout"; for orders none exists, so the authority is this app's own frame (`ui/src/DetailCards.tsx`).
- **The cut:** `main` is the day, the customer and the lines; `side` is the delivery request and its steps. The frame went inside `FormFields` and the read branch (`d96f810`), so the form's `dirty` state stays put; one frame round the page would be a rewrite. `ui/src/OrderParts.tsx` stays: `DeliveryPage` and `MyDeliveryPage` draw its panels too.
- **Item 99, the first of its two fixes:** a falsy `side` counts as absent, as `side={existing && <OrderActions/>}` is `null` on a new order. The second was not made: the person's page passes an always-truthy `<Stack>` and can still draw a blank half (item 106). Item 99 is done on that half.

## Rejected and what remains

- Deferred: item 106 (that residue), item 107 (column tests count every grid column in the page).
- **Moved, not added:** 8 screens of "An order, sent to a driver" (2-4, 7-11; 48 pictures), all already yes. No walk screen added or renumbered; `walk/specs/orders.spec.ts` untouched; screens 1, 5, 6, 12 did not move.

## Evidence

- Review (Opus): may merge, no High or Medium. It proved no behaviour changed by a token multiset diff of both versions of the page (handlers, api calls, setters, guards, keys, `t('…')`): all 71 identical but the two reused title keys the plan authorises.
- Gate: `orders-cards-step4-check2-20261106-0035.log`, `== exit 0`: shared 154, bff 556, ui 777, visual 197, scripts 277.
- Look build `walks/2026-11-06-003322-d96f81021`, hashes identical to the uncommitted one.
- Look: <!-- FILL: the human's answer on the eight re-laid screens -->
- Full run: <!-- FILL: result and minutes of the full run, log name -->
