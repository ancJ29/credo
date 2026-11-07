# A picture run notices when its browser is taken from under it

## At a glance

Playwright keeps one browser folder a machine and, in its `.links` subfolder, one claim file an
installation; an install deletes every browser no surviving claim names. On 2026-11-07 a 12-walk run
started at 12:33:11 on `Playwright 1.64.0, Chromium r1248`; a minute later an unrelated project here
ran its own install; this repository had **no claim registered**, so the browser the running walks
were using was deleted under them. The run printed 153 identical `Executable doesn't exist` failures
across every lane of both passes — each stack lane rebuilding c-storage and the UI for three minutes
before dying — and named nothing of the cause. This piece makes a run **notice, in one line naming
the prune**, and registers the claim so an outside install finds nothing unclaimed. Hole 2 of the
three, pinning the revision, is **not built**: a priced recommendation at the end.

The cheapest safe path is what exists: the executable path and revision the run already reads
(`walk/run.sh#L264-L271`), the `pass_of` funnel and the way its gate-lock return is read
(`#L350-L353`, `#L486-L495`), and the stand-in harness that runs the whole script with no browser
(`scripts/src/walk-run.test.ts`). **Price:** about 39 machine minutes, no run of the human's Mac, one
command of the human's.

## The slice

A run that loses its browser says so in one line, and the claim lives where it cannot die with a
worktree. Decided:

- **The re-check is per pass.** `pass_of` (`#L347-L374`) is the one funnel for every browser pass —
  the fakes, `full-1`, `full-2` — and the three minutes a stack lane spends building c-storage and
  the UI happen *inside* it, after the check would run. One `[ -e ]` on the two paths read at
  `#L264-L270` stops the loss at the first pass after a prune; the pass returns as the gate lock's
  does, and the outer part ends the run red, naming the path, the revision and the command that
  restores it. The check runs once more after the lanes join, before the raw count, so a prune during
  the *last* pass labels the reds already collected instead of reading as moved pixels. *Rejected:* a
  Playwright fixture per walk or per test — another process, a change in `walk/`, and it buys only
  the tail of a pass already covered. *Note:* `ops/full-run.sh`'s run 2 is `--bytes`, files only, no
  browser (`#L199`), so "between run 1 and run 2" needs nothing of its own.
- **The claim's home is the trunk's own `node_modules`.** A claim file is named `sha1(<path>)` and
  holds that path; Playwright reads each one, `require`s `<path>/browsers.json`, keeps every revision
  it names and deletes the rest — read in the installed `playwright-core@1.64.0` and checked against
  the live folder, where this repository's only claim today points into a **piece worktree**, so it
  dies at that worktree's deletion and takes the protection with it. The trunk is the one worktree
  never deleted, and its `playwright-core@1.64.0` names r1248, the revision every base was drawn on.
  Both paths are derived, never written down: the trunk from `git worktree list --porcelain`,
  `@playwright/test` resolved from its `walk` and `playwright-core` from there — the exact string
  Playwright hashes; the browser folder from the executable path, as `#L269` already slices it.
- **`walk/run.sh` registers it at 1/6 and refuses if it cannot.** One file through a temp name and a
  `rename`, so a concurrent install never reads half a claim; nothing downloaded, nothing pruned. If
  the trunk's `browsers.json` is unreadable or names another revision, the run refuses in seconds
  with the one command to install there: better to lose a second than 16 minutes on an unprotected
  browser. *Rejected:* a warning — read after the run has died. *Rejected:* a `postinstall` hook,
  which would make every agent's install write a folder the sandbox denies.
- **The piece moves no base picture, shown without running the walks.** Nothing it touches is read by
  a screen's markup, its styles or `versionOf` (`visual/src/capture.ts`): the diff is `walk/run.sh`,
  `scripts/src/` and this page, and `git diff --stat main...HEAD` names no `.png` and nothing under
  `ui/`, `visual/` or `walk/specs/`. On a green run the guard adds one header line and one `[ -e ]` a
  pass, which row 5 holds.

## The case table

