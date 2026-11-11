# The architecture page on routing, recap, 2026-11-11

Written before the merge into `main`. <!-- FILL: merge sha and the merge's time, when it lands -->

## What happened

Until now the architecture page did not say how a call finds its tenant's storage box. It now does, in two parts of [`docs/architecture-detail.md`](../architecture-detail.md#how-a-call-finds-its-tenants-box). **Built today:** an environment is one stack with one box and every tenant in it, so a call finds its tenant and never its box. **Intended, not built:** the pooled shape, tenants grouped about twenty to a box, all in the environment's one stack, a routing record that names the box and never holds a key, and each tenant at its own name on one distribution. [`docs/architecture.md`](../architecture.md) gains one dashed box in its diagram and one sentence in the walk.

Documents only: eight files, no code, template or workflow. The two memos for the BFF and c-storage, the activity log, open item 4, and one phrase in the collaboration convention that equated production with a client's own stack were brought in line. Two reading notes (open items, client readiness) say that "a client's stack" in a waiting trigger now means the first stack holding a real tenant's data.

## What the next session would otherwise re-learn

- **The pooled shape is written as intended on the human's request, not decided by a test.** The piece file records that the request was read as a yes to it; a no turns the part into a proposal.
- **The old pages were not re-read against the new shape.** The client-readiness note says so itself.
- **Five line citations were removed, none replaced,** all in `docs/architecture-detail.md`: the links to `ops/seed.sh` and `ops/env.yml`, and three bare ones (`#L181`, `#L5`, `#L68`). The commit message says four; the diff shows five.

## Open looks

- The human's look at the architecture page, asked after the merge. <!-- FILL: the look's answer; strike this line when it comes -->
- The pooled shape stays open to the human's one-word veto. <!-- FILL: the veto or its absence -->

## Evidence

- Commit `78644b95` on the trunk at `c52658ba` (`git merge-base main HEAD`); diff 8 files, 254 insertions, 26 deletions.
- Scripts gate, log `2026-11-11-113027-gate-scripts.log`: 37 test files, 411 tests passed, coverage 100%, typecheck, eslint, prettier, knip 0, last line `== exit 0`. Not covered there: c-storage's own gate.
- Citation test run alone on this tree (20 tests passed): 22 living documents, 204 named citations, 234 line citations left, 0 red.
- No row in [`docs/products.md`](../products.md) changes: it lists what a partner or an operator can do, and this piece adds none.
