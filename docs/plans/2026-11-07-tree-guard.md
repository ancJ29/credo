# The tree guard compares every path a script runs from, not `ops/` alone

## At a glance

Every script that acts under an AWS session already refuses unless the tree here is as reviewed, and
that refusal is one function: `ops_match_main` (`ops/lib.sh#L185-L198`), reached by all ten scripts
through `main_synced` (`ops/app.sh#L39`, `ops/check.sh#L50`, `ops/drill.sh#L24`,
`ops/operator.sh#L34`, `ops/release.sh#L35`, `ops/root-password.sh#L85`, `ops/seed.sh#L37`,
`ops/stack.sh#L77`, `ops/tunnel.sh#L39`). **It compares `ops/` and nothing else**
(`ops/lib.sh#L193-L194`), while `ridge_cli` runs the product's own code out of the working copy
(`ops/lib.sh#L616-L617`) — and that code holds the client delete, called from `check.sh`'s cleanup on
every exit path including a refusal (`ops/check.sh#L36-L47` through `ops/lib.sh#L106`). So the
cheapest safe path is not a new guard: it is widening the one that exists, in its one home, to the
paths the repository already names as its deployed code. Price: one function, its message, and the
cases beside the ones already there.

## The invariant

**No script that acts under an AWS session may execute, deploy or seed a file the reviewed base does
not hold** — the base being `origin/main` by hand and the checked-out commit in the deploy job, and
"a file it may execute" being every path the push trigger of `.github/workflows/ci.yml` deploys on.
That is the test every change below is judged against. It is deliberately not a list of files: the
set of packages a script can load changes the moment one gains an import, and `scripts`' own manifest
already depends on `@credo/bff`, `@credo/shared` and `@credo/ui` (`scripts/package.json`), which
`ridge.ts` imports directly (`scripts/src/ridge.ts#L1-L13`). A hand-curated set would be wrong on the
next import; the deploy's own path list cannot be.

## The slice

One. `ops_match_main` takes its path set from the push trigger of `.github/workflows/ci.yml`, through
the `push_paths` reader that already exists for exactly this purpose (`ops/lib.sh#L625-L629`, read
this way by `ops/seed.sh#L62-L68`: "The list is ci.yml's own, read here: one home"), and compares
every one of those paths — tracked and untracked — instead of `ops` alone. Its two messages widen
with it, so the refusal names the code rather than the folder. Its cases join the ones already in
`ops/test.sh#L426-L463`, whose scratch repository and `passes`/`refuses` helpers are the harness this
needs; the scratch repository gains a `ci.yml` so the reader has a list to read.

The two scripts that already carry a whole-tree check against `HEAD` keep it
(`ops/seed.sh#L41`, `ops/root-password.sh#L89`): it has a different base and a wider reach — it
refuses an edit under `docs/` too, which the stamp those two write would misname — and removing it
would trade one guard for another. Nothing else changes. The three scripts the open item names as
lacking the check (`check.sh`, `app.sh`, `operator.sh`) gain nothing of their own, because the route
taken covers them and the four the item does not name as well.

**Why this route and not the other, decided here.** Open item 130 (`docs/open-items.md#L809-L823`)
offers two fixes, and which one an ops guard takes is this machine's call, written down rather than
asked. The two are:
widen `ops_match_main`, or add the clean-tree check to those three scripts. The second is worse on
two counts proved by reading, not assumed. It leaves `stack.sh`, `release.sh`, `drill.sh` and
`tunnel.sh` uncovered, though each calls `main_synced` and each acts under the session. And the check
it would copy, `git diff --quiet HEAD`, does not refuse a worktree sitting on a branch — a committed
edit passes it — which is half of what the item says is open; `origin/main` as the base refuses both.

**What binds the shape, read first.** A widened comparison could refuse trees that are legitimately
clean, and that, not the comparison, is the risk. Every build output of this repository is ignored:
`dist` at `.gitignore#L83` (which `git check-ignore` resolves for `c-storage/dist`, `bff/dist` and
`ui/dist` alike), `node_modules/` at `#L41`, `coverage` at `#L22`, `playwright-report/` and
`test-results/` at `#L155-L156`. The box's binary is built into `dist/` too
(`c-storage/Makefile#L31`), and that Makefile already refuses an uncommitted tree in its own words
(`#L28-L29`) — a third place in this repository holding the same invariant. So the deploy job's tree
stays clean across every deployed path after its installs and builds, and the guard does not redden
it. That is a claim about a job, so it is step 3's own case and the point the human is asked.

