# Ridge comes back by a scripted path, and the running machine is read

## At a glance

Ridge, the shared pre-production environment, was destroyed on 2026-11-08. Until it is back, a
piece's last delivery stage is its visual report, and nobody outside the two readers of this repo
can check a piece without reading its code. This piece brings it back **from `main` by commands
that already exist in `ops/`** — nothing new is designed, and the only scripts written are the two
multi-step hand-offs and one reading. Then it reads four facts **off the running machine**: the
box and its disk fence, the environment check's verdict, the sweep of stranded check clients, and
the access log's own lines. The reading is the done check, not a formality: on 2026-11-08 five
pages said the disk fence had not been applied, and the run they described had applied it three
minutes earlier. The price: about 40 machine minutes, plus GitHub's and AWS's own, which are the
clock's not the machine's. The demo copies, the operator and anyone checking a piece without the
code are **not** here — they are C2 and C3.

## The slice

One slice, walkable when it ends: the three workflows are on, ridge's stack exists, the app of
`main` is on it, and six readings off the live environment say so. Walkable means the human opens
the app's address and reaches the sign-in screen; it is not yet usable, because no demo copy and
no operator exist until C2.

What is **not** in this slice, said so it is not pulled in: the six demo copies and the operator
coming back **by script instead of by hand** (C2, which `ops/seed.sh` records as never measured),
and a non-coder checking a piece on ridge (C3). Neither of the human's two open decisions — how
fresh ridge must be, and item 157's fourteen-day retention of callers' addresses — gates anything
below, and this plan asks neither.

## What is read off the live machine, and what the answer must say

A claim about an environment is a claim about something no session here can see. Each row is one
live read; a template's claim never satisfies a row.

| # | What is read | From where | The answer must say |
| --- | --- | --- | --- |
| 1 | the three workflow states | `gh workflow list --all`, **after** the enable, not the enable's own exit | `active` for `ci.yml`, `seed.yml` and `walks.yml` — three of three, each named |
| 2 | that the stack run reached its secret step | `ops/stack.sh`'s own log: the step at `ops/stack.sh#L291` and the read-back at `#L305` | `environment ridge holds secrets … AWS_ROLE_ARN`. Absent — or the die at `#L284`, "the box never answered through the endpoint" — means GitHub's secret still holds the **destroyed** role and every deploy fails at the role exchange. Then: run the same command again (it is an update and reaches the secret step) |
| 3 | the box and its root-disk fence | `aws ec2 describe-instances` on the live instance tagged `Env=ridge`: the `/dev/xvda` mapping's `Ebs.DeleteOnTermination`; then `describe-volumes` for anything unattached | one running instance; `DeleteOnTermination` **false** (`ops/env.yml#L128`); the unattached list empty. `DeletionPolicy: RetainExceptOnCreate` and `UpdateReplacePolicy: Retain` (`#L105-L106`) are CloudFormation's own and **cannot be read off the instance**: they are read from the live stack's template and reported as the stack's answer, never as the box's |
| 4 | the environment check's verdict | `ops/check.sh ridge`'s own log | `== green`, and step 7, "through the app's address", **not** `skipped` — skipped means the stack holds no layer four and the app is not really up (`ops/check.sh#L157-L159`) |
| 5 | the sweep of stranded check clients | the same log, the line `ops/check.sh#L167` prints | an `ok` line from `clear-checks` — **not** the `WARN` of `#L169`. On a fresh ridge the count is expected to be **zero**, and that is the proof: the command path ran and was authorised. A green here does not mean anything was deleted, and a reader who expects a deletion will misread it |
| 6 | the access log's own lines | the 2026-11-08 access-log one-off, re-run unchanged against the **new** address: three marked requests through `/api/`, then `aws logs filter-log-events` on `/aws/apigateway/credo-ridge` | `== lines of this run: 3`, each line carrying all ten fields of the format at `ops/env.yml#L297`, and the secret-shape search at 0 |

Rows 3, 5 and 6 are each a first real run on a live ridge: the fence, the sweep (merged this
morning, recorded `not live`) and the access log have all three only ever been read in `main`.

## The steps

Each step's check is the machine's. Every live act is a command for the human's own terminal: no
credentialed cloud CLI runs in this sandbox by design, so nothing below is run here, and the
machine's work is writing the hand-offs and reading their logs whole afterwards.

