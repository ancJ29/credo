# A refused change set names its own cause, recap, 2026-11-08

## What happened

When `ops/stack.sh` refuses a change to a deployed environment, the change set is deleted on the way out, so the script's printed lines are the only record. Today a refusal on ridge printed the resource and the word `Conditional` and nothing about which property caused it; finding out cost a 186-line memo (`docs/plans/2026-11-08-backup-policy-conditional-memo.md`). Two warnings an operator reads just before an irreversible act were also untrue or misleading.

## What was done

| Change | Where | Now |
| --- | --- | --- |
| Each change prints one line per detail: attribute, name, whether it requires recreation, evaluation | `ops/stack.sh#L226`, before the deletion in `cleanup_extra` (`ops/stack.sh#L85`) | A refusal names its cause |
| With `--take`, the verdict says what was let through | `ops/stack.sh#L237-L241` | `ok nothing unsafe except what was taken: Box`; it used to say there was no removal and no replacement to an operator who had just authorised one |
| A blank `--take ''` is a usage error | `ops/stack.sh#L44-L45` | It used to print a verdict naming nothing, a blank authorisation reading as an authorisation |
| A bullet for a refused `--plan`; the guard filter's header comment rewritten | `ops/README.md#L76-L80`, `ops/unsafe-changes.jq#L1-L9` | The comment now says the app keeps reaching the old box until the next deploy, so the hazard is a push before a reseed |

The filter's logic is untouched: its lines other than comments are byte-identical to the merge base's (compared with `cmp` on the comment-stripped files).

## What the review found that no brief claimed

At the merge base the suite's stand-in answered every run with "no changes" (`ops/test.sh#L2484-L2485` at `d0d2136d`), so `ops/stack.sh#L222-L246` (the change print, the guard call, the `REFUSED` block and the verdict) was never executed by any check. This piece gives that branch its first run, in new rows and one fixture (`ops/testdata/changeset-nodetails.json`). Until now the code that decides whether an irreversible change is waved through was only read by a person.

## A trap kept

`ops/stack.sh#L44-L45` is order-dependent. `[ $# -ge 2 ] || usage` must stay above `[ -n "$2" ] || usage`: under `set -euo pipefail` (`ops/stack.sh#L11`) the reverse turns a final `--take` from a usage message and exit 2 into `$2: unbound variable` and exit 1. The reviewer measured both orders. No check holds the order yet: item 157.

## What this is not

It changes no behaviour of the app and protects no data. It makes a refusal legible and two warnings true.

## Remains

- **157** (Low, filed here): the blank-`--take` rows pin the symptom, not the order of those two lines.
- Nothing waits on the human. The next `ops/stack.sh` run against ridge needs this on `origin/main` first, or its own guard refuses on our commit.

## Evidence

- Commits: `b2d5de9b` (the four wordings), `47c1df0a` (the fix pass), on merge base `d0d2136d`.
- Review (another model): may merge, no findings. `ops/README.md` and `docs/products.md`: the row for the ops scripts says what an operator can do, and none of that changed, so no row moves.