## The case table

| # | The case: one behaviour, one sentence | Held by |
| --- | --- | --- |
| 1 | A clean worktree at `origin/main` passes, and the line names the code, not the folder | `ops/test.sh` |
| 2 | An edited tracked file under `scripts/` is refused by hand | `ops/test.sh` |
| 3 | An untracked file added under `scripts/` is refused by hand | `ops/test.sh` |
| 4 | An edited file under `bff/`, `shared/` or `ui/` is refused by hand | `ops/test.sh` |
| 5 | An edited file under `ops/` is still refused, as before | `ops/test.sh` |
| 6 | A worktree on a branch main does not hold is refused, though its tree is clean against `HEAD` | `ops/test.sh` |
| 7 | A worktree at an earlier commit of main that differs in a deployed path is refused | `ops/test.sh` |
| 8 | An edit outside the deployed paths does not refuse a by-hand run | `ops/test.sh` |
| 9 | In the deploy job, the checked-out commit's tree passes with ignored build outputs present | `ops/test.sh` |
| 10 | In the deploy job, a commit main does not hold is refused, as before | `ops/test.sh` |
| 11 | In the deploy job, a push that landed meanwhile does not turn a sound deploy red | `ops/test.sh` |
| 12 | A path added to the push trigger is compared with no edit to `ops/lib.sh` | `ops/test.sh` |
| 13 | A push trigger the reader cannot parse stops the guard rather than comparing nothing | `ops/test.sh` |
| 14 | `seed.sh` and `root-password.sh` still refuse an edit outside the deployed paths | `ops/test.sh` |

## Steps

| # | Step | Done when | Size |
| --- | --- | --- | --- |
| 1 | The cheap end-to-end build: `ops_match_main` reads the path set through `push_paths` and compares it; both messages widened | In a scratch repository, the function exits 0 on a clean tree and non-zero after one appended line under `scripts/`, both exit codes printed | 8 min |
| 2 | Rows 1 to 8 and 12 to 14 as cases beside the existing ones, the scratch repository given a `ci.yml` | `bash ops/test.sh` at exit 0, and each new row seen red once by one mutation, the mutation count printed | 10 min |
| 3 | Rows 9 to 11: the deploy-job base, with ignored build outputs placed in the scratch tree | `bash ops/test.sh` at exit 0; removing the scratch `.gitignore` turns row 9 red, which is what proves the ignores carry it | 5 min |
| 4 | The touched package's whole gate, as the `ops` job runs it (`.github/workflows/ci.yml#L183-L206`) | ShellCheck at exit 0 and `bash ops/test.sh` whole at exit 0, read back from the log's own `== exit 0` | 5 min |
| 5 | One cross-model review, on a model other than the author's | A verdict line: may merge, or findings each carrying a line | 8 min |
| 6 | The fix pass on the review's findings | `bash ops/test.sh` at exit 0 again, each finding answered with its line | 5 min |
| 7 | The recap, before the squash into `main` | The recap committed in `docs/recaps/`, and item 130 closed with its commit | 3 min |

## Ticks

- [x] **1.** 2026-11-07 21:36. `ops_match_main` (`ops/lib.sh`) reads the path set through `push_paths` and compares it, tracked and untracked; both messages say "the code here (every path ci.yml deploys on)". One choice beyond the plan's words: the list is read from the base's own `ci.yml` (`git show <base>:.github/workflows/ci.yml`), not the working copy's, so an edited `ci.yml` cannot shorten the list it is judged by (it is itself a listed path, so the edit is refused). Check, in a scratch repository holding the real `ci.yml`: clean tree `exit 0`; after one appended line under `scripts/`, `exit 1`. `ops/test.sh` still expects the old wording and has no `ci.yml` in its scratch repository; step 2 brings it level.

