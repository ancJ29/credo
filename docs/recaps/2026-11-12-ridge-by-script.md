# Ridge deploys when you press, recap, 2026-11-12

Written before the landing on `pre-merge`; the first of two landings of "Nothing in ridge made by hand".

| When | You | What happens |
| --- | --- | --- |
| landing | push `main` | the push deploys by itself, as before |
| then | press **Run workflow** on `ci`, on `main` | the four gates, then the same deploy job |

## What happened

`ci` gained a manual trigger, and its deploy job now admits a push or a press on `main`. Nothing else had to change: the deploy scripts never read the event, and the role's trust names the environment. A press on a tip already deployed releases it again.

The workflow's check now refuses a deploy job that admits a pull request or lets no press through. Fourteen line citations in four living documents now name jobs and quoted steps, and five sentences that said only a push deploys were fixed.

## What was rejected

A workflow file of its own for the press: it would copy the four gate jobs and drift. The push's own deploy stays.

## Still yours

- The `act` run before the push. <!-- FILL: the act run's verdict in words -->
- The push. <!-- FILL: GitHub's run on the landing push, in words -->
- The first press. <!-- FILL: the press's run in words: the role taken, main's tip released, the check through the app's address -->
- The plan called the press the deploy job's first run onto the re-up's role. It will not be: the landing push touches deploy paths and deploys first.
- The demo copies by script are the second landing. No look of this landing is open.

## Evidence

- Base `c077ec86`; step `482a8365`, merge `9500df73`, fix pass `a0c58b59`.
- `ops/test.sh`, ShellCheck, `actionlint` and the citation test ended green at the step and again after the fix pass. The refused pull request reddens on a fixture only.
- Review on another model: one High outside the commit (the piece file's `act` line lacked the flags that keep keys out of the containers; a one-off script replaces it), one Medium and five Low, all fixed; its reread says it may land. One Info, item 325.
- `docs/products.md`: the CI and ridge's deploy row says a press as well as a push.
