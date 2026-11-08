# The box keeps its disk: the three stack acts that delete the records are fenced

## At a glance

A deployment's records are one SQLite file on one box's root disk
(`ops/c-storage.service#L20`, `DB_PATH=/var/lib/c-storage/c-storage.db`). That disk is a property of
the box, not a resource of its own (`ops/env.yml#L111-L117`), it carries `DeleteOnTermination: true`,
and nothing in `ops/` or `.github/` holds a `DeletionPolicy`, an `UpdateReplacePolicy` or a snapshot —
the one retention setting in the tree is a log group's 14 days (`ops/env.yml#L173`). So any act that
terminates or replaces the box takes every record with it. The cheapest safe path is not the backup:
it is three lines of template and one refusal message, proved by the guards that already read
`ops/env.yml` as JSON (`ops/test.sh#L183-L223`), ending in one change set the human applies to ridge.
Price: one resource's attributes, one message, and cases beside the ones there.

**This piece does not make the records recoverable.** It makes three named losses survivable. The
copy, its restore and the proof that it is readable are a second slice, named below.

## The invariant

**No single act may leave a client's records with no copy anywhere** — and separately, something
other than a person's memory must prove a copy is current and readable. There are four ways the one
copy goes, and they do not have one fix:

| # | The act | Fenced by this piece |
| --- | --- | --- |
| 1 | A stack delete terminates `Box` | yes — `DeletionPolicy: Retain` |
| 2 | A change set replaces `Box` (an image or instance-type change taken with `--take Box`) | yes — `UpdateReplacePolicy: Retain` |
| 3 | The `ROLLBACK_COMPLETE` advice, "delete the stack" (`ops/lib.sh#L294`), read on a stack holding records | yes — 1 and 2, plus the message |
| 4 | A termination, a torn file, a bad write or a wrong delete *outside* CloudFormation | **no** — only a backup, and `DeleteOnTermination: false` for the termination alone |

Rows 1 to 3 are stack operations, which is the whole reach of both policy attributes: AWS's pages say
they execute on a stack deletion and on a replacement during a stack update, and name no act outside
CloudFormation. Row 4 is why the second slice exists, and why this plan does not claim recovery.

## What the open item asks for cannot be written

Item 6 (`docs/open-items.md#L44-L70`) asks for "a `DeletionPolicy`/`UpdateReplacePolicy` of
`Snapshot` or `Retain` on the volume". Both halves of that are wrong, and the plan follows the code
rather than the item:

- **There is no volume resource.** `Box` (`ops/env.yml#L94-L95`) is the only resource here; the disk
  is a `BlockDeviceMappings` entry (`#L111-L117`). A policy attribute attaches to a resource, so
  there is nothing for it to attach to. A separate `AWS::EC2::Volume` would support `Snapshot`, and
  making one replaces the box and moves `DB_PATH` — the act row 2 exists to refuse.
- **`Snapshot` on `AWS::EC2::Instance` is worse than nothing.** The snapshot-capable types are
  DocumentDB, `AWS::EC2::Volume`, ElastiCache's two, Neptune, RDS's two and Redshift; an instance is
  not among them, and on a type that cannot snapshot, CloudFormation "reverts to the default option,
  which is `Delete`". Written as the item asks, the attribute would read as protection in the template
  and delete the disk in fact. Row 3 of the case table is that mutant, kept forever.

`Retain` is legal on any type, so both attributes go on `Box`, and `DeleteOnTermination: false` goes
on the device: `Retain` stops CloudFormation deleting the instance, and the device property stops
*any* termination taking the disk, including one from the console, which neither attribute reaches.
Neither is sufficient alone, so both are in.

## The slice

