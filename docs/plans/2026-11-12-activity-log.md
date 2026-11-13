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
| 12 | The check's rule readings accept the two ports from the back end's group and nothing less or more: a ridge without the log's rule reads red (widened at step 1, narrowed again at step 6) | `ops/test.sh`, beside the existing verdict cases |
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
  *Done, 2026-11-13 (sonnet):* shellcheck, cfn-lint, the citation test and the whole `ops/test.sh` at exit 0 ("all
  checks passed") on the committed tree, case 12 included. `pre-merge` was taken in. Built against the template as the continuous copy left it, which differs
  from the step as written: the unit is not a copy of the store's lines 12 to 22, which now wrap Litestream and wait
  on the records disk, but the store's plain shape (its own user, 0700 under umask 0077, two ports, listen file, key
  file) without them, the log's copy joining at step 12; the egress rule is inline in the back end's group, so the
  update modifies that group in place (the box's group does not change, and case 6 reads the back end's group, not
  the box's); `adds_and_one_modify` pins layer four's names and is left as it was, and the new update is its own
  guard, `activity_update`, over a hand-written change set, `ops/testdata/changeset-activity.json`, which checks the author's
  expected change set and not the one CloudFormation makes (`ops/stack.sh` does not call it, since a real change set holds
  other pieces' changes too; the only guard on the owner's run is `ops/unsafe-changes.jq`); the ports are
  `PORT` 3184 and `OPEN_PORT` 3185 in the unit, `AuditPort` the writing one. AWS's page on the egress update was not
  read in this step (no web), so "in place" rests on the change set read at step 2. Each new guard has its refused case
  on a copy of the real file broken one way: the second egress rule dropped or widened, a third port, an address
  range, the box rule from another group or for the store's port, a default on the port, a stack run that forgets
  the port, a change set that replaces the back end's group, adds a rule or modifies the box's group, and six breaks
  of the unit. Case 12 moved here from step 6, by the orchestrator's decision: `ops/check.sh`'s rule readings
  (`box_rules_verdict`, `bff_rules_verdict`) took the single rule, so a check of ridge would have read red between
  the stack run and step 6. They now take the log's writing port beside the store's, one rule each, and read green
  on a ridge that has the second rule and on one that has not yet (the stack run comes after the push); any other
  port, address range or group, a lone log rule or a rule too many is still refused. Each of the two readings
  was seen red once by a mutation of the reading (backed up first, reverted).
- [ ] 👤 **2. Your stack run,** once step 1 is in `main` and pushed: `ops/stack.sh env ridge --plan`,
  then without it. Your first point. Ridge by then already holds the continuous copy (its stack run is
  the same sitting's earlier act), so the plan-only run must print, and the machine reads the log whole
  for, exactly: `AuditPort=3184` among the parameters; `Add BoxFromBffActivity (AWS::EC2::SecurityGroupIngress)
  replacement=none`; `Modify BffGroup (AWS::EC2::SecurityGroup) replacement=False` with its detail
  `Properties SecurityGroupEgress requires-recreation=Never`; `ok no removal and no replacement`; and
  `== exit 0`. A ridge still at the night's state of 11-12 (no copy yet) also prints the copy's and the Slack
  alarm's lines, as their own plans name them. **A no** is any one of: `REFUSED`; `replacement=True` or
  `replacement=Conditional` on any line; a `Remove`; a change to `BoxGroup` or `Box` beyond the copy's own
  modify; `GroupDescription`, `VpcId` or `GroupName` named as a detail of `BffGroup`; `the change set failed:`
  naming `AuditPort`. Worth reading before the run without `--plan`: `Bff` or `BoxFromBff` shown as `Modify`
  with `evaluation=Dynamic` (the guard accepts it); if `BoxFromBff` shows `Conditional` the guard refuses it,
  and the answer is a decision, not a `--take` by reflex. Not settled before the run: whether CloudFormation
  adds the one egress rule alone or rewrites the list (the store's door dropped for a moment, which the back
  end's 600 ms bounds absorb on ridge's demo data). *Done when:* the machine reads the log whole and it
  matches the yes above, `== exit 0`. **5 to read.**
- [x] **3. The writing listener.** The store's `listenAddrOf` and its tests copied into the
  service's config, the writing listener bound to it (`internal/lifecycle/lifecycle.go#L45`), the
  reading one left on loopback (`#L49`), the comment naming the old app's proxy rewritten. Cases 1
  and 2. *Done when:* `make check` in `services/audit-backbone/` exits 0 at 100 %, each case red
  once. **5.**
  *Done, 2026-11-13 (sonnet):* `make check` in `services/audit-backbone/` at exit 0 at 100 %, the citation test at exit 0.
  The store's `listenAddrOf` and its tests are copied as they stand on this branch (unspecified, mapped-unspecified,
  named, ported, ranged, zoned and listed values refused naming the variable and never the value; unset or blank
  loopback). The differences: the default constant lives in the service's config and the open listener takes it, since
  the service has two listeners and the store one; `server.Listen` takes the address and the port as the store's does,
  and the old loopback-only test became the store's bind-the-address test; the two binds moved into one `bind`
  in `lifecycle.go`, so a test reads both addresses (`::1` for the writing one tells it from the default) and a second
  refuses an address the host does not own, naming the writing listener. Each case seen red by a mutation of its
  code, reverted and compared equal: the open listener on the configured address, the writing one on loopback,
  `Listen` ignoring its address, the variable never read, the mapped form not unmapped, the unspecified check, the
  zone check, the value printed in the error, and the listener's name dropped from the refusal.
- [x] **4. The box's side.** `ops/release.sh` builds the service by hand (`make check`, then
  `make dist BUILD_COMMIT=<sha>`) or takes the job's binary, sends it with its checksum, makes the
  key once, installs both units in the one rename command (`ops/release.sh#L117-L121`), and waits on
  both `/health` reads. Cases 7 to 9. *Done when:* the three `ops/` rows exit 0, each case red once.
  **12.**
  *Done, 2026-11-13 (sonnet), cases 7 and 8 only:* shellcheck, cfn-lint, the citation test and the whole `ops/test.sh`
  at exit 0 on the committed tree. Built to `ops/release.sh` as the continuous copy left it, which differs from the
  step as written: the file now carries Litestream, the records disk and a `die` when the stack names no bucket or
  disk, and writes every `.new` file before any install, so the plan's "both units in the one rename command" and
  "waits on both reads" do not fit. The log's part is a second half after c-storage's, in two steps of its own
  (sent, then installed and named): c-storage's binary, unit, disk, keys, install, restart and `/health` are done
  and read before one line of the log's half runs, so the log's half cannot stop or half-install the store's.
  A failure in it ends through `audit_die` alone, which says that c-storage is released and runs and that the
  log's half stopped. What it leaves: before the install, only `.new` files in `/opt/audit-backbone` and perhaps the
  key; in the install, the log's unit is the last rename, so a failure before it leaves the log unknown to
  systemd; after it, the log installed and not naming the commit while c-storage is untouched. The job must name
  `RELEASE_AUDIT_BINARY` (step 5 sets it in `ci.yml`): until then a job's release goes red after c-storage is
  released, by name. The order is pinned by a case (`audit_half_guard`: the first line naming the log comes after
  c-storage's restart and `keys_unchanged`, no bare `die` after it, the unit renamed last, c-storage absent from the
  install). Case 7's refusal of a differing checksum and of a job with no named binary, and case 8's key made once
  and never rewritten (the box's script extracted and run twice on a folder), are guarded offline and each seen red
  by a mutation. One old guard was narrowed: the one that counts the release's `LISTEN_ADDR` write now reads
  c-storage's line (the log's release writes its own, so the count was 2 and it reddened once). Not shown offline, so unticked: case 9, the real release on ridge naming the commit on both
  `/health` reads, and the checksum refusal and the key on a real box.
