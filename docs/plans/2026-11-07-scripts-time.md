# Where the scripts package's minutes go

## At a glance

Between a push and the office having what we built sit about twelve minutes of gate, and more than
half of them are one package's tests. This piece measures first, then trims or shards only what the
measurement names.

**The measurement is already done, and it needed no machine.** The logs on disk carry Vitest's own
per-file seconds. On the runner the `scripts` package took 407.45 s, and **one file,
`src/demo/apply.test.ts`, took 402.48 s of it — 98.8 %**. Locally the same file was 199.19 s of
199.98 s. Vitest runs files on separate workers but the tests inside one file one after another, so
the package's floor **is** that file. Nothing else comes near: the next longest is 86.7 s.

**The cheapest safe path is therefore not a trim but a split.** The file already has ten top-level
`describe` blocks, and every test inside takes a service of its own, so the blocks can become ten
files that run side by side. No assertion moves, no product line is touched, and coverage cannot
fall, since the same tests run over the same code. **The price:** ten files where there was one,
each starting its own c-storage — bounded by evidence at well under 14 s, and likely a second or
two, since the Go build cache is a shared path (`bff/tests/build.ts#L13`). Trimming what a test
sets up comes second, and only where the split leaves something slow: it is the change that can
make a test weaker.

## The slice

One: the `scripts` package's own wall time, measured, cut, measured again the same way. The other
long pole, `visual` at 274.89 s, is a second plan.

## What the logs already said

| | the runner, 11-05 (`20261107-0915-github-runs-f8162ace.log`) | a quiet Mac, 11-06 (`20261106-1428-walk-machinery-full-run-check-test-scripts.out`) |
| --- | --- | --- |
| `src/demo/apply.test.ts` | **402.48 s** (48 tests) | **199.19 s** |
| `src/stack.test.ts` | 86.7 s | 54.1 s |
| `src/demo.test.ts` | 72.3 s | 50.7 s |
| the package's own total | **407.45 s** | 199.98 s |
| the whole app job | 12 min 06 s | — |

Inside the slow file the same log prices both patterns it already contains: the seven tests that
each run their own fill cost 66.7 s, while the twelve that share one fill in a nested `beforeAll`
cost 19.5 s. That is the trim's evidence, measured, in the file itself.

## The rule every number here obeys

**A number without the machine's load beside it is not a measurement.** The same whole check ran
5 minutes on a quiet Mac and 23.5 minutes under load on 11-07, failing different files each time.
Every second this piece reports carries the one-minute load it was taken under, read as
`walk/run.sh#L97` reads it; and any run of its own is **a request to the orchestrator** for a window
with no gate lock held and no picture run pending, never something a step takes for itself.

## What counts as worth acting on, decided before looking

1. **A file over 25 % of the package's wall time.** The package's floor is its longest file, so
   only the longest one can pay. At 25 % exactly one file is in scope and the next (21 %) is out.
2. **Inside that file, a single test over 5 s.** Not a budget: the file's own shared-fill tests land
   at 2–3 s, so 5 s is above what this file already proves reachable.
3. **Stop when the longest file is at or under the second pole, 86.7 s on the runner.** Below that
   a further cut buys no wall time at all and only risks the tests. That is the piece's end.

## The remedies, and what the measurement would have to show for each

| Remedy | Right when the measurement shows | Price |
| --- | --- | --- |
| **Shard across files** (Vitest's own answer) | one file dominating, its tests independent | ten files; one c-storage start each; coverage untouched |
| **Trim what a test sets up** | a slow test setting up more than its case needs | real risk to what is asserted; a red per trimmed test |
| **Out of the gate's path** | the slow file not being the gate's business | rejected: it is, and a split job would break a package gate's five steps |

The measurement shows the first outright; the second applies only to what the split leaves over the
threshold; the third is closed here.

## The honest risk

**A faster test can be a weaker test, and the coverage gate will not say so.** A test that still
runs every line while checking less keeps the package at 100 %. So:

- The split changes no assertion and no test name, so QA's rules 2 and 4 hold by construction, and
  the 100 % thresholds in `scripts/vitest.config.ts` are the check that nothing was dropped.
- Any **trim** is seen red once per trimmed test, with its rule's line changed and put back, and the
  recap names each trimmed test and what it still asserts.
- The review's one job here is to read each trimmed test against its case's sentence and say whether
  breaking that case still turns it red. Coverage is not evidence for that question.

## The cases

| # | The case: one behaviour, one sentence | Held by |
| --- | --- | --- |
| 1 | Every per-file second reported carries the one-minute load it was read under | the recap's table, against the log it came from |
| 2 | Every test of the slow file survives the split under its own sentence: the package's count is 281, as it was | the `Tests` line of the package's own run |
| 3 | No shard meets another's records: each takes its own service on its own c-storage | the shards green when run together |
| 4 | The package stays at 100 % of statements, branches, functions and lines | the thresholds in `scripts/vitest.config.ts` |
| 5 | A trimmed test still fails when its rule breaks, seen red once | QA rule 2, named per test in the recap |
| 6 | The package's longest file is at or under 86.7 s on the runner, and the package's total falls | the next CI run's `scripts test: Duration` line |
| 7 | 👤 The before and after numbers read true, each with its load | the human, at step 4 |

## The steps

- [ ] **1. The measurement, from the logs alone.** No machine, no run. *Done when* the recap holds
      all 22 of the package's files with their seconds and the package's total, from both logs
      named above, and the share the longest file holds. **5 min.** (`.prettierignore` holds
      `*.md`, so a prettier green on this page inspects nothing and is no evidence for it.)
- [ ] **2. Split `src/demo/apply.test.ts` along its ten `describe` blocks.** No assertion, no name
      and no product line changed. *Done when* the package's five gate steps are green:
      `pnpm -r run typecheck && eslint . && prettier --check . && pnpm --filter @credo/scripts test && knip`,
      the `Tests` line still 281 and coverage 100 %. **12 min.**
- [ ] **3. Trim only what step 2 leaves over the threshold**, to the shared-fill pattern the file
      already holds. *Done when* each trimmed test has been seen red once, the same five steps are
      green, and no file is over 86.7 s. Skipped entirely if step 2 clears the threshold. **10 min.**
- [ ] **4. The after number, taken the way rule 3 asks.** The before is already on disk and free.
      *Done when* the recap holds the package's own `Duration` with its load beside it, and the next
      CI run's `scripts test` line. **5 min.**
- [ ] **5. One cross-model review, then the recap.** *Done when* each finding is `[FIXED]`,
      `[REJECTED]` or `[DEFERRED]` with its reason. **8 min.**

**40 minutes.**

## The human's point

**At step 4, the before and after.** You will see one table: the `scripts` package's seconds before
this piece and after it, each with the Mac's one-minute load beside it, and the same two numbers
from GitHub's own runner, where there is no other work on the machine at all. The question is
whether that reads as a real saving rather than a quiet machine. A yes closes the piece. A no means
the numbers go back for another reading in a window you name, and nothing merges until they do.
