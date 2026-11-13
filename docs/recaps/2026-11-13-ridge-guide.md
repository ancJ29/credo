# A guide-book for ridge's operations, recap, 2026-11-13

Written before the landing on `pre-merge`.

| To run ridge alone | Before | Now |
| --- | --- | --- |
| Deploy, check, take down, bring back, operator, demo copies, restore | the runbook, step by step | `docs/ridge-guide.md`, copy-and-paste blocks |

## What happened

The page has the quick start's shape, for you: an opening, a once-only list, nine numbered acts each a block and the line under it, and a closing list of what has not run. The runbook stays the authority. Every command was read in its script by its author, and again by a second model.

The second read fixed two faults that mattered: the demo copies' go-on rule had lost the runbook's exception (a stop inside the fill asks for the whole run again), and Go and `jq` were missing from the tools. Six small wordings were fixed too. A third commit linked the page from `docs/README.md` and the runbook, gave the pull its block, added "do not run while the seed runs" to the demo copies and the root password, and put a bold line over the delete of six copies. The page joined the living list in `scripts/src/citations.ts`.

## What was rejected

A block for a `main` ahead of GitHub: that fix is a push, which is yours, so the page says so.

## Not yet run on the real ridge

The page's closing section names them: the demo copies' remake and the root password (steps 6 and 8), the restore (step 9), and the first press of the workflow button (step 1).

## Still yours

- Your read of the guide: does each act read as something you could run alone, Friday night or Monday morning. <!-- FILL: your answer, not yet known -->
- Item 395: two slips outside the page, the demo remake's step labels and a runbook sentence on the seed's last line.

## Evidence

- Commits `497dd197`, `899b8409`, `3c224577`, on `pre-merge` at `c1b033ef`.
- The one check run was the citation test, in the agents' terminals, ended 0; no log was saved.
- The package gate for the one code line: <!-- FILL: the package gate's log name and exit -->
- `docs/products.md`: no row changes; it lists what a partner or operator can do, and the page adds no act.
