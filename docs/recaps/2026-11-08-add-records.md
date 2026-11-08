# A clerk adds a customer and a product, recap, 2026-11-08

## What the office can now do

Whoever may edit orders sees an Add button on the Customers and Products lists, types the record on the detail page's own form with the code box open, and lands on the new record. Before, only the root's Excel import could add one, so a new customer who telephoned could not be taken on. This closes the one product gap the readiness page held.

One route per list (`bff/src/lists.ts`) uses the import's own row rule and write, so an added record is the one an import would make. The import stays root-only. A taken code is refused with a notice and what was typed is kept.

## The stock decision

A blank stock cell in an imported sheet reads as "yes, in stock", deliberately and in the reader's own comment (`ui/src/listSheet.ts#L73`, with `stocked` absent from `needed` at `#L47`). The new form first started the switch off. Both values were legal, so every check passed and no gate could have seen it. **The form was changed, not the import** (`ui/src/AddProductPage.tsx#L13-L16`): the import's rule is deliberate, documented and already in `main`, and flipping it would silently change every product in every sheet that leaves the column blank.

## Limits

- No browser here: the rendered pages are proved by tests that mount the app and by the drawn screens, not by a page load.
- The words test reads the same dictionary on both sides, so it guards key completeness only; a wrong Vietnamese string stays green.
- If a record is written but the read-back of its version fails, the clerk sees an error although the record exists, and a retry answers "that code is taken" (item 148).

Also filed, still open, all Low: 145 (the fake's imports set no version), 146 (a taken code reddens the box with no message), 147 (a customer name over 200 characters shows the generic error).

## Evidence

- Looks: yes on the four screens, 2026-11-07; and yes again on screen 20 with the stock switch on, 2026-11-08.
- Whole check: red once at load 7.97 in an untouched test (`20261107-233125-clerk-add-records-step7-whole-check.log`, now on item 56), green on rerun (`20261107-233422-clerk-add-records-step7-whole-check.log`).
- Picture runs green: `20261107-2343-add-records-picture-run.log` wrote the bases (`cee6a814`, 36 pictures, the six screens changed); `20261108-1143-add-records-picture-rerun.log` compared fake, stack and stack again, and the bases: 126 pictures each, nothing moved, new, unmatched or unreadable.
- `docs/products.md`: the Customers and Products row names the add.
