# Why `app`'s `pnpm check` was red on both pushes (2026-11-07)

Diagnosis only; no source changed. Evidence: the two GitHub logs (6b8627e2, run 42167839708; f8162ace, run 42065001948), the sources at `main`@`02a8d631`, and two local single-test runs.

## Red A: bff coverage at `bff/src/operator-auth.ts#L326` (11-06)

- L326 is `if (removed === 'moved') throw gone();` in the join route: the loser of two joins on one link, whose `removeRecord` finds the link already removed by the winner.
- The loser can also be refused one step earlier, at `operator-auth.ts#L318-L319` (`readLiveLink` finds the link already gone). Both give a 404, so the test passes either way; only coverage differs.
- Only `bff/src/operator-passkeys.route.test.ts#L213` ("makes one passkey when two openings race") was found to reach L326, by firing two `joinWith` at once (`Promise.all`) and hoping both read the link before either removes it. That is an unforced interleaving over real HTTP to a real c-storage process. It is not a platform, Node or transpile difference: no `v8 ignore` hint is in the file, and the file and test are identical in `main` today.
- Local read-back: that test alone, six runs, covered L326 every time (statement hits 1). On the runner the same package ran 29 files at 115 s beside `ui` on 2 cores, and the interleaving fell the other way. This is inferred from the code and the missing line; the log does not say which refusal the loser took.
- Fix: a test that forces the interleaving, not a hint. A hint would hide a real, reachable branch. `operator-passkeys.route.test.ts#L1109-L1130` already has a `meddling` client with `onPut`/`afterRemove` hooks; a test that removes the link between `readLiveLink` and `removeRecord` (or wraps `removeRecord` to return `moved` once) covers L326 every time, and the race test can stay as it is. Size: one test, about 15 lines.

## Red B: `ui test: Failed`, SIGKILL, no summary (11-06)

- A consequence of Red A, not its own failure. `check` runs `pnpm -r run test` (`package.json#L10`), so `bff` and `ui` run at once. bff printed `Failed` at 05:24:02.649; ui's last line is at 05:24:01.866 (L1208) and it was still running, with no `Test Files` line; `ELIFECYCLE ... SIGKILL` and `ui test: Failed` come at 05:24:02.709, 60 ms after bff's failure. pnpm stopped the sibling when the first failed (`ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`, L1232-L1233).
- The log does not state whether ui would have passed: it never finished. On 11-05 ui passed in 214 s (log 2 L1439), so nothing in the log points at a ui fault. No memory limit or OOM line is in the log; `ui/vitest.config.ts` sets no pool or workers (defaults). That ui was killed by pnpm is established by the timing; that ui is otherwise healthy is not established.
- Fix: none of its own; Red A's fix removes it.

## Red C: `scripts/src/walk-run.test.ts` timing assertion (11-05)

- The assertion is `expect(Date.now() - began).toBeGreaterThan(9_000)`, now at `scripts/src/walk-run.test.ts#L794` (was L721). It failed with 2611 ms. `walk/run.sh` did not fail to wait; the stand-in lanes died to the first TERM because they had not yet installed their trap.
- The stand-in (`walk-run.test.ts#L99-L116`) creates the gate lock at L111 (`mkdir "$SHIM_LOCK"`) before it installs the TERM trap at L113. `walk/run.sh#L466-L473` polls once a second, sees the lock and sends TERM to every lane's group. Any lane still before L113 (the first lane between L111 and L113, or the other two still in the hold loop at L100-L106, whose release is staggered by `sleep 0.1` and `ls | wc` forks) has the default TERM disposition and dies at once. All lanes gone means `run.sh` ends in about 2.6 s. The wait-then-KILL path at `walk/run.sh#L474-L477` is correct and ran fine here twice (14-16 s).
- Load made the window visible: the scripts package ran 22 files for 407 s on the runner, with 20+ s `pnpm demo` tests in it. The log does not name which lane died early; that is inferred from L111/L113 and the 2.6 s.
- Fix, in the test's stand-in, not in `run.sh`: install the trap before the lane is counted as held (before the `touch` at L100), so that the lock can only appear after all three lanes trap. Size: moving about 3 lines. The 9_000 assertion should stay, as it is the check that the wait happens.

## Does `main`@`02a8d631` pass `app` on GitHub today?

- A: not reliably. `bff/` is byte-identical between `6b8627e2` and `02a8d631` (`git diff --stat` empty), so the same test and the same line decide it; it is a race, so a push may pass or fail.
- C: not reliably. The failing assertion and the stand-in's L111/L113 order are unchanged since `f8162ace`, and `run.sh`'s stop path is unchanged. `walk-run.test.ts` gained 73 lines since 11-06, unread here.
- B: follows A.
- Also: `app` has `timeout-minutes: 15` (`.github/workflows/ci.yml#L113`) and the 11-05 run took 12m8s before failing; more tests have been added since, so a timeout is a third risk, not measured.
- No deploy until the gate passes once; with A and C unfixed a push is a coin flip per red.

## Independence

A and C are independent causes (different packages, both unforced timing in a test). B is A's consequence. Nothing here is a runner-only code fault; each is a test that depends on timing.

## Ran

`vitest run src/operator-passkeys.route.test.ts -t "two openings race"` with coverage on `operator-auth.ts`, six times (bff); `vitest run src/walk-run.test.ts -t "holds the first TERM"`, twice (scripts). No `pnpm check`, no long suite.
