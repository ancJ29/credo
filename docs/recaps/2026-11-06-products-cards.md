# The product's page in the old app's cards, recap, 2026-11-06

## At a glance

[The plan](../plans/2026-11-06-products-cards.md) on `wip-products-cards`: a product opens from the list into a page of cards. Read only; no server work.

| | Before | After |
| --- | --- | --- |
| Product, PC | no page: a list and an Excel import | two columns, 7 to 5: code, name, unit, price, stock left; note right |
| Product without a note | no page | one column at the full width |
| List | plain name | the name opens the page |

## What shipped

- **A built page, not a re-laid one** (open item 98, done): `ui/src/ProductPage.tsx`, route `/products/:id` (`02bbebc`). `GET /api/products` answers each product whole, so the page reads the list and picks its id. The price is the whole-list read, bounded by the import's 500 rows; the BFF throws rather than truncate silently. No new route, nothing under `bff/` or `shared/`.
- **Walk screens 12 (a note) and 13 (none) appended**, screen 6's name now a link; the pickers choose a noted record by non-empty text (item 100, done).

## The lane split

This milestone ran beside the orders page. Both plans claimed the same two lines of `ui/src/DetailCards.tsx` (item 99), so that item was left to the orders lane. This page passes `side` as `note ? <DetailCard/> : undefined`, a ternary, never `&&`, which yields `false` and draws a blank column. It touches the shared file not at all, and its no-note case works without the frame's fix.

## Rejected and what remains the human's

- **Editing a product is not here:** it wants a write route, its own slice once products and orders match.
- **Review** (Opus, `c29ef10`): may merge, no High, no Medium. Item 105 is new and deferred: the "has a note" rule is written out in six places, all agreeing today; the fix wants a new `./lists` export.

## Evidence

- The human's look, yes 00:34 ("yes, all ok"), build `walks/2026-11-06-002829-02bbebc64`: screens 12, 13 and 6.
- The gate: `products-step4-0032-check.log`, `== exit 0`; shared 154, bff 556, ui 774, visual 199, scripts 277.
- Pictures: 118 screens against `main`'s 116; exactly `lists-6-products` moved, `lists-12-product` and `lists-13-product-no-note` new.
- The full run: <!-- FILL: result and minutes of the full run, log name -->