| # | The case: one behaviour, one sentence | Held by |
| --- | --- | --- |
| 1 | A pass whose browser is gone before it starts does not start, and the run ends red naming the prune | `walk-run.test.ts` |
| 2 | A browser taken between two passes leaves every base picture as it was, exit 1 | `walk-run.test.ts` |
| 3 | A headless shell folder gone, the executable still there, is named the same way | `walk-run.test.ts` |
| 4 | A browser taken during the last pass is named in the verdict, before the raw count | `walk-run.test.ts` |
| 5 | A run whose browser stays in place runs every pass and takes the same pictures as before | `walk-run.test.ts` |
| 6 | The red names the executable's path, its revision and the command that restores it | `walk-run.test.ts` |
| 7 | The claim for a `playwright-core` path is the file named by its sha1, holding that path | `claim.test.ts` |
| 8 | A claim already registered for that path is left as it is | `claim.test.ts` |
| 9 | The claim is written through a temp name and a rename, never in place | `claim.test.ts` |
| 10 | A claim folder that cannot be written is said in one line, and nothing else is tried | `claim.test.ts` |
| 11 | A run refuses before any pass when the trunk's `browsers.json` names another revision | `walk-run.test.ts` |
| 12 | A run refuses before any pass when the trunk has no readable `browsers.json` | `walk-run.test.ts` |
| 13 | A green run's header names the claim it registered and the revision it protects | `walk-run.test.ts` |
| 14 | An outside install leaves the claimed browser alone — **not held here** (the unknown, below) | the next outside install |

## Steps

No screen here, so the first build is the guard working end to end in the stand-in run. Each commit:
the touched package's gate, `shellcheck -x walk/run.sh`, the step's rows each seen red once.

- [ ] **1. This plan.** Opus, 9 minutes (the kind's last runs, 7 to 11). Done: committed, about
  2,080 words of `wc -w` — over the conventions' ~1,000, as every merged sibling is (1,321 to
  1,993), with about 115 of it the fourteen-row table's pipes, and one tightening pass taken.
  `prettier --check` inspects nothing here — `.prettierignore` excludes `*.md` — so the page is held
  by `wc -w` and a read.
- [x] **2. The re-check.** 15 minutes. Built: `browser_gone` and the per-pass check in `pass_of` (a pass stops with 5), one naming line after the lanes join, a first red in the verdict; five cases in `walk-run.test.ts` (rows 1 to 4 and 6 red without the guard, row 5 is the stays-in-place run), `scripts` gate 292 tests, 100 %, `shellcheck -x walk/run.sh` clean. Done: rows 1 to 6, each seen red first, in
  `cd scripts && npx vitest run src/walk-run.test.ts`; `shellcheck -x walk/run.sh` clean. **The
  rehearsal of the failure is row 2's own test:** the harness's shimmed browser, a file in the test's
  temp folder, is removed between two passes of a run of the real `walk/run.sh`, and the output is
  read for the one line naming it. **Nothing touches the machine's real browser folder** — the
  sandbox cannot write it, and a test that did would break every project here: the path under test
  comes from the harness's `node` shim (`walk-run.test.ts#L141`), and `#L90` already unsets
  `PLAYWRIGHT_BROWSERS_PATH`.
