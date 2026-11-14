# Companies pooled on boxes, first landing, recap, 2026-11-14

Written before the landing on `pre-merge`.

| An operator adding a company | Before | Now |
| --- | --- | --- |
| Which box | the one box, no choice | a list of boxes with free disk and company counts, the home box chosen |

## What happened

A company's line now names its box (none means the home box). The back end reads the line on every call and serves the company from that box; a box it was not handed answers 503. The add-company form lists the boxes, the delete and the root password act on the company's own box, and `pnpm stack` runs a second box, `b2`. Item 246's scripts go through the company's client.

The review's findings:
- **High 1, fixed:** a sign-in try left a record on a wrong line's box, so the delete's check passed; it now reads the company's settings.
- **Medium 2, fixed:** `deleteClient` with no box swept the home box; it now refuses a line naming another, as do `copy-company` and `drill-record`.
- **Low 5, fixed:** the delete's body check comes before the box check.
- **Low 6, fixed here:** item 246 closed, the memo's sentence made true.
- **Lows 3, 4, 7, 8:** items 440, 441, 442, 443. The row-18 gap: item 445.

## Not built

A box added to ridge by command, and the move: later landings. 
## Still yours

- Point 1, the box list: answered yes on 2026-11-14, on the walk's screen 10, where each box's figures sit under a mask. Case 8's and the form's tests hold the figures.
- The reviewer's reread of the fix said may merge: both fixes close their findings, none added.
- The whole check on `pre-merge`, then `main`, then ridge. <!-- FILL: the verdict of each, not yet known -->

## Evidence

- Commits `0d2611f7` to `3f66324c` on `pooled-shape`, from `7b2319a4`.
- The whole gate ended green, coverage 100 % with no new hint.
- The walk run wrote 96 base pictures, every comparison green.
- The fix pass's gates, bff and scripts, ended green (705 and 463 tests).
- The citation test exited 0.
- `docs/products.md`: row F added, state open until it is in `main`.
