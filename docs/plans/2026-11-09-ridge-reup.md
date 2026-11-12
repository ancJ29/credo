# Ridge comes back by a scripted path, and the running machine is read

## At a glance

Ridge, the shared pre-production environment, was destroyed on 2026-11-08. Until it is back, a
piece's last delivery stage is its visual report, and every later rehearsal of the final
architecture (a restore drill, the activity log, a forced alarm) has nowhere to run. This piece
brings it back **from `main` by commands that already exist in `ops/`**: nothing new is designed,
and the only scripts written are three hand-offs that call `ops/` and one reading. Then it reads
what is true **off the running machine**: the box and its disk fence, the environment check's
verdict, the sweep of stranded check clients, the access log's own lines and the workflows' states.
The reading is the done check, not a formality: on 2026-11-08 five pages said the disk fence had
not been applied, and the run they described had applied it three minutes earlier. **Every live act
is yours, in your own terminal** (👤 below); the machine writes the hand-offs and reads their logs
whole. The price: about 20 of the machine's minutes by its ledger, plus about half an hour of AWS's
and your terminal's. The demo copies, the operator and the activity log on ridge are **not** here.

## The slice

One slice, walkable when it ends: ridge's stack exists, the app of `main` is on it, the environment
check is green through the app's address, the three workflows are back on, and the readings below
say so. Walkable means you open the app's address and reach the sign-in screen; it is not yet
usable, because no demo copy and no operator exist until the next ridge milestone.

**What the later milestones expect ridge to hold, so what this slice must leave:** a stack made
from `main`'s templates, a box that answers through the endpoint and prints its memory, a release
and an app ship that work by hand and from the deploy job, and a check green through the app's
address. The continuous copy's drill, the activity log, the watch, the door and each company's own
address each add to that and are rehearsed there first.

What is **not** in this slice, said so it is not pulled in:

- **The six demo copies and the operator made by script instead of by hand**, the next ridge
  milestone (`ops/seed.sh#L16-L17` records a first fill as never measured), and somebody who does
  not read code checking a piece on ridge, the one after.
- **The activity log service.** It is in the trunk and runs only in the local copy: nothing ships
  it (`docs/activity-log.md#L49-L55`). The back end runs without it by design: with neither
  `AUDIT_URL` nor `AUDIT_KEY` set, a change is saved and the back end logs that the log is not
  configured (`bff/src/env.ts#L21-L22`), and `ops/app.sh` sets neither (no `AUDIT` in the file).
  Carrying it to ridge is the architecture's fourth line of work, a plan of its own: a unit, a
  network rule, the key, a release step, and the box's memory read with all three programs
  running. This slice leaves it the memory with `c-storage` alone to start from (step 2).
- **The box's shape.** Neither of the shapes you hold open (the pooled boxes, or a stack a company)
  is built in `main`, so ridge comes back as `ops/env.yml` declares it today: one stack of 21
  resources, its box included, the template unchanged since 2026-11-08 15:48, before the teardown.
  Whichever shape is chosen reaches ridge later, by its own piece and a stack run, and on a ridge
  holding no records that costs none. This plan would change only if a shape's template change
  landed in `main` before step 1 runs, and step 1's `--plan` count shows it.

Neither of your two open decisions — how fresh ridge must be, and the fourteen days the access log
keeps callers' addresses (item 157) — gates anything below, and this plan asks neither.

## What is read off the live machine, and what the answer must say

A claim about an environment is a claim about something no session here can see. Each row is one
live read; a template's claim never satisfies a row.

| # | What is read | From where | The answer must say |
| --- | --- | --- | --- |
| 1 | the three workflow states | `gh workflow list --all`, **after** step 4's enable, not the enable's own exit | `active` for `ci.yml`, `seed.yml` and `walks.yml` — three of three, each named |
| 2 | that the stack run reached its secret step | `ops/stack.sh`'s own log: the step at `ops/stack.sh#L291` and the read-back at `#L305` | `environment ridge holds secrets … AWS_ROLE_ARN`. Absent — or the die at `#L284`, "the box never answered through the endpoint" — means GitHub's secret still holds the **destroyed** role and every deploy fails at the role exchange. Then: run the same command again (it is an update and reaches the secret step) |
| 3 | the box and its root-disk fence | `aws ec2 describe-instances` on the live instance tagged `Env=ridge`: the `/dev/xvda` mapping's `Ebs.DeleteOnTermination`; then `describe-volumes` for every unattached volume, with its creation time | one running instance; `DeleteOnTermination` **false** (`ops/env.yml#L128`); no unattached volume made since the stack run began (the old disk was read back as gone on 2026-11-08, and the new box's is attached). An older one is another stack's, named in the log and not a red. `DeletionPolicy: RetainExceptOnCreate` and `UpdateReplacePolicy: Retain` (`#L105-L106`) are CloudFormation's own and **cannot be read off the instance**: they are read from the live stack's template and reported as the stack's answer, never as the box's |
| 4 | the environment check's verdict | `ops/check.sh ridge`'s own log | `== green`, and step 7, "through the app's address", **not** `skipped` — skipped means the stack holds no layer four and the app is not really up (`ops/check.sh#L157-L159`) |
| 5 | the sweep of stranded check clients | the same log, the line `ops/check.sh#L167` prints | an `ok` line from `clear-checks` — **not** the `WARN` of `#L169`. On a fresh ridge the count is expected to be **zero**, and that is the proof: the command path ran and was authorised. A green here does not mean anything was deleted, and a reader who expects a deletion will misread it |
| 6 | the access log's own lines | the 2026-11-08 access-log one-off, re-run unchanged (it reads the address from the stack): three marked requests through `/api/`, then `aws logs filter-log-events` on `/aws/apigateway/credo-ridge` | `== lines of this run: 3`, each line carrying all ten fields of the format at `ops/env.yml#L297`, and the secret-shape search at 0 |

