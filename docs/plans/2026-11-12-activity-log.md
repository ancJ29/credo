# The activity log running on ridge, the box's memory read once

*What was measured against the premise.* The back end does write an entry for every change, and
what is missing is mostly running the service on ridge, not building it. Three things are more
than running it. The service's two listeners bind loopback alone
(`services/audit-backbone/internal/server/server.go#L142-L147`), so the back end on ridge could not
reach it: one small change in the service, copied from the store's. CI has no gate for the service,
and a push that changes it deploys nothing (`.github/workflows/ci.yml#L9-L26`). And the memory reading
the milestone asks for, with the store, the log and the copy all running, waits on the continuous
copy being live on ridge, not on ridge alone.

## At a glance

Today a change made on ridge is saved and no entry is written: the back end runs there without
the activity log by design (`bff/src/env.ts#L21-L30`), and nothing ships the service
(`docs/activity-log.md#L49`). When this piece ends, a change made through ridge's own address is
written to the activity log on the box, and the environment check finds that entry by its record.
The log's file is copied beside the records, and one reading of the box's memory shows whether the
store, the log and both copies fit on the small machine. The cheapest safe path is what exists,
copied: the store's unit, its release, its network rule, its key file and its listen address. Price:
nothing beside the store; if the reading says it does not fit, the final page's box of its own,
about $4.20 a month. Three acts of yours, each a few minutes.

## The slice

One, walkable when it ends: on ridge, the root of a fresh company adds a customer through the app's
address, and `ops/check.sh ridge` reads that customer's entry back from the activity log on the box,
then prints each program's memory beside the box's free memory, with no out-of-memory kill. Every
part below serves that walk.

**Stage 1 is already held:** the local copy runs the service beside the store, and the back end
writes to it end to end (`pnpm local activity`, `docs/products.md#L67`). So the first step is the
template's half, which must land alone (below), not a new local build. Stage 3, the look, is the
check's verdict line on ridge, read as points 2 and 3; stage 4 is ridge itself.

**Decided here, each the machine's, each yours to veto:**

- **The writing listener binds the box's private address; the reading listener stays on loopback.**
  The back end only writes. Reading entries is the history screen's, after Monday, and needs no
  door open today. *Flips it:* the history screen's plan (item 287).
- **The box's ports are 3184 for writing and 3185 for reading,** the local copy's own, set once in
  the service's unit, which is their one home as the store's unit is the store's
  (`ops/lib.sh#L410-L413`).
