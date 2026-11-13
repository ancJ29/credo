# Every save copied within a second, the records on a disk of their own, a restore drilled on ridge

## At a glance

Today a deployment's records are one SQLite file on the box's system disk, and nothing holds a
copy (`ops/env.yml#L95`, "The records are one SQLite file on this box's root disk"). This piece
makes a lost disk cost about one second of saves: Litestream, an existing tool, copies each change
to an S3 bucket through a free private door, the records move to a disk of their own that grows
without replacing the box, and a drill on ridge restores the file and reads a save made seconds
before. Nothing in the store's code changes but one new reading, the free disk and the time of the
last write, which the copy's check needs. It is for the first environment that will hold a real
company's records, and it is built and drilled on ridge first, where nothing real exists. The
price: about 69 cents a month on ridge for its second 8 GB disk at the final architecture page's
price, cents for the copy, and four acts
of yours in your terminal, minutes each.

## The slice

One, walkable when it ends: on ridge, a save goes into c-storage, its page reaches the bucket
within a second, `ops/check.sh ridge` says the copy is fresh and the records disk has room, and
`ops/drill.sh ridge` restores the file and finds that save in it. The two templates, the box's
second program, the restore script and the check all serve that one walk; none is built for a
later caller.

**Decided here, each the machine's, each yours to veto:**

- **Litestream runs c-storage as its child**, `litestream replicate -exec`, inside c-storage's own
  unit. The file is c-storage's alone: a user systemd makes at each start, a 0700 directory, umask
  0077 (`ops/c-storage.service#L13-L18`). A second program as any other user could not read it, and
  one as root would make files c-storage cannot open. One unit is one user, one sandbox, one restart.
  *What flips it:* Litestream's own page saying `-exec` does not pass the child's exit through.
- **The restore runs on the box, under the box's own role**, started from your terminal through
  the tunnel. Item 6's "the box's role may only put" (`docs/open-items.md#L59-L61`) becomes "may add
  and read, never delete": the role reads so the box can restore itself, so no copy of Litestream is
  needed on your Mac, and the research pages' open question, whether Litestream runs without the
  right to read, does not arise. The old app's activity service carried the same tool and a
  restore drill; their shape is taken, not their files: restore into a new place, refuse the live
  path, then read the result through the program itself.
- **A blank records disk with a copy waiting is a restore, never a fresh start.** The release
  refuses to start c-storage on an empty disk when this box's path in the bucket already holds a
  copy, since the empty file would then be copied over the real one.
- **Seven days of copies kept**, the final page's design, by an S3 rule, with Litestream's own
  deleting off. The CQRS page's one day was its cost model only.
- **The check here is `ops/check.sh`'s**, run after each deploy. The scheduled check a box and its
  alarm are the watch's milestone, which calls the same reading.
- **The activity log's file joins the copy in its own milestone**, the one that ships it to the box:
  one more database in the copy's configuration, on the same records disk.

**Under either shape for the companies.** A stack a company changes nothing here: each stack from
`ops/env.yml` gets its own bucket, role, disk and copy. Pooled, the copy's path in the bucket names
its box (`Box/records`), so a second box adds a path, a disk and a line of the role, never a bucket.
That second box is the pooled piece's, and step 2 is the only step it would touch.

## The limits that shape it

