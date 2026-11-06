# The walk machinery's six faults

## At a glance

Every piece's picture run stands on `ops/full-run.sh` and `walk/run.sh`. Six faults found there on
2026-11-05 and 2026-11-06 cost Mac minutes on every run and make two of its own reports over-state
what happened. Five are in those two files, so they are one piece.

| The fault | Step | Item |
| --- | --- | --- |
| Two full runs can overlap: the lock is refused on, never taken | 2 | 108 |
| The verdict calls "moved" what was only asked about | 3 | 88 |
| Nothing inside the compare step says the time or the load | 4 | 109 |
| One stalled walk blocks the bases of every other walk | 5 | 110 |
| A picture is taken while a button is still loading | 6 | 91 |
| Piece-2's six minutes: measured, and deferred | — | 111 |

The cheapest safe path is what exists: the merged precedent's one-line wait (`926c1b2`), the
load-and-elapsed line the passes already print (`walk/run.sh#L351`), the `compare` lines, and the
stand-in harnesses that run both scripts with no browser. **Price:** about 75 machine minutes and
one run of the human's Mac, 15 to 30.

## The slice

The twelve walks end green on this branch, every count 0, no base picture moved. Decided:

- **A lock of the full run's own**, `.full-run-lock`: it must go on refusing on the gate lock and
  never take it (`ops/full-run.sh#L22`, `#L28`; `walk/run.sh#L250`). Today's guard is accidental —
  `walk/run.sh#L296-L309` refuses only while a credo process lives, and the compare step starts none
  (`#L495-L526`, 13m50s this morning).
- **The verdict reads the compare lines, not its own `--moved`** (`ops/full-run.sh#L205`), parting
  moved, new and named-but-unmoved. One run named three where one moved and two were new
  (`20261106-0054-products-cards-full-run.log#L1480`, run-1 text `#L1236-L1248`); the next named
  eight, one of which moved nothing (`…-0938-…-run-1.out#L1292`).
- **Each walk's bases written on its own reads** (`walk/run.sh#L529-L548`; all-or-nothing at
  `#L532-L533`, `reds` one list at `#L382`, `#L503`, `#L509`, `#L525`). A walk red of its own, or in
  a lane that ended red (`#L486`), is left untouched; the exit stands, and `ops/full-run.sh#L173`
  still commits nothing on a red run 1. The old way discarded three green walks' 156 pictures over
  one stalled pass, 27m24s (`20261105-1934-walk-piece-1-piece-2-operator-passkeys.log#L615`,
  `#L628`).
- **The compare step stamps each comparison**, elapsed and load, as `pass_of` does: 1m50s in one run
  this morning against 13m50s in the next on the same work (`…-0054-…-run-1.out#L1215`, `#L1339`;
  `…-0938-…-run-1.out#L1220`, `#L1406`): twelve of the fifteen minutes between the two runs'
  lengths, 14m20s and 29m25s.
- **The button-loader wait moves into `shot()`** (`walk/support.ts#L42-L61`), the one picture-taker,
  so no spec can forget it. No screen's subject is a button's loader, and a frozen one settles
  between two shots: the flake hides until a base disagrees.
- **Piece-2 is left alone**: one spec, 33 screens in six tests, one worker by decision
  (`walk/playwright.config.ts#L19-L20`), 6m01s against the next pass's 2m03s, Playwright advising a
  split (`…-0938-…-run-1.out#L745`). Tests at once in one stack raise the load steadiness rests on,
  and item 81 holds the cheaper rebalance.

## The case table

| # | The case: one behaviour, one sentence | Held by |
| --- | --- | --- |
| 1 | A full run started while another holds the run lock is refused, its owner named, and runs nothing | `ops/test.sh` |
| 2 | The run lock is gone after a green run, after a red one, and after an interrupt | `ops/test.sh` |
| 3 | `--check` takes no lock, and the gate lock still refuses before the run lock is taken | `ops/test.sh` |
| 4 | The verdict names what moved, what is new, and each named screen that moved nothing | `ops/test.sh` |
| 5 | Each comparison of the compare step prints its elapsed time and the Mac's load | `walk-run.test.ts` |
| 6 | A walk whose own reads are green has its bases written though another walk is red | `walk-run.test.ts` |
| 7 | A red walk's bases stay as they were, and the run still ends red, exit 1 | `walk-run.test.ts` |
| 8 | A lane that ended red writes no base for any walk of that lane | `walk-run.test.ts` |
| 9 | Every picture is taken with no button loader left on the page | the full run (no browser here) |
| 10 | Twelve walks, nothing asked: every raw and byte count 0, no base moved | the full run |