One: `Box` gains `DeletionPolicy: Retain` and `UpdateReplacePolicy: Retain`, its root device gains
`DeleteOnTermination: false`, a `volume_guard` joins the template guards in `ops/test.sh`, and the
`ROLLBACK_COMPLETE` refusal stops telling a human to delete a stack that holds records. The runbook
gains the two recovery paths this creates — reading a retained box after a stack delete, and attaching
a left-behind volume to a new box — because an attribute that keeps a disk nobody knows how to read
buys nothing.

**Out, and why the split falls here.** The nightly copy, its restore and its drill are a second plan.
They are not one slice with this: the copy needs an S3 gateway endpoint in `ops/network.yml`, which
holds no endpoint today (`ops/network.yml#L21-L83`) and is the one stack every environment and every
client's stack imports from; a put-only instance role, which the template deliberately does not have
("no instance role", `ops/env.yml#L93`); a timer and unit on the box; a restore script run from the
human's terminal over the tunnel; and a drill beside `ops/drill.sh`'s rows. The readiness page already
prices the pair as "a day's piece, not an afternoon" (`docs/client-readiness.md#L233-L236`). The order
is this one first, on a reason that is not convenience: the backup piece's own change sets touch `Box`
for its instance profile, and nobody should put a change set near the box that holds the only copy
while a replacement still destroys it.

## The case table

| # | The case: one behaviour, one sentence | Held by |
| --- | --- | --- |
| 1 | A stack delete does not take the box: `Box` carries `DeletionPolicy: Retain` | `ops/test.sh` |
| 2 | A replacement does not take the box: `Box` carries `UpdateReplacePolicy: Retain` | `ops/test.sh` |
| 3 | `Snapshot` on `Box` is refused, because CloudFormation turns it back into `Delete` | `ops/test.sh` |
| 4 | Either attribute missing is refused | `ops/test.sh` |
| 5 | The root device is refused unless `DeleteOnTermination` is false, so a termination outside CloudFormation leaves the disk | `ops/test.sh` |
| 6 | Any second instance resource added later without both attributes is refused | `ops/test.sh` |
| 7 | The device is still gp3, encrypted, at its parameter's size | `ops/test.sh` |
| 8 | A rolled-back stack is still refused, and on an environment that is not ridge the line names the environment and what the box holds, and offers the runbook, not a delete | `ops/test.sh` |
| 9 | On ridge the line still offers the delete, ridge holding no records | `ops/test.sh` |
| 10 | A stack description naming no `Env` is treated as one that holds records | `ops/test.sh` |
| 11 | The change-set guard still refuses an unnamed replacement of `Box` | `ops/test.sh` (the row already there) |
| 12 | cfn-lint accepts the template with both attributes | the `ops` job (`.github/workflows/ci.yml#L198-L203`) — **not runnable here** |
| 13 | Applying the change set does not itself replace `Box` | the human's `ops/stack.sh env ridge --plan` — **not runnable here** |

Rows 1 to 11 run with no AWS, on hand-written input, as every row in that suite does. Rows 12 and 13
cannot: cfn-lint needs a pip install from the network, and the local `cfn-lint` on this machine is a
shim over a missing module. Row 13 is the only thing that can answer whether changing a root device
replaces an instance; it is read on ridge, which holds no records, before any client's stack carries
the change.

## Steps