- **The box has no way out but what the network gives it** (`ops/network.yml#L32`, "no internet
  gateway, no NAT"). The S3 door is a gateway endpoint on the one route table, which AWS does not
  charge for. The box's group names no egress rule, so its default allows the door
  (`ops/env.yml#L76-L90`; naming one would remove it, `#L149-L151`). Litestream's binary rides the release as c-storage's does: sent over the
  tunnel, its checksum compared on the box (`ops/release.sh#L77-L88`).
- **A change to `Box` can stop the whole change set.** The guard refuses a replacement, and a
  `Conditional` one, unless named (`ops/unsafe-changes.jq#L11`). The box gains one property, its
  role's profile, which should change in place: read from AWS's own page before step 2, and read
  again in the `--plan` you run.
- **The records disk is a resource of its own, so its fences are new ones.** The system disk's three
  (`ops/env.yml#L103-L106`, `#L122-L128`) stay. A volume takes `Retain` and `Snapshot` both, unlike
  an instance (`docs/plans/2026-11-08-backup-policy.md#L45-L46`); the guard that holds the box says
  outright that a volume with no policy passes it today (`ops/test.sh#L471`). Whether a disk
  attached after launch is kept on a termination by default is read from AWS's page in step 2.
- **c-storage makes a new, empty file wherever it is pointed** (`services/c-storage/internal/sqlitedb/open.go#L21-L31`).
  A records disk that failed to mount would leave c-storage writing on the system disk, every save
  then outside the copy's disk. The unit waits on the mount and the release refuses without it.
- **`/health` answers two fields and no more**, before the key gate
  (`services/c-storage/internal/server/server.go#L84-L100`). The new reading is a route behind the
  internal key, as every other route is (`#L59-L61`), with its row in `everyRoute` and its request
  in `bruno/` (`services/c-storage/CLAUDE.md#L17`).
- **No table records when a row was written** (`services/c-storage/internal/store/schema.sql#L10-L15`),
  so the last write's time is kept by the process from its own committed writes, empty until the
  first since it started.
- **Every script that acts on AWS refuses unless `ops/` is `origin/main`'s** (`ops/CLAUDE.md#L32`).
  Every live step therefore follows this piece's merge to `main`.

## The case table

| # | The case: one behaviour, one sentence | Held by |
| --- | --- | --- |
| 1 | The network gains an S3 gateway door on its route table, and still has no internet gateway and no NAT | `ops/test.sh`, `network.yml` read as JSON |
| 2 | The copy's bucket blocks public access, is encrypted, is kept on a stack delete and a replacement, and expires copies after seven days | `ops/test.sh` |
| 3 | The box's role may put, get and list under its own box's path in its own bucket, and holds no delete and no other bucket | `ops/test.sh` |
| 4 | The records disk is gp3, encrypted, in the box's zone, at its own size parameter, and kept on a delete and a replacement | `ops/test.sh`, `volume_guard` widened |
| 5 | Any volume added with no policy is refused, which closes the backup-policy plan's row 14 | `ops/test.sh` |
| 6 | The deploy role may list the copy's bucket for the check, and nothing more on it | `ops/test.sh` |
| 7 | Litestream's version and checksum have one home, and the job and a release by hand both refuse a binary that does not match | `ops/test.sh`; the release's log |
| 8 | The copy's configuration names the records' file, the box's path, one sync a second, a full copy a day, and its own deleting off | `ops/test.sh` |
| 9 | c-storage's unit starts Litestream with c-storage as its child, and waits on the records disk's mount | `ops/test.sh`; the release on ridge |
| 10 | A release refuses to start c-storage when the records disk is not mounted | `ops/test.sh`; the release on ridge |
| 11 | A file already on the system disk is moved once onto a blank records disk with c-storage stopped, and the old one is kept | `ops/test.sh`; the release on ridge |
| 12 | A blank records disk whose box path in the bucket holds a copy refuses a fresh start and names the restore | `ops/test.sh` |
| 13 | `GET /api/status`, behind the internal key, answers the free bytes of the disk under the file and the last committed write's time, empty before the first | Go tests in `internal/server` |
| 14 | `/health` still answers its two fields alone | `TestHealthNamesTheBuild`, as it stands |
| 15 | The check is red when the newest copy lags the last write by over five minutes, when the newest full copy is older than six days, or when the records disk is below its floor | `ops/test.sh`, on written input |
| 16 | The restore writes a new file by default, refuses the live path unless named, and then moves the live file aside, never deleting it | `ops/test.sh` |
| 17 | A code registered seconds before is in the restored file, and a restore to a moment before it is not | `ops/drill.sh` on ridge, your run |
| 18 | The release's memory line is read with Litestream running | the release's log on ridge |

Rows 1 to 12, 15 and 16 run with no AWS on written input, as that suite's rows do. Row 13 is the
store's own gate. Rows 9 to 11, 17 and 18 are read on ridge, from your runs' logs.

## The steps

Sizes are machine minutes: an `ops/` template-and-guard step took 10 in the backup-policy piece,
a review with its whole check is about 20, a recap about 8 (`worktrees/runs.tsv`). 👤 marks your act.

| # | Step | Done when | Size |
| --- | --- | --- | --- |
| 1 | **The cheap end-to-end build, on this machine.** The copy's configuration, then a rehearsal: c-storage built and started on a scratch file, a code registered, Litestream copying to a folder instead of S3, a restore to a new path, and a second c-storage on that path. Litestream's v0.5 pages read first: retention off, `-exec`, restore to a moment, a full copy on an idle file | the rehearsal's log shows the second c-storage answering 409 to the same code, and a restore to a moment before it answering 201. A rehearsal, not a gate row. If the sandbox cannot fetch Litestream, its install is handed to you | 10 |
| 2 | **The templates** (`ops/network.yml`, `ops/env.yml`): the S3 door; the bucket; the box's role and profile on `Box`; the records disk and its attachment, with outputs naming both; the deploy role's list; the comment at `ops/env.yml#L92-L93` rewritten. AWS's page on `IamInstanceProfile`'s update behaviour read before. Guards in `ops/test.sh` | `bash ops/test.sh` at exit 0, rows 1 to 6 each seen red once, the count printed. cfn-lint is CI's | 10 |
| 3 | **The box's side**: `ops/c-storage.service` under `-exec` and waiting on the mount; the pin's one home; `ops/release.sh` sends Litestream with its checksum, mounts the disk, moves a file once, refuses rows 10 and 12; `ops/lib.sh`'s `box_resources` reads the records disk beside `/` (`ops/lib.sh#L491`); the deploy job fetches the pinned binary by checksum as it does ShellCheck (`.github/workflows/ci.yml#L186-L193`) and hands it to the release (`#L296-L302`). `ops/drill.sh`'s kill row reads `MainPID` (`ops/drill.sh#L52-L60`), Litestream's from now, and is reread | `bash ops/test.sh` at exit 0, rows 7 to 12 each red once; `shellcheck -x ops/*.sh` at exit 0 | 12 |
| 4 | **The reading**: `GET /api/status` in c-storage, its row in `everyRoute`, its Bruno request | `make check` in `services/c-storage/` at exit 0, coverage at 100 %, row 13 red once | 8 |
| 5 | **The check and the restore**: `ops/check.sh` reads the status through the tunnel and the bucket's newest copy; a new `ops/restore.sh <env> [--at <time>] [--onto-live]`; `ops/drill.sh` gains row 17; the runbook gains "Restoring the records" and the table its row (`ops/CLAUDE.md#L9`) | `bash ops/test.sh` at exit 0, rows 15 and 16 each red once; `shellcheck` at exit 0 | 10 |
| 6 | **The prose it makes false**: item 6's backup half and its put-only line; `docs/client-readiness.md#L278-L281`; c-storage's memo on the only copy; the architecture pages' storage sentence | the citation test at exit 0, and the branch's diff adds no local path | 5 |
| 7 | One review, on a model other than the author's, and the whole check | a verdict line, each finding with its line | 20 |
| 8 | The fix pass | each finding fixed, rejected or deferred with its reason; the gates of steps 2 to 5 again | 10 |
| 9 | The recap, before the piece lands; rows 9 to 11, 17 and 18 marked not yet known | committed in `docs/recaps/` | 8 |
| 10 | 👤 The network's change: `ops/stack.sh network --plan`, then without it | the machine reads the log whole: one addition, the door, nothing else changed | 5 to read |
| 11 | 👤 ridge's change: `ops/stack.sh env ridge --plan`, your first point, then without it | the log reads `Modify Box` with no replacement, additions otherwise, `== exit 0` | 5 to read |
| 12 | 👤 The release, by your push to `main` or `ops/release.sh ridge`, then `ops/check.sh ridge` | the release's log names the disk mounted and the memory with Litestream running; the check's log reads `== green` with the copy fresh | 5 to read |
| 13 | 👤 The drill: `ops/drill.sh ridge`, your second point | its log reads row 17 both ways and `== green`; `ops/check.sh ridge` after it green again | 5 to read |

Step 5, corrected 2026-11-12: the bucket layout in its first build, `<path>/ltx/9/`, was the file replica's (the folder rehearsal of step 1 showed it); Litestream 0.5.18's S3 client keys level 9 as `<path>/0009/<min>-<max>.ltx`, and the check and its fixtures now read that, the newest full copy picked by its largest name; the evidence is `orch/worktrees/research/2026-11-12-litestream-layout.md`, "The source at v0.5.18".

- [x] **Step 1, ticked 2026-11-11.** Litestream 0.5.18 (macOS arm64) copied c-storage's scratch file to a
  folder with `replicate -exec`; a code registered answered 201 and 409 again; a restore to a new path
  carried the code, so a second c-storage on it answered 409, and a restore to a moment before the
  registration answered 201. Read in Litestream's own pages and seen in the run: `retention: enabled: false`
  deletes nothing remote and logs a warning that idle databases get no new snapshots; `-exec` ends
  Litestream with a non-zero exit when the child exits (a child's exit 3 gave "exit status 3", Litestream
  exit 1), which keeps the unit's restart working; `restore -timestamp <RFC 3339>` restores to a moment;
  and an idle file got no new full copy in 35 seconds past a 20-second snapshot interval, so the hazard
  below is real and row 15's six-day limit is its only guard. The configuration is `ops/litestream.yml`.
  A rehearsal on this machine, not a gate row; no gate ran, as no guarded file changed.
- [x] **Step 2, ticked 2026-11-12.** The S3 gateway door, the copy's bucket, the box's role and profile, the
  records disk and its attachment, and the deploy role's list are in `ops/network.yml` and `ops/env.yml`, with
  their guards and `ops/testdata/changeset-copy.json` in `ops/test.sh`, on top of `pre-merge` at `95855e30`.
  `bash ops/test.sh` exit 0, `shellcheck -x` and `cfn-lint` exit 0.
  Each of rows 1 to 6 was seen red by one named mutation of the real template, then put back: row 1 the door's
  `VpcEndpointType` to `Interface`; row 2 `ExpirationInDays` to 1; row 3 `s3:PutObject` to `s3:DeleteObject` in the
  box's role; row 4 the records disk to `gp2`; row 5 the records disk's two policies deleted; row 6 the deploy
  role's `ListCopyBucket` pointed at the UI bucket. The old whole-template `StringLike` guard now leaves `BoxRole`
  out (its list is held to the box's path by a `StringLike` prefix); its own case, a trust with `StringLike`,
  still refuses in the green run. The mutations were batched, four then two to a run, each in a different guard.
- [x] **Step 3, ticked 2026-11-12.** The box's side is in `ops/litestream.pin` (the one home of the version and the
  arm64 sum), `ops/c-storage.service` (Litestream with c-storage as its child, waiting on the mount), `ops/release.sh`
  (the archive's sum, the mount, the one move, the refusals of rows 10 and 12), `ops/lib.sh`, `ops/drill.sh` and
  `.github/workflows/ci.yml`'s deploy job, with rows 7 to 12 guarded in `ops/test.sh`, committed as `7f3ae4b3`.
  `bash ops/test.sh` exit 0 on the final tree (log `2026-11-12 green2`, "all checks passed"), `shellcheck -x
  ops/*.sh walk/*.sh services/c-storage/scripts/*.sh`, `cfn-lint ops/network.yml ops/github.yml ops/env.yml
  --regions ap-southeast-5` and `actionlint` exit 0. Each of rows 7 to 12 was seen red by one mutation of the real
  file, then put back (backup first, tree compared equal after): row 7 the deploy job's `sha256sum -c -` line
  deleted ("does not check the Litestream archive's sum"); row 8 `enabled: false` to `true` in `ops/litestream.yml`
  ("own deleting is not off"); row 9 `RequiresMountsFor` deleted ("does not wait on the records disk's mount"); row 10
  the release's `mountpoint -q` refusal deleted ("does not refuse a records disk"); row 11 `rm -f` added before the
  move ("deletes a file"); row 12 the bucket check's `!= 0` made unreachable ("does not stop the release"). Rows 8
  to 12 shared one run, row 7 had its own (the first try deleted the ShellCheck step's line, not the Litestream
  step's, and stayed green). Rows 9 to 11's second halves are read on ridge.
- [x] **Step 4, ticked 2026-11-12.** `GET /api/status` is in `services/c-storage/internal/server/handlers.go`
  (`status`), registered in `Build`, behind the internal key. It answers `{"freeBytes", "lastWriteAt"}`: the free bytes
  of the disk under the file (`Store.FreeBytes`, the file's directory read through `pragma_database_list`, so `Build`
  keeps its signature) and the last committed write's time (`Store.LastWrite`, kept by the process after a commit and
  after a registration), `null` before the first since the process started. Its row is in `everyRoute`, its request is
  `bruno/04-the-reading/01-status.yml` (not run: Bruno CLI is not in the sandbox, `make check` holds its shape).
  `make check` in `services/c-storage/` exit 0, "coverage: 100 % of statements outside cmd/server" (log
  `orch-49-continuous-copy/gate.log`, last line `== exit 0`). Row 13 was seen red by three mutations, each put back
  (backup first, compared equal after): the commit's note of the write deleted (`TestTheStatusNamesTheLastCommittedWriteAndNoRefusedOne`,
  "want later than the registration's"), the note moved before the precondition check so a refused write counts (the
  same test, "after a refused write ... unchanged"), and the free bytes forced to 0 (`TestTheStatusHoldsTheFreeBytesAndNoWriteTimeBeforeTheFirstWrite`).
  Two old tests touched, named: `TestAStoreFailureIsAGeneric500`'s last loop takes the first five routes (the status
  reads no services table), and `TestEveryServiceRouteRefusesAMissingOrWrongAdminKey` skips the status path (it takes
  no admin key). The seven-routes count in c-storage's `CLAUDE.md` and `README.md` follows.
