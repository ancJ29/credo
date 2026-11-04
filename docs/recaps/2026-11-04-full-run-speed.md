# The walks' full run made shorter, recap, 2026-11-04

## At a glance

[The plan](../plans/2026-11-04-full-run-speed.md), all seven steps done on `full-run-speed`: the full run of
the eleven walks takes **16 minutes**, down from about 70. Tooling only; no screen moved.

| | Before | After |
| --- | --- | --- |
| Run 1 (writes the bases) | one walk at a time | three lanes at once, each on its own stacks |
| Run 2 | a second whole run | each base against run 1's picture, byte for byte, seconds |

## What shipped

- Run 2 is `walk/run.sh --bytes <run 1's folder>`, files only (`6d11c01`); a run 1 that moves no base commits nothing.
- Three lanes, each a background subshell with `[lane n]` lines; `--serial` keeps the old order (`edb80a8`).
- A signal or the gate lock stops every lane, TERM then KILL at 10 s, and the verdict still lands (`56bc475`).

## Rejected and what remains the human's

- Run 2 as a second browser run: it read 0 in all eight runs since 10-31, so the saving costs two samples.
- The review (Opus) found one Medium, the wait loop watching the prefixing `awk`; fixed in `f9e33a0` with its Low, reread clean.
- Open items 77 to 81 are deferred (a stuck group's silent wait, unprefixed job lines, a rare port clash, the
  stray filter and a rename, the lanes' balance: about 3 more minutes). Nothing is the human's to decide.

## Evidence

- The human's adoption run, 14:01:09 to 14:17:25, 16m16s, log `20261104-1401-full-run-speed-adoption.log`
  (1,250 lines, read whole): "== verdict: green: run 1 wrote the bases (moved: none), run 2 read every count 0".
- All eleven walks, each in one lane: lane 1 piece-2 alone 13m04s; lane 2 four walks 12m38s; lane 3 six walks 9m49s.
- 32 compares and 11 byte compares, all 0; no error or kill line; load peaked at 14.18 once, no failure.