| # | Step | Done when | Size |
| --- | --- | --- | --- |
| 1 | The cheap end-to-end build: the two attributes on `Box` and `DeleteOnTermination: false` (`ops/env.yml#L94-L117`), and a `volume_guard` beside the other template guards, through `tojson`/`must` (`ops/test.sh#L186-L223`) | `bash ops/test.sh` at exit 0 with the guard's `passes` row printing ok | 8 min |
| 2 | Rows 1 to 7 as mutants through `mut`, on the pattern of the throttle rows (`ops/test.sh#L389-L395`) | `bash ops/test.sh` at exit 0, each row seen red once, the mutation count printed | 10 min |
| 3 | The `ROLLBACK_COMPLETE` line (`ops/lib.sh#L294`) reads the stack's `Env` through `stack_param` and branches; rows 8 to 10 beside the row already pinning its text (`ops/test.sh#L84`), `described` extended to carry a parameter | `bash ops/test.sh` at exit 0, the three rows each red once | 6 min |
| 4 | `ops/README.md` gains the two recovery paths; item 6 corrected to what is legal and split, its backup half left open | the piece's own diff adds no local path (`git diff main...HEAD -U0 -- . ':!docs/plans' | grep -E '^\+' | grep -E '/Users/\|~/'` prints nothing; a whole-tree `git grep` never has, with 468 binary walk snapshots and four documents quoting the command matching before this piece) and `bash ops/test.sh` still exits 0. **A doc step: that grep is its only machine check, and the words are the reviewer's at step 6** | 5 min |
| 5 | The `ops` job's gate as CI runs it, less cfn-lint | ShellCheck 0.11.0 `-x ops/*.sh walk/*.sh` at exit 0 and `bash ops/test.sh` at exit 0, read back from the log's own exit line. **cfn-lint is named, not run: it is CI's or the human's terminal** | 4 min |
| 6 | One cross-model review, on a model other than the author's | A verdict line: may merge, or findings each carrying a line | 10 min |
| 7 | The fix pass on the findings | `bash ops/test.sh` at exit 0 again, each finding answered with its line | 5 min |
| 8 | 👤 The human's change set on ridge: `ops/stack.sh env ridge --plan`, then again without it | The plan's output names no change to `Box`. **If it names `Box` as a replacement the step stops**: that is the loss itself on a client's stack, and the piece reconsiders the device property | the human's |
| 9 | The recap, before the squash into `main` | The recap committed in `docs/recaps/`, item 6's fence half closed with its commit and its backup half left open | 3 min |

**Ticks.** Step 1 done 2026-11-08: `Box` carries both policies and `DeleteOnTermination: false`; `volume_guard` and
eight rows beside it (the pass, each attribute missing, `Snapshot` on each, the device deleted on termination
and with the setting absent, a second instance) in `ops/test.sh`, so rows 1 to 7 of the case table are held
already and step 2 adds only what is left of them. `bash ops/test.sh` exit 0 with the guard's row ok and
`shellcheck -x ops/*.sh` exit 0, from `logs/20261108-144249-ops-test-backup-policy-step1.log`
(`== exit 0 (ops/test.sh 0 shellcheck 0)`). The guard reddens on the attributes removed, on `Snapshot`, on
`DeleteOnTermination: true` and on the attributes turned into comments naming them. No fixture moved (no resource
was added). Not shown: that applying this does not replace `Box` (row 13, step 8) and that cfn-lint accepts it
(row 12).

Step 3 done 2026-11-08: `rolled_back_refusal` in `ops/lib.sh` reads `Env` through `stack_param`; ridge is told it
holds demo data and may be deleted (the box and disk stay behind, running and billing); any other Env, and a
description naming no Env, is told it holds records, that a delete would not destroy the retained box and disk but
would leave them outside any stack, and is pointed at the recovery paths in `ops/README.md` (step 4 writes them;
nobody has tried them). `described` takes a third argument, `Env`. Rows 8 to 10 sit beside the pinned row, which now
names ridge. `bash ops/test.sh` exit 0 and `shellcheck -x ops/*.sh` exit 0, from
`logs/20261108-144740-ops-test-backup-policy-step3.log` (`== exit 0 (ops/test.sh 0 shellcheck 0)`). Each mutation of
`lib.sh`, restored and `cmp`-verified, reddened its own rows: one message everywhere (records text; ridge text), the
branch inverted, and a missing Env falling to ridge's side (only the two no-Env rows red). Not shown: that the
README's recovery paths exist (step 4) or work.

