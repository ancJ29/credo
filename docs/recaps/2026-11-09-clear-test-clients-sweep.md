# The deploy check clears stranded check clients, recap, 2026-11-09

## At a glance

| | Before | After |
| --- | --- | --- |
| A check client left by a failed delete or a died run | stays in the Clients list until someone deletes it by hand | deleted by the next deploy's check once it is two hours old |
| A sweep that fails | not applicable | a `WARN` line in the log; the deploy's verdict does not change |

## What shipped

- **The chore was already half solved.** Since 11-07 the check deletes its own client at every end of the run ([the cleanup recap](2026-11-07-deploy-check-cleanup.md)), so the clients the human saw were historical. The one way a new one could still appear was a delete that failed and only warned. This piece clears those too.
- **The command:** `ridge clear-checks` lists the clients and deletes each whose code is a check code with a stamp more than two hours old, the rest still going after a failure, exit 1 if any failed (`scripts/src/ridge.ts`; the age comes from the code, no new field). The deletion is `untenant`'s, now one shared helper.
- **The call:** `ops/check.sh` runs it once, after the BFF's keys are read and before the check makes its own client, inside the tunnel already open.
- **A failed sweep still only warns.** It is an `if` condition with no `die`, so the exit 1 becomes a `WARN` line, never a red deploy. This closes item 117 without making a good deploy fail on housekeeping; the cost is that nothing reads the `WARN`, which item 159 now records (with a half-swept client the sweep cannot resume).

## Rejected and why

- **An age under two hours.** A live check client lives 8 minutes at most (the step's `timeout-minutes: 8`); a shorter age could delete a concurrent deploy's client mid-check.

## What remains the human's

- Nothing to look at. The first deploy that runs shows `ok   clear-checks: …` in its log; a `WARN` there means the sweep failed.

## Evidence

- Commits `1d48c7d0` (the command, rows 1 to 5) and `edb58986` (the call, two `ops/test.sh` lines).
- Package gate, `scripts`: five steps exit 0, 314 tests, 100 percent coverage (`20261109-0908-scripts-gate-clear-test-clients.log`). Ops: `shellcheck` and `ops/test.sh` exit 0 (`20261109-0913-ops-gate-clear-test-clients.log`).
- The whole check: `== exit 0 (typecheck 0 eslint 0 prettier 0 test 0 knip 0)`, 1,300 tests across the five test packages, run after the merge of `main` (`20261109-0920-root-check-clear-test-clients.log`).
- `docs/products.md`: no row changes; the rows name what a partner or an operator can do, and this is internal.
