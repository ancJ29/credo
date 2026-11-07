# The gate's four reds, recap, 2026-11-07

## Why it mattered

`ci`'s `app` job failed on `pnpm check` for both of the last two pushes, so `deploy` was skipped by its `needs:` both times. Ridge kept serving the 11-05 app; three built, reviewed, pushed pages never reached the office or the partners.

## What was found: four reds, none a fault in the product

- **A bff coverage threshold failed while every test passed.** The only test reaching one branch of the join route (`bff/src/operator-auth.ts#L326`) fired two joins at once and hoped the interleaving fell one way; on the slower runner it fell the other.
- **The `ui` package's `SIGKILL` was that red's shadow.** `pnpm -r run test` stopped the sibling when bff failed; `ui` never finished and held no fault of its own.
- **A `scripts` stopwatch read 2611 ms against a 9000 ms assertion.** The stand-in lane locked the gate before it trapped TERM, so the lanes died to the first TERM.
- **A fourth was found only by running the whole check on the merge result:** two lint errors already sitting in `main` (`scripts/src/ridge.test.ts`, `no-base-to-string`). It came in with this morning's own merge, whose hand-assembled gate left out eslint, one of the check's five steps. The cause is the convention that lets a gate be assembled by hand, not the file.

## Rejected, and why

- **A coverage hint** in place of a test: the branch is real and reachable. A test now forces the loser's order every time.
- **Raising the stopwatch's bound alone.** The first fix made the test take a path it used to leave early, so the red moved one line down: a pid count, and a 16 000 ms bound, which was what separated "killed at 10 s" from "the trap's own sleep finished". Review caught it; the pid is now written before the barrier and the bound is 30 000 ms.

## The cap

`app`'s limit went from 15 to 25 minutes: the whole check took 5 min 31 s on this Mac, a runner is about 2.2 times slower, and the 11-05 run spent 12m8s before failing, with tests added since.

## What remains the human's

The push. Only a green `app` followed by a `deploy` on GitHub proves any of it; nothing local can.

## Evidence

- Commits: `e997bba1` (the diagnosis, `docs/memo/2026-11-07-deploy-gate-red.md`), `accba185` (the forced join order and the trap placed first), `7c44ec0a` (the pid and the bound), `4a15d012` (the cap), `2c0455cd` (the lint red).
- The whole check on the merge result: `main` with all four fixes, whole `pnpm check`, exit 0 in 5 min 2 s (`20261107-1035-edit-customer-step5-check-3.log`). Two earlier whole checks that morning went red on timeouts alone, in untouched files, at load 14 and 45; the third passed unchanged.
- `docs/products.md`: no row changes. Its rows say what a partner or an operator can do; "The gate" and "CI and ridge's deploy" stay true as written, and nothing here adds a product.