- [ ] **1. The workflows-on hand-off** — one script, `$ROOT_DIR/one-off/<stamp>-ridge-workflows-on.sh`:
  the three `gh workflow enable` calls recorded in the teardown's log, then its own read-back of
  all three states. It writes on GitHub only and touches no AWS resource and no workflow file.
  *Done when:* `bash -n` and `shellcheck` are clean, and the run's log reads row 1. **~5 min.**
- [ ] **2. The stack, in two hand-offs** — no script: both are single `ops/` commands. First
  `ops/stack.sh env ridge --plan`, which the human reads; then `ops/stack.sh env ridge`, which
  makes the box, the function, the API, the bucket, the distribution and the deploy role, and
  rewrites GitHub's secret. *Done when:* the machine reads the run's log whole and it reads row 2.
  **~10 min** of the machine's; the run itself is about 5 of AWS's, longer if the endpoint is slow.
- [ ] **3. The release hand-off** — one script, `<stamp>-ridge-release.sh`, calling `ops/release.sh
  ridge` then `ops/app.sh ridge` with the environment they need, each tee'd. It calls the `ops/`
  scripts with parameters and copies no line of them. *Done when:* `bash -n` and `shellcheck`
  clean, and the log ends on its verdict with both scripts green. **~8 min.**
- [ ] **4. The environment check, its own hand-off** — `ops/check.sh ridge`, alone, because it
  reads what step 3 left behind. *Done when:* the machine reads the log whole and it reads rows 4
  and 5. **~5 min.**
- [ ] **5. The live reading** — one script, `<stamp>-ridge-live-read.sh`: the box and its fence and
  the unattached volumes, the live stack's two template policies, then a call to the existing
  access-log one-off **by path, unmodified**, so that reading is re-run and not re-written. Reads
  only; it changes nothing on AWS. *Done when:* `bash -n` and `shellcheck` clean, and its log reads
  rows 3 and 6. **~10 min.**
- [ ] **6. The recap** — `docs/recaps/2026-11-09-ridge-reup.md`, carrying the six readings as its
  evidence and the new address's consequences, and keeping this piece's row in `docs/products.md`
  true. *Done when:* committed, and `git grep -nE '/Users/|~/'` finds nothing in the commit.
  **~8 min.**

## Where the seams between hand-offs fall, and why

A command that writes and a command that then checks the write are two hand-offs, never one `&&`
chain, because the second reads what the first left behind. Applied here, the seams are: between
step 1 and step 2 (the workflows must be on before anything that needs the deploy or seed jobs);
between `--plan` and the create, which is the human's own decision point; between the create and
step 3, because a stack run that died before its secret step must be re-run rather than released
onto; between step 3 and step 4, which is the rule's plainest case; and between step 4 and step 5.

A script's **own** read-back of its **own** write is that script's receipt, not a second hand-off —
which is why steps 1 and 3 each end in a read. The seam falls where a *different* fact is read, by
a command that must be able to refuse. The teardown's own script set that precedent on 2026-11-08
and its GitHub half was read back inside it.

## The human's point, at the end of step 5

**Ridge is back, and here is what the running machine itself says.** You will get one page: the
three workflows read back as on; the box up with its root disk fenced against termination; the
environment check green through all seven steps, including the walk through the app's own address;
the sweep of stranded check clients reporting zero, which is the right answer on a fresh
environment and proves the path runs; and three access-log lines the gateway wrote for three
requests made a minute earlier, with all ten fields. **The one question: does that read true as
ridge being back?** A yes opens C2, the demo copies and the operator by script instead of by hand.
A no reopens this piece at whichever reading did not convince you. Two things to know either way:
the address is **new**, because the templates hold no custom domain, so old passkeys and any link
or bookmark anyone kept no longer work; and ridge holds **no** demo copy and **no** operator until
C2, so it is not yet a place to check a piece.

## What this costs, and what it does not add

The re-created stack is the resource set that was there before: `ops/env.yml` and `ops/network.yml`
declare **no** NAT gateway, **no** load balancer and **no** allocated address, so the re-up adds no
fixed charge and needs no decision about one. The records of the old ridge are gone with its disk —
no snapshot was kept, requested zero in both teardown runs — which is the intended state, and C2's
seed is what fills a new ridge.

*Hazard no gate catches:* a reading is reported from the template rather than the machine, which is
exactly what happened on 2026-11-08. *Guard:* every row above names its source command, and row 3
says in its own words which two facts the instance cannot answer for.
