# The walks' full run made shorter

## At a glance

Every piece that moves pictures pays one full run in the human's terminal (milestone 2's: 79 minutes, five tries).
This piece cuts eleven walks from about 78 minutes to about 18, tooling only. Milestone 3's palettes gain first.

| | Today | After |
| --- | --- | --- |
| Run 1, `walk/run.sh … --write` | one walk at a time, ~40 min | three lanes of walks, each on its own stacks, ~18 min |
| Run 2 | a second whole run, ~38 min | each committed base against run 1's picture, byte for byte, seconds |

The cheapest safe path is what exists: run 2's reader is `compare` (`scripts/src/walks.ts#L51-L133`) on bytes, over
the bases view run 1 builds (`walk/run.sh#L376-L382`); the lanes are today's passes (`walk/run.sh#L291-L314`). Each
stack builds into its own temp folder (`scripts/src/cli.ts#L97`, `scripts/src/stack.ts#L115`) on ports the OS hands
out; a port taken before its bind is a red naming the child's log (`scripts/src/processes.ts#L7-L18`).
**Price:** $0; about 29 machine minutes and one ~18-minute run.

## The slice

The human's one command, `ops/full-run.sh`, ends green in about 18 minutes on all eleven walks. Decided here:

- **Run 2 becomes `walk/run.sh <walks> --bytes <run 1's folder>`**, the folder read from run 1's line "pictures and
  results in" (`walk/run.sh#L286`). Outside `--bases`, `compare` reds a name on one side only
  (`scripts/src/walks.ts#L97-L110`) and prints the line `ops/full-run.sh#L190` reads. `--bytes` reads files only, no
  browser check; its view goes to `bytes/`, not over run 1's `bases/`. Two samples fewer: the eight run 2s since 10-31
  all read 0; a picture that moves only between runs shows in the next piece's run 1.
- **A run 1 that moved no base commits nothing** and goes on; today `git commit` fails there
  (`ops/full-run.sh#L176-L182`), as the adoption run would.
- **The lanes are a column in the table** (`walk/run.sh#L38-L50`), the memo's measured split: piece-2; the four
  office and driver walks; the six others. A run of fewer walks may use fewer lanes.
- **Each lane is a background subshell**, its lines prefixed `[lane n]` (as `ops/full-run.sh#L109-L112`). The parent
  waits for all, then reads `results.txt` (`walk/run.sh#L319-L327`, moved after the join: a subshell's `reds` dies
  with it) and counts as today.
- **Each pass gets Playwright's `--output` in the run's folder** (`walk/run.sh#L115-L117`): with no `outputDir`
  (`walk/playwright.config.ts#L17-L29`), each pass empties the shared `walk/test-results`. The patterns come from the
  parent's listing (today `walk/run.sh#L349`, `#L354`).
- **`--serial` keeps today's order**: the red path's switch, and how a later red tells a clash from a screen's timing.
- **The markers become `== 1/6` to `6/6`**, the passes one step; the orchestrator's Monitor follows.

## The case table

| # | The case | Held by |
| --- | --- | --- |
| 1 | `--bytes` reads every committed base equal to its run-1 picture: green, every count 0 | `walk-run.test.ts` |
| 2 | One byte off, or a base or a picture on one side only, is red and named | `walks.test.ts`, `walk-run.test.ts` |
| 3 | `ops/full-run.sh`: run 1 green, its commit or none, the bytes; a count not 0 is red | a stand-in `walk/run.sh`, throwaway repo |
| 4 | Three lanes run at once, each walk's passes as today; the verdict waits for all | `walk-run.test.ts` |
| 5 | `--serial` gives the same passes and pictures in one lane | `walk-run.test.ts` |
| 6 | Each pass writes Playwright's output into a folder of its own | `walk-run.test.ts` |
| 7 | A lane's red pass leaves the others to finish and is named | `walk-run.test.ts` |
| 8 | The gate lock appearing, or a Ctrl-C, stops every lane; the verdict lands; nothing left running | `walk-run.test.ts` |
| 9 | Eleven walks on lanes read every count 0 against `main`'s serial bases, `42d4102` | the adoption run |

## Steps

Every check runs in the sandbox; while iterating, `pnpm --filter @credo/scripts exec vitest run src/walks.test.ts
src/walk-run.test.ts` (stand-ins, `scripts/src/walk-run.test.ts#L76-L106`).

- [x] **1. This plan.** 🤖 Opus, about 8 minutes. Done when: committed, about 1,000 words.
- [ ] **2. Run 2 as bytes, end to end.** 🤖 Sonnet, about 5 minutes. Done when: rows 1 to 3 each seen red once;
  `shellcheck -x ops/full-run.sh` clean; the throwaway repo (scratch, never committed) green, empty run 1, red count.
- [ ] **3. The lanes, cheap.** 🤖 Sonnet, about 5 minutes. Done when: the existing cases green unchanged; row 4 by a
  stand-in holding each pass until every lane has started one (today's script times out: the red); rows 5 and 6.
- [ ] **4. The lanes, hardened.** 🤖 Sonnet, about 5 minutes. Done when: rows 7 and 8 each seen red once; `scripts`
  at 100 %; one whole `pnpm check` under the gate lock, `== exit 0`.
- [ ] **5. One review.** 🤖 Opus, correctness only, at a fixed sha, about 5 minutes. Done when: each finding tagged
  in the recap; High and Medium fixed.
- [ ] **6. The adoption run** (👤 1), about 18 minutes; 🤖 reads its log whole. Done when: `== verdict: green`,
  `== done`, every `compare` line 0.
- [ ] **7. The recap and the squash.** 🤖 Sonnet, about 1 minute. Done when: committed, the products row true.

Total: about 47 minutes, 29 the machine's.

**If step 6 is red,** nothing is written (`walk/run.sh#L397-L398`) or rerun to green (QA rule 6). A lanes clash (a
stack that would not start, a missing folder) is fixed as step 4, then one more run. A screen moved between passes
is a timing defect load surfaced: `ops/full-run.sh` passes `--serial` (one line), the piece merges with run 2's 38
minutes saved, the screen becomes a diagnose entry, and the lanes return once a lanes run reads 0. Run 1 green, the
bytes red: the lanes are adopted; the reader is fixed and rerun on run 1's folder in the sandbox.

## The human's point

👤 **1. The adoption run, step 6.** One command in the human's terminal, nothing else testing: `ops/full-run.sh` on
this branch, all eleven walks, no `--moved`. The lanes take every picture again against the bases milestone 2's
serial run wrote; nothing should move. The machine reads the verdict. Green merges the piece, and every later full
run takes about 18 minutes; red starts the path above.
