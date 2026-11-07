# Editing a product on its page, recap, 2026-11-07

## What the office can now do

Open a product from the list and correct its name, unit, price, stock or note there. Whoever may take and edit orders sees Save. If someone else saved first, the page says so, shows what they saved and keeps what was typed. The code is not editable.

The route is the customer's, generalised over the list kind, not copied.

## The screens

Yes on all four, answered 2026-11-07: 12 and 13 moved (boxes now, and 13 draws an empty note card); 16 (a price saved) and 17 (someone saved first) are new.

## Decided, rejected, deferred

- **Stock is a switch, not a number:** the field only says whether stock is kept. The price is the one number.
- **Rejected: the order form's number-box props.** They silently rounded a pasted `95000.5` and dropped the minus of `-5`. The box now clamps nothing, and the shared `priceSchema` refuses both on submit with one word.
- **Review, Medium, fixed:** a guard test in `ui/src/Access.test.tsx` stopped pinning when the page's call was renamed. The customer page's identical hole was fixed in the same two lines (`de7d2389`). Those two lines were not seen red.
- **Deferred:** items 126 and 127 in `docs/open-items.md`. Item 118 stays open for the customer form.

## Still the human's

Whether Save needs a products right of its own; it rests on the order-editing right, the weaker decision.

## Evidence

- Commits `cf216840` (page), `4983ee52` (routes), `de7d2389` (review fix), `8a7f13b1` (merge of `main`, two documentation files, no code).
- **Step 5 closed without a single whole `pnpm check` green, deliberately.** Every step was green on this code, by package. Two whole-check attempts went red in `visual`, on different cases outside this piece, neither repeating. Logs: `20261107-1539-edit-product-step5-check.log`, `20261107-1546-edit-product-step5-rerun-tests.log`, `20261107-1610-edit-product-step5-check-single.log`.
- **The picture run was green at 17:06.** Screens 12 and 13 moved, 16 and 17 were written new, nothing was named but unmoved or asked for yet in no walk, and run 2's every count was 0. It refused once first, correctly, as `main` had moved. Log `20261107-1648-edit-product-full-run.log`; bases `dae59e0e`.
- `docs/products.md`: the Customers and Products row now names the product's editing.
