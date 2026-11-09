# One gate command a package

## At a glance

No package here has a `check` script: only the root does, and it is an `&&` chain
(`package.json#L10`), so a test failure means eslint, prettier and knip never run and their silence
reads as a pass. Every session that needs a package's gate therefore writes the five steps out by
hand, and four committed plans wrote four different assemblies. This piece moves that assembly into
one script, `ops/gate.sh`, which takes the packages as its parameter, runs all five steps whatever
any one of them does, and ends on `ops/lib.sh`'s own `== exit <code>` line. Each package's
`package.json` gains a `check` that calls it, so `pnpm --filter <pkg> check` exists; the root's
`check` becomes the same script over every package. Nothing a step *does* changes, and the 100 %
thresholds are untouched. Its proof is a forced red in each of the five positions: the command must
report it, not swallow it.

## The slice

One slice, walkable when it ends: `pnpm --filter @credo/shared check` and `pnpm check` both run,
report every step, take the gate lock, write one log a run and end on a readable code — and a
deliberately broken step in any of the five positions turns the exit line red while the other four
still run and are named.

**The name.** `ops/check.sh` is taken: it is ridge's environment check (`ops/check.sh#L2`), and
`.prettierignore#L11` names it as such. The new script is `ops/gate.sh`, the word qa.md and
`.gate-lock` already use.

**The shape, and the lines that decided it.** The brief's design — one `ops/` script with the
package as a parameter — holds, and the repo already converged on its interior.
`docs/plans/2026-11-07-clear-test-clients-press.md#L40-L42` spells a package's five steps as
`pnpm --filter <pkg> run typecheck`, `pnpm exec eslint .`, `pnpm exec prettier --check .`,
`pnpm --filter <pkg> run test`, `pnpm exec knip`: typecheck and test scoped, the other three over
the whole tree. That split is not a convenience, it is forced. `knip.json#L3-L11` configures knip
as one workspace map, so a symbol `shared` exports and only `ui` imports reads as unused if knip is
scoped to `shared`; `eslint.config.js#L11-L18` and `.prettierignore` are root configs over the
whole tree. So the package parameter selects which packages' `typecheck` and `test` run, and the
other three steps are identical in every call. **That is why there is one body and no per-package
branch.**

**The two real differences, neither a branch.** `walk` has no `test` script at all
(`walk/package.json#L5-L8`), so the script derives each selected package's step list from that
package's own `scripts` and prints `skipped: @credo/walk has no test script (its proof is
walk/run.sh)` — a named line, never a silent `--if-present`. And the test step is always the
package's own `test` script, `vitest run --coverage` with the thresholds in each
`vitest.config.ts` (`shared#L11`, `bff#L21`, `ui#L18`, `visual#L24`, `scripts#L51`); the script
never spells `vitest` itself, which is how a hand-typed gate loses coverage. `bff`'s tests also
`go build` c-storage (`bff/tests/global-setup.ts#L23`), and the Go environment that needs already
has a home in `bff/tests/build.ts#L7-L13`: the gate passes the caller's environment through
unchanged and adds no Go variable of its own.

**The root `check` becomes one call of the same script over all six packages,** and the `&&` chain
goes. Not a loop over the packages' own `check` scripts: that would run eslint, prettier and knip
six times and contend six ways on one lock. The `-r` steps take `--no-bail`, because
qa.md#L192-L194 records that a plain `pnpm -r` run hides every package behind the first failure. A
green from the root then means every step of every package ran, which is what the chain could not
say. `.github/workflows/ci.yml#L144-L145` runs `pnpm check` as the app's gate, so the script must
work on a runner: under `CI` it skips the lock and the load wait and says so in the log. No
workflow file changes — `ci.yml#L197` already shellchecks `ops/*.sh` and `#L206` already runs
`ops/test.sh`.

**c-storage stays outside, named.** Its gate is `make check` in `c-storage/` and its Makefile says
so in its first line (`c-storage/Makefile#L1-L2`, `#L19-L21`); eslint, prettier, knip and CI each
hold it separately (`eslint.config.js#L15`, `.prettierignore#L4-L5`, `knip.json#L4`,
`ci.yml` job at `#L67-L69`). Folding Go into `pnpm check` would make every UI gate need the Go
toolchain. `ops/gate.sh` prints one line in its verdict naming `make check` as the gate it is not,
so a green here cannot be read as the whole repository.

**The lock and the log.** The lock loop qa.md#L198-L206 describes goes inside the script: one loop
that waits for the one-minute load under 8 and takes `<credo root>/.gate-lock` with `mkdir`,
refusing an empty or non-numeric `uptime` reading, writing an `owner` file, released from a `trap`
on EXIT. `walk/run.sh#L97` already has `load_now`, and `#L253` and `ops/full-run.sh#L218-L221`
already refuse while the lock exists — nothing takes it today. The log and the marker are
`ops/lib.sh`'s: `log_start gate <packages>` names it `<date>-<time>-gate-<packages>.log` from
`date` inside the script (`ops/lib.sh#L82`), and `on_exit` saves `$?` before anything else
(`#L103`) and appends `== exit $rc` past the pipe (`#L141`). A rerun cannot overwrite a red run's
log: the stamp holds seconds and the lock admits one run at a time. The script does **not** call
`main_synced` (`ops/lib.sh#L175-L178`) — it would refuse on every branch that touches `ops/`,
which is every branch running this gate.

## The cases

