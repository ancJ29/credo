# The customer's page in the old app's cards

## At a glance

The office opens a customer from the list and reads what the old app shows: code and name, phone, address and note,
in the legacy's two columns of cards. **The new app has no customer page to re-lay:** customers are a list and an
Excel import, nothing more (`ui/src/ListPage.tsx#L14`, `ui/src/ClientApp.tsx#L367-L379`), so this milestone builds the
page onto the frame the person's page made (`ui/src/DetailCards.tsx`), the same cards and the same 7/5.

The cheapest safe path costs no server work: `GET /api/customers` already answers every customer whole, `extra`'s
phone, address and note included (`shared/src/lists.ts#L9-L14`, `bff/src/lists.ts#L60-L62`), so the page reads that
list and picks its id — every customer read to show one, bounded by the import's 500 rows
(`shared/src/import.ts#L7`). No route, no field, no wire. **Price:** $0 a month; about 45 machine minutes and a
17-minute full run. *Trigger:* editing by hand, which wants a record read for its version.

## The slice

- **The page**, `/customers/:id`, for whoever may see orders, as the list is (`bff/src/lists.ts#L96`). Above the
  columns: the name, the code and "Back to the customers" (`ui/src/i18n/en.ts#L662`, the key is there), as the
  person's page sets it (`ui/src/PersonPage.tsx#L395`, `#L433`). `main`: **Basic information** (code and name in a
  `FieldPair`), **Contacts** (the phone), **Address** — the legacy's three left cards
  (`c-mngt/pages/customers/CustomerDetailPage.tsx#L397`, `#L417`, `#L497`). `side`: **Note**, its right card
  (`#L545`), drawn only when the customer has one.
- **The list opens it:** the name cell becomes an `Anchor component={Link}`, the staff list's exactly
  (`ui/src/StaffListPage.tsx#L294-L299`). Nothing else of the list changes.
- **The frame's side column becomes optional** — open item 90 (`docs/open-items.md#L619`), whose trigger is this
  milestone: `side` absent gives `main` the full 12 (`ui/src/DetailCards.tsx#L8-L15`). **The item closes with this
  merge**, a customer with no note being its first live case.
- Read only: no add, no edit, no delete. `bff/`, `shared/` and `c-storage/` are untouched.

Decided here:

- **No difference page is opened** (none exists for these screens, and no legacy capture of them is in the repo): the
  person's page is the shape's authority (`docs/recaps/2026-11-04-staff-cards.md`), the legacy file the cards'.
- **Read only.** *Rejected:* the legacy's edit in place; it wants a record read for its version, a write route and the
  code's uniqueness again — its own slice, after the three detail pages match.
- **No Active chip, no danger zone** (`CustomerDetailPage.tsx#L560-L585`): the new app switches off no customer and
  deletes none. *Rejected:* a phone accordion (`#L618`); the person's page set one column of cards.

## The case table

| # | The case | Held by |
| --- | --- | --- |
| 1 | The customer's name in the list opens that customer's page | unit, `ui/src/ListPage.test.tsx`; red first |
| 2 | The page shows the code, the name, the phone, the address and the note, each in its card | unit, `ListPage.test.tsx`; red first |
| 3 | An unknown id says the customer is not there, and does not look like an empty customer | unit, `ListPage.test.tsx`; red first |
| 4 | Whoever may not see orders gets the 403 page on a customer's address, and no list is asked | unit, the path added to `ui/src/Access.test.tsx#L24-L29`; red first |
| 5 | From 992 two columns, 7 to 5; below one column, details first; fields two a row from 768 | the walk |
| 6 | A customer with no note is one column at the full width, at every width | unit, `ui/src/DetailCards.test.tsx`, red first; the walk |
| 7 | Every card is `DetailCard` (`grep -c withBorder ui/src/CustomerPage.tsx` is 0); the titles read in both languages | the grep; unit, `ListPage.test.tsx` |
| 8 | No server change: `git diff --stat main` names nothing under `bff/`, `shared/`, `c-storage/`; no fourth screen moves | the diff; the run's `raw.txt` |

## What moves

"Customers and products from Excel" (`visual/src/walks.ts#L1164`): screen **1**, the list, its name now a link; two
new screens **appended as 10 and 11**, never inserted, or the nine ids renumber and lose their yeses — 10 a customer
with a note (two columns), 11 one without (a single column). **3 screens, 18 pictures** (vi and en at 390, 768,
1280). Only `walk/specs/lists.spec.ts#L99-L102` opens these pages; each new screen needs its first heading in
`visual/src/words.test.tsx#L212-L222`.

**Beside it:** line 58's milestones 2 and 3 also edit `ui/src/i18n/en.ts` and `vi.ts`, and milestone 2 draws the
frame's `side` on every person's page; the second to merge takes `main` at its gate step and keeps both sides.

## Steps

- [ ] **1. This plan.** 🤖 Opus, 8 minutes. Done when: committed, about 1,000 words or under, no local path.
- [ ] **2. The page on the fake.** 🤖 Sonnet, about 25 minutes: the frame's optional `side`,
  `ui/src/CustomerPage.tsx`, the list's link, the words, the two walk screens. Done when: rows 1 to 4 and 6 each red
  once, then green; row 7 green; row 8's diff; ui at 100 %, lint and knip clean; `pnpm report` builds, and against
  `main`'s build exactly the three screens' versions differ.
- [ ] **3. The look** (👤 1); the machine goes on.
- [ ] **4. The gate.** 🤖 Sonnet, about 11 minutes: `main` taken in; the whole `pnpm check` under the lock,
  `== exit 0`.
- [ ] **5. One review.** 🤖 Opus, about 5 minutes, not the build's model. Done when: each finding tagged here, and
  item 90 marked done with its commit.
- [ ] **6. The full run** (👤 2): the one-off about 2 minutes, the run about 17. Done when: run 1 green, its `raw.txt`
  naming the three screens alone; run 2 every count 0; 18 bases committed.
- [ ] **7. The recap.** 🤖 Sonnet, about 1 minute. Done when: committed, under 400 words, the products row true.

Total: about 69 minutes, 50 the machine's.

## The human's points

👤 **1. The look, after step 2.** On the walks page, open "Customers and products from Excel", screen 10, a customer
with a note, on PC: two columns of cards as the old app has them, the details left, the note right; then the same
screen on phone, one column, details first. Then screen 11, a customer with no note: one column at the full width, no
blank half. A yes holds; a no becomes a case, fixed before step 6.

👤 **2. The full run, step 6.** One command in your terminal, about 17 minutes, nothing else testing: the three
screens' bases written, then a byte compare of a second run. Green starts the recap; a red names each moved screen,
and the machine finds why before any base is kept.
