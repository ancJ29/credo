# Ridge taken down and brought back by one command each, recap, 2026-11-12

Written before the landing on `pre-merge`.

| To take ridge down and back | Before | Now |
| --- | --- | --- |
| Down | a one-off outside git, run once | `ops/destroy.sh ridge` |
| Back | about eight commands by hand | `ops/remake.sh ridge` |

## What happened

`ops/destroy.sh` switches the two workflows off, asks for the name `ridge` typed, deletes the box, its disk and the stack, and reads each back as gone. `ops/remake.sh` makes the stack, releases, ships the app, runs the check and switches the workflows on; a red stops it there, workflows off. Then `ops/operator.sh ridge` makes the operator. Runbook: "Ridge down and back" in `ops/README.md`. Twenty-seven cases run both on stand-ins for `aws` and `gh`.

A second model found one Medium: a terminal in another account could destroy a stack not this repository's; the destroy now refuses it before the name is asked. Its seven Lows were fixed; its reread left three Lows, items 369 to 371.

## What the rehearsal showed

The first two runs stopped before any change, on red CI runs. Cause one: `sed -i ''` in the ops guards, which the runner's GNU sed misreads; fixed with the form both read and a guard against the BSD form. Cause two: a stack test's front port was picked free and bound later, with no error handler; the port is now held from the pick and the listener rejects. `act` then ran green. The second red was a ui test counting a load before it started; its fix waits for the count (on this branch, not yet in `main`), and the failed job, rerun without it, passed. The diagnoses and the review carry the rest.

The third run changed ridge. Destroy took about 5.5 minutes, remake about 7.5, the operator 13 seconds; each ended 0. The destroy read each resource back as gone and ended "ridge is destroyed, ci.yml and seed.yml are off". The remake's five steps each ended 0, both workflows read back active, and it closed "ridge is remade from main and checked. It is empty". The operator's link was shown on the terminal only; no key reached its log.

## What was rejected

Nothing; the weekly cycle is only an idea, and the scripts stand without it.

## Still yours

- Your read of the two verdicts, the destroy's and the remake's. <!-- FILL: your answer, not yet known -->
- Opening the operator's link for the first passkey. <!-- FILL: whether the passkey was made, not yet known -->
- Items 369 to 371: after a failed destroy, the stop line can call a workflow off that is still on, can send you to the remake on a half-deleted stack, and misses the disk a rerun leaves.

## Evidence

- Steps `ec867872`, `f17b60f4`, `d6e2811b`, `047b6830`; fix pass `a7019ad5`; fixes after the first landing `f14253cf`, `5c4360a5`, `29024472`.
- `ops/test.sh` and ShellCheck over `ops/*.sh` ended green per step, after the fix pass and after taking `pre-merge` in.
- The stand-in cases made no AWS call; the rehearsal's third run is the first real one.
- `docs/products.md`: a row for the two commands; the client-delete row now says ridge.