## Steps

No screen here, so the first build is the cheapest guard, not a fake. Each commit: the touched
package's gate under the gate lock, `shellcheck -x` on the script, and the step's rows each seen red
once. Items 108 to 111 are written in step 2 and never renumbered.

- [x] **1. This plan.** Opus, about 9 minutes (the kind's last five, 7 to 11). Done: committed,
  about 1,000 words.
- [x] **2. The run lock, and the log of the six.** 15 minutes; closes 108. Taken after the refusals,
  released at the end, on the red path (`ops/full-run.sh#L98-L102`) and in the trap (`#L127`);
  `--check` (`#L160-L168`) takes none. Done: rows 1 to 3, `bash ops/test.sh` green on stand-ins,
  nothing run. A break shows as every run refused by a lock left behind, so the refusal names its
  owner and the command that clears it.
  Evidence: rows 1 to 3 each seen red before the lock existed, then green in `ops/test.sh` (stand-in
  worktree and stand-in `walk/run.sh`, nothing run), which ends all checks passed; `shellcheck -x` clean
  on `ops/full-run.sh` and `ops/test.sh`; `pnpm check` green, its log ending `== exit 0`. The lock is a
  `mkdir` folder like the gate lock, never cleared by the script; items 108 to 111 written, 108 done.
- [x] **3. The verdict names what moved.** 12 minutes; closes 88. Done: row 4, `ops/test.sh` green.
  The counts still decide the exit (`#L199-L201`), so a break misleads a reader and cannot green a
  red.
  Evidence: row 4 seen red (four checks failed before the change), then green in `ops/test.sh`; the verdict
  reads the compare lines of run 1 and prints `asked` beside `found`; the exit code is untouched. `shellcheck -x` clean; `pnpm check` green on its second run (`== exit 0`; the first went red on one `visual` scene timeout under load, in a file this step never touched).
- [x] **4. The compare step's own stamps.** 8 minutes; closes 109. Done: row 5, `scripts` at 100 %.
  No verdict reads the new lines; a break is a missing line.
  Evidence: row 5 seen red (the stamp missing), then green; `compare_stamp` prints before each of the four
  comparisons; `scripts` at 100 % in the gate. Item 112 (a slow `visual` scene) written, not in this piece.
- [ ] **5. The bases written per walk.** 18 minutes; closes 110. Done: rows 6 to 8, the suite's
  other cases unchanged, `scripts` at 100 %. The one step that could write a wrong base: a break
  shows as a red walk's picture put in as a base, which rows 7 and 8 hold.
- [ ] **6. The loader wait in the one picture-taker.** 6 minutes; closes 91. Done:
  `pnpm --filter @credo/walk run typecheck`, eslint and prettier green; the services walk's own
  waits left as they are. A break shows at once on every walk, as a red naming a screen whose button
  never stopped loading; one line reverts it.
- [ ] **7. One review.** Another model than the builder's, correctness only, at a fixed sha, 8
  minutes. Done: each finding tagged in the recap, High and Medium fixed.
- [ ] **8. The full run** (point 1), 15 to 30 minutes. One script in the root's `one-off/`, on this
  morning's two, calling **this worktree's** `ops/full-run.sh` with its parameters and never a copy
  of its body: the twelve walks, no `--moved`. `git merge main` and one whole `pnpm check` first,
  since the run refuses until main is in (`walk/run.sh#L248`). Done: `== verdict: green`, `== done`;
  every `compare` line 0 moved, 0 new, 0 without a counterpart, 0 unreadable; run 1 "moved no base:
  nothing to commit"; twelve bases-written lines; run 2's twelve byte comparisons 0.
- [ ] **9. The recap and the squash.** 5 minutes. Done: committed; 88, 91 and 108 to 110 done with
  their commits, 111 deferred; the products row true.

Total: about 75 machine minutes and one run of the Mac.

**If step 8 is red,** nothing is rerun to green (QA rule 6): a moved base is this piece's own doing,
so the step that moved it is reverted and the run repeated; no screen is re-asked.

**Not in this piece:** no walk screen renumbered, added, removed or reworded; nothing in the UI, the
BFF or piece-2's spec; items 80, 81 and 87, which live in these files, stay open.

## The human's point

👤 **1. The full run, step 8.** One command in your terminal, nothing else testing on the Mac, about
15 to 30 minutes. It takes every picture of all twelve walks again and compares each with the base
committed today. Only the machinery changed, so the pass here is **nothing moved**: every count 0,
not one base written anew — the opposite of a UI piece, where the moved pictures are the point.
Green merges the piece; a moved picture means the machinery changed a screen, and the red path above
starts.
