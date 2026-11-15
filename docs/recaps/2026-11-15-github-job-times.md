# GitHub's job times, recap, 2026-11-15

Written before the landing on `pre-merge`.

| GitHub's app gate | Before | Now |
| --- | --- | --- |
| The scripts tests | one job, cancelled at 25 minutes on 11-13 | three shards by each file's time |
| A job's limit | 25, then 40 minutes | three times its longest run, at least 15 |

## What happened

The limit was lifted to measure (`6d8fd757`). The scripts tests, 14 of 23 minutes, went into three shards: by size (`600f0eff`, 4.6, 5.5 and 7.1 minutes), then by each file's recorded time kept under its hash (`5af37fc3`, fixed in `0556d766`), in `main` at `6a0e2264`. The 11-14 run took 6.7 minutes whole, shards 6.1, 4.9, 3.9; the 11-15 run of `34dd2770`, shards 6.2, 3.9, 3.9, 11.5 minutes with its deploy.

Limits follow the rule (`8ad6d8cc`, `4a4a4877`, `e91eda26`): shards 28 (slowest 9.2), `ops` 19 (6.2), other app jobs 15 (none over 4.6).

The review (Opus) of `34dd2770..4a4a4877`, may merge:
- **Medium, fixed:** `ops` at 10 minutes was 1.6 times its longest run; now 19.
- **Lows 1 to 3, fixed:** the comment says 4.6, not 4.2; the "15-minute cap" no longer covers the scripts; each limit has a guard.
- **Low 4:** no change needed under a `--no-ff` landing.

## Still yours

- No look is open.
- The reread of the fix pass (Opus) said may merge: all four fixes hold, and two new findings are deferred, a Medium (item 483, the `ops` guards step's own 5-minute limit) and a Low (item 484).
- Act's `ops` job. <!-- FILL: its result, not yet known -->
- GitHub's run with the new limits. <!-- FILL: its verdict, not yet known -->
- The whole check on `pre-merge`. <!-- FILL: its verdict, not yet known -->
- Parked: `scripts/src/ridge-remake.test.ts` (282 seconds on GitHub) is split when someone waits on CI; items 458 to 461 in `docs/open-items.md`.

## Evidence

- Commits `8ad6d8cc` to `e91eda26` on `ci-workers`.
- The fix pass's `ops/test.sh` ended "all checks passed".
- `docs/products.md`: no row changed, the limits being internal.
