# The walk machinery, recap, 2026-11-06

## At a glance

[The plan](../plans/2026-11-06-walk-machinery.md) on `walk-machinery`: six faults in the machinery every picture run stands on, five fixed, one measured and deferred. No screen changed.

## What shipped

- **A lock of its own** for the full run, so two runs cannot overlap (item 108, `40da696`).
- **A verdict that names what moved**, what is new and what was named but moved nothing, read from the compare lines, not echoed from its argument (item 88, `5921174`).
- **Each comparison stamped** with its elapsed time and the Mac's load (item 109, `a1b5c7f`).
- **Bases written per walk**, on each walk's own reads, so a stalled walk no longer discards the rest; it cost a 27-minute run's 156 pictures (item 110, `c088487`).
- **The loader wait inside `shot()`**, the one picture-taker, so no spec can forget it (item 91, `c646396`).

## Rejected and what remains

- **Piece-2's six-minute stack was measured and not built** (item 111): running its tests at once raises the load the pictures' steadiness rests on.
- **New, deferred:** 112, 113, 114 (test flakiness in packages this piece does not touch); 115, 116 from the review, both unreachable today.

## What the piece taught

- **The review earned its place** (`5f0985f`). A second model, reading only, found the new wait could never pass on one walk: that walk freezes the browser's clock, a frozen clock leaves the loader mounted, so an assertion on element count was unsatisfiable where one on pixels always passed. The run would have found it at 15 to 30 minutes of the human's machine. The builder added one screen the review had missed.
- **The first run was refused by the project check, correctly** (`4d902831`): a test in another package asserts the source text of the function changed here, which a gate scoped to the touched packages cannot see. Rule: grep every package's tests for a shared file's name before changing it.
- **The pass was "nothing moved"**, the reverse of a UI piece, and it held on the first run after the fix.

## Evidence

- The full run: `20261106-1541-walk-machinery-full-run.log`, green in 14m48s: run 1 wrote the bases (asked none; found moved none, new none, named but not moved none, asked but in no walk none), run 2 read every count 0. Twelve walks, 708 pictures, every compare line 0 moved.
- First attempt, refused: `20261106-1409-walk-machinery-full-run.log`.