- [x] **Step 5, ticked 2026-11-12.** `ops/check.sh` gains a step that reads the copy: c-storage's `/api/status`
  read on the box (`copy_status` in `ops/lib.sh`; the internal key goes from its file into curl's config on stdin and never
  leaves the box, so it runs on a real environment too) and the bucket's objects under `Box/records/`; `copy_problems`
  names a red for a copy more than 300 s behind the last write, a newest full copy (the `0009/` level) over six days old,
  none at all, or the records disk under 1 GiB free. The new `ops/restore.sh <env> [--at <time>] [--onto-live]` runs
  `box_restore` (in `ops/lib.sh`) on the box: by default a new file `restored-<stamp>.db` on the records disk, nothing live
  touched; `--onto-live` stops c-storage, moves the live file, its wal, shm and Litestream's state folder to `.aside-<stamp>`
  (never deleted), puts the restore on the live path and starts c-storage; `--onto-live` is refused on an environment that
  may hold real data, where the default alone runs. `ops/drill.sh` gains row 17 (a restore of the newest copy holds the code
  registered before the reboot, a restore to the box's clock from before it does not; the drill removes its own two files);
  it is not run here. The runbook gains "Restoring the records" and its row in the at-a-glance table and the production table.
  `bash ops/test.sh` exit 0 ("all checks passed", 803 ok lines before the final run) and `shellcheck -x ops/*.sh walk/*.sh
  services/c-storage/scripts/*.sh` exit 0. Row 15 was seen red by three mutations of `copy_problems`, each put back (backup
  first, compared equal after): the lag limit made huge (lag case), the full-copy limit made huge (old-full case), the floor
  comparison reversed (every sound case red); the first batch hid the other two behind the floor, so lag and full were rerun
  together. Row 16 was seen red by the restore's target changed to the live path (the guard, "does not write to the new
  file") and the script's default flipped to the live path (the guard and the whole run's "writes a new file" cases). Unproven
  here: the bucket's key layout (`0009/` for full copies, from Litestream's S3 client source, which corrected the first build's `ltx/9/`) is not yet seen against S3, and a full listing of
  the prefix grows with the writes (seven days at most); both are for the check on ridge. Row 17 and the blank-disk restore
  are the drill's and your runs'.
- [x] **Step 6, ticked 2026-11-12.** The prose that the copy made false now says what the scripts do, and that
  nothing has run on an environment yet: `docs/open-items.md` item 6 (its backup half rewritten, the put-only line
  replaced by "may put, get and list, never delete" and the restore on the box), `docs/client-readiness.md` (the
  one-copy section and the first item of the before-a-real-client list), `docs/memo/c-storage.md` (the section on the
  only copy is now "A second copy follows the file within a second", its anchor re-pointed in `ops/README.md` and
  `services/c-storage/CLAUDE.md`), `docs/architecture.md` (the records box in the diagram), and
  `docs/architecture-detail.md` (the nightly-backup finding and the store's table row). The citation test exit 0 and
  prettier over the pages touched exit 0; the branch's added lines hold no local path. One fix outside the row: step
  2's tick above named a gate log by file name, which the citation test refused, so its words now say only that the
  run ended at exit 0. The merge of `pre-merge` came in with no conflict; `bash ops/test.sh` on the merged tree exit 0.
- [x] **Step 8, ticked 2026-11-12.** The review's one High, three Mediums and eight Lows, on top of `pre-merge` at
  `fab8d02a` (taken in first; conflicts in four pages and in `ops/test.sh`, resolved by keeping the copy's prose and
  `pre-merge`'s layer-four pin). **High 1:** the copy's address now carries the bucket's region
  (`s3://<bucket>/<path>?region=<region>`, which Litestream 0.5.18 reads in `cmd/litestream/main.go` before it falls
  back to asking `us-east-1`), so the unit, the restore and the drill's row 17 (all read the one `copy.env`) start
  against the bucket; the row refuses a release that writes the address with no region, seen red. **Medium 1:**
  `DESTROY_BY_HAND` lists the copy bucket and the records disk, `ops/destroy.sh` empties and deletes the copy bucket,
  accepts the records disk on the box, reads back the stack delete's snapshot of it, and no longer says the records
  are one file on the root disk; row 14 is green on the merged tree, its control moved to an invented pair, and a
  whole run on a stack with both resources, with two refusals, was added; the whole run seen red with the bucket's
  delete removed. **Medium 2 (the smaller fix):** after a restart the check's green line says the lag was not read and
  never says the copy holds the last write; seen red against the old line; the reading that survives a restart is open
  item 378. **Medium 3:** `ops/restore.sh <env> --onto-blank` is the one path (format if blank, mount, restore, before
  c-storage starts), the release refuses a disk with no `c-storage.db` while the bucket holds a copy (blank, or
  mounted by hand) and names it, and the runbook says "never release before the restore"; seen red with the dispatch
  broken and each guard mutated. **Lows:** the path is passed from `COPY_PATH` (1); the role guard reads the list's
  prefix condition (2); the trust guard reads every role's trust, not a cut between two names (3); a default restore
  refuses under twice the live file free (4); the `--onto-live` failure names the stopped c-storage and the
  `.aside-<stamp>` files (5); the recovery prose and the quote of item 6 follow the records disk (6); the moved
  line citations in living pages (35 by the review's count, 38 by a line-by-line comparison with `pre-merge`) were converted to a
  file and a name, one left that is pinned to a commit and so stays right (7); the
  500 tests skip routes by path (8). Deferred as items 378 to 382. On the merged tree `bash ops/test.sh` exit 0 with no
  FAIL line, `shellcheck -x` as the gate runs it exit 0, `cfn-lint` on the three templates exit 0 (none was touched), the
  citation test exit 0, prettier over the pages touched exit 0, and c-storage's server package tests exit 0. The reviewer's reread then found two more, fixed the
  same day: the blank-disk restore now falls back to the release's sent files on a box no release has finished on, and both
  scripts replace a stale fstab line for a new disk; the default restore's free-space sum no longer stops when c-storage is
  stopped and has no write-ahead file. Each has a row, seen red against the first build's form; the whole `bash ops/test.sh`
  ran again at exit 0 with no FAIL line, then the citation test exit 0. Two reread notes went into item 382.
- [x] **Step 9, ticked 2026-11-12.** The recap is `docs/recaps/2026-11-12-continuous-copy.md`, with the stack runs, the first release, the drill's restore and the look marked not yet known; `docs/products.md` gains the copy's row and its second known gap now says the copy is written and not yet run. `pre-merge` was taken in at `3ef04cd2`; the two conflicts (a destroy line and a test line, each side kept) were resolved by hand. The whole `ops/test.sh` and the citation test run on the final tree before the commit.

About 93 machine minutes for steps 1 to 9 and 20 more to read your four logs. A stack change of
yours ran in about a minute and a half on 2026-11-08; a release or a drill, about five each.

## The order, and what it waits on

- **Steps 1 to 9 wait on nothing.** Steps 10 to 13 wait on ridge being back, by
  `docs/plans/2026-11-09-ridge-reup.md` on `ridge-reup`, through its stack and its release, and on
  this piece's merge to `main`.
- **The two merges.** Step 2 changes `ops/network.yml`, `ops/env.yml` and `ops/test.sh`. Step 3
  changes `ops/c-storage.service`, `ops/release.sh`, `ops/lib.sh`, `ops/drill.sh`, `ops/test.sh`
  and `.github/workflows/ci.yml`, and adds the pin. Step 5 changes `ops/check.sh`, `ops/drill.sh`,
  `ops/README.md` and `ops/test.sh`, and adds `ops/restore.sh`. Ridge's re-up, at `a352b6c6`,
  changes only its plan. If its revision touches any of these files it merges first and this
  branch takes it in, since ridge is re-made from `main` before this piece changes it.
- **This adds a program to the box.** The activity log's milestone reads the box's memory once
  with all programs running. That reading comes after step 12 here: four of your logs read 273 to
  279 MiB free with c-storage alone (the final architecture page's count), and Litestream's pages
  give no memory figure. The release's floor still refuses below 96 MiB (`ops/lib.sh#L18`).
- **The watch's milestone** gets this piece's reading for its scheduled check, and its alarm.

## The human's points

**1, at step 11: the change set for ridge.** You will read the `--plan` of ridge's environment. It
should add the copy's bucket, the box's role and profile, and the records disk with its
attachment, and modify the box in place, its replacement "False". Yes: run it without `--plan`. No,
the box shown as replaced or "Conditional": the guard has already refused it and nothing changed;
the piece then finds another way to give the box its role.

**2, at step 13: the records came back.** You will read the drill's log. A code was registered,
the copy was restored from S3 into a new file, and a second c-storage reading that file knew the
code; a restore to a minute before did not. The live records were never touched. Does that read
true as a lost disk costing about a second? Yes closes item 6's backup half. No reopens the piece
at the row that did not convince you.

## Hazards no gate catches

- **An idle file can outlive its copy.** Litestream's page warns that with its own deleting off, an
  idle database may lose its coverage. If an idle file makes no new full copy, the seven-day rule
  would expire the only one. Row 15's six-day limit turns that into a red check before it happens;
  step 1 reads whether it can happen at all.
- **A copy that stops is silent until the check runs.** Here that is after each deploy, by hand;
  the scheduled check and its alarm are the watch's.
- **A save answered as saved can still be lost** in the last second before a disk dies. Only
  writing each save to a log off the box first loses nothing, and the final page names that as
  what would flip this design.
