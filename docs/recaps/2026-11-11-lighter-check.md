# The lighter check, recap, 2026-11-11

Written before the landing on `pre-merge`, the first piece to land there. <!-- FILL: the landing's sha and time, and the day `main` reaches this recap -->

## What happened

You said the check run slowed development, and asked for a `pre-merge` branch, the check run there, and at most once in two hours. Yesterday's 70 checks were measured first: 18 were red, and only one of the 18 needed the combined tree; the other 17 were caught by the piece's own checks. Run the new way, the day would have had 6 whole checks instead of 28, about 160 minutes instead of 358.

The rule is now in `main`: a finished piece lands on `pre-merge`; its quick check at each commit is the touched package's check plus the citation test; the whole check runs on `pre-merge` at most every two hours, only if it has moved; a green moves `main` to the commit it checked ([QA](../conventions/qa.md#the-whole-check-on-pre-merge)). Four conventions changed and open items 223 to 226 were filed.

## What the next session would otherwise re-learn

- **The quick check keeps the package's whole check.** "Its touched tests" alone would have let 12 of the 18 reds onto the shared branch.
- **The price is a wait.** A finished piece sits on `pre-merge` about an hour, at most an hour and three quarters on yesterday's replay, before `main` holds it.
- **The citation test takes about one second.** The research page timed it at 269 ms in vitest. Step 2's own runs are in no commit message.
- **The orchestrator's skills followed in `orch`.** Eight skills and the template were brought in line; the conventions skill was drained first, 44 entries, and a send of it reads 1,765 words where it read 4,255.

## Still yours

- The sync line that copies the skill mirror into `.claude/`.
- `main` reaches this recap only at the next whole check on `pre-merge`.
- No look of this piece is open.

## Evidence

- Base `92d54dc3`, the conventions change.
- Research: commit `1782c681`; conventions: `92d54dc3`; mirror: `b3a7da65`; drain: `14d34497`.
- No gate ran under this piece, so no log. The citation test, run alone in this worktree: 1 file, 20 tests passed, 236 ms in vitest.
- `docs/products.md` changes no row: a rule for how we work adds nothing a partner or an operator can do.
