# The product's page in the old app's cards

## At a glance

The office opens a product from the list and reads what the old app shows: code and name, the unit and the price,
whether its stock is kept, and the note — in the legacy's two columns of cards. **The new app has no product page
either:** products are a list and an Excel import (`ui/src/ClientApp.tsx#L371-L377`), so this milestone builds one,
as the customer's was built, on the same frame (`ui/src/DetailCards.tsx`) and the same 7/5, with its own columns.

No server work: `GET /api/products` answers every product whole — unit, price and `stocked` typed, the note in
`extra` (`shared/src/lists.ts#L24-L33`, `bff/src/lists.ts#L95-L100`) — so the page reads that list and picks its id.
**Price:** $0 a month; every product read to show one, bounded by the import's 500 rows (`shared/src/import.ts#L7`).
*Trigger:* editing by hand, which wants a record read for its version.

## The slice

- **The page**, `/products/:id`, for whoever may see orders, as the list is (`bff/src/lists.ts#L96`). Above the
  columns: the name, the code and "Back to the products" (`ui/src/i18n/en.ts#L677`, the key is there), as
  `ui/src/CustomerPage.tsx#L27-L38` sets it. `main`: **Basic information** (code and name in a `FieldPair`),
  **Unit and price** (the price as the language writes a number, `ui/src/listSheet.ts#L56`), **Stock** (Yes or No,
  `#L57`). `side`: **Note**, drawn only when its text is non-empty.
- **The list opens it:** the name cell's `Anchor component={Link}` becomes both kinds', `/${kind}/${row.id}`
  (`ui/src/ListPage.tsx#L52-L55`; `row.id` is there already, `listSheet.ts#L51`). Nothing else of the list changes.
- **Item 99** (`docs/open-items.md#L657`), its trigger "the next detail page": a falsy `side` counts as absent,
  two lines at `ui/src/DetailCards.tsx#L12-L13`. **Item 100** (`#L661`): the walk and the words test pick their
  noted record by non-empty text, the page's own rule, in place of `'note' in extra` and of an array index
  (`walk/specs/lists.spec.ts#L18-L19`, `visual/src/walks.ts#L183-L184`, `words.test.tsx#L224-L225`). Both close
  with this merge.
- Read only: no add, no edit, no delete. `bff/`, `shared/` and `c-storage/` are untouched.

Decided here, not asked:

- **The legacy's cards with no data here are out** — description, specs, classification, barcode, set composition,
  purchase-order names, the inventory cards, the danger zone. The product holds six fields and the page draws those,
  the record left whole and the note alone on the right, as the customer's. *Rejected:* a stock chip by the name.
- **Read only.** *Rejected:* the legacy's edit in place; it wants a write route and the code's uniqueness again, so
  it is its own slice after the three pages match.

## The case table

| # | The case | Held by |
| --- | --- | --- |
| 1 | The product's name in the list opens that product's page | unit, `ui/src/ListPage.test.tsx`; red first |
| 2 | The page shows the code, name, unit, price, stock and note, each in its card, the price as the language writes a number and the stock as Yes or No | unit; red first |
| 3 | An unknown id says the product is not there, not an empty product | unit; red first |
| 4 | Whoever may not see orders gets the 403 page on a product's address, no list asked | unit, `Access.test.tsx#L24-L30`; red first |
| 5 | A product with no note is one column at the full width | unit, `DetailCards.test.tsx`, red first; the walk |
| 6 | A `side` of `null` or `false` draws no column (item 99) | unit; red first |
| 7 | From 992 two columns, 7 to 5; below one, details first; fields two a row from 768 | the walk |
| 8 | Every card is `DetailCard` (`grep -c withBorder ui/src/ProductPage.tsx` is 0); the titles read in both languages | the grep; unit |
| 9 | No server change: `git diff --stat main` names nothing under `bff/`, `shared/`, `c-storage/`; the report moves lists screens 6, 12 and 13 alone | the diff; `raw.txt` |

## What moves

