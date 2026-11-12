# Ridge taken down and brought back by one command each, recap, 2026-11-12

Written before the landing on `pre-merge`.

| To take ridge down and back | Before | Now |
| --- | --- | --- |
| Down | a one-off outside git, run once | `ops/destroy.sh ridge` |
| Back | about eight commands by hand | `ops/remake.sh ridge` |

## What happened

`ops/destroy.sh` switches the two workflows off, asks for the name `ridge` typed, deletes the box, its disk and the stack, and reads each back as gone. `ops/remake.sh` makes the stack, releases, ships the app, runs the check and switches the workflows on; a red at any step stops it there, with the workflows off. After it, `ops/operator.sh ridge` makes the operator. The runbook is "Ridge down and back" in `ops/README.md`. Twenty-seven cases run both scripts on stand-ins for `aws` and `gh`.

A second model found one Medium: a terminal in another account could destroy a stack that is not this repository's. The destroy now refuses it before the name is asked. Its seven Lows were fixed. Its reread says it may land with named changes: three Lows, filed as items 369 to 371.

## What was rejected

Nothing; the weekly cycle is only an idea, and the scripts stand without it.

## Still yours

- Your rehearsal on ridge: destroy, remake, then `ops/operator.sh ridge`. <!-- FILL: the rehearsal's outcome, not yet known; write what each log ended on, after reading them whole -->
- Your read of the two verdicts, the destroy's and the remake's. <!-- FILL: your answer, not yet known -->
- Items 369 to 371: after a failed destroy, the stop line can call a workflow off that is still on, can send you to the remake on a half-deleted stack, and misses the disk a rerun leaves.

## Evidence

- Base `80b5c1f0`; steps `ec867872`, `f17b60f4`, `d6e2811b`, `047b6830`; fix pass `a7019ad5`.
- Each step's `ops/test.sh` ended green, and again after the fix pass, with ShellCheck over `ops/*.sh` at exit 0.
- After taking `pre-merge` in (production's order fix), ShellCheck and the whole `ops/test.sh` were run again on the merged tree; both ended green.
- No AWS call has been made by these scripts.
- `docs/products.md`: a row for the two commands; the client-delete row now says ridge.