- **One release ships both programs.** `ops/release.sh` gains the second binary as a parameter of
  the same run, never a second script (collaboration's remake rule); its superseded read stays the
  store's `/health`.
- **The write key is made once on the box, in a root-only file of the log's own,** as the store's keys
  are (`ops/release.sh#L91-L109`); the deploy reads it into the function's settings, as it reads the
  store's (`ops/app.sh#L96-L115`).
- **The log's file gets its own Litestream inside its own unit,** the continuous copy's shape
  copied: one unit is one user, and the store's Litestream, running as the store's user, cannot read
  the log's file. *Price:* a second Litestream process, which the reading measures. *Flips it:* the
  reading below the floor (point 3).
- **CI gains the service's gate as a job of its own,** a copy of the store's `make check` job
  (`.github/workflows/ci.yml#L56-L69`), and the deploy waits on it.

## The limits that shape it

- **The back end reaches the box only on ports its group names.** The back end's group sends to the
  store's port alone, and the box admits that port from that group alone (`ops/env.yml#L153-L178`).
  The log's port needs one rule each way, so the template changes, and a template change is your
  stack run.
- **A push deploys at once, and the stack script reads `origin/main`.** The template's half must
  therefore be in `main` and live before the code that uses it is pushed: the deploy would otherwise
  set the log's address while no rule lets the back end reach it, every change paying the 600 ms
  bound (`shared/src/activity.ts`'s `AUDIT_TIMEOUT_MS`) and the check red. So step 1 lands alone.
- **The guards pin today's single rule.** `ops/test.sh#L253-L261` requires the back end's group to
  send to the store's port alone and `BoxFromBff` to be the only rule into the box;
  `ops/test.sh#L507-L524` counts every resource the template gained as layer four's. All three widen.
- **The check pins the single rule and five settings too:** `box_rules_verdict` and
  `bff_rules_verdict` (`ops/lib.sh#L744-L766`) and the function's variable names
  (`ops/lib.sh#L775-L777`).
- **The service refuses to start without its key, ports or file**
  (`services/audit-backbone/internal/config/config.go#L44-L73`): a unit missing one crash-loops, and
  the release's wait on `/health` sees it.
- **The box is a `t4g.nano`** (`ops/env.yml#L40`); ridge's own release read about 287 MiB available
  with the store alone, and a release refuses below 96 (`ops/lib.sh#L15-L19`).
- **Ridge's files are small,** so a full copy uploads in a moment there. The reading is each
  program's resting size plus that moment, not the peak a company's full file would cost.

## The case table

| # | The case: one behaviour, one sentence | Held by |
| --- | --- | --- |
| 1 | The writing listener binds `LISTEN_ADDR` when set and loopback when unset; the reading listener binds loopback whatever is set | Go test in `internal/server`, `TestListenersBindLoopbackOnly` widened |
| 2 | An unspecified, mapped-unspecified or named `LISTEN_ADDR` stops the start, naming the variable and never its value | Go test in `internal/config`, copied from the store's |
| 3 | The log's unit runs as a user of its own, its directory 0700 under umask 0077, its ports set once, its key from a root-only file | `ops/test.sh` |
| 4 | The box admits the log's writing port from the back end's group alone, and the back end's group sends to the two ports on the box's group and nowhere else | `ops/test.sh`, the template's guards |
| 5 | A third port, an address range or a rule from another group is still refused | `ops/test.sh` |
| 6 | The layer-four update counts the new rule as an addition, and the box's group as a modify in place | `ops/test.sh`, `adds_and_one_modify` |
| 7 | A release refuses a log binary whose checksum on the box differs from the one sent, and in the job one that is not named | `ops/test.sh`; the release's log |
| 8 | The log's key is made by the first release and never rewritten by a later one | `ops/test.sh`; the release's log |
| 9 | A release waits until the log's `/health` names the commit shipped | the release's log on ridge |
| 10 | The deploy sets the log's address and key from the box's file, refuses by name when the box holds none, and the function then holds seven names, never the super-admin key | `ops/test.sh` |
| 11 | The check is red when the log's unit is not active, its writing listener is anywhere but the box's private address, its reading listener anywhere but loopback, or its key file not 600 root | `ops/test.sh`, on written input |
| 12 | The check's rule readings accept the two ports from the back end's group and refuse anything more | `ops/test.sh`, beside the existing verdict cases |
| 13 | A customer added through the app's address is found in the log by its record, read on the box, with no key in the log | the check on ridge, your run |
| 14 | A push that changes the service runs its gate in CI, and the deploy waits on that gate | `ops/test.sh`, reading `ci.yml` |
| 15 | The log's file is copied by its own Litestream inside its own unit, to the box's own path in the copy's bucket | `ops/test.sh` |
| 16 | The check prints each program's memory beside the box's free memory, and stays red on any out-of-memory kill | `ops/test.sh`; the check on ridge |

Rows 1 and 2 are the service's gate, rows 3 to 8, 10 to 12 and 14 to 16 run on written input with no
AWS, and rows 9, 13 and 16 are read off ridge from your runs' logs.

## The steps

Sizes are machine minutes from `worktrees/runs.tsv`: an `ops/` template-and-guard step took 10
(the backup-policy piece's first), a copy of code that already works about 5 (the one-company
client's steps), a review with its whole check about 20, a fix pass about 10, a recap about 8.
Each gate is the touched package's one command: `make check` in `services/audit-backbone/`, or for
`ops/` the three rows (`shellcheck -x ops/*.sh walk/*.sh services/c-storage/scripts/*.sh`,
`cfn-lint ops/network.yml ops/github.yml ops/env.yml`, `bash ops/test.sh`), plus the citation test.

- [x] **1. The template's half, landed alone.** `ops/env.yml`: the back end's group gains its second
  egress rule, to the log's writing port on the box's group, and a new `BoxFromBffActivity` admits
  that port from the back end's group alone. The port is a parameter `ops/stack.sh` passes from the
  log's unit, as it passes `BoxPort` (`ops/stack.sh#L167`, guarded at `ops/test.sh#L500-L505`), so
  the unit, `ops/audit-backbone.service`, arrives here whole: a copy of
  `ops/c-storage.service#L12-L22` with the log's two ports, file and key file, which nothing installs
  until step 4. The guards at `ops/test.sh#L253-L261` and `#L507-L524` widened. AWS's page on a
  security group's egress update read first (in place, or not). Cases 3 to 6. *Done when:* the three
  `ops/` rows exit 0, each new guard seen red once. **10.** Lands on `pre-merge` alone.
  *Done, 2026-11-13 (sonnet):* shellcheck and cfn-lint at exit 0 and the whole `ops/test.sh` at exit 0, "all checks
  passed", after `pre-merge` was taken in. Built against the template as the continuous copy left it, which differs
  from the step as written: the unit is not a copy of the store's lines 12 to 22, which now wrap Litestream and wait
  on the records disk, but the store's plain shape (its own user, 0700 under umask 0077, two ports, listen file, key
  file) without them, the log's copy joining at step 12; the egress rule is inline in the back end's group, so the
  update modifies that group in place (the box's group does not change, and case 6 reads the back end's group, not
  the box's); `adds_and_one_modify` pins layer four's names and is left as it was, and the new update is its own
  guard, `activity_update`, over a hand-written change set, `ops/testdata/changeset-activity.json`; the ports are
  `PORT` 3184 and `OPEN_PORT` 3185 in the unit, `AuditPort` the writing one. AWS's page on the egress update was not
  read in this step (no web), so "in place" rests on the change set read at step 2. Each new guard has its refused case
  on a copy of the real file broken one way: the second egress rule dropped or widened, a third port, an address
  range, the box rule from another group or for the store's port, a default on the port, a stack run that forgets
  the port, a change set that replaces the back end's group, adds a rule or modifies the box's group, and six breaks
  of the unit. `ops/check.sh`'s rule readings still pin the single rule, so a check of ridge after the stack run
  reads red until step 6 widens them.
- [ ] 👤 **2. Your stack run,** once step 1 is in `main` and pushed: `ops/stack.sh env ridge --plan`,
  then without it. Your first point. *Done when:* the machine reads the log whole: one addition, a
  modify of the back end's group in place, nothing removed or replaced, `== exit 0`. **5 to read.**
- [ ] **3. The writing listener.** The store's `listenAddrOf` and its tests copied into the
  service's config, the writing listener bound to it (`internal/lifecycle/lifecycle.go#L45`), the
  reading one left on loopback (`#L49`), the comment naming the old app's proxy rewritten. Cases 1
  and 2. *Done when:* `make check` in `services/audit-backbone/` exits 0 at 100 %, each case red
  once. **5.**
- [ ] **4. The box's side.** `ops/release.sh` builds the service by hand (`make check`, then
  `make dist BUILD_COMMIT=<sha>`) or takes the job's binary, sends it with its checksum, makes the
  key once, installs both units in the one rename command (`ops/release.sh#L117-L121`), and waits on
  both `/health` reads. Cases 7 to 9. *Done when:* the three `ops/` rows exit 0, each case red once.
  **12.**
- [ ] **5. The deploy and CI.** `ops/app.sh` adds `AUDIT_URL` and `AUDIT_KEY` to the function's
  settings (`ops/app.sh#L128-L134`) from the box's file; the variable list at `ops/lib.sh#L777`
  gains both; `ci.yml` gains `services/audit-backbone/**` in both path lists, an `audit` job, the
  deploy's `needs` (`#L216`), a build of the binary beside the store's (`#L274-L279`) and its name
  handed to the release (`#L296-L302`). Cases 10 and 14. *Done when:* the three `ops/` rows exit 0,
  each case red once; `actionlint` read by hand (`ops/CLAUDE.md`'s OP3). **8.**
- [ ] **6. The check.** `ops/check.sh`'s box reads (`#L81-L103`) gain the log's unit, its two
  listeners, its key file and directory modes, its `/health` naming the commit, and each unit's
  memory; the rule readings widen; after the walk through the app's address (`#L157-L181`) the root
  adds one customer and the box itself reads its entry by that record, the key read on the box and
  never sent back. Cases 11 to 13 and 16. *Done when:* the three `ops/` rows exit 0, each case red
  once. **10.**
- [ ] **7. The prose it makes false.** `docs/activity-log.md` (its title, "Nothing ships it", where
  it runs), `docs/architecture.md`'s picture and part line, `docs/architecture-detail.md`'s row,
  `docs/README.md`'s row, the service's `CLAUDE.md` ("Ship: none yet"), its `README.md` and
  `Makefile` first lines, the root `CLAUDE.md`'s gate table (a seventh command, CI's `audit` job),
  `ops/README.md`'s release steps. *Done when:* the citation test exits 0 and `git grep -nE
  '/Users/|~/'` finds nothing. **8.**
- [ ] **8. One review**, on a model other than the author's, with the whole check: code, tests and
  this table (QA's rule 5). *Done when:* a verdict line, each finding with its line. **20.**
- [ ] **9. The fix pass.** *Done when:* each finding fixed, rejected or deferred with its reason, and
  the gates of steps 3 to 6 at exit 0 again. **10.**
- [ ] **10. The recap**, before the landing; rows 9, 13 and 16 marked not yet known. *Done when:*
  committed in `docs/recaps/` with its `docs/products.md` row. **8.**
- [ ] 👤 **11. Your push of steps 3 to 10**, which deploys onto ridge. Your second point. *Done
  when:* the deploy's log reads the release naming both commits, the function's seven names, and the
  check `== green` with the customer's entry found. **5 to read.**
- [ ] **12. The log's file joins the copy**, once the continuous copy has landed and its release ran
  on ridge (its step 12). The log's unit starts its own `litestream replicate -exec`, the continuous
  copy's `ops/litestream.yml` copied with the log's file and the path `<box>/activity`, on the records
  disk; the check reads that copy fresh. Case 15. *Done when:* the three `ops/` rows exit 0, the case
  red once, and a reread of the changed lines by the step 8 reviewer's model. **10, and 5 for the
  reread.**
- [ ] 👤 **13. Your release and check,** `ops/release.sh ridge` then `ops/check.sh ridge`, or the push
  of step 12. Your third point. *Done when:* the check's log prints each program's memory and the
  box's free memory, no out-of-memory kill, `== green`; the recap and item 2's memory half take the
  figure. **5 to read.**

About 106 machine minutes for steps 1, 3 to 10 and 12, and 15 more to read your three runs: about
twice the cut's hour, which counted neither the listener, the CI job nor the copy.

## The order, and the files shared with other lanes

- **Steps 1 and 3 to 10 wait on nothing but ridge,** which is in `pre-merge` now. **Step 12 waits on
  the continuous copy's landing,** whose plan names this file's copy as this lane's
  (`docs/plans/2026-11-11-continuous-copy.md` on its branch, "The activity log's file joins the
  copy"), and **step 13 on its ridge release**, since the reading wants all three programs.
- **Which lands first, by the final page's order of work:** the continuous copy (its line 3) before
  this lane (line 4), then the Slack alarm (5), the door and the keys (6), each company's address
  (7), production (8), and the pooled shape and the photos (9). The second to land takes `pre-merge`
  in and builds on the first's lines, never beside them.

| File | This lane | Also changed by |
| --- | --- | --- |
| `ops/env.yml` | the second rule each way | the continuous copy, the Slack alarm, the door, the pooled shape |
| `ops/test.sh` | the group guards, the layer-four list | the continuous copy, the Slack alarm, the door, the pooled shape, the store's copy tool |
| `ops/release.sh` | the second binary, its key, its unit | the continuous copy, the door, the pooled shape |
| `ops/lib.sh` | the variable list, the rule readings | the continuous copy, the Slack alarm, the door, the pooled shape, the store's copy tool |
| `ops/app.sh` | two settings | the door, the pooled shape, the photos |
| `ops/check.sh` | the log's reads, the entry | the continuous copy, the Slack alarm, the door, the pooled shape |
| `ops/stack.sh` | the log's port parameter | the continuous copy, the Slack alarm, the door, the pooled shape |
| `.github/workflows/ci.yml` | the job, the paths, the build | the continuous copy, the store's copy tool |
| `docs/architecture.md`, `docs/architecture-detail.md` | the log's lines | the continuous copy, the door, the pooled shape, the photos, the store |

- **The three plans written beside this one** (each company's address, the safe scripts, production)
  were not on their branches when this was written; by the order this lane lands before all three.
- **The layer-four list in `ops/test.sh`:** the Slack alarm's plan pins it if it lands first; this
  lane lands before it by the order, so this lane pins it, and the Slack alarm then adds its own
  resources to the pin.
- **The log's key replacement stays with item 251,** which the door's plan files for this lane and
  parks until the key reaches a deployed environment. That is step 11; the replacement is a fifth
  order of the door's `ops/keys.sh`, built when both have landed, and not here.

## The human's points

**1, at step 2: the stack change for ridge.** You will read the `--plan` of ridge's environment: one
rule added, letting the back end reach the activity log's port on the box, and the back end's group
changed in place, nothing replaced. A yes: run it without `--plan`, and the code can then be pushed.
A no: the guard has already refused it, nothing changed, and the piece finds another way to open
the port.

**2, at step 11: the first entry on ridge.** You will read the check's log after your push: a fresh
company's root added a customer through the app's own address, and the check found that change in
the activity log on the box, no key printed. Does that read as the log running on ridge? A yes
closes the running half; a no reopens the piece at the line that did not convince you.

**3, at step 13: the box's memory, read once.** You will read one line a program (the store, the
log, each one's copy), the box's free memory beside them, the 96 MiB a release refuses below, and
the out-of-memory kills, which should be none. Room enough for the log beside the store? A yes keeps
it there at no cost. A no is your money decision: a box of its own, about $4.20 a month.

## Hazards no gate catches

- **A lost entry is silent unless the request log is read.** The back end saves the change and logs
  the failure (`docs/activity-log.md`, "Where a lost entry shows up"); the check reads one entry a
  run, not every one.
- **The reading is a resting one.** Ridge's files are tiny, so the copy's upload peak at a real
  company's size is not seen; each program's own figure is printed so it can be scaled.
- **Two Litestream processes pay twice for one tool.** If the reading is tight, one copy process for
  both files under one user is the cheaper shape, at the price of the one-unit, one-user rule.

## What stays out

The history screen and its reading door (after Monday; item 287); the write measurement the final
page's order of work places beside this reading, which no milestone of the week's cut carries
(item 286); the log's key replacement (item 251, the door's script); a log per box in the pooled
shape (the pooled shape's plan, "What stays out").
