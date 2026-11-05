# The customer's page in the old app's cards, recap, 2026-11-05

## At a glance

[The plan](../plans/2026-11-05-customer-cards.md), steps 1 to 6 on `wip-customer-cards`: a customer opens from the list into a page of cards. Read only; no server work.

| | Before | After |
| --- | --- | --- |
| Customer, PC | no page: a list and an Excel import | two columns, 7 to 5: code and name, phone, address left; note right |
| Customer without a note | no page | one column at the full width |
| List | plain name | the name opens the page |

## What shipped

- **A built page, not a moved one.** Planning found the premise wrong: there was no customer page to re-lay (open item 98). The page sits on the person's frame, `ui/src/DetailCards.tsx` (`331ccf2`), reading `GET /api/customers` and picking its id.
- The frame's `side` is optional, `main` taking the full 12 without it: open item 90, closed (`a71e6a1`).
- Screens 10 (a note) and 11 (none) appended to the lists walk (`a046be9`).

## Rejected and what remains the human's

- **Editing a customer is not here:** it wants a write route, so it is its own slice after products and orders match.
- **The review's one High** (`9375ffd`): the new walk screens opened an address built from the data set's ids, but on the seeded stack the BFF mints each id, so all 12 full-stack cases would have gone red. The fix reaches the page by clicking the customer's name, as the orders walk does (`479f7dd`). A walk that builds an address from fake-data ids needs a stack check.
- Deferred Lows: item 99 (a `side` passed but empty still draws a blank), item 100 (the walk picks a noted customer by `'note' in extra`, the page draws on non-empty text).
- **Next, products** is a new page too, with its own columns (unit, price, stocked); only orders has a page already.

## Evidence

- The human's look, yes 11-05 17:52, both screens of "Customers and products from Excel": 10 and 11.
- The gate after the fix: `logs/customer-cards-fix-check3-20261105-1744.log`, `== exit 0`.
- The full run: <!-- FILL: result and minutes of the full run, log name -->
