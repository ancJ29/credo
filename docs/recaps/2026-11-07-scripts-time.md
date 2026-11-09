# The scripts package's minutes, recap, 2026-11-07

## What shipped

One file, `scripts/src/demo/apply.test.ts`, set the `scripts` package's wall time: 199.19 s of 199.98 s on a quiet Mac. It is now ten files, one per `describe` block, plus a shared helper `apply-support.ts`. No assertion, name or product line changed.

## Before and after

| `scripts` test step | Seconds | Taken |
| --- | --- | --- |
| Before | 199.98 | 11-06, quiet machine; 281 tests, 22 files |
| After | 120.60 and 120.26 | 11-07, two runs; load 4.45 and 5.82 at start, 14.85 and 13.95 at peak; 305 tests, 32 files |

About 80 s off the local step. That is a floor: `main` added `claim.ts`, `claim.test.ts` and nine tests meanwhile (287 became 305), and the after runs were loaded where the before was quiet. Both push the after number up.

**GitHub's runner is not claimed** (there the file was 402.48 s of 407.45 s). The split trades CPU for wall time (the eight largest shards sum to 335 s against 199 s in one process), so the saving there depends on the workers vitest gets, and is not the local 80 s.

## Unchanged meaning, proved

By count, name and text, not coverage, which would stay 100 % even if assertions were lost: 48 tests on both sides; the ten blocks byte-identical to `main`'s, 1290 lines each side. The helper is excluded from coverage in one line, as the old test file already was.

## Rejected

Trimming test setup: the split left nothing to trim, and a trim can weaken a test.

## What remains

- Step 4's CI half is held on a push; the piece merges without it.
- `src/walk-run.test.ts` is now the floor, 119.4 s summed, as long as the package. The plan's table read an aborted runner line and missed it; item 128, deliberately not this piece.
- Item 129: the helper's module-level handle breaks on a second `useCStorage()` in one file.

## Evidence

- Logs: `20261107-1414-scripts-time-step2-gate-rerun.log`, `20261107-scripts-time-step4b.log`, `20261107-scripts-time-step4c.log`.
- `docs/products.md`: no row changes; an internal test layout adds no product.
