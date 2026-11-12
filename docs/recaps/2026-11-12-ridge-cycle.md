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

The first run, after the first push, stopped before any change on a red CI run, two causes. The ops guards used `sed -i ''`, which the runner's GNU sed reads as the script; the guard now uses the form both read, and a case fails on the BSD form. A stack test picked the front's port free and bound it later, with no error handler, so a taken port hung it 120 s; the port is now held from the pick and the listener rejects on error. A second model's read: may land, three Lows; one taken, one worded down, one filed as item 383.

`act` ran clean on the fixes and ended green. The second run still stopped on a red: one ui test counted a load at once, after a heading drawn before the load started, which `act` and the Mac had passed. Its fix waits for the count (on this branch, not yet in `main`); a second such count is item 388; the ui gate ended green. The failed GitHub job, rerun without that fix, passed, which fits a timing race.

The third run changed ridge. Destroy took about 5.5 minutes, remake about 7.5, the operator 13 seconds; each ended 0. The destroy read each resource back as gone and ended "ridge is destroyed, ci.yml and seed.yml are off". The remake's five steps each ended 0, both workflows read back active, and it closed "ridge is remade from main and checked. It is empty". The operator's link was shown on the terminal only; no key reached its log.

## What was rejected

Nothing; the weekly cycle is only an idea, and the scripts stand without it.

## Still yours

- Your read of the two verdicts, the destroy's and the remake's. <!-- FILL: your answer, not yet known -->
- Opening the operator's link for the first passkey. <!-- FILL: whether the passkey was made, not yet known -->
- Items 369 to 371: after a failed destroy, the stop line can call a workflow off that is still on, can send you to the remake on a half-deleted stack, and misses the disk a rerun leaves.

## Evidence

- Base `80b5c1f0`; steps `ec867872`, `f17b60f4`, `d6e2811b`, `047b6830`; fix pass `a7019ad5`.
- `ops/test.sh` and ShellCheck over `ops/*.sh` ended green per step, after the fix pass and after taking `pre-merge` in.
- The stand-in cases made no AWS call; the rehearsal's third run is the first real one.
- Fixes after the first landing: `f14253cf`, `5c4360a5` (ci), `29024472` (ui).
- `docs/products.md`: a row for the two commands; the client-delete row now says ridge.