Step 4 done 2026-11-08: `ops/README.md` gains "Reading what the fence kept" (a retained box, a left-behind
volume), every step marked untested where the repository cannot show it; item 6 retitled, split (fence half built and
awaiting the merge and step 8, backup half open, "no copy of any client's records") and its `Snapshot`/"on the
volume" ask corrected; item 4's list no longer claims an S3 endpoint; the rollback citation moved `#L276` to `#L294`
in item 6 and `docs/client-readiness.md` (the line `ROLLBACK_COMPLETE) die "... delete the stack ..."` is line 294 in
`git show 88596afd:ops/lib.sh`), and the `ops/env.yml` device citation to `#L118-L124`. Check: the diff of this commit
adds no match of `git grep -nE '/Users/|~/'`; the tree's own matches are the convention's and two plans' quotations of
that command and 468 binary walk snapshots, all there before (step 5 corrected the done-check above, which
had claimed the whole-tree grep prints nothing). `bash ops/test.sh` not run (another agent's suite).

Step 5 done 2026-11-08: the `ops` job's gate as CI runs it, less cfn-lint (named, not run: CI's `ops` job is its
verdict), on the tree as it stood with steps 1, 3 and 4 together and `main` merged in (HEAD `3d4ac5f3`), load 7.89 at
the start, the gate lock taken and released from a trap and read free after. ShellCheck 0.11.0 `-x ops/*.sh
walk/*.sh` exit 0, `bash ops/test.sh` exit 0 ("all checks passed"), and, since step 4 changed documents and prettier
covers the whole repository, `pnpm exec prettier --check .` exit 0 run on its own; from
`logs/20261108-145303-ops-gate-backup-policy-step5.log` (`== exit 0 (shellcheck 0 ops/test.sh 0 prettier 0)`).
Nothing retried. Step 4's done-check corrected: the whole-tree `git grep` never printed nothing (468 binary walk
snapshots and four documents quoting it); it now asks that this piece's diff add no local path, which holds.

**51 machine minutes**, the review and the whole gate among them, plus the human's step 8. Each size
is the minutes the same shape took in its last rows of the task ledger: a guard built into a shell
script 8, its cases 8 to 14, a small cases step on `ops/test.sh` 3 to 6, a doc step 5, the ops gate 4,
an Opus review 10 to 12, a fix pass 5, a recap 3.

## What is proved where

- **Here, by a command:** every attribute and property of the template, through the suite that reads
  `ops/env.yml` as JSON; every mutant of them; the refusal message's two branches. Rows 1 to 11.
- **Only on a real stack:** that CloudFormation accepts the template (cfn-lint, row 12) and that
  applying it does not replace the box (row 13). Both are step 8 or CI, neither is the sandbox's.
- **Only reasoned, and written down as such:** that a retained box or a left-behind volume can
  actually be read afterwards. The runbook says how; nobody has done it. The first real recovery is
  the second slice's drill, and until it runs, this piece's claim is "the disk is still there", never
  "the records come back".

## The human's points

**1. What a fenced loss costs on the bill, at step 1.** After this, a deleted stack leaves its box
running and a terminated box leaves its disk behind, and both keep billing until someone removes
them — the disk is pennies a month at 8 GB, a retained `t4g.nano` a few dollars. **Yes** accepts
paying for wreckage you can still read from. **No** means `Delete`, and a slip takes the records.

**2. What this piece does not buy, at step 1.** There is still no copy of the records when it ends. A
stack delete, a replacement and a hand-terminated box stop destroying them; a torn file, a bad write
or a wrong delete inside the database are still unrecoverable, and nothing yet proves any copy is
readable. **Yes** takes the fence as its own piece with the backup next. **No** means hold it and
build both together, which is the day's piece the readiness page prices.

**3. The change set on ridge, at step 8.** Only a real `--plan` says whether changing a root device
replaces the instance; no local read can. ridge holds no records, so it is the free place to find
out. **Yes** means you run those two commands and read the one line about `Box`. **No** means the
template change sits in `main` unapplied, and ridge keeps the old box until you choose.