- [x] **5. The deploy and CI.** `ops/app.sh` adds `AUDIT_URL` and `AUDIT_KEY` to the function's
  settings (`ops/app.sh#L128-L134`) from the box's file; the variable list at `ops/lib.sh#L777`
  gains both; `ci.yml` gains `services/audit-backbone/**` in both path lists, an `audit` job, the
  deploy's `needs` (`#L216`), a build of the binary beside the store's (`#L274-L279`) and its name
  handed to the release (`#L296-L302`). Cases 10 and 14. *Done when:* the three `ops/` rows exit 0,
  each case red once; `actionlint` read by hand (`ops/CLAUDE.md`'s OP3). **8.**
  *Done, 2026-11-13 (sonnet):* shellcheck, cfn-lint, `actionlint` on `ci.yml` (installed here, exit 0), the citation test and
  the whole `ops/test.sh` at exit 0 on the committed tree. Built to the tree, not the lines cited. `ops/app.sh` reads
  the log's key from the box's `/etc/audit-backbone/keys.env` right after the BFF's own, masks it at once, takes the
  address from the log's unit (`AUDIT_PORT`, the box's private address), and puts both in the function's settings
  through the same 0600 file; a box without the file, or with no key in it, is refused by name before anything is
  sent, saying to run the release first. `BFF_ENV_NAMES` is the seven names, never the super-admin key. `ci.yml`
  gains the service in both path lists, an `audit` job (the service's `make check`), the deploy waits on it, builds
  the arm64 binary stamped with the commit beside the store's, before the role is taken, and names it to the release
  as `RELEASE_AUDIT_BINARY`. That closes the cost step 4 named, a job's release going red by name after c-storage was
  released: the case `audit_ci_guard` pins the release step's naming of the binary, beside the step 4 case that
  refuses a job without one. Two old checks changed because the function now holds seven names, not five (the stand-in's
  environment check and the names constant's check); the stand-in ssh answers the log's key file. Each new guard was seen red
  by a mutation: the four CI breaks on copies of `ci.yml`, and on the real `ops/app.sh` the log's settings left out
  and the refusal removed.
- [x] **6. The check.** `ops/check.sh`'s box reads (`#L81-L103`) gain the log's unit, its two
  listeners, its key file and directory modes, its `/health` naming the commit, and each unit's
  memory; the rule readings, widened at step 1 so the check read green on a ridge before and after the stack run, are narrowed again here to the two ports from the back end's group, so a ridge without the log's rule reads red, with a case that pins it (case 12); after the walk through the app's address (`#L157-L181`) the root
  adds one customer and the box itself reads its entry by that record, the key read on the box and
  never sent back. Cases 11, 12, 13 and 16. *Done when:* the three `ops/` rows exit 0, each case red
  once. **10.**
  *Done, 2026-11-13 (sonnet):* shellcheck, cfn-lint, the citation test, the whole `ops/test.sh` ("all checks passed") and
  the scripts package's gate at exit 0 on the committed tree. The check's box reads gained a call of their own (the
  first word `audit`): the log's unit, its writing listener on the box's private address alone, its reading
  listener on loopback alone, the key file, the data folder and its files, and its `/health` against the commit
  c-storage's `/health` names, one `RED` line each (`audit_problems`, on written input); each program's memory
  beside the box's free memory (`audit_memory_line`, a figure the box does not give said as not read), and the OOM
  read stays red. After the walk the root adds one customer through the app's address; the box mints a read token
  from the key file it holds, reads that record's entries on its loopback and prints counts alone (a second call,
  first word `entry`, the key and token handed to curl as a config on a pipe, never an argument), and the check
  needs one `customer.create` entry and no key in it. To give the box the client's id, `ridge.ts` gained
  `tenant-id <code>`, so the scripts package changed too, which the plan did not name. Case 12 is narrowed
  (Medium 2 of the template review): both rule readings take the store's port and the log's, one rule each, and
  a ridge or a group without the log's rule reads red; the "without" form is dropped. Medium 1: `activity_update`'s
  comment and this plan's step 1 now say it checks the author's expected change set, not CloudFormation's.
  Medium 3: step 2 is rewritten for a ridge that already holds the copy, with the lines a yes and a no print.
  Low 1: a comment beside `GroupDescription` says it stays because a change replaces the group. Each case was seen
  red once by a mutation on a scratch copy, reverted (the copy never committed): both pins (the box's reading and
  the back end's reading with the "without" form back), each of the seven log facts and each of the three entry
  facts with its check dropped, the memory line dropped, a zero said for a missing figure, the OOM expectation
  loosened, the customer's add removed from the walk, and `tenant-id` printing the name; the key-on-a-pipe text
  guard was seen to count a line that echoes the key, not by a run. Not shown offline, so unticked: case 13
  and case 16 read off ridge. Three old checks changed: the stand-in edge takes the check's dated client
  code, and the two lists of the client commands now hold `tenant-id` (open item 389).
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
