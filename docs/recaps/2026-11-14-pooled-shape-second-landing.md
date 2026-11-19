# Companies pooled on boxes, second landing, recap, 2026-11-14

Written before the landing on `pre-merge`; the ridge sitting's line was filled once it ran, on 2026-11-19.

| An operator growing an environment | Before | Now |
| --- | --- | --- |
| Adding a box | none: a second box ran only on this machine | `ops/stack.sh env <env> --more-boxes b2`, then release, app and check go over each box |

## What happened

A box added to an environment is a loop over the `MoreBoxes` list in `ops/env.yml`: each name makes an instance, its role and a records disk of its own. The deploy role reaches this environment's boxes by tag and subnet. The scripts take `--box <name>`: release and check go over the home box and then each box added, and the runbook gains "Adding a box".

The review's findings:
- **High 1, fixed:** an empty list is one empty name on AWS's page, so the loop's ids were the home box's; the loop's names now start `More`, "no box" is the word `none`.
- **Medium 2, fixed:** the runbook's removal could match the home box; it looks the box up by its own name.
- **Lows 3, 4, fixed:** the removal's disk wording; the release names the commit.
- **Lows 5, 6:** items 449, 462.

The reread of the fix said may merge, with four new Lows: A, B, C are items 463 to 465; D is item 447's stale names, corrected in place.

## Still yours

- Ridge's sitting, planned for 2026-11-15: add the second box, check both, remove it. It ran on 2026-11-16: the second box was added, both boxes released and checked (the home box's check red on its own list only, fixed since) and the box removed again, so ridge holds one box ([`docs/products.md`](../products.md), row F).
- No look of yours is open for this landing.
- The whole check on `pre-merge`, then `main`. <!-- FILL: the verdict of each, not yet known -->
- Left after this landing: step 7, the move of a company between boxes, its review, and ridge's sitting for it.

## Evidence

- Commits `14e77b62` to `b19807d8` on `pooled-shape`, from `6a0e2264`.
- The fix pass's `ops/test.sh` ended "all checks passed".
- GitHub's run of the step's code: every job green; the deploy job was skipped (a branch push). The fix has had no GitHub run.
- The citation test exited 0.
- `docs/products.md`: row F extended (an operator adds a box by command), state still open until it is in `main`.