"Customers and products from Excel" (`visual/src/walks.ts#L1174`): screen **6**, the product list, its name now a
link; two new screens **appended as 12 and 13** — the walk ends at 11 today (`walk/specs/lists.spec.ts#L191`) —
never inserted, or the eleven ids renumber and lose their yeses. 12 is a product with a note, 13 one without.
**3 screens, 18 pictures** (vi and en at 390, 768, 1280). The spec's "eleven screens" (`#L9`, both test names at
`#L202`) becomes thirteen, and each new screen needs its heading in `words.test.tsx#L220-L225`. The data set holds
both: `VT-001` has a note, `DV-001` none (`shared/src/demo.ts#L449-L467`).

**The named guard:** a walk screen never opens a record by a data-set id. On the stack the import mints each id
(`bff/src/lists.ts#L123`), so screens 12 and 13 click the list's name link, as `openCustomer` does
(`walk/specs/lists.spec.ts#L170-L175`). That mistake reddened all 12 full-stack cases in milestone 1, unseen by
every unit test.

**Beside it, lane B's orders page** writes the same `docs/products.md`, `docs/open-items.md`,
`ui/src/ClientApp.tsx`, `visual/src/walks.ts` and `words.test.tsx`, and may read `DetailCards.tsx`, where this
plan's only edit is those two lines, so the second lane to finish **takes `main` in as step 4's first act**, before
the gate, and keeps both sides. One whole check and one picture build run at a time on the Mac, behind the gate lock
in the repos' parent folder: the gate and the full run may wait on the sibling, and the lock is read before every
run and never broken.

## Steps

- [ ] **1. This plan.** 🤖 Opus, 9 minutes. Done when: committed, about 1,000 words, no local path.
- [x] **2. The page on the fake.** 🤖 Sonnet, about 30 minutes: `ui/src/ProductPage.tsx`, its route, the list's
  link for both kinds, the frame's falsy `side`, five words in both languages, the two walk screens, the two
  pickers. Done when: rows 1 to 6 each red once, then green; rows 8 and 9 green; ui at 100 %, lint, knip and tsc
  clean; `pnpm report` builds and, against `main`'s build, exactly screens 6, 12 and 13 differ.
  *Done 2026-11-06, 16 minutes, about 3 of them waiting on the gate lock.* Rows 1 to 6 each red once, then green
  (`ListPage.test.tsx`, `Access.test.tsx`); item 99 is lane B's, so the page passes `side` as `undefined` by a
  ternary and row 5 and 6 are proved through it, `DetailCards.tsx` untouched. Whole run per package green, ui 774
  tests at 100 %; tsc, eslint, prettier and knip clean. `pnpm report` 118 screens, 236 captures against `main`'s
  116, 232: screen 6 moved, 12 and 13 new, nothing else. Rows 8 and 9: 0 `withBorder`, no diff under `bff/`,
  `shared/`, `c-storage/`. The words test and the walk's pickers pick by non-empty text (item 100).
- [ ] **3. The look** (👤 1); the machine goes on.
- [ ] **4. The gate.** 🤖 Sonnet, about 15 minutes: `main` taken in first, then the whole `pnpm check` under the
  lock, `== exit 0`.
- [ ] **5. One review.** 🤖 Opus, about 8 minutes, not the build's model. Done when: each finding tagged here, and
  items 98, 99 and 100 marked done with their commits, as item 90 was (`docs/open-items.md#L619-L623`).
- [ ] **6. The full run** (👤 2): the one-off about 2 minutes, the run about 17. Done when: run 1 green, its
  `raw.txt` naming the three screens alone; run 2 every count 0; 18 bases committed.
- [ ] **7. The recap.** 🤖 Sonnet, 2 minutes. Done when: committed, under 400 words, the orders row true.

Total: about 64 machine minutes, about 85 all told — milestone 1's own cost.

## The human's points

👤 **1. The look, after step 2.** On the walks page, open "Customers and products from Excel", screen 12, a product
with a note, on PC: two columns as the old app has them — code and name, the unit and price, the stock on the left,
the note on the right. Then the same screen on phone: one column, details first. Then screen 13, a product with no
note: one full-width column. A yes holds; a no becomes a case, fixed before step 6.

👤 **2. The full run, step 6.** One command in your terminal, about 17 minutes, nothing else testing — it may wait
for the orders lane's run, one at a time on the Mac. Run 1 writes the three screens' bases; a second run is compared
byte for byte. Green starts the recap; a red names each moved screen, and the machine finds why before a base is
kept.
