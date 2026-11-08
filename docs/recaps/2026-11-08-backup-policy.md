# The box keeps its disk, recap, 2026-11-08

## What changed, and what did not

Three named losses became survivable: a stack delete, a replacement of the box (`--take Box`) and a termination outside CloudFormation. `Box` now carries `DeletionPolicy: RetainExceptOnCreate` and `UpdateReplacePolicy: Retain`, its disk `DeleteOnTermination: false` (`ops/env.yml#L105-L106`, `#L128`), and a guard in `ops/test.sh` reads all three from the parsed template, each refusal seen red. The runbook gained how to read what was kept (`ops/README.md`, "Reading what the fence kept").

**This is not "backup: done". There is still no copy of any client's records.** A termination by a person, a torn file, a bad write and a wrong delete inside the database are as unrecoverable as before.

## What it cost, and its real history

Three rounds, each finding the previous round's confident sentence untrue:

- The item's own ask (`Snapshot` or `Retain` "on the volume") was unwritable: the disk is no resource, and `Snapshot` on an instance is reverted to `Delete` per AWS's page, so it would have read as protection and deleted the disk.
- The review found the `ROLLBACK_COMPLETE` refusal built on a status that only follows a failed (or cancelled) creation, so most of that step was reverted, not mended.
- Plain `Retain` would have stranded a client's first failed deploy behind its own retained network interface, so the value became `RetainExceptOnCreate`.

The reread then found the fix pass had broken the citation it repaired; fixed here, every line number the piece carries re-read at its target.

## Still open

- The human's change set has not been run on ridge (`ops/stack.sh env ridge --plan`, then without it), so whether applying it replaces the box is not known.
- cfn-lint has not run locally; CI's `ops` job is its verdict.
- No recovery path has ever been tried; the runbook's are marked untested. A rolled-back creation's empty root disk is left behind, reasoned and not seen.
- The second slice, the copy, the restore and the drill, is not built. Item 6's backup half stays open (`docs/open-items.md`, item 6); its fence half closes with this commit.

## Evidence

Plan `docs/plans/2026-11-08-backup-policy.md`, steps ticked with their logs; review verdicts there. `docs/products.md` unchanged: its rows say what an operator or partner can do, and nothing visible moved.