Rows 3, 5 and 6 are each a first real run on a live ridge: the fence, the sweep (merged 2026-11-09,
recorded `not live`) and the access log have only ever been read in `main`.

**Not read here, and why:** the deploy job's own run onto the new deploy role. Every release below
is by hand in your session, and a push of documents runs no deploy (`.github/workflows/ci.yml#L9-L26`,
the push trigger's paths), so the job's first run is your next push to `main` that touches code. Its
log is read then, and a red at the role exchange reopens this piece at step 1. Until then, GitHub's
provider stack is what the teardown read as present on 2026-11-08, not a reading of today.

## The steps

Each step's check is the machine's. 👤 is an act in your own terminal, since no credentialed cloud
CLI runs in this sandbox by design; 🤖 is the machine's, writing a hand-off and then reading its log
whole. Each hand-off reaches you as one command in its own block, every path absolute, run from
`main`'s worktree. Sizes are the ledger's for the same shape: a one-off script 1 to 7 minutes
(median 2), a log read 1 to 2, a recap about 3.

- [x] **1. The stack, in two hand-offs** — no script: both are single `ops/` commands. 👤 First, if
  `origin/main` lags `main`, your push of `main`: every `ops/` script refuses a worktree whose
  deployed paths differ from `origin/main`'s (`main_synced`, `ops/lib.sh#L175-L178`), and with all
  three workflows still off the push runs nothing on GitHub. 👤 Then `ops/stack.sh env ridge
  --plan`, your decision point; then `ops/stack.sh env ridge`, which makes the box, the function,
  the API, the bucket, the distribution and the deploy role, and rewrites GitHub's secret.
  *Done when:* 🤖 the `--plan` log names the template at `origin/main`'s commit (`ops/stack.sh#L143`),
  passes the network stack's lookup (it dies at `#L163-L164` when `credo-network` is gone), and
  lists 21 `Add` lines with nothing removed or replaced; and the create's log, read whole, reads
  row 2. **About 4 min** of the machine's; the create is about 5 of AWS's (`#L9`), longer if the
  distribution or the endpoint is slow.
  *Ticked:* the `--plan` run read `origin/main`'s code, found the region enabled, listed 21 additions with no removal and no replacement, and ended 0; the create then ran to complete in 4 min 49 s of AWS's, set GitHub's environment to admit `main` alone, read its secret back (`AWS_ROLE_ARN`), ended green with no key in its log, and left the box at 286 MiB available of 412.
- [x] **2. The release hand-off** — one script, `<stamp>-ridge-release.sh`, calling `ops/release.sh
  ridge` then `ops/app.sh ridge` with the environment they need, each tee'd. It calls the `ops/`
  scripts with parameters and copies no line of them. 👤 You run it. *Done when:* 🤖 `bash -n` and
  `shellcheck` clean; the log ends on its verdict with both scripts green; and the release's
  `box: memory … MiB available` line (`ops/lib.sh#L495`) is kept for the recap as the memory with
  `c-storage` alone. **About 3 min.**
  *Ticked:* the first run refused at once, changing nothing: it asked for the stack with no region and was told it was not found. With the region set, the rerun found the stack complete, the release was sent and its checksum matched, the app's function carried the code sent, no key was in any log, and both scripts ended green. The box showed 287 MiB available, 2459 MiB of swap and 4392 MiB of disk free, with `c-storage` alone.
- [x] **3. The environment check, its own hand-off** — 👤 `ops/check.sh ridge`, alone, because it
  reads what step 2 left behind. *Done when:* 🤖 the log, read whole, reads rows 4 and 5.
  **About 2 min.**
  *Ticked:* `ops/check.sh ridge` ran all seven steps and ended green. Step 7, through the app's address, ran and was not skipped. The sweep of stranded check clients reported 0 deleted and 0 failed, an `ok` line, as the plan expected on a fresh ridge. Sign-in, sign-out and the refusals answered as written, and no key was in the log.
- [x] **4. The workflows-on hand-off** — one script, `<stamp>-ridge-workflows-on.sh`: the three
  `gh workflow enable` calls the teardown's log recorded, then its own read-back of all three
  states. It writes on GitHub only and touches no AWS resource and no workflow file. 👤 You run it.
  *Done when:* 🤖 `bash -n` and `shellcheck` clean, and the log reads row 1. **About 3 min.**
  *Ticked:* the three workflows were enabled (each had been manually disabled), then read back with `gh workflow list --all`: `ci.yml`, `seed.yml` and `walks.yml` each active, 3 of 3, and the script ended 0.
- [x] **5. The live reading** — one script, `<stamp>-ridge-live-read.sh`: the box, its fence and the
  unattached volumes, the live stack's two template policies, then a call to the existing
  access-log one-off **by path, unmodified**, so that reading is re-run and not re-written. Reads
  only; it changes nothing on AWS. 👤 You run it. *Done when:* 🤖 `bash -n` and `shellcheck` clean,
  and its log reads rows 3 and 6. **About 4 min.**
  *Ticked:* the live reading found one running box, its root disk's `DeleteOnTermination` false, no unattached volume, and the live stack's Box policies `RetainExceptOnCreate` and `Retain` (the stack's answer, not the instance's). The access-log one-off, re-run unchanged, made three requests through `/api/` and read three lines back from the gateway's log group, each with all ten fields, with the secret-shape search at 0 lines. It ended 0.
- [x] **6. The recap** — `docs/recaps/<date>-ridge-reup.md`, carrying the six readings as its
  evidence, the memory with `c-storage` alone, the new address's consequences, and the deploy job's
  first run as not yet known if no code push has come; and keeping `docs/products.md` true, whose
  "Ridge runs what `main` held at its last push" (`docs/products.md#L6`) is false while ridge is
  down. *Done when:* committed; the citation test green (`pnpm --filter @credo/scripts exec vitest
  run src/citations.test.ts`, the whole check for a change to documents only); `git grep -nE
  '/Users/|~/'` finds nothing in the commit. The piece then lands on `pre-merge` and counts as
  merged when `main` holds it. **About 3 min.**
  *Ticked:* the recap is `docs/recaps/2026-11-12-ridge-reup.md`, `docs/products.md` is true again for ridge, and the citation test and the path grep passed before the commit. The deploy job's first run is not yet known (no code push has come); it is marked in the recap.

## Why the workflows go on fourth, and where the other seams fall

The 11-09 version of this plan turned the workflows on first. Nothing in steps 1 to 3 runs a
workflow, and with them on before the stack, any push to `main` runs the deploy job against a stack
that does not exist and a secret naming the destroyed role: a red you would then have to read.
Fourth, they go on over a ridge already read green, so your next push deploys onto it as it
should. The teardown's own line, "before any re-up step that depends on the deploy or seed jobs",
still holds: the seed job is the next milestone's.

A command that writes and a command that then checks the write are two hand-offs, never one `&&`
chain, because the second reads what the first left behind. The other seams: between `--plan` and
the create, your own decision point; between the create and step 2, because a stack run that died
before its secret step must be re-run rather than released onto; between steps 2 and 3, the rule's
plainest case; and between step 4 and step 5, which reads facts of another kind.

A script's **own** read-back of its **own** write is that script's receipt, not a second hand-off —
which is why steps 2 and 4 each end in a read. The seam falls where a *different* fact is read, by a
command that must be able to refuse. The teardown's own script set that precedent on 2026-11-08 and
its GitHub half was read back inside it.

## Your point, at the end of step 5

**Ridge is back, and here is what the running machine itself says.** You will get one page: the box
up with its root disk fenced against termination; the environment check green through all seven
steps, including the walk through the app's own address; the sweep of stranded check clients
reporting zero, which is the right answer on a fresh environment and proves the path runs; three
access-log lines the gateway wrote for three requests made a minute earlier, with all ten fields;
and the three workflows read back as on. **The one question: does that read true as ridge being
back?** A yes opens the next ridge milestone, the demo copies and the operator made by script
instead of by hand. A no reopens this piece at whichever reading did not convince you. Three things
to know either way: the address is **new**, because the templates hold no custom domain
(`ops/env.yml#L390-L391`), so old passkeys and any link or bookmark anyone kept no longer work;
ridge holds **no** demo copy and **no** operator until that next milestone, so it is not yet a place
to check a piece; and the activity log is not on it yet, by design.

## What this costs, and what it does not add

The re-created stack is the resource set that was there before: `ops/env.yml` and `ops/network.yml`
declare **no** NAT gateway, **no** load balancer and **no** allocated address, so the re-up adds no
fixed charge and needs no decision about one. The records of the old ridge are gone with its disk —
no snapshot was kept, requested zero in both teardown runs — which is the intended state, and the
next milestone's seed is what fills a new ridge.

*Hazard no gate catches:* a reading is reported from the template rather than the machine, which is
exactly what happened on 2026-11-08. *Guard:* every row above names its source command, and row 3
says in its own words which two facts the instance cannot answer for.