| # | The case: one behaviour, one sentence | Held by |
| --- | --- | --- |
| 1 | A package's gate runs five steps and names each with its result | `ops/test.sh` |
| 2 | A red step does not stop the later steps: all five still run and are named | `ops/test.sh` |
| 3 | The exit line carries the gate's own code, in each of the five positions | `ops/test.sh` |
| 4 | A package with no `test` script prints a named skip, not silence | `ops/test.sh` |
| 5 | The test step invokes the package's own `test` script, never `vitest` directly | `ops/test.sh` |
| 6 | eslint, prettier and knip run once over the whole tree in a scoped call too | `ops/test.sh` |
| 7 | With no package named, every package's typecheck and test is reported, `--no-bail` | `ops/test.sh` |
| 8 | The lock is waited for in one loop that also waits for the load under 8 | `ops/test.sh` |
| 9 | An unreadable `uptime` reading refuses rather than taking the lock | `ops/test.sh` |
| 10 | The lock is released from the trap on a red and on a signal | `ops/test.sh` |
| 11 | A nested call runs the steps without taking the lock a second time | `ops/test.sh` |
| 12 | Under `CI` the lock and the load wait are skipped, and the log says so | `ops/test.sh` |
| 13 | The verdict names `make check` as c-storage's own gate, outside this one | `ops/test.sh` |

## The steps

- [x] **1. `ops/gate.sh <pkg>`, end to end on the cheapest package, 15 min.** The five steps, each
      run and its result kept whatever the one before did (`set -uo pipefail` without `-e`, as
      `ops/full-run.sh#L45`), `ops/lib.sh`'s `log_start`, `step`, `ok`, `red` and `verdict`; no
      lock yet. *Done when:* `bash <root>/ops/gate.sh shared` prints five `[n/5]` lines and
      `== green`, and the log's last line is `== exit 0`.
      *Evidence:* logs/2026-11-09-095423-gate-shared.log, five `[n/5]` lines, `== green`, `== exit 0`; forced prettier red logs/2026-11-09-095504-gate-shared.log, `== exit 1`, other four steps ran.
- [x] **2. The step list from each package's own `scripts`, and the whole-tree call, 10 min.**
      *Done when:* `ops/gate.sh walk`'s log holds `skipped: @credo/walk has no test script`; a call
      with no package names six typecheck results and five test results; `grep -c vitest
      ops/gate.sh` is 0.
      *Deliberate departure:* the per-package steps are a loop that runs each package's script on its
      own, not `pnpm -r --no-bail`: it keeps `--no-bail`'s property (no package hides the rest) and
      names every package in the log, which `-r` does not. Do not change it back. A step a package
      lacks is a named `skipped:` line stating only the fact; the `== steps:` line shows `skip` for a
      step that ran nowhere and `<code>+<n>skipped` where some packages skipped it.
      *Evidence:* logs/2026-11-09-100407-gate-all.log: 6 typecheck results, 5 test results, `skipped: @credo/walk has no test script`, `test 0+1skipped`, `== green`, `== exit 0`; logs/2026-11-09-100335-gate-walk.log: `test skip`.
- [ ] **3. The lock, the load wait, the trap, the CI skip, the nesting guard, 10 min.** Cases 8 to
      12. *Done when:* with `.gate-lock` present the run logs its wait and the owner; after a
      forced red the lock is gone; `CI=1` logs the skip.
- [ ] **4. The seven `check` scripts; the root's chain goes, 8 min.** Six packages call
      `bash ../ops/gate.sh <pkg>`; the root calls it with every package. *Done when:*
      `pnpm --filter @credo/shared check` ends `== exit 0`; `git grep -c '"check":' -- '*/package.json'`
      counts 6; the root's `check` holds no `&&`.
- [ ] **5. The cases in `ops/test.sh`, the five forced reds by stand-in, 17 min.** Each case red
      once ([QA](../conventions/qa.md) rule 2), the five positions driven by a PATH stand-in that
      exits 1. *Done when:* `bash ops/test.sh` prints 0 `FAIL`, each of the 13 cases has been seen
      red once, and `shellcheck -x ops/*.sh` exits 0.
- [ ] **6. The real forced red in each position, and the whole gate on the merge result, 22 min.**
      A genuinely broken line per position on `shared` (a type error, a lint error, an unformatted
      line, a failing assertion, an unused export), put back after each. *Done when:* five logs,
      each `== exit 1`, each naming its red step and still naming the other four; then `main` taken
      in and `pnpm check` green with `== exit 0`; `ops/README.md` gains the script's entry.
- [ ] **7. The review and the recap, 23 min.** One cross-model review ([QA](../conventions/qa.md)
      rule 5), each finding tagged; `docs/recaps/2026-11-09-one-gate-command.md` with its
      `docs/products.md` row. *Done when:* every finding tagged, and the recap cites the five
      forced-red logs by the names `ls` gives them.

**Size: about 105 minutes** across the plan, the build, the review and the recap — above the brief's
50, which did not carry the 13 cases in `ops/test.sh`, the five real forced reds (about 30 minutes
together) or the review and recap (23).

## The human's point

**One, the whole of it: does this read true?** From the build on, any brief can say "run the
package's check" and nothing more, because `pnpm --filter <pkg> check` will exist and will be the
same five steps for every package. Two things change that you will notice yourself: `pnpm check`
gets longer and slower on a red run, since it now reports all five steps instead of stopping at the
first, and every gate run waits for the machine's load and takes `.gate-lock`, so two of them queue
instead of fighting. The interior choices here — the script's name, which steps are scoped, where
the lock lives — are the machine's and are decided above. A yes starts the build at step 1; a no
names the part that reads wrong, before any code exists.

**For a separate piece, not done here:** qa.md#L41 and #L116-L121 still describe a package gate as
five steps a session names and runs, which is the paragraph every brief has been copying. Once this
command exists those lines should point at it instead.
