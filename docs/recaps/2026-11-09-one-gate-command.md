# One gate command, recap, 2026-11-09

## What happened

On 2026-11-07 four faults hit the gate and none was in product code: a hand-assembled gate that left eslint out and let two lint errors reach `main`; two gates in one hour that ended `== exit done`, the status lost behind a pipe; a plan that copied a command that never existed; and a rerun that overwrote its own log. The gate is now one command, `pnpm --filter @credo/<pkg> check` for a package and `pnpm check` for all six. It runs the five steps whatever any one does, waits for the machine's load and one lock, writes one log, and ends on the real status. A step a package lacks is named as skipped, never read as a pass.

## What the two reads found

- **A green that ran nowhere.** With an empty package list the gate printed `== green` having run no typecheck and no test: the piece's own fault class, in how the command learns what to run rather than in how it reports. It now refuses (`ops/gate.sh#L134-L136`), and a `package.json` it cannot ask is a red, not a skip.
- **Advice no assertion could catch.** The give-up refusal told the human to delete the lock even when its owner was alive, and a healthy full run outlasts the wait. The line was correct and the advice wrong. It now prints the clearing command only for an owner that is gone or unknown, and says to wait otherwise.
- The gate also waits while a full run holds its lock, so a short check no longer reddens a long run.

## What it does not close

- A bare `walk/run.sh` takes no lock, so a gate started during one still reddens it.
- `pnpm -r run check` exists now and is the wrong command (six gates on one lock; eslint, prettier and knip six times).
- **The loop is not shut:** `docs/conventions/qa.md` still tells every brief to name and run the five steps by hand, and ten plans carry a hand-assembled chain. The convention is owed a piece of its own.
- Items 171 to 176 and 190 to 192 hold what was filed and not fixed.

## What remains the human's

Nothing. No `docs/products.md` row changes (internal).

## Evidence

- The five real forced reds, one per position: `2026-11-09-120026-gate-shared.log`, `2026-11-09-115527-gate-shared.log`, `2026-11-09-115554-gate-shared.log`, `2026-11-09-115622-gate-shared.log`, `2026-11-09-120100-gate-shared.log`, each `== exit 1` with the other four steps named; and one through pnpm's own entry, `2026-11-09-123433-gate-shared.log`.
- Every added test case seen red by a named mutation: `2026-11-09-124306-94-fix-mutations.log`, `2026-11-09-130532-94-fix-r1-mutations-b.log`.
- Whole gate over the merge with `main`: `2026-11-09-131204-gate-all.log`, `typecheck 0 eslint 0 prettier 0 test 0+1skipped knip 0`, `== green`, last line `== exit 0`. That is the command gating `main` at `15b7dc99`, five packages of code it did not ship with.
