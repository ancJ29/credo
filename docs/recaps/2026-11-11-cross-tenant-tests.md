# The cross-company tests, recap, 2026-11-11

Written before the landing on `pre-merge`. <!-- FILL: the landing's sha and time -->

## What happened

An outside review asked for a test that deliberately tries to cross from one company to another. Such tests existed for sign-in, settings and the customer and product lists; none was found for orders, deliveries, staff or closed days. The store keeps no company apart: separation is only a prefix the back end builds into each key, so a bug there would let one company read or change another's records.

A new file, `bff/src/routes/cross-tenant.route.test.ts`, starts one store holding two companies. The second tries the first's records by id and gets a 404, its own lists show none of them, and a log of every write the store takes proves the attempt wrote nothing. It covers orders, deliveries and their photos, people (read, save, archive, password set), the drivers list, closed days, and the customer and product lists. No leak was found.

## What the next session would otherwise re-learn

- **The first draft missed cases.** One review found the photo case had no delivered request, the close case no driver with an open day, and the lists no one-service case. The second commit fixed them.
- **Not every handler is covered.** Open item 227 lists what has no second-company case, because each handler builds its key from the tenant at its own call site, so a fault in one stays uncaught where no case reaches it.
- **The architecture row is now exact.** "No concept of a tenant in c-storage" in `docs/architecture.md` names the files that prove separation.

## Still yours

- No look of this piece is open.
- Nothing: the review's last read of the fixed lines says it may land, all five findings fixed at `455b9310`.

## Evidence

- Base `a590f8f1`. Tests `18eaa40b`; merge of `pre-merge` into the branch `65111e87`; fix pass `455b9310`.
- Gate of the tests, `logs/2026-11-11-150911-gate-bff.log`: five steps exit 0, 645 tests passed, coverage 100 % on all four counts, `== exit 0`.
- Gate of the fix pass, `logs/2026-11-11-152241-gate-bff.log`: the same, 649 tests passed.
- Each test seen failing on a broken key: the card alone, no log read.
- The citation test, run alone in this worktree: 1 file, 20 tests passed.
- `docs/products.md` changes no row: tests add nothing a partner or an operator can do.
