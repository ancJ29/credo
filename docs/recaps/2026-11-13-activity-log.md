# The activity log on ridge, recap, 2026-11-13

Written before the landing on `pre-merge`. Built offline; nothing of it has run on ridge.

| A change made through ridge's address | Before | Once pushed and released |
| --- | --- | --- |
| Entry in the activity log | none | written on the box, found by `ops/check.sh` |

## What happened

The service was never shipped. The template lets the back end reach the log's writing port, which binds the box's private address while the reading one stays on loopback. The release ships the log after the store's half is done, so it cannot stop the store. The deploy hands the function the log's address and key, CI gates the service, and the check reads the log's unit, memory and the entry a new customer left.

A second model reviewed the template (three Mediums, two Lows, fixed in the plan's text and a comment) and then steps 3 to 7 (two Mediums, seven Lows). The fix pass fixed those Mediums and Lows 1 to 3; Lows 4 to 7 are items 390, 391, 410 and 411. Item 389 is the step 6 stand-in gap.

## Not built, not run

The log's file does not yet join the continuous copy (plan step 12). The release naming both commits, the first entry and the memory have not run anywhere.

## Still yours

- Your push and stack run. <!-- FILL: your push and stack run's verdict; do not write a result, a count, a time or a log name -->
- The first entry read on ridge. <!-- FILL: the check's reading of the first entry; do not write a result, a count, a time or a log name -->
- The box's memory reading. <!-- FILL: the memory reading's verdict; do not write a result, a count, a time or a log name -->

## Evidence

- Twelve commits on `pre-merge..HEAD` to `db055edf`; the landing also takes in `pre-merge`'s records-disk fix.
- Every gate is this Mac's; none ran on Linux (CI's Ubuntu).
- At `db055edf`: `ops/test.sh` ended 0; the scripts package's gate ended 0.
- The service's `make check` ended 0 at step 3; its Go has not changed since, its `Makefile` one comment line at step 7.
- `docs/products.md`: no row changes; nothing new for a partner or operator until ridge runs it.