- [x] **3. The claim, registered and kept** (point 1). 15 minutes. Built: `scripts/src/claim.ts` (`trunkOf`, `claimName`, `registerClaim`), a `claim` command in `walks.ts`, called from `walk/run.sh`'s 1/6 (so also under `--checks`) before the header, which now prints the claim's line; rows 7 to 13 in `claim.test.ts`, `walks.test.ts` and `walk-run.test.ts` (row 9's end state is not observable by a test: a draft then rename and a write in place leave the same folder, so it is held by the draft sitting outside `.links` and being gone after). Departure: a run with the claim absent writes it from a terminal that can (the sandbox cannot, and says so in one line with the command); with it present the run only reads. `scripts/src/claim.ts` beside
  `strays.ts`, a `claim` command in `walks.ts`, called from `walk/run.sh`'s 1/6 and covered by
  `--checks`. Done: rows 7 to 13, each seen red first, in
  `cd scripts && npx vitest run src/claim.test.ts src/walk-run.test.ts`; `scripts` at 100 %.
- [ ] **4. One review.** Another model than the builder's, correctness only, at a fixed sha. 8
  minutes; each finding fixed, rejected or deferred with its reason.
- [ ] **5. The whole check on the merge result.** 12 minutes. `main` taken in, then
  `pnpm check`, its five steps named: typecheck, eslint, prettier, the tests, knip. Done: exit 0, and
  `git diff --stat main...HEAD` naming no `.png`.

The record sizes the piece at 45: steps 1 to 3 are 39 of it, and the review and the whole check add
20.

## The human's points

**1. The claim registered today, in your terminal** (step 3). The sandbox cannot write Playwright's
browser folder, so the claim that protects today's runs has to be written once by you, by a command
that writes one small file: no install, no download, nothing pruned. Until it exists, this
repository's only claim on the machine points into a piece worktree that will be deleted at its
merge, and the next outside install takes the browser again. A yes closes the hole today; a no leaves
step 2's guard as the whole protection — a run still dies, but it says why in one line.

**2. Hole 2, pinning the revision** — the recommendation below, with its price. Giving this
repository a browser folder of its own would end the sharing for good and need no agreement with
anyone, but it is replacing a guard that protects every base picture, and it costs re-approving every
base by hand. A yes opens it as a piece of its own after this one merges; a no leaves this repository
sharing one browser folder with whatever else installs Playwright here, with step 2's guard and step
3's claim as the protection.

There is no look here: this piece changes nothing a partner, a client or money sees, and the property
it must prove about itself — that no base picture moves — is read from the diff, not from a picture
(the slice's last point).

## Hole 2 — the recommendation, not built here

`PLAYWRIGHT_BROWSERS_PATH` is deliberately `unset` by both run scripts (`ops/full-run.sh#L85`,
`walk/run.sh#L90`) so a stray value cannot point a run at another browser build: every base picture
here was drawn on one build, and a different one moves screens nobody touched. Replacing that unset
with a **set** to one path this repository owns would end the sharing and need no agreement with
anyone — but that is replacing a guard, not setting a variable, and the price is **re-approving every
base picture by hand**, since the first run on the new path draws on a browser nothing here was drawn
on. Another piece's picture run is in flight now. Recommendation: a piece of its own after this one
merges, scoped to the two scripts, whatever documents how bases are made, and one full run of the
twelve walks with `--moved all`.

Two levers verified in the installed 1.64.0, so nobody re-derives them: `playwright install
--no-remove` and `PLAYWRIGHT_SKIP_BROWSER_GC` each govern only the install that passes them — they
stop *our* installs taking a neighbour's browsers and never stop a neighbour's taking ours, the other
side running 1.59.1, which predates the flag. *Rejected:* pinning this repository and that project to
one Playwright version: both would want the same build, but it locks two unrelated projects together
forever and breaks the day either upgrades.

## The one thing unknown

Until 13:14:57 on 2026-11-07 this repository had no claim at all, which fully explains the 12:34
deletion. **Whether an outside install now respects the claim we have is untested, and this piece
cannot test it.** The installed library's code says it should: a claim is honoured when
`require(<its path>/browsers.json)` resolves, our path is a plain directory any process can read, and
the neighbour's claim was a path inside a yarn-PnP zip no npm or pnpm process can resolve — which is
why theirs was read as stale and the browser it claimed pruned. If that reading holds, hole 3 alone
is the whole fix and the re-check is a diagnostic rather than a shield. It is still worth its 15
minutes: a claim can be lost again — a worktree deleted, the trunk reinstalled, an `uninstall --all`
from any project — and the diagnostic is what would have turned 90 minutes into one line. **The step
that settles it is the next outside install:** with the claim registered, the browser survives it and
the run's header says the claim was there (row 14). Rehearsing the prune itself needs another
project's install, and doing it against the machine's real browser folder would break every project
on it.
