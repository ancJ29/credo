# The tree guard, recap, 2026-11-07

## What shipped

Every ops script that acts under an AWS session already refused a tree that differed from `origin/main`, through one function, `ops_match_main`. It compared `ops/` and nothing else, while the scripts run the product's own code from the working copy. The piece widened that one function, so the gap was one pathspec, not a missing guard.

It now compares every path the push trigger of `.github/workflows/ci.yml` deploys on (16 today), plus the root `.gitignore`, tracked and untracked. The list comes from the base's own `ci.yml`, so a working copy cannot shorten the list and then edit what it dropped. Nothing is compared outside those paths: an edit under `docs/` still runs.

## What it does not do

- Ignored files (`node_modules`, `dist`) sit inside deployed paths and are not compared. Both refusal messages now say exactly what is compared; the first wording claimed more.
- Item 142 (the install is not checked against the lock) and item 143 (`RIDGE_SCRIPTS_DIR` points outside the tree) stay open.

## Rejected

Copying `git diff --quiet HEAD` into the three scripts the item named: it leaves four of the ten uncovered, and it passes a worktree on a branch holding an unreviewed commit.

## What proves it

- Fourteen cases beside the existing ones, each seen red under at least one of nine mutations in the function.
- The deploy job stays green. This rests on a step already green inside that job: `c-storage/Makefile#L28-L29` runs `git status --porcelain` after the install and both builds, before the role is taken, and would fail on any dirty tree there. A local scratch tree with ignored build outputs agrees.
- The whole ops gate, `20261107-2159-tree-guard-step6.log`: `== ops/test.sh exit 0` (L576), `== exit 0` (L577), no `FAIL`. ShellCheck exit 0 in `20261107-2147-tree-guard-step4.log` (L6); its L224 pins the real trigger at 16 paths. Mutation 14 red: `20261107-2141-tree-guard-step2-mut14.log` (L569).
- **Not run:** cfn-lint (needs pip and the network). GitHub confirms it on the push.

## What remains

Items 142 and 143, and item 144 (a `mktemp` failure in the new code dies with a misleading message, still failing closed). Items 131 and 132 are separate pieces.

## Evidence

`git log main..HEAD`: `55bcd2f0`, `687d8161`, `9431460f`, `1e1f5946`, `dc5983dc`, `138571c4`. `docs/products.md`: no row changes; an internal guard adds no product.
