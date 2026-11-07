# Editing an order, and its prices made to agree, recap, 2026-11-07

## What the office can now do

An order's total on screen and the total the driver carries can no longer differ. A saved draft shows the prices it was agreed at; a price that moved since is marked with what a save would make it, never applied silently. This is the last of the three detail pages the office could not correct.

Editing an order already existed end to end since 11-01. What was missing was the money (`docs/open-items.md` item 36, finding 5).

## The screens

Yes on all three, 2026-11-07. One screen moved (the orders list, a row more); two are new.

## Decided, rejected, deferred

- **Corrected by the whole check:** the plan said both picture lanes take the fixture from one data set. The stack lane replays orders through the BFF, which prices from today's list, so it could never hold a stale-price draft. The generator now sets that product to its saved price through its own route for that one order, then restores it (item 140).
- **Refuted before built:** "raise the price at the end" was impossible, as the draft's saved price is below the list's.
- **Review, four Lows:** the walk's moved-price assertion was really the substring "Now"; it held, but would have reddened a later picture run where no gate could see it. It is now a regex over the whole message, and ran green in a real browser in this piece's run.
- **Also fixed:** the recovery's re-read keeps the write's failure; the price window closes in a `finally`.
- **Closed on the branch, with reasons:** item 140, item 35's first bullet, item 36's findings 4, 5 and 8.
- **Deferred:** item 141, the "Now X" advisory is the list as read when the editor mounted; no money divergence follows. Item 36's findings 3, 6 and 7 stay parked.

## Evidence

- Commits `c536f1cf`, `20ba3846`, `05bb852b`, `79a29d62`, `a7263006`. The whole `pnpm check` passed in one invocation: `20261107-2000-edit-order-step5-check2.log`.
- Proved by reading, not a picture: a draft's screen total and the driver's total cannot differ, as a cross-model read enumerated every order write in the BFF.
- Picture run green at 20:59, 17m07s; nothing named but unmoved, run 2 all 0: `20261107-2042-edit-order-full-run.log`.
- `docs/products.md`: the Orders row names the editing.