- [x] **2.** 2026-11-07 21:45. Rows 1 to 8 and 12 to 14 are cases in `ops/test.sh` beside the existing ones: the scratch repository gains a `ci.yml`, and the cases that named `ops/` by its old wording now name the code. Row 14 needed the two whole-tree cases of `seed.sh` and `root-password.sh` to edit a file in `docs/`, because the file they edited (`c-storage/bruno/opencollection.yml`) is itself a deployed path now and would be refused earlier, by the new check. `bash ops/test.sh` at exit 0: `logs/20261107-2137-tree-guard-step2-a.log` ends `== exit 0`. Each new row seen red by a mutation, **9 mutations**: 8 of `ops_match_main` (message back to `ops/`: row 1; path set `ops` alone: rows 2, 3, 4, 6, 7, 12, 13; `ops` left out: row 5; whole tree `.`: row 8; untracked check off: rows 2-3's untracked cases; base `HEAD`: rows 6, 7; fixed list: row 12; parse failure swallowed: row 13) and 1 deleting the `git diff --quiet HEAD` line of both `seed.sh` and `root-password.sh` (row 14: both cases red, `logs/20261107-2141-tree-guard-step2-mut14.log`); files restored from git after.

- [x] **3.** 2026-11-07 21:48. Rows 9 to 11 in `ops/test.sh`: the scratch repository carries the real ignore lines (`dist`, `node_modules/`, `coverage`, `playwright-report/`, `test-results/`) and ignored build outputs in `scripts/`, `bff/`, `ui/` and `shared/`, left in the tree for every case after, so row 9 (the job's checked-out commit passes with them present), row 10 (a commit main does not hold is refused) and row 11 (a push that landed meanwhile does not turn it red) all run with the outputs present. A permanent case moves the scratch `.gitignore` away and asserts the same job tree is refused. `bash ops/test.sh` at exit 0: `logs/20261107-2145-tree-guard-step3.log` ends `== exit 0`. Row 9 red with the scratch `.gitignore` never written (the block run alone): 5 red, row 9 and row 11 among them, 0 red with it.

- [x] **4.** 2026-11-07 21:50. The `ops` job's steps as `.github/workflows/ci.yml` runs them, locally: ShellCheck 0.11.0 (`-x ops/*.sh walk/*.sh`) exit 0 and `bash ops/test.sh` whole exit 0, `logs/20261107-2147-tree-guard-step4.log` (`== shellcheck exit 0`, `== ops/test.sh exit 0`, last line `== exit 0`, lock released and free). cfn-lint is not part of this step's done-when and was not run (needs pip, no network). The one unknown is answered: after the whole gate on the committed tree, `git status --short` printed nothing, so no tracked file under any deployed path was rewritten, and the path set loses no path.

**Total 44 minutes**, the review and the whole check among them. Each size is the minutes the same
shape took in its last rows: a guard built into a shell script 8, its cases 8 to 14, a small cases
step on `ops/test.sh` 3, an Opus review 6 to 12, a fix pass 5 to 7, a recap 2 to 4. The piece needs
the workspace installed before step 1, for the gate's node.

## The human's points

There is nothing to look at here: this piece's whole proof is that nothing changes. So the three
points below are the ones only you can answer, and the route the guard takes is not among them — it
is decided above, and a no from you reopens it.

**1. What it costs you by hand, at step 2.** After this, running any `ops/` script by hand needs a
worktree identical to `origin/main` across every path the deploy acts on — the whole app, not just
`ops/`. An edit under `docs/` is still fine. A local experiment under `bff/` will refuse a deploy
check until it is committed and pushed. **Yes** accepts that; **no** means the guard should compare
only the code a script loads, which is a narrower set that drifts on the next import.

**2. The null proof, at step 3.** The strongest evidence here is that nothing changes: the deploy job
must stay exactly as green as before, because its tree is clean once every build output is ignored.
Step 3 proves that in a scratch tree, which is as far as a local run reaches. Only a real push to
main proves the job itself. **Yes** means you will push it and read that one run; **no** means the
guard waits for a push you choose later, and ridge stays on the old one meanwhile.

**3. What this does not close, at step 7.** This closes item 130 and nothing else. The deploy check
still puts the box's internal and super-admin keys on whatever machine runs it, for any environment
(item 131), and six of the nine scripts still take any environment name (item 132). Both stay open
and both are named in the client-readiness order. **Yes** closes 130 alone; **no** means you want 131
or 132 folded in, which is a second slice and a second plan.

## The one thing unknown

Whether any path the push trigger names holds a tracked file that a local gate run rewrites. The
ignores above cover every build output read in this run, and this worktree reports no untracked file
under those paths, but a gate the machine has not run here could write a tracked fixture. Step 4's
whole gate is where that would show, as a refusal on the run after it; if it does, the path set loses
that one path with its reason written beside it.
