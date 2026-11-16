# The activity log on ridge, recap, 2026-11-13

Written before the landing; the ridge lines were filled once they ran, on 2026-11-13.

| A change made through ridge's address | Before | Once pushed and released |
| --- | --- | --- |
| Entry in the activity log | none | written on the box, found by `ops/check.sh` |

## What happened

The service was never shipped. The template lets the back end reach the log's writing port, which binds the box's private address while the reading one stays on loopback. The release ships the log after the store's half is done, so it cannot stop the store. The deploy hands the function the log's address and key, CI gates the service, and the check reads the log's unit, memory and the entry a new customer left.

A second model reviewed the template and steps 3 to 7 (two Mediums, seven Lows). The fix pass fixed the Mediums and Lows 1 to 3; Lows 4 to 7 are items 390, 391, 410 and 411; item 389 is the step 6 stand-in gap.

## Not built

The log's file does not yet join the continuous copy (plan step 12).

## On ridge

- Your acts in order: one push of the whole piece (with the front door's keys; its deploy ends red once, at `app.sh`'s refusal, since ridge's stack names no distribution yet, the function left as it was), the stack run, a rerun of the deploy job. The deploy ended red once, there; the stack's guard refused the first plan for one rule CloudFormation calls conditionally replaced, so it was taken by name, and the run completed with no rollback; the rerun was green.
- The first entry read on ridge, green: the log is sound on the box, and the customer the check added was found in it.
- The box's memory reading: the store 16 MiB and the log 2 MiB, 267 MiB of the box's 412 left.

## Evidence

- Twelve commits to `db055edf`; the landing also takes in `pre-merge`'s records-disk fix.
- Every gate ran on this Mac.
- At `db055edf`: `ops/test.sh` ended 0; the scripts package's gate ended 0.
- The service's `make check` ended 0 at step 3; its Go has not changed since.
- `docs/products.md`: no row changes; nothing new for a partner or operator until ridge runs it.
