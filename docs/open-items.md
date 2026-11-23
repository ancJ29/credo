# Open items

Numbered, never renumbered; an entry is deleted when done
([documentation](conventions/documentation.md)).

**"A client's own stack" or "a client's stack", in a trigger or a severity below, means the first
stack that holds a real tenant's data.** The items were written when each client was to have a
stack of its own; since 2026-11-11 the shape for production is one stack
per environment with its tenants pooled on boxes (what of it is built is in
[the detail page](architecture-detail.md#pooled-on-boxes-in-the-same-one-stack-what-is-built-and-what-is-not)), so
such a trigger fires at that environment's stack, not at a stack for each client.

## 1. A client's server that stops reaches no one — the machine proposes, the human places the alert; waits for a signed client (the architecture plan, 2026-10-27)

Ridge's four alarms are applied and one was forced there on 2026-11-13, its alarm and its return to
normal each reaching the Slack channel ([the recap](recaps/2026-11-12-slack-alarm.md), [the
runbook](../ops/README.md#the-watch)). Open: the scheduled check that fails when the continuous copy
lags or the disk is low, production's alarms (one more stack, the same four, applied and one forced
before the first client goes live), and a spend alarm. Where production's alert lands is the human's.

## 2. The plan's assumptions are unmeasured — *parked* until a review (the architecture plan, 2026-10-27)

Its costs rest on about 1 M BFF calls, 23 GB and 100 ms of Lambda a call, per client a month, and
its box on c-storage holding in a `t4g.nano` with swap. The nano is read on the first box: its
memory and any OOM kill. The rest is read on the first client's first bill, with whether the BFF's
answers to CloudFront are billed.

## 3. The demo's language — *parked* until the first feature's plan (the big picture, 2026-10-27)

The 11-04 screenshots and video come from the demo, and the old app's screens came in English
and Vietnamese. Which one the demo shows, or both, is the human's call, at the first feature's
plan, since it decides each walk's words.

## 4. The network's and an environment's YAML templates — the machine writes, the human runs; built first for ridge (the architecture plan, 2026-10-27)

Home: [the ridge plan](plans/2026-10-28-ridge.md#the-templates). Hand-written CloudFormation, shipped
through change sets, in Malaysia: `ops/network.yml`, the one network (a VPC with no internet
gateway, its Instance Connect Endpoint; the S3 gateway endpoint is not there yet, it comes with the backup, item 6),
`ops/github.yml`, the account's OIDC provider for GitHub's tokens, and `ops/env.yml`, one
environment's stack (subnet, box, the role its deploys take; with piece 1 its function, bucket and
distribution). ridge is the first stack from each. Production is one more stack from `env.yml`,
and still waits for a client; in the pooled shape it holds every tenant
group's box, and its tenants' names sit under one wildcard certificate requested in `us-east-1`
(the stack's `Domain` and `CertificateArn` settings; ridge's is the next act of the human's),
with one wildcard name in Cloudflare
([how a call finds its tenant's box](architecture-detail.md#how-a-call-finds-its-tenants-box)). A
tenant takes a stack of its own only where its contract needs its keys apart.

## 5. The arm64 builds and how each release lands — the machine writes, GitHub Actions runs on the human's push to main; c-storage's first, for ridge (the architecture plan, 2026-10-27)

Home: [the ridge plan](plans/2026-10-28-ridge.md#deploys-from-github-actions). c-storage's Go binary
for arm64, built from `main` alone, sent to its box over the Instance Connect tunnel and run under
systemd. `ops/release.sh` does this, run by GitHub Actions' `deploy` job on each push to `main`, or
by the human while Actions is down. The BFF's function for arm64 comes with piece 1, in the ridge
plan's fourth layer, which decides how CD ships it (planned in [ridge-app](plans/2026-10-28-ridge-app.md#layer-four)).

## 6. The restore onto a blank disk and onto an added box — run only on stand-ins; the copy, its check and its restore ran on ridge on 2026-11-13; the human runs the two (the continuous-copy plan, 2026-11-11)

**The backup half ran on ridge on 2026-11-13.** The check read the copy within 300 seconds of the last
write, and `ops/drill.sh ridge` restored the newest copy holding a code registered before a reboot, and a
copy from a moment before not holding it ([the recap](recaps/2026-11-12-continuous-copy.md)); one demo copy
was restored alone the same day ([its recap](recaps/2026-11-13-store-pages-copy.md)). **What stays open is
two restores run only on stand-ins:** onto a real blank disk (`--onto-blank`) and onto a box added to the
stack (`--box <name>`, [its recap](recaps/2026-11-17-move-fixes.md)); the item closes when both have run on
ridge. The fence half is the backup-policy piece's (below).

How it is built, each line read off the scripts:

- **The copy:** `ops/c-storage.service` starts Litestream with c-storage as its child
  (`litestream replicate -exec`), and waits on the records disk's mount (`RequiresMountsFor`). Its
  configuration, `ops/litestream.yml`, syncs once a second, takes a full copy every 24 hours while the file
  is written, and deletes nothing itself (`retention.enabled: false`); the bucket's own rule expires copies
  after seven days. The records live on a disk of their own, which `ops/release.sh` mounts, formats when
  blank, and moves the old file onto once (the old one kept as `c-storage.db.moved`).
- **The box's role** may put, get and list under its own path in its own bucket, and holds no delete. So
  the box restores itself, under its own role: `ops/restore.sh` runs on the box, not from the human's
  terminal with a copy of Litestream on the Mac.
- **The check:** `ops/check.sh` reads c-storage's `GET /api/status` on the box and the bucket's objects
  under the box's path (`copy_status` and `copy_problems` in `ops/lib.sh`). It is red when the newest copy
  lags the last write by over 300 seconds (`COPY_LAG_S`), when the newest full copy is over six days old
  (`COPY_FULL_MAX_S`), when the bucket holds no copy or no full copy, or when the records disk has under
  1 GiB free. c-storage keeps the time of its last write in memory only, so after any restart the lag cannot
  be read, and the check's green line then says so and does not claim the copy holds the last write (a
  reading that survives a restart is item 378 below).
- **The restore:** `ops/restore.sh <env> [--at <time>] [--onto-live | --onto-blank] [--box <name>]` (`box_restore` and `box_restore_blank` in `ops/lib.sh`). By
  default it writes a new file, `restored-<stamp>.db`, on the records disk and touches nothing live.
  `--onto-live` stops c-storage, moves the live file and its companions aside (never deleted), puts the
  restore on the live path and starts c-storage; it is refused on an environment that may hold real data
  ([the runbook](../ops/README.md#restoring-the-records)).
- **A records disk with no `c-storage.db` whose path in the bucket holds a copy is a restore, never a fresh
  start:** the release refuses it (blank, or formatted and mounted by hand) and names `ops/restore.sh <env>
  --onto-blank`, the one scripted path (format if blank, mount, restore, all before c-storage starts), since
  an empty file would otherwise be copied over the real one.
- **The copy's address carries the bucket's region** (`s3://<bucket>/<path>?region=<region>`, the release's
  `copy.env`): Litestream takes its region from that query or its own config, never from `AWS_REGION`, and
  with none it asks `us-east-1` where the bucket is, which the box's role does not grant and the box cannot
  reach. From Litestream 0.5.18's source, and seen on ridge, where the copy started against the bucket.

Unproven, as above: a restore from an empty disk (`ops/restore.sh --onto-blank`) on a real blank disk, and
one onto an added box. Litestream makes no full copy of a file that has not been
written, so a file idle for six days reads red on the check by design: the check is what notices it.

**The fence half (widened by the client-readiness read, 2026-11-07), corrected 2026-11-08 and built
in [the backup-policy plan](plans/2026-11-08-backup-policy.md); closed with that piece's recap commit; the
human's change set was run on ridge as `--plan` on 2026-11-08 at 16:44 and refused by the guard
(`Modify Box` at `replacement=Conditional`, the property's class, not a verdict; the reason is in
[the memo](plans/2026-11-08-backup-policy-conditional-memo.md)), and then re-run on ridge at 17:10 with `--take Box` (the project's logs folder, `logs/2026-11-08-171042-stack-ridge.log`: the guard passed on the take, UPDATE complete, `== exit 0`, the execute step 32 seconds). **The fence is live on ridge**, and it is proved on the running box by the receipt, not inferred from the 32 seconds: read off the live machine afterwards (`logs/20261108-1715-ridge-box-fence-receipt.log`): the same instance, launched 2026-10-28 and running, so it was not replaced; the root device with `Keep: false`, which is the fence read off the box and not off the template; and no unattached volume.** The box's root volume holds the one SQLite file
(`ops/c-storage.service#L20`). Before the piece it carried `DeleteOnTermination: true` with no
`DeletionPolicy` and no snapshot, so a stack delete, an image or instance-type change taken with
`--take Box`, or the advice printed on a stack left in `ROLLBACK_COMPLETE` — "delete the stack"
(`ops/lib.sh#L294`, as of `0f7d69c1`, `main` before the piece) — took every record with it. The item first asked for a
`DeletionPolicy`/`UpdateReplacePolicy` of `Snapshot` or `Retain` "on the volume". Neither half could
be written: there is no volume resource (the disk is a `BlockDeviceMappings` entry of `Box`,
`ops/env.yml#L145-L151`), and on an `AWS::EC2::Instance`, which cannot snapshot, AWS's `UpdateReplacePolicy` page says CloudFormation reverts `Snapshot` to `Delete`, so
it would have read as protection and deleted the disk. What was done instead: `RetainExceptOnCreate` (deletion) and `Retain` (replacement)
on `Box`, `DeleteOnTermination: false` on the device (for a console termination, which
neither attribute reaches), a guard holding all three, a `ROLLBACK_COMPLETE` message that says the
stack holds nothing (that status exists only after a failed creation, whose rollback deleted the box), and the two ways to read what is kept
([the runbook](../ops/README.md#reading-what-the-fence-kept), untested). **Three named losses become
survivable; nothing else changes.** A termination, a torn file, a bad write or a wrong delete inside
the database are still unrecoverable, and the fence, though live on ridge (its change set was refused as
`--plan` on 2026-11-08 at 16:44, `Conditional` being the property's class as
[the memo](plans/2026-11-08-backup-policy-conditional-memo.md) explains, then applied at 17:10 with
`--take Box`), is not a copy: the copy above is the backup half, run on ridge on 2026-11-13.

## 8. Two places start c-storage — the machine; *parked* until a third caller (the app frame plan, step 6, 2026-10-28)

`bff/tests/c-storage.ts` (the route tests) and `scripts/src/running/processes.ts` with `scripts/src/stack.ts`
(`pnpm stack`) each start the real c-storage on a free port, with the same keys and the same health
wait. They share only the build (`bff/tests/build.ts`). They differ in what they need: the tests
retry a port taken between the probe and the bind and stop at the process's exit; the stack logs
to a file and reports a child that exited. A shared start would make `bff` or `scripts` depend on
the other for test code. Join them when a third caller appears, in a package both already depend
on.

## 9. A free port can be taken before the child binds it — the machine; *parked* until it bites (the app frame plan, step 6, 2026-10-28)

`pnpm stack` asks for a free port, then starts c-storage and the BFF on it. Another process taking
the port in between makes the child exit, and the stack stops naming the child and the end of its
log; running it again is the remedy. A stranger already answering on that port is not mistaken for
the child: `waitUntilUp` also needs the child's own log to say it is listening
(`scripts/src/running/processes.ts`). The route tests retry on another port. *Trigger:* a second
`pnpm stack` failing this way, when it retries too.

## 12. A lockfile for Bruno CLI in CI — the machine; *parked* until the CLI's dependencies are a problem (the ridge plan, step 12, 2026-10-28)

Home: [the ridge plan](plans/2026-10-28-ridge.md#deploys-from-github-actions). `npm install -g
@usebruno/cli@4.2.0` pins the CLI but not its 500-odd dependencies, and the `deploy` job runs it
beside the deploy role. The job installs with `--ignore-scripts` and runs `bru` without the job's
credentials, which holds the install scripts and the secrets. A lockfile (or a vendored install
checked by hash) would also pin the code that runs. Add it when a dependency's release breaks a
run, or when the CLI's version moves.

## 13. The public URL in front of ridge's c-storage, parked — the human; *parked* until someone or a machine beyond the human's Mac needs it (the ridge URL plan, 2026-10-28)

Home: [the parked plan](plans/2026-10-28-ridge-url.md), with its three calls, its shape (an HTTP API
and a relay function in ridge's subnet) and its steps. The human decided not to build it now. Until
then ridge's c-storage is reached through the tunnel from the human's Mac
([the memo](../services/c-storage/docs/memo/c-storage.md#no-public-url-for-now)). Trigger: someone other than the human, or a
machine other than the human's Mac, needs to reach it: partners sending requests themselves, or a CI
or tool outside AWS.

## 18. The stack's seed door answers any process on the machine — the machine; *parked* until a stack runs on a machine others log into (the employee list plan, step 9, 2026-10-29)

`scripts/src/seeding.ts` serves `POST /seed` on loopback for as long as a stack stands, so the full
run can open each screen on a client of its own. It asks for no key: any local process that learns
its port can make clients on that throwaway stack, which holds only invented data and goes down with
its command. The callers are not only processes: a web page open in the machine's own browser can
send a `POST` to a loopback port (a cross-site request needs no answer to do its work), and the
door's `Host` header is never checked, so a name that resolves to 127.0.0.1 reaches it too. On a
shared machine, hand the command a random key in its environment and have the door require it, and
refuse a `Host` that is not the loopback address and its port, with a test for each that refuses
a call without it.

## 23. A scripts test depends on how fast a child starts, and the gate's coverage goes red under load — the machine; *parked* until the scripts package is next touched (the employee list plan, step 14, 2026-10-29)

`scripts/src/running/processes.test.ts`, "it logged that it is listening, and the url still does not answer",
gives `waitUntilUp` 200 ms, and the child must log "listening" inside them. In a whole `pnpm check`,
where every package's tests run at once, the child sometimes starts later: the loop then ends before
it reaches the `fetch(...).catch(() => null)` in `processes.ts`, and the package's coverage reads
99.68 % and fails. Run alone, the package reads 100 % each time. The test passes either way; the gate
fails. Make the test wait for the child's log line before it starts the clock (a longer timeout would
only hide the cause).

## 24. `nextCode` can still make a code of 21 characters, and the add page then says "try again" — the machine; *parked*, on the human's word that it never happens (the employee list plan, step 15, 2026-10-29)

With a prefix of `EMP-` and a last number of 16 digits, `nextCode` makes a code longer than the 20 a code may be.
The BFF now parses the person before any write and answers 400, so no record the list cannot read is stored.
The add page reads that 400 as a failed save and says to try again, which never works. The human: "EMP-9999999999999999
never happen" (customers do not reach 1000). If it ever does, `nextCode` refuses at the limit and the add page says why.

## 27. The whole gate goes red under load on tests that pass alone, and a test seems to outlive its jsdom — the machine, at the next review; *parked* until then (the employee list plan, step 19, 2026-10-30)

Step 19's whole `pnpm check` went red twice before a green third run, at the same code, with `ui` and `visual` untouched.
Run 1, at a load of 12 to 20: `visual/src/cli.test.ts`, "With partners, takes a partner's Share post…", hit its 120 s timeout
in `pnpm answers`, and "stops on an answers file that does not parse" failed with `window is not defined`, plus 3 unhandled
errors. Run 2, at a load up to 30: two `ui` tests ran into their 5 s limit, `SignIns.test.tsx` "The root turns the email and the QR
sign-in on…" and `StaffRecord.test.tsx` "The editor refuses fields it cannot take…", and the run ended with SIGKILL.
To look into: why `window is not defined` appears after a timeout, and whether a test outlives its jsdom (a timer, a fetch or a
render still running once the environment is torn down). qa.md rule 6 reads these as defects; a longer timeout or a retry is no fix,
and no test is changed here.

Seen again in the fix pass of step 20 (2026-10-30), two more reds. At 12:38 the whole check's `ui` run failed on `ImportPage.test.tsx`,
"The app gives a template in Vietnamese or English…", `expected [] to have a length of 1 but got +0`: not load but a real defect of the
test, which asserted the saved file before the lazily loaded libraries had loaded; fixed in `b0a1150` (it waits), seen red under a
300 ms delay in the load. At 12:42 the whole check (`logs/20261030-1242-employee-list-fix-pass-check.log`) failed again on
`ui/src/pages/client/StaffRecord.test.tsx#L301`, "The editor refuses fields it cannot take and says so…", `Test timed out in 5000ms` (5139 ms; the
file took 32079 ms): the load was 4.58 at the start and 15.55 at the end, with a second agent testing in another worktree, and the
`scripts` package was killed by that first failure. This is the same test as in run 2 above; it is load, and still unexplained.

Cause found for the `StaffRecord.test.tsx` reds (main merge, 2026-10-30). The first test typed 28 characters one key at a time with
`userEvent.type`: each key draws the whole staff editor (30 to 45 ms a key at a load of 4) and waits a turn of the event loop, so the
test took 1667 ms alone (`ui/src/pages/client/StaffRecord.test.tsx#L310`) and a loaded machine stretched it past 5 s. The second test's "Saved."
miss is not its own: a test that times out keeps running its remaining keystrokes, and they land in the next test's page (seen by
running the file with `--testTimeout=1000`: the second test then read `['ĐBỏ2 cl', …]`, the first test's `Đ` among its own keys). A
longer `findBy` would hide that; its default stands. The change: those two tests put text in with a helper `enter` (a click, then
`user.paste`), one draw per field; their rules are unchanged, and each mutation of the rule they hold (no refusal of invalid
fields, an option's English name saved as its Vietnamese one, an option's value lost, a removed field kept) is red from its
assertion. Alone, at a load of 3 to 5: the first test 1667 ms to 937 ms, the second 838 ms to 552 ms. Left open: the 1.0 to 1.4 s stories
named `SLOW` (a 20 s timeout, in this file and in `StaffSetupPage.test.tsx`) hold the same typing and the same hidden cause; a
longer timeout is what qa.md rule 6 rejects, so they should be made cheap the same way and `SLOW` removed. The `SignIns.test.tsx`
and `cli.test.ts` reds above were not looked at here, so the item stays open.

Seen on GitHub (the push of `main`@`983d454`, 2026-10-31, ci run 41177806474): the same test and "Search finds a person by any word…"
timed out at 5000 ms; the file took 58.7 s there against 40.7 s the day before. Cause: every `userEvent` call (and the search test's
key-by-key typing) hands the event loop a turn after each key and click, which a loaded runner stretches. Fixed in branch
`ci-timeouts`: the three Staff test files use one `userEvent.setup({ delay: null })`, and the search test and the two `SLOW` stories
paste where they are not about keystrokes. Alone: the refusal test 1572 ms to about 730 ms, the search test 972 ms to under 300 ms,
the two `SLOW` stories 2240 and 2291 ms to about 830 and 680 ms. `SLOW` stays until a run on GitHub shows them well under 5 s.
Still open here: the `SignIns.test.tsx` red. Item 23 (the scripts test) is not touched. The `cli.test.ts` reds have their cause (line 34, 2026-11-01): the shared
build's cost landed on the first test by run order, and when that test timed out `report()` went on with `installDom`'s globals, so the next
`beforeEach` hit `window is not defined`; the file's one build in a `beforeAll` removed it, and a timed-out build now skips the file's tests.

A scene can hang its full 30 s at a low load with no frozen process (line 31's review, 2026-11-01): the second `answer` in "With
partners…" (`visual/src/cli.test.ts#L214`) failed with "walk admin-staff, screen staff-14-search: the scene did not end in 30000 ms"
at a load of 1.4 to 1.8, the other draws in that process staying at 26 to 27 s
(`logs/20261101-0839-ci-timeouts-review-scene-hang.log`). Each step waits at most 3 s to find and 3 s to go still, so
`runSteps` settles well inside 30 s; the phase never reaching `done` or `failed` points at the status update not landing
(`visual/src/scene.tsx#L54-L66`, awaited at `visual/src/words.tsx#L120-L131`). A red like it is not filed under the sandbox's freeze,
and no test budget covers it. To diagnose after the 11-04 demo, or the first time it shows on GitHub: log in `drawnSceneWords`
whether `runSteps` had settled when the 30 s ran out. The 240 s for every `visual` test stays (Decide 48); item 37 holds the finer budget.

`ui/src/pages/client/StaffRecord.test.tsx#L315` (the editor's refusal of three bad fields) timed out at 5302 ms in a loaded whole check (`logs/20261101-0852-orders-delivery-check.log`). `4760ad9` cut it from 975 to 803 ms alone, a margin of about 2x under load. The next step, after 11-04 or at its next red: split it into its three cases, one behaviour a test (QA rules 1 and 4). **Done (line 36, 2026-11-01).** The next red was on GitHub, the push of `main`@`fae4dee`: 5351 ms of 5000 (`logs/20261101-1333-push-and-save-runs-ci.log#L2215`), where the test had run 1.9 to 5.4 s for days and 4813 ms at `fe7d31f`. What was left in it was the page's own draws, so it is split into four tests, each opening `/staff-setup` once: a field with no key is refused, the same key twice is refused, a choice with no options is refused and saved once it has one, and an option and a field are removed (the old test's tail, which its name never held). Alone: 267, 290, 614 and 477 ms (`logs/20261101-1356-staff-test-split-alone2.log`). Each is red from its own assertion with its rule's line changed and put back (`logs/20261101-1353-staff-test-split-red-*.log`, `20261101-1356-staff-test-split-red-nokey2.log`); the no-key test gives both names, since with them empty the names' own rule refused the field and the key's rule was held by nothing (two reds with the key's rule changed passed, `20261101-1353-staff-test-split-red-nokey.log` and `20261101-1355-staff-test-split-red-nokeyretry.log`). No budget or retry changed; `SLOW` stays as it was.

Line 32's review (2026-11-01): at slice 3's step 4 `scripts`' `apply.test.ts` row 22 went red at 123 s of its 120 s, and `visual` ran 227.67 s of its 240 s (`logs/20261101-0942-driver-phone-red-scripts-generator-and-apply-timeout.log`).


## 30. Adding a passkey in Safari may be refused — the machine, with the human's 3 minutes; *parked* until the console is used in Safari (the operator console plan, step 8, 2026-10-30)

One click on "Add a passkey" (`ui/src/pages/operator/PasskeysPage.tsx`) runs two WebAuthn ceremonies: the touch of a
passkey already held (`passkeys.authenticate`), then the registration (`passkeys.register`). WebKit
may spend the click's user activation on the first and refuse the second, so an operator on Safari
might never add a second passkey. Chromium and jsdom have no such rule, so no test or walk can see it;
nothing here has been tried in Safari.

**The check (3 minutes):** on the local stack, sign in in Safari, add a passkey, remove one. If the add
works, delete this entry.

**The fix, if it fails:** the confirm touch gets a click of its own, and the add its second click, so
each ceremony has its own user activation. The picture of pk-2 stays as it is.

**Why parked:** the console is Chrome-only for now, the human's call (Decide 24, 2026-10-30).

## 31. Nothing on a phone shows that a wide table scrolls sideways — the machine; *parked* until the phone screens' own look (the employee list plan, step 26, 2026-10-30)

On a phone, a wide table scrolls sideways inside its box, and nothing tells the person so: Mantine's
`ScrollArea` draws its scrollbar on hover only, and a thumb has no hover. It touches the two
`Table.ScrollContainer`s, the import preview's (`ui/src/pages/client/ImportPage.tsx#L262`) and the staff list's
(`ui/src/pages/client/StaffListPage.tsx#L192`), so a field manager who opens the list on a phone sees the first
columns and may not know that the rest is there. The fix, if taken: `scrollAreaProps={{ type: 'auto' }}`
on both, which keeps the scrollbar on screen. It would move the pictures of staff-1, staff-8 and
staff-14 at 390 and 768 wide, in both languages, and the human is asked about them again. *Trigger:* the
human's look at the phone screens, or a partner who did not find the columns.

## 33. The walk script's stray-stop loop and its Ctrl-C path were never run, and the strays' choice reads working folders with `lsof` — the machine; *parked* until a stack is left behind or a run is interrupted (the walk-steady plan, step 7, 2026-10-31)

`walk/run.sh` stops a process of credo's whose parent is 1 (TERM, five seconds, KILL) and names what is
left running on a Ctrl-C. The stand-in tests in `scripts/src/walk-run.test.ts` never reach either: the
sandbox cannot signal a process an earlier command started or read the process list. The first real
stray or interrupt shows them; read that run's log for the `stopped` lines. The BFF a stack starts is
matched by its relative `src/main.ts` only when `lsof` puts its working folder under the root
(`scripts/src/running/strays.ts`), so a Mac where `lsof` is denied leaves such a BFF running and the next run
refuses on it by name. A Ctrl-C during the first step's listings ends as a refusal (exit 2), not 130;
nothing was acted on. *Trigger:* a refusal naming a stray the script did not stop, or a log with
`stopped` lines that look wrong.

## 34. Three technical rows of the lists are held weakly: the list's 500 log, the write's precondition, the fake's code order — the machine; *parked* until the lists are next touched (the customers and products plan, step 6, 2026-10-31)

The review of the lists found three technical rows (the case table's 13, 14 and 19) whose test passes
with the behaviour broken. Under the demo's ceremony (Decide 46) only the High and the Medium findings
are fixed; these stay.
- **Row 14:** the 500 on a short or unparsable list is asserted by status and by the key being absent
  from the body, but the log line is never read. Capture the logger as
  `bff/src/routes/employees.route.test.ts#L1132` does and assert it names the kind and never the key.
- **Row 13:** the record is written with `If-None-Match: *`, but no test would fail if the precondition
  went. Record the `ifTag` the wrapped client receives in the "adds each row" test of
  `bff/src/routes/lists.route.test.ts` and assert it is `null`.
- **Row 19:** the fake lists in code order, but no test imports a code that sorts first. Import one at
  `ui/src/fake.test.tsx#L594` and assert the list starts with it.

*Trigger:* the lists get a by-hand add or edit, or a reader of a test names one of these three.

## 35. Orders and requests: four small things left under the demo's ceremony — the machine; *partly closed* by edit-an-order (2026-11-07): the first bullet is `[FIXED]`, the rest parked (orders-delivery, step 6, 2026-10-31)

Found while building the BFF half; none breaks a demo step or the gate, so none is fixed now.
- **`[FIXED]` in edit-an-order, step 4 (`20ba3846`):** **a first save that carries a `version`** is
  refused 400 and no order is made (case 6, `bff/src/routes/orders.route.test.ts`).
- **A cancelled request's order is freed by one write that may not land** (`bff/src/routes/orders.ts`, the
  request's cancel; the same again in the close of a driver's day, item 41 finding 3): a moved order is left as it is and the page reads the request as none, so the
  order offers to send again either way; no test moves the order between the two writes. Also a
  false conflict (`bff/src/routes/orders.ts#L388-L406`): a send pressed on a page read between the two
  writes meets a 409 though nothing the page showed has moved, in a window of milliseconds; a
  re-read that compares the shown order would recover it.
- **The orders list reads each day of the span and each day its requests name**, one list read a day:
  at S2's busiest, a week is at most 14 reads. A report over a longer span would need an index.
- **`GET /api/drivers` asks `orders.canEdit`**, as the fake does, not `orders.canView`; a viewer who
  opens Confirm has none to see. Right while only an editor confirms.

*Trigger:* the orders get a second caller (a report, a driver's phone), or a reader of a test names one.

## 36. Orders, review findings 3 to 8, deferred under the 11-04 demo's exception — the machine; *partly closed* by edit-an-order (2026-11-07): findings 4, 5 and 8 are `[FIXED]`, 3, 6 and 7 stay parked; finding 5 re-read and confirmed fixed by money-defects on 2026-11-08 (orders-delivery, step 7, 2026-11-01)

Found by the line 30 review; only its High and Medium findings are fixed under the demo's ceremony
(Decide 46). None breaks a demo step or the gate.
- **Finding 3, `bff/src/routes/orders.ts#L341-L347`:** the order's cancel drops the request write's `moved`
  result, so from slice 3 a request delivered between the read and the write leaves a cancelled order
  beside a delivered request. *Fix (slice 3):* on `moved`, re-read the request; if still waiting, retry
  a bounded number of times; if delivered, answer 409 with the order.
- **`[FIXED]` in edit-an-order (step 2: the page sends the order's stored `extra`, case 10).** **Finding 4, `ui/src/pages/client/OrderPage.tsx#L118`:** every save sends `extra: {}`, a draft's re-save
  included, and the BFF stores it as given (`bff/src/routes/orders.ts#L274`); nothing writes an order's
  `extra` yet, so nothing is lost today. *Fix:* send `existing?.doc.order.extra ?? {}`, as
  `ui/src/pages/client/PersonPage.tsx#L329` merges into the stored one.
- **`[FIXED]` in edit-an-order (steps 2 and 4: the page draws a saved draft at its saved prices and marks a moved line, and a save reprices it, so the page's total and the request's agree).** *Fixed by that earlier piece on 2026-11-07, not by money-defects; the money-defects piece (2026-11-08; it was thought still open from `docs/client-readiness.md`) built nothing for it and only re-read the code and corrected the stale prose (recap `docs/recaps/2026-11-08-money-defects.md`). The form draws a saved draft at its saved prices and marks a moved line (`ui/src/pages/client/OrderPage.tsx#L90-L93`), a moved price alone makes the save worth making (`#L107`), and the moved price is shown (`#L220-L223`).* As filed: **Finding 5, `ui/src/pages/client/OrderPage.tsx#L86-L90` and `bff/src/routes/orders.ts#L303-L317`:** the form prices a
  saved draft from today's lists, but Confirm copies the saved lines, so after a price change the
  page's total and the request's total to collect differ. *Fix:* draw a saved draft at its saved
  prices and mark a line whose product's price has since moved, so that a save reprices it.
- **Finding 6, `bff/src/routes/orders-records.route.test.ts#L338-L347`:** row 18's second half ends at the
  503, so a numbering that hands out the lost number again would stay green. *Fix:* one more `made()`
  after the 503, expecting `DH-00002`.
- **Finding 7, `bff/src/routes/orders.ts#L367-L369` and `ui/src/fake.ts#L629-L632`:** requests sort by number
  as text, so the order breaks past 99,999 requests. *Fix:* one shared comparator for both, as
  `newestOrdersFirst` (`shared/src/orders.ts#L183-L186`) compares the length first, the next time
  either is touched.
- **`[FIXED]` in edit-an-order (step 4: the re-save schema takes a `tagSchema` version, a malformed one is a 400, case 5).** **Finding 8, `bff/src/routes/orders.ts#L262-L265`:** the PUT body extends `saveOrderRequestSchema` with
  `version: z.string().min(1)`, outside `shared/` and looser than `tagSchema`, so a malformed version
  reads as a moved one (409), not a 400. *Fix:* a re-save schema in `shared/src/orders.ts`, beside
  item 35's first bullet.

*Trigger:* the orders are next touched, a price changes in a demo (5), a real client's order volume
(7), or a reader of a test names one.

## 37. `visual`'s tests: review findings 4 and 6 of line 31 and a finer budget, deferred under the 11-04 demo's exception — the machine; *parked* until after the demo (ci-timeouts, step 3, 2026-11-01)

The review of line 31 fixed its High and Medium findings; these stay.
- **Findings 4 and 6 (`cli.ts`, `take.ts`):** retired with `pnpm answers` and `cli.test.ts` (the walks page, step 2).
- **The finer budget (Decide 48's (b), done honestly):** the build's readers under one `describe` with 240 s on that block alone,
  then `visual/vitest.config.ts`'s default lowered to what the other tests need (the slowest takes about 35 s on GitHub).
  Line 34's review adds: the five tests that read the build go under that `describe`, and the four that do not (the process put back,
  the command line, all lines refused, the unparsable file) stay outside, so a `-t` on them does not pay the draw.
- **Where `visual`'s ceiling is now (line 34's review):** `words.test.tsx` is `visual`'s slowest file, about 1.5 times the scene draws of
  the one build (four draws a piece-2 screen), so the real saving on GitHub is about 200 to 280 s, not 240 to 290; measure the file in
  the next GitHub run.

*Trigger:* after the 11-04 demo, or the `app` job nearing its 15 minutes, or line 32's screens pushing a whole-page test past 120 s.

## 38. The services status page: review findings 4 to 10 and 12 to 15 of line 24, deferred under the 11-04 demo's exception — the machine; *parked* until after the demo (the operator console plan, step 17, 2026-11-01)

The review of line 24 fixed its High and Medium findings and the Low that made the stamp visible on ridge (finding 11); these stay.
- **Finding 4, `ui/src/OperatorApp.tsx#L175`:** once the sign-in has ended, the minute's check meets the 401 again and `setEnded('idle')`
  resets the prompt, mid-touch included. Fix: `setEnded((was) => was ?? 'idle')` for every page's `onSignedOut`, and a fake-timer test
  (the prompt busy, a minute passes, still busy).
- **Finding 5, `ui/src/api.ts#L274`:** every services call carries `?renew=0`, so "Check now" keeps no sign-in open (row 8, "working
  keeps it"). Fix: the minute's turn and the return to view send `renew=0`; the opening and "Check now" do not; a test in `api.test.ts`
  and in the page test.
- **Finding 6, `bff/src/operator.route.test.ts#L92`:** no test tries a client root's handle on `/api/operator/services`. Fix: add the
  route to that loop.
- **Finding 7, `bff/src/routes/operator-auth.ts#L274`:** sv-5 is provoked by an options 503 the BFF never answers for c-storage (cue
  `operatorPasskeyOptions:503`, `visual/src/walks.ts#L554`, `walk/specs/operator-services.spec.ts#L82` and `#L182`). Fix: cue
  `operatorPasskeySignIn:503` in the fake and the scene; the full spec stubs the sign-in POST and lets the virtual authenticator answer the
  touch; or record why the shortcut stays.
- **Finding 8, `walk/run.sh#L44`:** the services row and its build stamp (`#L295-L304`) have no case in `scripts/src/walk-run.test.ts`.
  Fix: a case like the passkeys one: `--checks` lists both projects; with a stand-in `pnpm` the stack phase gets `CREDO_BUILD=4e1a9c7`;
  a `demo.ts` without the line is "red: the fake's build could not be read".
- **Finding 9, `bff/vitest.config.ts#L14`:** `bundle-main.ts`'s exclusion reason ("only names the bundle's file") is false since it reads
  `CREDO_BUILD`. Fix: name `ops/app.sh`'s refusal and `ops/test.sh` as where it is held, or move the env read into `bundleBff`'s default
  and test it.
- **Finding 10, `bff/src/build.ts#L1`:** the comment says nothing reads the build at run time, but the unbundled BFF and an unstamped
  bundle do. Fix: "Read where the module loads, unless the bundle's build replaced it with the commit (`bundleBff`)."
- **Finding 12, `scripts/src/generator.ts#L248`:** the hint's reason ("the roster was read empty") is inexact. Fix: "unreachable: the
  roster was just written holding the active operator alone, whose name the invited one's differs from (`shared/src/demo.test.ts`)".
- **Finding 13, `bff/src/app.ts#L89`:** a 5xx's log line carries the cause chain, the c-storage address included (every route since the
  client was written; the open page adds one a minute while c-storage is down). Fix: log the `CStorageError`'s message and status without
  its cause, and a route test that searches the logger's output for the base URL.
- **Finding 14, `shared/src/wire.ts#L175`:** `servicesReplySchema` is strict, so a field added later reads as "the BFF does not answer" in
  an older tab. Fix: loosen the UI's read (`ui/src/api.ts#L283`) in the commit that adds the field.
- **Finding 15, `walk/specs/operator-services.spec.ts#L119`:** the full spec pauses the page's clock, a first in the walks, never run;
  Mantine's transitions run on the timers it stops. Fix: if step 19's sv-1 or sv-2 differ from the fake's at "Check now", look here first.

*Trigger:* after the 11-04 demo, or step 19's full walk reading one of these.

## 39. The driver's phone: line 32's review findings 2 to 6 and 8 to 14, deferred under the 11-04 demo's exception — the machine; *parked* until the deliveries are next touched, and worked after the demo (driver-phone, step 7, 2026-11-01)

Found by the line 32 review; only its Medium finding is fixed under the demo's ceremony (Decide 46). None breaks a demo step or the gate.
- **Finding 2, `bff/src/routes/orders.ts#L362-L365`:** the order's cancel still drops its request write's `moved` result (slice 2's finding 3, the plan's parked 6), so a cancel racing a delivery leaves a cancelled order beside a delivered request with a photo. *Fix:* read the write's result; on `moved` re-read the request: delivered, answer 409 with `orderDoc`; still waiting, retry a bounded number of times. Test: a flaky client that delivers the request just before the cancel's request write.
- **Finding 3, `bff/src/routes/orders.ts#L396`:** no test holds the "not allowed to deliver" check on a request's read (`someone` and the other driver are refused at `#L398` anyway), so a driver whose right was taken away still reads their own photo. *Fix:* two assertions in `bff/src/routes/deliveries.route.test.ts#L368-L397`: that driver reads their delivered request's photo, 403; `someone` on a request id that is not there, 403.
- **Finding 4, `bff/src/routes/orders.ts#L473-L483` and `ui/src/pages/client/MyDeliveryPage.tsx#L74-L77`:** when only the order's write fails, deliver answers 503 and the phone says "Not sent" for a request it delivered. *Fix:* treat the fulfil write as best effort, catch it, answer 200, and change `bff/src/routes/deliveries.route.test.ts#L242` to expect 200.
- **Finding 5, `bff/src/app.ts#L76` and `bff/src/routes/orders.ts#L453-L455`:** a body up to 1 MiB (Fastify's default) is read and parsed before the sign-in and the 200 KB check. *Fix:* a route `bodyLimit` of about 300 KB on deliver and about 80 KB on the person's photo route.
- **Finding 6, `ui/src/photo.ts#L45`:** `imageOrientation: 'from-image'` is a TypeError in a browser that predates the value, so every picture fails to shrink. *Fix:* on a TypeError, retry `createImageBitmap(file)` without the option. The human's phone at step 13 settles whether it is needed.
- **Finding 8, `ui/src/photo.ts#L8`:** the rule 8 hint says the walk's browser and the human's phone hold the bound, the quality loop and the orientation; the walk's 240x180 PNG meets none. *Fix:* "the walk's browser runs it on a small PNG; the bound, the quality loop and the orientation meet a real photo only on the human's phone (step 13)".
- **Finding 9 (skew and rollback), `shared/src/orders.ts`:** an office tab opened before the deploy fails to parse `fulfilled`, `delivered` and `deliveredAt` until reloaded, and a BFF rolled back past this slice answers 500 for any day with a delivered request. *Fix:* a line in the recap's hazards (same class as slice 2's finding 9).
- **Finding 10, `bff/src/routes/orders.ts#L52-L55` and `ui/src/fake.ts#L699`:** the module comment says an order naming a request that is "not waiting" reads as having none, which a delivered one no longer does; the fake stamps the real clock into `deliveredAt` (QA rule 7). *Fix:* "not there, or cancelled"; a fixed time, such as the data set's today at 10:00.
- **Finding 11, `scripts/src/generator.ts#L253`:** the generator signs a driver in once per delivered request, about a dozen scrypt checks and session records per seed. *Fix:* sign each driver in once per seed, keyed by code.
- **Finding 14, `bff/src/routes/orders.ts#L444-L451`:** two delivers of one request at once by its driver let the losing call's photo overwrite the winner's (same driver, same goods). *Fix:* none now.
- **Finding 14, `walk/specs/piece-2.spec.ts#L125` and `walk/specs/orders.spec.ts#L126`:** `withoutDriversAllowed` is written twice with two signatures. *Fix:* fold it into `walk/support.ts` when either spec is next touched.

*Trigger:* after the 11-04 demo, the deliveries next touched, a cancel and a delivery seen racing, or the human's phone at step 13 showing a picture refused.

## 40. The five address masks carry no label — the machine; *parked* (check-host-yes-no, line 37, 2026-11-01)

`app_load` masks the app's and the API's address and host with no label (`ops/lib.sh`, the four `mask` calls in `app_load` and `outputs_show`'s `mask "$(out ApiAddress)"`), so a match in a log reads "a key is in this log: delete it and replace the key" when the value is an address. *Fix:* pass a label such as "the app's host" as `mask`'s second argument, so the red reads "redact it in this log; nothing to replace"; a test case holds the words.

*Trigger:* the next red that names a key where an address matched.

## 41. Slice 4, đối soát: line 35's review findings 1 to 11, deferred under the 11-04 demo's exception — the machine; *partly closed* by money-defects (`f6a12579` to `333a7f2d`, 2026-11-08): findings 2 and 7 are `[FIXED]`, finding 5 half so, the rest stay parked until the day's end is next touched (driver-reconcile, step 6, 2026-11-01)

Found by the line 35 review (Opus 5.5, 2026-11-01 14:27, `review-a`@`beeaedb`; its file is `logs/20261101-1427-driver-reconcile-review.md`, its runs `logs/20261101-1424-driver-reconcile-review-runs.log`). It found no High and no Medium, so under the demo's ceremony (Decide 46) nothing is fixed now; each finding is `[DEFERRED]` here. None breaks a demo step or the gate.
- **Finding 1, `docs/plans/2026-11-01-driver-reconcile.md`, step 5's evidence:** row 5's two clauses were seen red only through other rows' assertions (the BFF's through the 409 body, the UI's through the Closed table). *Fix:* none in code; the reviewer's runs 1 and 3 hold them (BFF `bff/src/routes/reconciliations.route.test.ts#L220`, UI `ui/src/pages/client/Reconcile.test.tsx#L379`) and step 6's tick names that log.
- **`[FIXED]` in money-defects (`bc5ddb24`, 2026-11-08, Low as filed, on money; it was a missing test, not a missing safeguard).** *The precondition was always in the code: `bff/src/routes/reconciliations.ts#L41` passes `null` and `shared/src/c-storage.ts#L105-L107` turns it into `if-none-match: *`, so two closes could never overwrite each other's cash. What was missing was anything holding it, and `bc5ddb24` adds that: a `'rival'` mode that lands a rival close under the key and lets our write through, so the precondition itself refuses it (409, the first close's cash kept); with the `null` dropped the case is red. Recap `docs/recaps/2026-11-08-money-defects.md`.* As filed: **Finding 2, `bff/src/routes/reconciliations.ts#L41`:** the closed day's `If-None-Match` is held by no test (dropping the `null` kept all 14 green); two closes at once would let the later overwrite the first's cash. *Fix:* a `flaky()` mode that writes another close under the key and passes ours on to c-storage with its own tag; expect 409, the record theirs.
- **Finding 3, `bff/src/routes/reconciliations.ts#L115-L126`, tests `#L153-L154` and `#L420-L432`:** the order's free and its guard are held by no test, item 35's second bullet a second time. *Fix:* assert the stored order's `request` in the close test; at `#L420` make the order name another request id and expect it kept.
- **Finding 4, `bff/src/routes/reconciliations.route.test.ts#L406` and `#L371-L372`:** a test name and a comment say more than their tests hold (a throwing order write, not a `moved` one; a fresh body, not the old). *Fix:* rename `#L406` and add the `moved` case (200, the order left); at `#L372` send the old body first (409), then the fresh one (200).
- **Half `[FIXED]` in money-defects (`f6a12579`, 2026-11-08); the page's reload stays open on purpose.** *The closer is now read before the first write, so a gone person stops the close with nothing cancelled. The `catch` calling `loaded.reload()` was out of this piece's scope and stays open; the 409 wording still blames a delivery.* As filed: **Finding 5, `ui/src/pages/client/DriverDayPage.tsx#L70-L73`, `bff/src/routes/reconciliations.ts#L109-L130`, `ui/src/fake.ts#L449-L486`:** a close that stops part way leaves the page showing requests it already cancelled, and its retry meets a 409 whose words blame a delivery; the fake's 503 moves nothing, so it differs from the stack. *Fix:* read the closer before the first write; in the page's `catch` call `loaded.reload()` too.
- **Finding 6, `ui/src/i18n/en.ts#L172`, `ui/src/i18n/vi.ts#L173`, `shared/src/permissions.ts#L6-L7`:** the editors' words for `orders.canEdit` do not say it closes a driver's day. *Fix:* a code comment now; the words with the next change to piece 2's editors or the cashier right (re-asks their screens).
- **`[FIXED]` in money-defects (`f6a12579`, 2026-11-08, Low as filed, on money; a race only).** *Reached only when the closer's staff record went between the sign-in's read and the close's, a window that spanned the whole cancel loop; then the close was stored with the root's shape and the cashier's own name. The read now sits above the cancel loop and a gone record is a 401 with nothing cancelled and nothing written; the root alone has no id, so the mis-attribution branch is unreachable for anyone else. Recap `docs/recaps/2026-11-08-money-defects.md`.* As filed: **Finding 7, `bff/src/routes/reconciliations.ts#L128-L140`:** a person whose record cannot be read at the close is recorded as the root (a race only). *Fix:* branch on `who.root`; a gone person is a 401; read it before the writes (finding 5).
- **Finding 8, `ui/src/fake.ts#L449-L456` and `#L364-L370`:** the fake looks for the driver (404) before parsing the body (400), frees the order whatever it names, and refuses no extra key. *Fix:* when the fake is next touched, parse `closeDayRequestSchema` first.
- **Finding 9, `shared/src/reconciliations.ts#L65`:** `driverDay` sorts request numbers as text, item 36's finding 7 in another place. *Fix:* the shared comparator that item 36 names.
- **Finding 10, `ui/src/i18n/en.ts#L685` (and `vi.ts#L685`), `ui/src/fake.test.tsx#L1908-L1939`:** the moved words name two of the 409's causes; the fake's test asserts less than its name. *Fix:* the words on a no at step 8 or 12 (re-asks screen 7); assert that Nam's two waiting requests still wait.
- **Finding 11, `visual/src/cli.test.ts`:** `main` in adds 16 (screen, language) pairs to its single draw, 176 to 192, about 9 %. *Fix:* none; its time is read in the whole check.

*Trigger:* after the 11-04 demo, the day's end next touched, or a close seen stopping part way.

## 42. The seed's closed-day check runs after the order is saved — the machine; *parked* until after the 11-04 demo (seed-demo-safe, review of line 42, 2026-11-02)

`scripts/src/demo/apply.ts#L399` `closedFor` runs after the order's save (`#L386`), so a failed GET leaves that order a draft for good. *Fix:* call `closedFor(plan.sendFor)` before the save. *Severity:* Low.

## 43. The closed-day test sends for the order's own day — the machine; *parked* until after the 11-04 demo (seed-demo-safe, review of line 42, 2026-11-02)

`scripts/src/demo/apply.first-fill-orders.test.ts#L356`: the order's day equals its `sendFor` day, so a wrong `closedFor(day)` would still pass. *Fix:* add a case sent for the next working day. *Severity:* Low.

## 44. Time wording left from the 06:00 run — the machine; *parked* until after the 11-04 demo (seed-demo-safe, review of line 42, 2026-11-02)

`ops/seed.sh#L13` "Runs each morning" and `#L15` "about a minute" (now 8 to 10); `.github/workflows/seed.yml#L6-L7`, `ops/README.md#L199` and `#L214` (as the item was written; that wording is since rewritten) "next morning" and "the morning's run". *Fix:* say night, 03:17 +07, and the run's real length. *Severity:* Low. *(Half done, half moot, 2026-11-08: the "each morning" and "next morning" wording is moot, since the schedule is gone and `seed.yml`'s header and `ops/README.md` were rewritten for an on-demand run, see item 151. The other defect, `ops/seed.sh`'s length line, was not fixed by that removal and is done in the fix pass of the same day: the header and the `ops/README.md` table row now say about 15 minutes for a run, longer for a first fill.)*

## 45. The closed-day change: small things — the machine; *parked* until after the 11-04 demo (seed-demo-safe, review of line 42, 2026-11-02)

*Severity:* Info.
- `scripts/src/demo/apply.ts#L404`: when every driver is closed the draft is named "no driver who delivers".
- `apply.ts#L359`: the "closed, sent nothing" line is logged for every closed driver, is not in `report.skipped`, and is absent from the log lines `ops/README.md` lists.
- `scripts/src/demo/apply.first-fill-orders.test.ts#L377`: the closed record is written straight to storage, so that driver's requests stay waiting.
- A close between `closedFor` and the confirm still answers 400. *Corrected 2026-11-08:* it was called negligible at 03:17, and there is no 03:17 any more: the seed runs when somebody asks, in the daytime, when a tester may be closing a driver's day, so a collision is likelier, not negligible. What it does when it happens: the 400 is no 404 or 409, so `unlessChanged` does not skip it and the copy's run stops with an error; the run ends red, the ledger stays on the last finished day, and running the seed again repeats that day (orders already there are skipped, the closed driver is now left out), so nothing is doubled. One thing is lost: the order whose confirm took the 400 stays a draft for good (the repeat sees it "already there" and skips it), so that day on ridge ends one delivered order short. Cheapest fix if it bites: treat that one 400 as a skip like the 409. It is not made.
- `ops/test.sh#L1139`: the Seed step's minutes check (18 now, 15 when this was written) matches any step, and the `stepmin` read at `#L1141` makes it redundant.
- `docs/plans/2026-11-02-seed-demo-safe.md#L5`: "10:4x" reads 10:47.

## 46. The root-password door's read-back ignores its sign-out reply — the machine; *parked* until after the 11-04 demo (ridge-root-password, review of line 41, 2026-11-02, finding L3)

`scripts/src/root-password.ts#L94-L98` sends the sign-out and never reads its status, so a session the read-back left is not noticed. *Fix:* read the 204, name the code if not.

*Trigger:* a session record seen left after a run.

## 47. A failure before the first write is reported as if roots might be set — the machine; *parked* until after the 11-04 demo (ridge-root-password, review of line 41, 2026-11-02, finding L4)

`scripts/src/root-password.ts#L116` and `ops/root-password.sh#L107-L109`: any status but 2 sets `WRITTEN=1`, and lib.sh's ssh reads under `set -e` end exit 1 with no `== refused`. *Fix:* tell "before the first write" from "after" by what node printed, and trap the ssh reads into a refusal.

*Trigger:* a failed read of the box seen reported as a possible partial set.

## 48. The test's `rp_run` job is not a process-group leader and its driver has no deadline — the machine; *parked* until after the 11-04 demo (ridge-root-password, review of line 41, 2026-11-02, finding L5)

`ops/test.sh`, `rp_run` (`#L1886-L1897` before the merge): `e2e_launch` starts its job in its own session so `e2e_reap` can kill the group; `rp_run` does not, and `rp-driver.py` waits for a prompt for ever. *Fix:* the same `setsid` launch, and a deadline in the driver.

*Trigger:* a hung ops test run.

## 49. PASSWORD and SECRETS are never unset — the machine; *parked* until after the 11-04 demo (ridge-root-password, review of line 41, 2026-11-02, finding I1)

`ops/root-password.sh` keeps `PASSWORD` for the process's life, and lib.sh keeps `SECRETS`. *Fix:* unset each when its last use has passed.

*Trigger:* the next change to either file.

## 50. Every ops run's keys go through grep's argv and bash 3.2 here-strings — the machine; *parked* until after the 11-04 demo (ridge-root-password, review of line 41, 2026-11-02, finding I2)

`ops/lib.sh#L122`, `#L127`, `#L165`, `#L609-L610`, `#L814-L815`: the keys the end-of-run search looks for are on grep's argument list, and a here-string is written to a temp file by bash 3.2 (the Mac's). *Fix:* one lib.sh change: split without here-strings and `grep -f /dev/stdin` on a pipe, as `search_extra` in `ops/root-password.sh` does.

*Narrowed 2026-11-12 (the safe scripts' fix pass):* the deploy check no longer reads the BFF's function settings whole, whose variables hold its two access keys and went through here-strings on every environment, production's included; it reads only the names and two non-secret values (`BFF_FN_QUERY` in `ops/lib.sh`), and a case holds that the stand-in refuses a read without that query. What stays is the box's key files read through here-strings (`read_keys`, `bff_env_read`) and the search's argument list.

*Trigger:* the next lib.sh change.

## 51. The leak advice "nothing to replace" is wrong for a password — the machine; *parked* until after the 11-04 demo (ridge-root-password, review of line 41, 2026-11-02, finding I3)

`ops/lib.sh#L132` and the runbook's last bullet say "nothing to replace" for any labelled secret; a password in a log is replaced by choosing another. `search_extra` says so for its own; the shared words do not. *Fix:* word the label's advice per secret.

*Trigger:* the next red naming a labelled secret.

## 52. The guards step's 5 minutes against about 1 to 2 minutes more — the machine; *parked* until after the 11-04 demo (ridge-root-password, review of line 41, 2026-11-02, finding I4)

`.github/workflows/ci.yml#L203`: `ops/test.sh` grew by about 1 to 2 minutes with the root-password section. *Fix:* read the step's real time in CI and raise the limit if it nears 5.

*Trigger:* the first push's CI run.

## 53. A Ctrl-C at a prompt under bash 3.2 may leave the terminal's echo off — the machine; *parked* until after the 11-04 demo (ridge-root-password, review of line 41, 2026-11-02, finding I5)

`ops/root-password.sh` `type_password`: `read -s` is interrupted. *Fix:* `stty echo` in a cleanup (`stty sane` restores by hand).

*Trigger:* the human's first run.

## 54. `bash -x` or SHELLOPTS xtrace would trace the password — the machine; *parked* until after the 11-04 demo (ridge-root-password, review of line 41, 2026-11-02, finding I6)

`ops/root-password.sh` runs under whatever xtrace the caller set. *Fix:* `set +x` near the top.

*Trigger:* the next change to the script.

## 55. `OPS_TEST_NO_TTY` or `RIDGE_SCRIPTS_DIR` in the environment bypass two checks on ridge — the machine; *parked* until after the 11-04 demo (ridge-root-password, review of line 41, 2026-11-02, finding I7; narrowed 2026-11-12)

`ops/root-password.sh` (and `ops/operator.sh`, the same pattern) takes both from the environment, the test's own switches. *Narrowed:* on an environment not listed in `INVENTED_ENVS`, `real_ok` refuses both unless the tests' marker is set, so `operator.sh` is safe on production; `root-password.sh` refuses it outright. Only ridge keeps the switches. *Fix:* read them only under a test marker, or drop the switches for a test-only wrapper.

*Trigger:* the next change to either script.

## 56. Two reds filed as one cause are probably two faults: a `bff` case near its own time limit (measured), and a `ui` case that never found its element (cause not known) — the machine; `[OPEN]` (2026-11-02, rewritten 2026-11-08, corrected the same day)

**History, so the next reader meets no third confident claim.** This item first said the reds were load. This morning it was rewritten to say they were headroom, one shared cause for the `bff` case and for "some `ui` tests". That shared cause was asserted and then withdrawn the same day: only the `bff` half was ever measured.

**Measured, for the `bff` case only.** `bff/src/routes/clients-delete.route.test.ts` case 13 was run alone, three times on an idle machine, and took **4155 ms, 4132 ms and 4175 ms against a 5000 ms limit**, about **82 per cent of its own timeout every run** (`logs/20261108-1205-money-defects-clients-delete-alone.log`). A case that close to its limit reddens at any load, which is why "the load that does it" was never a stable number. *Fix:* make that case cheaper or give it a limit that leaves room, and hold what it waits on by the test's own signal, not a time.

**Not known, for the `ui` cases.** No `ui` case was ever timed alone, so nothing says they sit near a limit. The best evidence of how one fails is the sighting from GitHub below: an element that never appeared, which is not a clock running out. The two may well be unrelated faults filed under one number; the first step for the `ui` side is to time that case alone and to read why "Send it again" was not on the page, before any fix.

**The sightings, as history, with their loads:**
- 2026-11-02, load 12.6 (the gate's limit is 8), a whole `pnpm check`: two `ui` tests failed in files the change did not touch and both passed on a rerun at load 4.7, which is no verdict (QA rule 6: a flaky red is a defect). [`SignIns.test.tsx#L129`](../ui/src/pages/SignIns.test.tsx#L129), "C: the root turns the email and the QR sign-in on…", timed out at 5000 ms; [`MyDeliveries.test.tsx#L39`](../ui/src/pages/client/MyDeliveries.test.tsx#L39), "a driver … lands on My deliveries", saw `myDeliveries` called 0 times.
- 2026-11-03, load about 12: `MyDeliveries.test.tsx` alone, the same no call, nothing in `ui` changed (once item 57, folded in here; `logs/20261103-walks-page-step2-gate-run3-red-ui.log`).
- 2026-11-07 14:22Z, **the first sighting from GitHub rather than from this machine, and the first with a real error message**: CI run `42380906824`, commit `5073bbc9bebc2bc881e7f05a46c6ede0f3e54379`, job `app`, step `pnpm check`. In [`OrdersPages.test.tsx`](../ui/src/pages/client/OrdersPages.test.tsx), "the order's page on the cards > a confirmed order whose request is gone puts its facts and lines left, its request and its steps right", at line 354: `TestingLibraryElementError: Unable to find an accessible element with the role "heading" and name "Send it again"`. The summary was `Test Files 1 failed | 62 passed (63)` and `Tests 1 failed | 811 passed (812)`. The `shared` and `bff` parts of the same check were green. No load is known for a GitHub runner (`logs/20261108-1214-github-reds-run-42380906824.failed.txt`).
- 2026-11-07 23:31, load 7.97, under the limit of 8: the same `OrdersPages.test.tsx` case failed in a whole check (`logs/20261107-233125-clerk-add-records-step7-whole-check.log` red, `logs/20261107-233422-clerk-add-records-step7-whole-check.log` green). Its error was not read for this item, so whether it is the same missing heading is not known.
- 2026-11-08, load 3.4: a further red. The same morning money-defects' first run of `bff` timed out one case in `clients-delete.route.test.ts` (`logs/20261108-120141-money-defects-step1-bff-gate.log`, exit 1; the rerun was green), which the measurement above then explained.

*Trigger:* the next red of any of them, or any edit that adds time to a near-limit case.

## 58. `appStyles` and `pageScript` save and restore `NODE_ENV` at once — the machine; *parked* until after the 11-04 demo (the walks page, review of step 2, 2026-11-03)

`visual/src/capture.ts#L40-L48` sets and restores `process.env['NODE_ENV']` around each Vite build,
and `#L342-L346` runs the two under `Promise.all`: the second saves the first's `production`, so after
both end `NODE_ENV` may stay `production` instead of what it was. Fix: run them one after the other,
or set it once around both.

## 59. Undo puts back a saved copy and writes under the name active at Undo — the machine; *parked* until after the 11-04 demo (the walks page, review of step 2, 2026-11-03)

`visual/site/page.ts#L642-L648`: Undo restores the copy of each screen taken when Yes to all ran, so
a No given within the 8 seconds is deleted, and the write goes under the name active at Undo, not
the one at Yes to all. Fix: restore only a screen still holding the Yes to all's own answer, under
the name it was given under.

## 60. `READS` names the four people the page knows — the machine; *parked* until after the 11-04 demo (the walks page, review of step 2, 2026-11-03)

`visual/site/page.ts#L130-L131`: a person added to `PEOPLE` has no entry, so a walk opens with `lang`
undefined. Fix: take the language from the build's data, or fall back to `vi`.

## 61. After a timeout the failure message says nothing changed, yet the write may have landed — the machine; `[DEFERRED]` (D, plan step 6, review at `e6320b9`, 2026-11-03, Low)

c-storage saves the root's record but its answer misses the BFF's 5-second timeout: the BFF answers 503 and the page says the password is as it was, while the root is signed out and holds the new one. A retry repairs it. Lines: `ui/src/i18n/en.ts#L104`, `ui/src/i18n/vi.ts#L103`, `bff/src/routes/root-password.ts#L50`. *Fix:* word it "may not have been set: set it again" in both languages and re-take screen 4; or `setSignInPassword` re-reads once after a write with no answer.

*Trigger:* the first client's root, or the next change to the route.

## 62. The root-password touch is not tied to the client, and nor is the delete's — the machine; `[DEFERRED]` (D, plan step 6, review at `e6320b9`, 2026-11-03, Low; widened 2026-11-07)

Within its 5 minutes and before it is spent, a touch made for client A, posted to client B's route, sets B's root; this goes beyond the plan's row 11 (the act and the operator). Lines: `bff/src/routes/operator-auth.ts#L375` (mint), `#L264` (open), used at `bff/src/routes/root-password.ts#L48`. *Fix:* confirm-options takes the client's code and mints with the subject `${operator.id}:${code}`; the route opens it with the same subject.

**Widened by the client-readiness read (2026-11-07): the same holds for deleting a client, which is the heavier act, and it is held here rather than in a new item because one fix closes both.** `confirmed` opens any act's token with the operator's id as its only subject (`bff/src/routes/operator-auth.ts#L266-L275`, `bff/src/calling/challenge.ts#L42-L48`), so every `ConfirmAct` has this shape, and `delete-client` is the one that cannot be undone: `bff/src/routes/clients-delete.ts#L50` passes the touch with no code of its own, though the route knows the code at `#L44`. The page asks for the company's code typed, which is the UI's check and not the guard. *Fix, both routes together:* the subject becomes `${operator.id}:${code}` at the mint and at the open, with a case for each route that a touch made for one client does not open on another. *Severity:* Low while one operator runs the console; it is the only gate between a live session and an irreversible delete once there are two.

*Trigger:* before a second operator or a client signs.

## 63. No page test for the BFF refusing the touch (403) — the machine; `[DEFERRED]` (D, plan step 6, review at `e6320b9`, 2026-11-03, Low)

The page's half of the case table's rows 5 and 7 has no test. Lines: `ui/src/pages/operator/RootPasswordPage.tsx#L62` (the catch), `ui/src/pages/operator/RootPasswordPage.test.tsx#L124` (the 503 test to copy). *Fix:* one test with the fake's `setRootPassword:403` cue, asserting the "not changed" alert and that the code and passwords are still typed.

*Trigger:* the next change to the page.

## 64. The scripts' coverage missed 100 % once, at the wait's retry sleep — the machine; *parked* (B1, plan step 2, 2026-11-03)

`scripts/src/running/processes.ts#L83` (`await sleep(25)` in `waitUntilUp`, run only when the first look finds nothing listening)
and the function around it showed uncovered in one whole run of the scripts' tests (263 pass, statements 99.92 %,
branches 99.82 %), under a load near 8; the same tests passed at 100 % when run again with nothing else changed (the
only change between the two runs was a type in `bff/src/calling/challenge.ts`, which `scripts` does not run). So the retry is
covered by timing, not by a test of its own. *Fix:* a test that answers the first poll "not yet" on purpose, with the
stand-in's own clock. *Trigger:* the next red of this kind, or the next change to `scripts/src/running/processes.ts`.

## 69. A BFF rolled back past B1 cannot read the accounts B1 writes — the machine; `[DEFERRED]` (B1, plan step 5, review at `5bae528`, 2026-11-03, Low)

`signedInAt` and the strict schema (`shared/src/records.ts#L125`) make an older BFF answer 503 to those operators. The precedent is `docs/open-items.md#L359`. *Fix:* none now; a line in B1's recap's hazards.

*Trigger:* a rollback past B1.

## 70. An add or a link the target began before its delete can land after the sweep — the machine; `[DEFERRED]` (B2, plan step 5, review at `44db639`, amended after the reread of `4131696`, 2026-11-03, Low)

`createOperator`'s retry (`bff/src/records/operators.ts#L135-L143`) checks the name, not that `addedBy` is still on the roster, and `makeLink` (`#L83-L95`) can finish after the sweep passed that account, so a deleted operator could end up holding a working link. The gap is wider since the fix at `4131696`: the target stays signed in until the roster write, so a link they make after the sweep has passed that colleague's account and before the roster write survives the 204 (`bff/src/records/operators.ts#L181-L190`). The comment at `#L165-L166` ("no link of theirs or of their making is left") claims more than this. *Fix:* none now; check the maker on the roster at the last write, and say so in the comment.

*Trigger:* two operators acting in the same instants.

## 71. The link's kind comes from a roster read that can be stale — the machine; `[DEFERRED]` (B2, plan step 5, review at `44db639`, 2026-11-03, Low)

A colleague who joins between the read (`bff/src/routes/operator-team.ts#L100-L107`) and `makeLink` gets a `join` link while active; using it replaces their passkeys (`bff/src/routes/operator-auth.ts#L328-L332`) without raising the generation, so their sessions are not ended. *Fix:* none now; make the link's kind from the account, not the roster.

*Trigger:* a join in the instant a link is made for the same colleague.

## 72. `--replace` refuses roster names with a space or an accent — the machine; `[DEFERRED]` (B2, plan step 5, review at `44db639`, 2026-11-03, Low)

`scripts/src/ridge.ts#L77-L78` accepts only `^[a-z0-9][a-z0-9._-]{0,31}$`; item 68's compare helps only plain names. The console's New link covers those operators. *Fix:* none now.

*Trigger:* a command-line replace for an operator named with a space or an accent.

## 73. A delete refused at its roster write has already removed the links of an operator who stays listed — the machine; `[DEFERRED]` (B2, plan step 5, reread of `4131696`, Opus, 2026-11-03, Low)

A delete that stops at its roster write (an actor gone, 401; three roster moves, 503; a write that throws) has already removed, in `bff/src/records/operators.ts#L178-L191`, the links of an operator who stays listed. In the race of two deletes the survivor loses its own recovery link and its invitees' join links, and nobody is told until a colleague opens a dead link. A new link recovers each. The plan's case 3 ("one remains … deletes nothing more") no longer holds for links. *Fix:* none now; remove the links only after the actor is checked at the last roster read, or note that a refused delete may need new links.

*Trigger:* two operators deleting each other, or a roster that keeps moving.


## 76. A client's own logo in the header — the human; `[PARKED]` (legacy frame, plan 2026-11-03)

The header shows the company's name beside a stand-in logo (Tabler's `IconBrandAdobe`), not the stored one.

*Trigger:* a client's ask for its own logo.

## 77. A process left in a lane's group holds the wait with no line saying why — the machine; `[DEFERRED]` (full-run-speed, plan step 5, reread of `f9e33a0`, Opus, 2026-11-04, Low)

In a run nobody stops, a process left in a lane's process group holds the wait after the last pass, and no line says why (`walk/run.sh#L459`). Unlikely, since the stack kills its children at exit (`scripts/src/running/processes.ts#L47-L48`). *Fix:* once every lane's `.rc` is written, a short grace, then name what is left and TERM it.

## 78. On the stop path bash prints its job lines unprefixed — the machine; `[DEFERRED]` (full-run-speed, plan step 5, reread of `f9e33a0`, Opus, 2026-11-04, Info)

On the KILL path, bash still prints its job lines without the `[lane n]` prefix (`walk/run.sh#L459`). No verdict reads them.

## 79. A rare port clash between lanes — the machine; `[DEFERRED]` (full-run-speed, plan step 5, review at `56bc475`, Opus, 2026-11-04, Info)

`freePort` releases its port before the child binds it (`scripts/src/running/processes.ts#L7-L18`), so two lanes can meet on one. It shows as a named red, never a green. *Fix:* only if a run meets it.

## 80. The full run's stray filter does not take a staged rename — the machine; `[DEFERRED]` (full-run-speed, plan step 5, review at `56bc475`, Opus, 2026-11-04, Info; older than the piece)

`ops/full-run.sh#L180` takes only `A`, `M` or `D`, so a staged rename (`R `) would red as "more than base pictures". *Fix:* add `R` when a run stages one.

## 81. The lanes are not balanced — the machine; `[DEFERRED]` (full-run-speed, adoption run, 2026-11-04)

Lane 1, piece-2 alone, is the long pole at 13m04s against lane 3's 9m49s (`walk/run.sh#L38-L50`). Splitting piece-2's passes or moving a walk could take about 3 more minutes off a run.
The staff-cards full run (rerun, 2026-11-04, 16m00s) shows it again: lane 3 ended about 3 minutes before the others, 10m17s against about 13 (`20261104-1732-staff-cards-full-run.log`). Rebalance when a run's length matters.

## 82. A test types a hex with no letters and calls it a case check — the machine; `[DEFERRED]` (palettes, plan step 4, review, Opus, 2026-11-04, Low)

`ui/src/parts/Settings.test.tsx#L277` types `'#047857'.toUpperCase()`, which has no letters, so it proves no case handling. *Fix:* a stock shade 7 with a letter in it, such as `#4A76A9`, when the file is next touched.

## 83. Six palettes' menu text falls below 4.5:1 at shade 8 — the machine; `[DEFERRED]` (palettes, plan step 4, review, Opus, 2026-11-04, Info)

For six palettes the legacy's own shades 8 and 9 are lighter than mixed ones, so the menu's white text on its 9-to-8 gradient reads below 4.5:1 at shade 8: autumn 3.65, coin 3.78, terracotta 4.02. The legacy's own, as decided.

`[DEFERRED]` 2026-11-20, piece 203 step 1b: autumn, coin and terracotta left the stock palettes (the human's pick of six, `docs/decisions.md`), and the six that remain white-text-safe at shade 8 by the memo's measure (7.68 at the least, emerald's; steel 8.52, brick 9.62, bronze 9.24, plum 9.59, indigo 9.45, white's contrast against shade 8 by `onBrand.ts`'s own formula, read from `palettes.ts` on 2026-11-20), so this item no longer names a palette that can be picked; a typed colour is served by `onBrand`'s span, which step 3 of `docs/plans/2026-11-20-design-fixes.md` closes it on.

## 84. The demo company can wear steel — the machine; `[DEFERRED]` (palettes, plan step 4, review, Opus, 2026-11-04, Info)

The demo script draws a client's colour from seven (`scripts/src/demo/company.ts#L5`); one is steel's shade 7, so such a company shows Steel checked in Settings, as meant. The other six are no stock shade and check none.

## 85. The legacy's lookup also takes a palette's name — the machine; `[DEFERRED]` (palettes, plan step 4, review, Opus, 2026-11-04, Info)

`ui/frame-mock/frame.js#L44` matches a palette's name as well as its shade 7, so moving a legacy client's data needs each name turned into its shade 7.
*Trigger:* the first legacy client's data move.

## 86. The services walk's sv-5 does not move with a palette — the machine; `[DEFERRED]` (palettes, full run, 2026-11-04, Info)

The full run named "sv-5-unavailable" and moved 0 of its 6 pictures, so 210 pictures were committed, not the plan's 216 (log line "named, not moved: sv-5-unavailable" in `20261104-1447-palettes-full-run.log`). It is right: the screen is `Boot` in its unavailable state (`ui/src/frame/Boot.tsx#L19-L39`), a red alert, a title and a Retry button, and the button draws shade 7 only (`ui/src/theme.ts#L109`), which is the colour itself in the mix and in steel's own ten. Nothing on it draws another shade.

## 87. A lane's child could not set its process group — the machine; `[DEFERRED]` (palettes, full run, 2026-11-04, Info)

The run printed "walk/run.sh: child setpgid (11085 to 11085): Operation not permitted" (`20261104-1447-palettes-full-run.log`, line 996), in lane 2's driver walk, which still passed 6 of 6 and exited 0. A lane's child could not set its own process group, so the stop path's KILL may not reach that group. Harmless here. *Trigger:* the next piece touching `walk/run.sh`.

## 92. The card's avatar condition is untested — the machine; `[DEFERRED]` (staff-list, review, Opus, 2026-11-04, Low)

The photo-off and photo checks read the table row only (`ui/src/pages/client/StaffRecord.test.tsx#L67-L70`, `#L565`); the phone card's avatar condition has no test of its own. *Fix:* the same two checks scoped to the card, when the card is next touched.

## 93. At 992 the last filter select wraps — the machine; `[DEFERRED]` (staff-list, second look, 2026-11-04, Low)

At 992 px of screen width the content is 710 px and the last select wraps; the five filters sit on one line only from about 1166 px. The human's looks were at 1280 and the phone. *Trigger:* the next look at a tablet; say so then, it is known.

## 94. White on the brand shade 7 is under 3:1 on the menu mark and about 3:1 on the header and button — the machine; `[DEFERRED]` (white-frame, plan, 2026-11-04, Info; widened by the sign-in look, 2026-11-05)

One pairing fault, line 54's own (the old app's colours kept as they are), not the sign-in look's and not line 60's. It shows in two places. (1) On the white menu the open page's mark (brand shade 7) falls under 3:1 for terracotta, autumn, olive and coin (2.72 to 2.99); kept as decided, since the page's name carries the meaning. (2) The sign-in mock measured the same pairing wider: white text on the header and on the primary button, as the app draws them, is 2.84 to 3.40:1 across six palettes, the four above plus sandstone and ocean — terracotta 3.12, sandstone 3.32, autumn 2.84, olive 3.10, ocean 3.40, coin 3.05 (`one-off/20261105-1755-signin-look-round-1/check.log#L16-L17`, `#L19-L20`, `#L23-L24`, logged as notes "white on <palette>'s shade 7"). The other palettes sit at 4.91 to 6.38. The human was given the recommendation to leave the pairing as it is and answered with their yes on the look (18:12), so this is a record, not a pending fix. *Trigger:* a client on one of the six asks, or a contrast pass over the palettes (the fix would be a darker shade for the fill, or dark text on the light palettes).

`[DEFERRED]` 2026-11-20, piece 203 step 1 (the human's reversal, 13:3x: "yes, switch to dark text, judged in the gallery first"): part (2) is no longer left as it is. The rule `onBrand` (`ui/src/design-system/onBrand.ts`) gives dark text where white does not reach 4.5:1, shown in the gallery's "On the brand" part, and the screens take it at steps 2 and 3 of `docs/plans/2026-11-20-design-fixes.md`, which closes (2). Part (1), the open page's mark and brand-coloured text on a light ground, moved to item 636.

`[DEFERRED]` 2026-11-20, piece 203 step 1b: the six palettes named above, with sandstone and ocean, left the stock set (the human's pick of six); the figures stay as the record of why. Of today's six, steel and emerald remain, emerald's buttons the one stock change the rule makes, and the new four pass white on every shade of every span.

## 95. The icon strip's tip is tested by the CSS file's text, never drawn — the machine; `[DEFERRED]` (white-frame, review, Opus, 2026-11-04, Low)

The strip's tip on `:focus-visible` is held by a test that reads `ui/src/frame/frameLook.module.css` as text, since jsdom has no computed styles; a browser check would be the first to see it drawn. *Trigger:* the first browser check of the app, or the next change to the strip.

## 96. The start, birth and address values are checked in the browser only — the machine; `[DEFERRED]` (staff-fields, review, 2026-11-05, Low)

The BFF stores `extra` untouched (`shared/src/extra.ts#L3-L5`), so a stored non-day shows as a blank date input and is re-sent unchanged (`ui/src/parts/personalFields.tsx#L23`). The company's own date field behaves the same, so this is consistent, not new. *Fix:* a day check on the three keys in the BFF's save of a person, about a route test and ten lines; *trigger:* a second client that writes `extra` (an import of the dates, or a partner's tool).

## 97. The day check's production path is nearly unreachable on these two fields — the machine; `[DEFERRED]` (staff-fields, review, 2026-11-05, Low)

A real browser's date input never yields a day that is not one, so `dayIsValid` (`shared/src/fields.ts#L117`) guards an older browser's text fallback; it is right and covered, and its refusal is tested with the input made a text input. *Cost:* none to keep; *trigger:* none, noted so a reader does not look for the path.

## 102. The QR landing card's heading sits outside the announced region — the machine; `[DEFERRED]` (signin-look, review, Opus, 2026-11-05, Low)

`ui/src/pages/client/QrLanding.tsx#L34` moved `role="status"` from the card onto the inner `Stack`, so the heading ("Signing you in" / "This code cannot sign you in") now sits outside the announced region and a screen reader hears only the body text and the button. Every word is unchanged and no test or walk reads the region. *Fix:* move the one attribute back to the element that holds the heading. *Trigger:* the first accessibility pass over the doors, or the next change to `QrLanding`.

## 103. A door draws the client's logo, the shell does not — the machine; `[DEFERRED]` (signin-look, review, Opus, 2026-11-05, Info)

A door draws `brand.logo` when there is one (`ui/src/pages/SignIn.tsx#L75-L79`), while `Shell` draws its generic mark unconditionally and never reads `brand.logo` (`ui/src/frame/Shell.tsx#L146-L148`), so a client with a logo sees its logo on the door and the generic mark one click later. `Shell` was outside this piece's bound and the human approved the mock's choice at 18:12. *Fix:* have `Shell` draw `brand.logo` when there is one, as the door does. *Trigger:* the first client with a logo, or the next change to `Shell`'s header.

## 104. The words test's BEFORE table was written by hand, not rendered from the old doors — the machine; `[DEFERRED]` (signin-look, review, Opus, 2026-11-05, Info)

Case 8's `BEFORE` table (`ui/src/i18n/words.test.tsx#L10-L11`) was hand-written from the doors as they then read, not rendered from `c759c43`, so it pins the words firmly from now on but did not itself prove the rewrite changed no word; the reviewer hand-checked three entries (`qr-busy`, `signin-refused`, `operator-notgiven`) and they matched. *Fix:* render the doors at `c759c43` once and compare the table to the output. *Trigger:* a doubt about a door's wording after this piece, or the next rewrite of the doors' markup.

## 105. One rule for "has a note", written out six times — the machine; `[DEFERRED]` (products-cards, review, Opus, 2026-11-06, Low)

The walk and the page once disagreed on what "has a note" means; products-cards (2026-11-06) made every picker read the page's rule, but each reads its own copy of it: `walk/specs/lists.spec.ts#L18-L19`, `visual/src/walks.ts#L183-L184`, `visual/src/words.test.tsx#L27-L28`, the inline pair in `visual/src/walks.test.ts#L668`, and a fifth shape in the unit test, `ui/src/pages/client/ListPage.test.tsx#L12` with `#L240` and `#L301`. The pages themselves hold the sixth, as the truthiness of `textIn` (`ui/src/listSheet.ts#L63`, used at `ui/src/parts/ProductForm.tsx#L55` and `ui/src/parts/CustomerForm.tsx#L34` and `#L36`). Nothing fails today — all six agree — but the next change to what a page counts as a note (a trim, say, so that a note of spaces draws no card) moves one and leaves five, and the red appears only in the human's full picture run, where a walk opens the record it still calls noted and waits for a heading that is correctly absent. *Fix:* export the rule once beside `textIn` (`noteOf`, or `hasNote` taking `extra`) and add `./lists` to `ui/package.json`'s exports, which today offers `./import-demo`, `./mock`, `./scene` and `./words` only; the walk and the visual package already import `@credo/ui/words`, so both can take it. *Trigger:* the next change to how a page decides to draw a conditional card, or a seventh copy of the rule.

## 106. The person's page can still draw a blank half, and no test says so — the machine; `[DEFERRED]` (orders-cards, review, Opus, 2026-11-06, Low)

Orders-cards (2026-11-06) made a falsy `side` count as absent, the first of the two fixes the frame's empty-column item named; this is the second, unmade: the case that item was opened for is still live. The person's page passes `side={<Stack>…</Stack>}` (`ui/src/pages/client/PersonPage.tsx#L551-L552`), an element that is always truthy, and every panel inside it is conditional (`#L553`, `#L563`, `#L566`, `#L576`, `#L586`, `#L589`). A viewer who is not the root, may not delete and has no photo field gets an empty `Stack`, so `DetailColumns` still draws the details at 7/12 beside a blank 5/12 — the symptom the frame's empty side column was first filed for. No screen shows it: of the 116 built screens 40 draw a 5/12 column and none of them is empty, so the fix would move no picture. Nothing tests the case either: only `ui/src/parts/DetailCards.test.tsx` and `ui/src/pages/client/OrdersPages.test.tsx` read a grid column, so the person's page's own tests (`ui/src/pages/client/StaffPages.test.tsx`) never count its columns. *Fix:* have the page pass `undefined` when every panel is out — one `const` over the six conditions — with a test for that viewer; or, narrower, let `DetailColumns` count an element with no rendered children as none. *Trigger:* the next change to the person's page's side, or a client whose office staff are neither root nor deleters.

## 107. The new column tests count every grid column in the document — the machine; `[DEFERRED]` (orders-cards, review, Opus, 2026-11-06, Info)

`columnOf` and `columnCount` (`ui/src/pages/client/OrdersPages.test.tsx#L349-L353`) query `document` for `.mantine-Grid-col`, so they hold only while the page's frame draws no other `Grid`. They are right today and read the real class the component emits, which is the point; but a `Grid` added to the shell or a banner would turn the column *indexes* wrong rather than merely failing, and the message would point at the order's page. *Fix:* scope both to the page's own grid (the `.mantine-Grid` nearest the found heading). *Trigger:* a `Grid` added to `ui/src/frame/Shell.tsx`, or the next page to copy these helpers.

## 111. Piece-2's walk takes six minutes in one worker — the machine; `[DEFERRED]` (walk-machinery, plan, 2026-11-06, Info)

One spec of 33 screens in six tests, one worker by decision (`walk/playwright.config.ts#L19-L20`): 6m01s against the next pass's 2m03s, and Playwright advises a split. Measured and left alone: tests at once in one stack raise the load the walks' steadiness rests on, and item 81 holds the cheaper rebalance. *Trigger:* item 81 is worked, or the run's length is next cut.

## 112. One words-test scene took 187,912 ms against its own 30,000 ms limit — the machine; `[DEFERRED]` (walk-machinery, step 3 gate, 2026-11-06, Medium)

In the step 3 gate, `visual`'s `src/words.test.tsx` took 325,709 ms for the file, and one scene, `office-orders:orders-9-confirm-failed`, ran 187,912 ms against its 30,000 ms limit and failed with "the scene did not end in 30000 ms" (`20261106-1252-walk-machinery-step3-gate.log#L99-L111`). The same gate passed on one rerun (`20261106-1301-walk-machinery-step3-gate-rerun.log`, `== exit 0`). The screen was merged that morning and nothing heavy was on the Mac in that window, so load alone does not explain a sixfold overshoot: the scene's own slowness is the symptom. Not in the walk-machinery piece, and the fix is nobody's yet. *Trigger:* the next red of that scene, or `visual` is next touched; first read how long that scene takes alone.

## 113. `ui`'s 5-second per-test limit starves its slowest files under load — the machine; `[DEFERRED]` (walk-machinery, step 5 gate, 2026-11-06, Medium)

In three whole gates of the same tree, `ui`'s `src/pages/client/StaffSetupPage.test.tsx` timed out at 5,000 ms in every run, and the others moved about: 6 timeouts, then 4, then 1, the last being that file alone at the quietest load (`20261106-1324-walk-machinery-step5-gate.log`, `20261106-1329-walk-machinery-step5-gate.log`, `20261106-1337-walk-machinery-step5-gate.log`). The four failing files passed alone. It is the slowest file rather than a broken one, and the first to starve; item 112 is the same shape in `visual`. Not chased in the walk-machinery piece. *Trigger:* the next such red; first time the file alone and raise its limit or split it.

## 114. A `ui` test reads a call count straight after awaiting a heading, and can read zero under load — the machine; `[DEFERRED]` (walk-machinery, step 5 gate, 2026-11-06, Low)

`ui/src/pages/client/MyDeliveries.test.tsx#L48` expects `myDeliveries` to have been called exactly once with `DEMO_TODAY` right after awaiting the "My deliveries" heading, and read zero calls in one whole gate (`20261106-1343-walk-machinery-step5-gate.log`, the file ran 1,856 ms, no timeout). The file passed alone twice straight afterwards at a load of 16 to 18. A separate flake from item 113; neither is the walk-machinery piece's to fix. *Trigger:* the next such red; first wait for the call (`waitFor`) rather than reading it at once.

## 115. The verdict's cross-walk guard covers a moved screen but not a new one — the machine; `[DEFERRED]` (walk-machinery, review, 2026-11-06, Low)

In `found_in_compare` (`ops/full-run.sh`) a named screen that moved in one walk is not listed as "not moved" because of another walk, but a screen that is new in one walk and named-and-seen in another is not given the same care. Unreachable today: no screen name is shared by two walks. It becomes reachable the day two walks use one screen name. *Trigger:* a screen name used by two walks; then treat new like moved.

## 116. The base write removes the old pictures before it copies the new, with no `nullglob` — the machine; `[DEFERRED]` (walk-machinery, review, 2026-11-06, Low)

`walk/run.sh`'s write (`rm -f …/*.png`, then a copy loop over `$run/full-1/$w/*.png`) leaves the folder empty and writes one literal `*.png` copy attempt if a green walk produced no picture. Unreachable today: a green walk has its tests passed, each of which takes pictures, and the shape is the old block's. It becomes reachable if a walk with no pictures is added. *Trigger:* a walk that takes no picture; then guard the loop with `[ -e "$picture" ] || continue`.


## 118. An over-8 KB save answers 400 and the page says to try again, which cannot work — the machine; `[DEFERRED]` (edit-customer, review of line 64.1, 2026-11-07, Low)

Deferred from line 64.1's review, not a fault of the piece. `extra` is bounded at 8 KB (`shared/src/extra.ts#L34`); a customer save past it answers 400 and the page shows "What you typed is still here: try again", which is true but useless, since trying again cannot succeed. The form caps nothing. Not data loss: what was typed stays. *Trigger:* the product page copying this save shape; then give the form a cap and the 400 a notice of its own.

## 119. A save that lands and is then deleted would answer 404, "not saved" over a write that did land — the machine; `[DEFERRED]` (edit-customer, review of line 64.1, 2026-11-07, Low)

Deferred from line 64.1's review, not a fault of the piece. If a customer's write lands and the record is deleted before the answer is read again, the route answers 404 and the office would see "not saved" over a write that did land. Unreachable today: no customer delete exists. *Trigger:* a customer delete; then let the 404 after a write say what is known.

## 120. A non-string `phone`, `address` or `note` is erased by a customer save — the machine; `[DEFERRED]` (edit-customer, review of line 64.1, 2026-11-07, Low)

Deferred from line 64.1's review, not a fault of the piece. The customer save rebuilds those three keys from the body, so a stored value that is not a string is erased, where the employee's own-fields path deliberately keeps a stored value it cannot render. Reachable only through a direct call, not through the UI's sheet reader, which writes strings. *Trigger:* a second writer of customer records (an importer or another client); then keep an unrenderable value as the employee's path does.

## 122. A run green in every pass is turned red by a browser that vanishes before the join, and `--write` still writes — the machine; `[DEFERRED]` (browser-guard, review of line 72, 2026-11-07, Low)

Deferred from line 72's review, not a fault of the piece. The post-join check (`walk/run.sh#L523`, `#L604`) adds a red rather than only labelling reds already collected, which was the plan's intent: a run green in every pass and comparison exits 1 if the browser vanishes in the second between the last pass and the join. `red_walks` is untouched, so `--write` still writes the bases while the run exits 1. *Trigger:* a green run turned red by that check; then make it label only.

## 123. A prune undone before the join leaves no signal — the machine; `[DEFERRED]` (browser-guard, review of line 72, 2026-11-07, Low)

Deferred from line 72's review, not a fault of the piece. `browser_lost` is set only when a pass was blocked, and the post-join check is a fresh stat, so an install that deletes and re-downloads the same revision mid-pass fails the pass silently. Harmless today. *Trigger:* a pass failing on `Executable doesn't exist` with no browser line; then record the first missing stat.

## 124. A crash between the claim's draft and its rename leaves `.claim-<pid>` in the shared folder for good — the machine; `[DEFERRED]` (browser-guard, review of line 72, 2026-11-07, Low)

Deferred from line 72's review, not a fault of the piece. `scripts/src/running/claim.ts` writes the draft beside `.links` and renames it; a crash between the two leaves `.claim-<pid>` in the shared browser folder, and nothing prunes it. It sits outside `.links`, so no install reads it. *Trigger:* a `.claim-*` file seen in the browser folder; then remove it by hand.

## 126. The 409's `current: null` arm has no case — the machine; `[DEFERRED]` (edit-a-product, review of line 64.2, 2026-11-07, Low)

In `bff/src/routes/lists.ts` the save's conflict answer carries `current: now && docOf(now)`, so it is `null` when the record was deleted between the read and the failed write. No test reaches that arm: it needs the record removed between those two calls, and the customer route merged with the same gap. *Trigger:* the order page's plan, or a customer delete.

## 127. The product page's `extra` test dropped two of its three variants — the machine; `[DEFERRED]` (edit-a-product, review of line 64.2, 2026-11-07, Low)

In `ui/src/pages/client/ListPage.test.tsx` the test that became the editable-versus-reader one kept only one of its three `extra` shapes: `{ note: 5 }` is still exercised as a save, while `{ note: '' }` is covered only through the `textIn` behaviour, and the third is gone. A change to how an emptied or non-string note is written would not fail a case of its own. *Trigger:* the next change to how a note is read or written on a detail page.

## 128. `src/walk-run.test.ts` is now the `scripts` package's floor — the machine; `[DEFERRED]` (scripts-time, review of line 73, 2026-11-07, Medium)

About 119.4 s summed over 47 tests, as long as the whole package. It met the plan's 25 % rule from the start: the plan's table missed it because the runner line it read (`src/walk-run.test.ts (34 tests | 1 failed) 67047ms`) was an aborted run, while locally the file was 86.4 s over 38 tests, 43 % of 199.98 s. The longest apply shard is about 89 s; every other file is 43 s or under. **This piece deliberately does not cover it**: a different file and a different change. *Caveat:* per-file seconds here are sums of test times, because vitest's verbose reporter prints no file totals, so the 86.7 s runner figure has no equivalent after the split. *Trigger:* the next piece that touches `scripts`' run time.

## 129. The c-storage handle in `apply-support.ts` lives in two module-level variables — the machine; `[DEFERRED]` (scripts-time, review of line 73, 2026-11-07, Low)

`scripts/src/demo/apply-support.ts#L25-L26` keeps the handle in two module-level `let`s, written at `#L31-L34` and read at `#L48`. Harmless today, and ruled out by the reviewer rather than assumed: `scripts/vitest.config.ts` sets no `isolate`, `pool` or `fileParallelism` and the script is a plain `vitest run --coverage`, so each of the ten files gets its own fork and module instance. The one break is a second `useCStorage()` in one file: the second `beforeAll` would overwrite the handle and the single `afterAll` would leak a c-storage process and a temp folder. *Fix if ever wanted:* return the handle instead of closing over it.


## 132. A client's root password cannot be set from a terminal at all — the machine proposes, the human decides what a client's stack may receive; *parked* until a client's own stack (the client-readiness read, 2026-11-07, narrowed 2026-11-12)

*Narrowed:* the guards this item first asked for are in `ops/lib.sh` (`refuse_real`, `real_ok`), and every script's answer on production is read on one page, [`ops/README.md`](../ops/README.md#on-production). What is left is a missing capability. `ops/root-password.sh` refuses every environment but ridge ("a client's own stack is the console's, never this"), and the console's route needs a live operator session and a fresh passkey touch (`bff/src/routes/root-password.ts`), so a client whose BFF is broken has no way to set one. *Fix:* decide whether a terminal path is wanted for a client's root, and under what proof of the person. *Trigger:* a client's own stack.

## 133. An unfinished client deletion is readable by nothing, so "deleted whole" is true of the door and not of the data — the machine; *parked* until a client's deletion is seen stopping part way (the client-readiness read, 2026-11-07)

`deleteClient` removes the index first — from that write the client is out of the list and every session of it is
refused — then sweeps at most 200 records a press (`bff/src/records/clients.ts#L112-L174`), and a press after the index is
gone resumes on the session alone (`bff/src/routes/clients-delete.ts#L32-L33`). If nobody presses again, the records stay
in the file for good, reachable by nothing: `listClients` reads the index prefix alone (`clients.ts#L93-L94`), and
the deletion record's only two readers are inside `clients.ts` itself (`#L67`, `#L145`) — no route, no page and no
script lists one. The code is held, so the client cannot be made again (`#L67`), which is right; what is missing is
anyone being told. *Fix:* a read of the deletion records on the Clients page or in the operator's own view, so an
unfinished deletion is visible and can be pressed on. *Severity:* Low on ridge, where the data is invented; it is
what makes the delete's promise in `docs/products.md` true or not for a real client. *Trigger:* a client's deletion
seen stopping part way, or the first deletion of real records.

*Update 2026-11-20:* a "Resume deletion" button exists, reached by the delete page's address once the client is gone from the
list (`ui/src/pages/operator/DeleteClientPage.tsx`, the resume button). Nothing lists an unfinished deletion yet, so the
fix stands.

## 136. No price can be set on an order line, and a total must be at least 1 — the human decides whether a client prices by hand; *parked* until a client asks for a price of its own (the client-readiness read, 2026-11-07)

A line is a product id and a quantity, and the price is always the product list's: the schema says so in its
own words, "the customer and the lines by id and quantity, never a price or a total"
(`shared/src/orders.ts#L130-L146`), and the BFF prices every save and every confirm from the lists
(`bff/src/routes/orders.ts#L257`, `#L303-L317`). So there is no discount, no customer-specific price, no delivery
fee and no VAT line, and because `total` is `z.number().int().min(1)` (`shared/src/orders.ts#L108`) an order
worth nothing — a free replacement after a damaged delivery — cannot be recorded at all. This is a
deliberate shape, not a defect: it is what makes the server the only pricer and keeps a tampered total out.
It becomes a gap the moment a client sells at agreed prices rather than list prices. *Fix:* a per-line price
the server still bounds, or a customer price list, and a decision about who may type one; the zero total is
a separate and smaller change. *Trigger:* a client asks for a discount, a customer price or a replacement
delivery.

## 137. Nothing older than seven days can be found: no search by number or customer, and "Earlier" re-reads every week again — the machine; *parked* until a client's second week (the client-readiness read, 2026-11-07)

The orders route answers at most seven days and refuses a wider span (`shared/src/orders.ts#L23`,
`bff/src/routes/orders.ts#L218-L226`), and the page's only way back in time is an Earlier button that raises a week
count and re-reads *every* week from today (`ui/src/pages/client/OrdersPage.tsx#L14-L20`, `#L84`): at twelve weeks that
is twelve calls of seven day-lists each. There is no search by order number, no search by customer, no
filter by state and no day to open at. Finding last month's order means pressing Earlier five times and
reading an unfiltered table. The delivery requests page has the same shape, a day at a time
(`bff/src/routes/orders.ts#L389`). Item 35's third bullet already notes that a longer span would need an index;
this item is the other half of it, what a person can and cannot find. *Fix:* a search by number and by
customer, and a day to open the list at, which together need an index rather than a wider day span.
*Trigger:* a client's second week, or the first time someone is asked for last month's order.

## 138. No report of any kind — the human names the first report, since what it must show is the client's business; *parked* until a client asks (the client-readiness read, 2026-11-07)

The menu holds eight pages and not one of them is a total: My deliveries, Orders, Delivery requests,
Settings, Staff, Staff setup, Customers and Products (`ui/src/nav.ts#L27-L85`). There is no day's takings,
no customer's history, no driver's month and no product's movement, and nothing in the BFF answers a sum —
every orders route returns records for a page to add up. The operator console's own Usage and costs and
Activity are "coming soon" pages (`ui/src/operatorNav.ts#L17-L18`), which is a different lack.
**What it costs a real client:** nothing in week one, and an ask in week two; it is on the readiness list
last for exactly that reason. *Fix:* one report the human names, which decides whether the sums are made in
the BFF over an index or in the page over the seven-day reads (item 137). *Trigger:* a client asks.

## 139. Nothing in the product sends email or an SMS, so a staff password is reset by hand and the root's only from the console — the machine proposes the sender, the human decides what may leave the system; *parked* until before a client's own stack (the client-readiness read, 2026-11-07)

A search over `bff/src`, `ui/src`, `shared/src`, `ops` and `.github` for any mail or message sender finds
none. "Sign in by email" means only that the email address may be typed where the code goes, against the
same password (`bff/src/app.ts#L251-L268`), and the QR code is made by the root and shown on a screen for
fifteen minutes (`shared/src/signins.ts#L29`) — it is handed over, never sent. The consequences:
- **A staff member who forgets their password** has no self-service path; the root types them a new one
  (the root's own screen, `staff-6-password`).
- **The root has none at all.** Only an operator can set a client's root password, from the console, with a
  live session and a fresh passkey touch (`bff/src/routes/root-password.ts#L41-L48`) — and that door can report
  "as it was" over a password that was in fact set (item 61).
- **Nothing reaches a customer**: no order confirmation, no delivery notice.
*Fix:* a sender, and then the human's decision on what may leave a client's system; the staff reset is the
smallest first use and does not need one if a one-time link shown on the root's screen is accepted instead.
*Trigger:* before a client's own stack, or the first staff member who forgets a password.

## 141. The page's "Now X" figure is the list as read when the editor mounted — the machine; `[DEFERRED]` (edit-an-order, review of line 64, milestone 3, 2026-11-07, Low)

`ui/src/pages/client/OrderPage.tsx#L87-L93` takes the moved-price advisory from the product list read at mount, so a price moving while the page stays open shows a stale figure and a save takes another. No money diverges: the screen and the driver both carry the saved prices until a save, and the save's answer redraws the page. *Trigger:* a second office editing prices while an order is open, or a reader of a test names it.

## 142. Files under `scripts/node_modules/` are executed by the ops scripts and nothing compares them with the lock — the machine; `[OPEN]` (tree guard, review of the guard, 2026-11-07, Low)

`ridge_cli` runs `node --import tsx src/ridge-main.ts` out of `scripts/` (`ops/lib.sh#L727-L728`), and node loads the packages in `scripts/node_modules/` as well as the source. The tree guard (`ops_match_main`, `ops/lib.sh#L180-L218`) compares the tracked and untracked files git does not ignore under the paths `ci.yml` deploys on, plus `.gitignore`; `node_modules/` is ignored (`.gitignore#L41`), so a changed file there is not compared, and nothing verifies the install against `pnpm-lock.yaml`. The deploy job installs with a frozen lock on a fresh checkout, so the hole is the by-hand run on a machine whose install was altered. Its message says only what is compared. *Fix:* a check by hand that the install matches the lock (`pnpm install --offline --frozen-lockfile` leaving nothing changed, or a stamp of the lock's hash written at install and read by the guard). *Trigger:* before a second person runs the ops scripts by hand, or a client's own stack.

## 143. `RIDGE_SCRIPTS_DIR` lets the code the ops scripts run sit outside the guarded tree on ridge — the machine; `[DEFERRED]` (tree guard, review of the guard, 2026-11-07, Low; narrowed 2026-11-12)

`ridge_cli` runs `${RIDGE_SCRIPTS_DIR:-$REPO_DIR/scripts}` (`ops/lib.sh`), so with the variable set the code executed is not the tree the guard compared. *Narrowed:* on an environment not listed in `INVENTED_ENVS`, `real_ok` refuses the variable unless the tests' own marker is set, so only ridge keeps this. It is read by the suite's own harness (`ops/test.sh`, the `RIDGE_SCRIPTS_DIR` stand-ins), and `seed.sh` and `root-password.sh` test it as a switch, so it cannot simply go. *Fix:* refuse the variable when `GITHUB_ACTIONS` is true or when set outside a test (`OPS_TEST_*`), on ridge too. *Trigger:* the same as item 142.

## 144. `ops_match_main`'s `mktemp` is not checked, so a failed one reports a misleading cause — the machine; `[DEFERRED]` (tree guard, the recap's own read, 2026-11-07, Low)

`ci=$(mktemp ...)` (`ops/lib.sh#L200`) has no check of its own. If `mktemp` fails, `ci` is empty, the redirect on the next line fails, and the function dies through its `||` branch with "ci.yml cannot be read" — failing closed, but naming the wrong cause. The same unchecked shape sits at `ops/lib.sh#L146`. *Fix:* `|| die "no temporary file could be made"` on both. *Trigger:* a reader of that message is misled, or the next edit of this function.

## 145. The fake's imports add records with no version, so an imported customer or product saves to "NaN" — the machine; `[OPEN]` (add-records, step 2, 2026-11-07, Low)

`ui/src/fake.ts`'s `importInto` puts a record in its list but never sets its entry in `customerVersions` or `productVersions`, so a record the fake imported reads at version `cundefined`, and a save over it moves the version to `NaN`. The new add (`addInto`) sets version 1 itself, so an added record is right; an imported one is not. Only the fake lane is touched (the real BFF versions by c-storage's tag), and no walk imports and then edits the same record. *Fix:* set the version inside `importInto` and let `addInto` rely on it. *Trigger:* a walk or a test that edits a record the fake imported.

## 146. A taken code reddens the code box with no message in it, and the red outlasts the retyping — the machine; `[OPEN]` (add-records, review, 2026-11-07, Low)

`ui/src/parts/CustomerForm.tsx#L42` and `ui/src/parts/ProductForm.tsx#L75` pass `adding.taken || undefined` to a prop that takes a node, so a taken code reddens the box with no message in it (the words are in the orange alert above). `adding.taken` also stays true while the clerk retypes the code and clears only on the next press, so the box stays red over a code that may now be free. The same shape is in the save form the human approved, so it was left. *Fix:* pass the words as the box's error, and clear `taken` when the code box changes. *Trigger:* a clerk misreading the red box, or the next edit of either form.

## 147. A customer's name over 200 characters is sent, refused 400 and shown as the generic "could not add" — the machine; `[OPEN]` (add-records, review, 2026-11-07, Low)

`CustomerForm.submit` checks only `!name.trim()` (`ui/src/parts/CustomerForm.tsx#L47`) while `nameSchema` allows 200 (`shared/src/staff.ts#L36`), so a 250-character name goes to the server, comes back 400 and shows the generic alert, where the import refuses the same row with its own word (`ui/src/listSheet.ts#L203`). The save form has the same shape. *Fix:* refuse on the page with the import's word, before any call. *Trigger:* a clerk pasting a long text into the name box, or the next edit of the form.

## 148. An add's uniqueness is read-then-write, so two adds of one code can both land, and a lost answer can duplicate — the machine; `[OPEN]` (add-records, plan and review, 2026-11-07, Low)

A record's key is its uuid, not its code (`bff/src/routes/lists.ts#L116`, `#L157`), so two adds of one code at one instant can both land, as two simultaneous imports can today. The review found how the limit could **duplicate** rather than merely answer 409: `write`'s recovery confirms with a point read (`bff/src/routes/lists.ts#L121`) while the retry's duplicate guard uses a list read (`#L104`), so if the list lags the point read the retry writes a second record under a new uuid. *Fix:* a key by code, or a conditional write on a code index. *Trigger:* a client reporting a doubled code, or the first client with more than one order-taker adding at once.

## 149. The 409 case's post-condition is narrower than its sentence — the machine; `[OPEN]` (money-defects, review, 2026-11-08, Low)

`bff/src/routes/reconciliations.route.test.ts#L478` asserts only `handedIn === 1` of the surviving record. The rival the `'rival'` mode writes is our own record with `handedIn` forced, so its `difference` is still the one computed for 5 and the stored record is internally inconsistent. The 409 and the surviving cash both hold, so nothing is wrong today, but an assertion over the whole stored record would also catch a future change that merged fields. It is a pre-existing pattern inherited from the `'theirs'` mode (`#L45-L48`). *Fix:* assert the whole stored record, with a rival that is consistent. *Trigger:* the next edit of the close route or of that mode.

## 150. The day page's pre-close sum is held by pixels, not by an assertion — the machine; `[OPEN]` (money-defects, review, 2026-11-08, Low)

`ui/src/pages/client/DriverDayPage.tsx#L109` renders `money(figures.toCollect)`. The only holder is `walk/specs/reconcile.spec.ts`, whose own `CASH` is derived from `driverDay` (`#L23`) and so is tautological on the UI side; what actually pins the rendered number is the base-image byte compare. `ui/src/fake.test.tsx#L2301`'s literal pins the fake Api's arithmetic, not the render. *Fix:* one `ui` test that mounts the page over a known day and asserts the rendered sum as a literal. *Trigger:* the next edit of the page's figures.

## 151. The nightly seed of ridge is killed by GitHub's 15-minute step limit, with no error of its own, and nobody is told — the machine; `[CLOSED BY REMOVAL, NOT FIXED]` (the nightly schedule and its failure notice removed from `seed.yml`, 2026-11-08, Medium; the GitHub reds read, 2026-11-08)

**Closed by removal, not by fix, 2026-11-08 (branch `seed-timeout`).** The timeout was not solved as a nightly job; the nightly job was taken away. The human decided the seed comes out of GitHub Actions' schedule: `seed.yml` has no `schedule`, no `tell` job and no `issues: write`, and `ops/seed-failed.sh` is deleted. `workflow_dispatch` stays, so ridge can still be seeded by OIDC without anyone holding long-lived AWS keys, and a workflow with no schedule cannot fail on one. What the removal costs: **ridge's data now refreshes only when somebody asks**, and ridge is what others check their work against, so run the workflow ("Run workflow" on `main`, or `gh workflow run seed`) before anyone is asked to check anything on ridge against a recent day. What stays from the built work below, *as corrected the same day (branch `seed-timeout`): the 30-minute step and 40-minute job and the three-day bound became an 18-minute step, a 30-minute job and a two-day bound, because three days (about 22 minutes at the measured 7.5 a day) outlived the deploy role's 20 minutes (`role-duration-seconds: 1200`, deliberately not widened); the chain is now 2 days x 7.5 = 15 < 18 < 20 < 30, and `ops/test.sh` checks the sums*: the step and job limits and the day bound per copy and run, since a manual run after a long gap still meets a backlog (it ends green and prints `seed: STILL BEHIND, ... run it again to go on`). Not done and no longer needed: the first-fill cost measurement and the unexplained red of run 42316272960, both about a schedule that is gone. `ops/test.sh` now refuses a seed workflow that regains a schedule, gains any other trigger, a second job or any permission but `id-token: write` and `contents: read`.

**What is known**, all from GitHub's own log for the scheduled `seed` workflow, run `42426192862`, on commit `5ea0be17f048fa9299a159e57713c92a162b7356` (`main`'s tip), created 2026-11-07T23:38:54Z. Job `seed`, step `Seed`. It checked out, set up Node 26 and pnpm 12.10.1, installed, assumed its AWS role by OIDC, and ran `bash ops/seed.sh ridge`. Its stages `[1/5]` to `[4/5]` ended by 23:39:31 (the box had 275 MiB of memory available, 2459 MiB of swap and 4270 MiB of disk free; `/health` and the BFF's function both named the commit); `[5/5] the seed` began at 23:39:32 and printed per-tenant lines. The last such line is at 23:53:14, and at 23:54:30 came `##[error]The action 'Seed' has timed out after 15 minutes.` The step's `timeout-minutes: 15` is in `.github/workflows/seed.yml`.

**What is not there:** no error from the seed script itself and no completion line. So it was ended by GitHub's step limit. It is not a credentials failure (the role was assumed and the stages ran) and not a failure the script announced. **Whether it hung or merely ran long cannot be told from the excerpt.** One thing leans toward "ran long": the lines kept coming, with silences of up to about three minutes between them earlier (23:49:07 to 23:52:05), so the 76 seconds before the kill is not unusual; the three `vat-lieu-quang-tin-dat` tenants had printed "up to 2026-11-07" by 23:47:26 while the three `phan-phoi-loc-vuong-hai` tenants, which write about twice the orders a day, were still on 2026-11-07 when the limit came. That is a reading, not a finding.

**One detail, not a cause:** `phan-phoi-loc-vuong-hai-3: NV-004 is not in the list, left as it is`, at 23:45:35. The other two `phan-phoi` tenants printed "applied, 1 events" for the same day without it, so only tenant 3 lacked that code. It reads as the script's own harmless skip.

**Not read:** the whole failed log, `logs/20261108-1214-github-reds-run-42426192862.failed.txt` (339 lines), has not been read by a person. The 100 or so lines of the seed itself were skimmed for this item; the answer to hung or long is most likely in a full read, in the time each tenant took on earlier nights (earlier runs of the same workflow), and in `ops/seed.sh` itself.

**Why it mattered, as filed.** It was a scheduled job, so it failed quietly every night it ran long and no one was told. Ridge's data was perhaps partly seeded or stale (there, at least the `phan-phoi` tenants' 2026-11-07 day was cut off before its orders), and ridge is what other people check things against. *Fix, after the cause is read:* if it ran long, give the step more room or run the tenants so that they finish in time; if it hung, find the call that waited; either way, make a timed-out seed report itself to someone. *Trigger:* the next red of the `seed` workflow, or before anyone is asked to check anything on ridge against a night's data.

**A check that cannot be checked yet (not a leak).** The read script's count `AWS access key ids: 2 line(s)` (`one-off/20261108-1214-github-reds.sh`, line 129) is not trustworthy as a count of keys, for three reasons. It does not print the pattern it searched with, so a reader of the output alone cannot reproduce it. The pattern, once read in the source, matches role ids too (`AROA` is the prefix of a role's unique id, not of an access key), and it is not anchored, so it can match inside longer strings. And the two lines it counted are one line twice: the `Authenticated as assumedRoleId …` line the AWS action prints at 23:39:17, which sits once in the seed's failed log and once more in the script's own log, which copies that file. So there is no access key in the files, but one unmasked role id is, which is an identifier and not a secret. The same script's `arn prefixes` count has the same weakness: the pattern `arn:` also matches `yarn:`, and the hits were `yarn:` in the Node setup output. *Fix:* anchor both patterns (`\bAKIA`, `\barn:`), count `AROA` apart, print the patterns in the output, and count a line once even when two files hold it.

**Built first, then removed (2026-11-08, branch `seed-timeout`; none of this is in `main`, and the files and limits named are gone or changed).** The cause was a three-day backlog in a one-night window, not a hang. The first design gave the Seed step 30 minutes and the job 40, applied at most three days a copy, ended green printing `seed: STILL BEHIND, ...`, and added a last job, `tell`, that opened or commented on one GitHub issue when the seed job failed (`ops/seed-failed.sh`, holding `issues: write`). That design was never merged: three days (about 22 minutes) outlived the deploy role's 20, and the human then took the seed off its schedule, so the `tell` job, `ops/seed-failed.sh` and the permission were deleted, and the limits became the 18-minute step, 30-minute job and two-day bound named above. **What was left unmeasured and is still so:** a fresh copy's first fill (the fill plus 2 days in an 18-minute step), and run 42316272960's red, never explained. A first fill that is cut off by the step limit is not lost, though not because of the ledger: the ledger's `filled` flag flips in one write after the whole fill returns, so a killed fill repeats from its start. What makes the repeats converge is the fill's own idempotence: every write it makes is skipped when its record is already there, so each repeat only does what the cut-off one did not reach. A fill longer than the step could thus take several runs, each ending in a clean timeout (read from the code, not run).

## 152. No line names the client whose records were read: the stage's access log cannot carry the client's code — the machine; `[OPEN]` (the access log, 2026-11-08, Low: ridge holds no real client records today, and the path already names a record id on detail routes, so the gap costs nothing until a client signs)

**What is known.** The stage's access-log format (`ops/env.yml#L318-L320`) can name only `$context` variables, and the client's code arrives in a request header, so it cannot go in a line at the door. What the line does carry is the path, and the detail routes put the record's minted id in it (`/api/employees/<id>`, `bff/src/routes/employees.route.test.ts#L1285`), so "which record, when, from where" is answered for those routes and "whose" is not. The function's own request line (Fastify's default logger, on since `bff/src/lambda-main.ts#L3` passes no options) is a second trail; whether it holds the client header, or an id that matches the stage's `requestId`, is **not verified** here.

**What is not known.** Whether the two lines can be joined by a shared request id, and whether the BFF should write one line of its own with the client's code and the record read. Neither was looked at; this item records the gap so it is not left silent.

**Also not known: the end user's own address.** The stage's `$context.identity.sourceIp` is the immediate TCP connection, and it was read here as a CloudFront edge node for a call through the distribution; **the run of 2026-11-08 18:11 on ridge overturned that** (three calls through the distribution, three lines, one public address outside AWS's published ranges, consistent with the caller's own; see item 157). An HTTP API's access-log format still cannot carry the viewer's `X-Forwarded-For` (only `$context` variables, and `$request.header.*` is not among them), which is a reading of the template, not measured. The function's trail cannot recover it either: Fastify is built with no `trustProxy` (none in `bff/src`). Whether the adapter gives Fastify a remote address at all would need a run. So the stage's log is now measured to name a caller's address for a call through the distribution, once; the function's trail is not known to.

**Trigger:** a client signs, or real client data reaches any deployment, whichever comes first, the same as the wall in front of the API's address had (the front door's key closed it, 2026-11-13). *Fix, a sketch and not a design:* join the two trails on one id, or have the BFF log the client's code on a read, whichever the reading shows is cheaper.

## 153. The access log's route field carries no information — the machine; `[OPEN]` (the access log, 2026-11-08, Low)

The stage is the default stage with a single catch-all route, so `"route":"$context.routeKey"` in the format (`ops/env.yml`, `ApiStage`'s `AccessLogSettings`) is the constant `$default` on every line. It is one of the five fields `api_log_guard` insists on and one of the things `docs/plans/2026-11-08-access-log.md` says the line holds. *Fix:* drop it, or keep it for the day a second route exists and say so. *Trigger:* the next change of the format.

## 154. The access-log format is hand-built JSON with three caller-controlled values interpolated unescaped — the machine; `[OPEN]` (the access log, 2026-11-08, Low)

The user agent, the path and the integration error (which can itself be JSON) are written into the line as they arrive. A `"` or `\` in any of them would make that line invalid JSON, so a structured query over the log fails on it, and a guessing run is exactly the traffic that would carry one. The line stays human-readable, so this degrades machine parsing only. AWS's own pages say nothing about escaping and nothing local can settle it; the first lines on ridge are what would. *Fix, if it shows:* drop the three fields from the JSON or move to a format that tolerates them. *Trigger:* the first query over the log that skips a line.

## 155. The access-log guard holds five of the format's ten fields — the machine; `[OPEN]` (the access log, 2026-11-08, Low)

`api_log_guard` in `ops/test.sh` requires the five field groups of the plan's case 1; the other five rest on step 1's exact-equality check, which is a literal copy of the format and so the first thing any deliberate format change edits. After such an edit nothing would catch a variable that does not exist, such as the payload-2.0 spelling `$context.http.method`, a natural mistake in this very template. *Fix:* the guard's list should carry every field the format claims. *Trigger:* the next change of the format.

## 156. The seed's 7.5 minutes a day is written nowhere a check can read, and the checks hold consistency, not the policy of never widening the role — the machine; `[OPEN]` (the seed-timeout piece's review, 2026-11-08, Low)

The seed's whole sizing rests on one measured rate, about 7.5 minutes of writes a day for the heavier client (run 42426192862, 2026-11-08). It stands as prose in `scripts/src/demo/apply.ts` (above `MAX_DAYS_PER_RUN`), `.github/workflows/seed.yml` (the job's and the Seed step's comments), `ops/seed.sh` (the header) and, as the 15 minutes it makes, `ops/README.md`, and in `ops/test.sh`'s `seed_guards` only as the literals of `days x 7.5 x 1.2 <= the Seed step` (`days * 90 <= step * 10`). **If the real rate rises, every check stays green while two days no longer fit the step**; the first sign would be a Seed step ended by its own timeout. Nothing measures the rate again: the run's log carries no per-day time. *Fix:* have the seed print each day's elapsed minutes (one line a day in `apply.ts`), and let a check, or a person reading the first long run, compare it with the rate in the check; or hold the rate in one named constant that the check, the comment and the README read. *Second, and separate:* the three checks (the step ends before the role does, the days fit the step, the step plus its setup fit the job) enforce **consistency between the numbers, not the policy that the role is never widened to make more work fit**. A role of 1800 s, a step of 27, a job of 36 and 3 days a run would pass all three once their exact pins are edited in the same change; only a comment in `seed.yml` forbids it. *Trigger:* the first change to `MAX_DAYS_PER_RUN`, to the step's or the role's limit, or the first run of the seed that ends in a timeout.

## 157. The access log holds callers' real public addresses for 14 days, and nothing says who may read them or whether a client is told — the human; `[OPEN]` (the access log, 2026-11-08, to decide)

Measured on ridge, 2026-11-08 at 18:11 (`logs/20261108-1809-ridge-access-log-read.log`, outside git): three calls through the distribution left three lines in `/aws/apigateway/credo-ridge` carrying one and the same public address, outside AWS's published ranges (the orchestrating session's check of that date, not re-run) and consistent with the caller's own. The earlier prose in `docs/client-readiness.md`, `docs/products.md` and the access log's plan and recap said an edge node would be there instead; that was reasoning and is corrected. So the log group, 14 days of retention, holds callers' real public addresses: a person's address is personal data in some places, and no document recorded that it was being kept.

*To decide, not decided here:* (1) who the addresses are acceptable to, and who may read the group; (2) whether a client must be told its API's callers' addresses are kept; (3) whether 14 days is the right retention. *Also open, smaller:* why the field shows the caller and not an edge node, when `$context.identity.sourceIp` is documented as the immediate connection's address; one run, one caller, one network, and no mechanism is claimed. *Trigger:* before a client signs, or before real client data reaches a deployment, whichever comes first, the same as the wall in front of the API's address had (the front door's key closed it, 2026-11-13).

## 158. The blank-`--take` rows pin the symptom, not the order of the two lines that produce it — the machine; `[DEFERRED]` (the change-set-cause piece's review, 2026-11-08, Low)

`ops/stack.sh#L44-L45` must keep `[ $# -ge 2 ] || usage` above `[ -n "$2" ] || usage`: under `set -euo pipefail`, the reverse order turns `--take` as the final argument from a usage message with exit 2 into `$2: unbound variable` with exit 1. The two new rows (`ops/test.sh#L2863-L2868`) assert exit 2 and no verdict line, but both pass `--take ''`, so `$2` exists and both orders exit 2 there; only the final-argument case differs, and no row runs it. So a future edit could swap the two lines and every check would stay green, while an operator's mistyped `--take` died on an unbound variable instead of being told what it got wrong. A small, real gap, not a defect. *Fix:* one row asserting that `--take` as the final argument, with nothing after it, exits 2 specifically. *Trigger:* the next edit of that parser.

## 159. A failed sweep or a failed check-client delete is announced only by a `WARN` nothing reads, and a half-swept client cannot be resumed — the machine; `[DEFERRED]` (clear-test-clients-sweep, review of line 77.1, 2026-11-09, Low)

Replaces item 117, which the sweep's piece deleted. Nothing in `ops/*.sh` or `.github/workflows/*.yml` reads `WARN`: the two echo lines (`ops/check.sh#L169` for the sweep, `#L44` for the check's own delete) are the whole announcement. Second shape, pre-existing in `untenant`: `deleteClient` removes the client's index before its records (`bff/src/records/clients.ts#L148-L152`), so a delete that stops midway leaves the client out of `listClients` and no later sweep can resume it. Unreachable today (a check client holds 3 records against `DELETE_BOUND = 200`). Third: nothing reserves the `check-<stamp>` code shape (`shared/src/records.ts#L77` admits it), so a client typed with such a code and an old stamp would be swept. *Trigger:* a `check-…` client surviving two deploys; then make the workflow surface `WARN`, and for the other two a reservation or a resumable delete as a piece of their own.
## 160. The convention's rules that a check should hold instead of prose — the machine; `[OPEN]` (the 2026-11-08 structure review, 2026-11-09, Medium)

[The code convention](conventions/code.md) states these rules in prose, which holds them only while
someone reads the diff. Each row below is its own small piece, and the review's model for all of
them is `services/c-storage/internal/server/server.go#L51-L54`, where the function that registers a route
appends its pattern to the list a test reads (`server_test.go#L106`).

| The rule it would hold | The check |
| --- | --- |
| no screen imports the API client; nothing in `bff/src` calls `fetch` | an eslint import-boundary rule (`no-restricted-imports` on `./api` outside `ui/src/api.ts` and the two app shells) in `eslint.config.js`, which today is 35 lines with one configured rule |
| every `CREDO_*` name comes from one declaration | export the eleven names at `scripts/src/cli.ts#L132-L141` from `shared/` and import them in the twelve `walk/specs/*.spec.ts` and `walk/run.sh`, so a dropped name is a compile error rather than an `undefined` |
| the three screen widths are declared once | one exported set in `shared/`, replacing `visual/src/walks.ts#L26`, `walk/support.ts#L9`, `ui/src/mock/MockPage.tsx#L17`, `ui/src/mock/Frame.tsx#L8` — and retiring the regex in `visual/src/walks.test.ts` that reads one of them as source text |
| the retry bound is one number | one export imported by `bff/src/records/staff-records.ts#L58`, `operators.ts#L21`, `orders.ts#L48`, `sessions.ts#L27` |
| the next route in the two big modules goes in its own module | an eslint `max-lines` on `bff/src/routes/staff.ts` and `bff/src/routes/orders.ts` (single closures of 629 and 453 lines) |
| the shellcheck glob covers every tracked script | a test comparing the glob in `.github/workflows/ci.yml`'s ShellCheck step with `git ls-files '*.sh'`; the two match today, since `9eb9a61a`, and no test keeps them so |
| one `refuse()` and one log opener, one shebang | two greps in `ops/test.sh`: `ops/lib.sh#L75`'s opener used by all seventeen scripts, and `#!/usr/bin/env bash` on each — four scripts the human runs by hand pin `#!/bin/bash` (bash 3.2) and define `refuse()` separately, one of them already using newer-bash arrays |
| no client is named in shared code | a grep in the gate, as the divergence rule's mechanical test |
| a walk has one identity | `walk/playwright.config.ts#L30-L96` derives its projects from the table at `walk/run.sh#L45-L57`, or one test fails when the two disagree |

## 161. The Node file that proves a Bruno run is read by no lint or formatter — the machine; `[OPEN]` (the 2026-11-08 structure review, 2026-11-09, Medium)

`services/c-storage/scripts/bruno-proof.cjs`, the small Node file that proves a request run actually
asserted something, is read by no lint or formatter: `eslint.config.js#L33` ignores `services/c-storage/`
and `.prettierignore#L5` ignores `services/`. It is run as a test (`ops/test.sh#L1730`), and its two callers
are `ops/check.sh#L212` and `services/c-storage/scripts/e2e.sh#L95`. The rest of this item is settled: the two
gate scripts beside it, `cover.sh` and `e2e.sh`, are in ShellCheck's list (`.github/workflows/ci.yml#L684`,
`ops/README.md#L989`) since `9eb9a61a`, and since then ShellCheck reads `cover.sh`'s two comments (`#L29`,
`#L37`), each needed and each giving its reason. *Fix:* let eslint and prettier read
`services/*/scripts/*.cjs`, one exception in each ignore list, then fix what they find. *Trigger:* the next
edit of `bruno-proof.cjs`.

## 162. The units nobody can judge in one read — the machine; *parked* until each is touched (the 2026-11-08 structure review, 2026-11-09, Low)

Recorded so the next session sizes them right, not as work to start. `ops/test.sh`: 2,771 lines, 95
functions, 42 sections, every section sharing one temp directory and one failure flag, with no way
to run one — the cheap half is an optional section name that skips the rest, which splits nothing.
`ui/src/fake.ts`: 1,466 lines, 201 branches, a second implementation of the server's behaviour used
by the fake build, the walks page and 25 test files; its existence is a stated decision, its being
one undivided file is not, and the `const fake: Api` binding would keep a split by feature honest.
`ui/src/pages/client/PersonPage.tsx`: 732 lines, five components, 25 pieces of state, with one 302-line form
taking 21 props — the file split is separable from the 21-prop boundary, which should wait for the
record-page shell. `scripts/src/ridge.ts#L51`: 155 lines, 40 branch points, seven unrelated commands
in one `try` whose shared catch turns a new failure into exit 1. `visual/site/page.ts`: 811 lines in
one bare block with no seam, driven through the DOM by a 971-line test. `visual/src/walks.ts`: 1,813
lines of screen data, where only navigation costs anything. `ops/lib.sh`: 896 lines of small
functions with no section markers. **Not a fault:** `ui/src/api.ts` at 829 lines is a flat list of
independent calls, and its one-place property is worth more than its length.

## 163. The two compiler flags governing index and optional access are off — the machine; *parked* until it is a piece of its own (the 2026-11-08 structure review, 2026-11-09, Low)

`tsconfig.base.json#L14` sets `strict: true` and neither `noUncheckedIndexedAccess` nor
`exactOptionalPropertyTypes`; across 372 TypeScript files the escape hatches are essentially unused
(no `@ts-expect-error`, no `@ts-ignore`, no `any` annotation, three `eslint-disable` lines each with
its reason), so the gate is strong where it is configured. Turning either flag on is a repo-wide
piece. *Trigger:* a defect that either flag would have caught, or a quiet week.

## 164. Go has `gofmt` and `go vet` and no linter — the machine; *parked* until a second internal package (the 2026-11-08 structure review, 2026-11-09, Low)

`c-storage`'s gate is `make check`: `gofmt -l`, `go vet ./...`, the race tests at 100 % through
`scripts/cover.sh`, and the box's cross-compile. Over 16 Go files that is proportionate; a linter
earns its place at a second internal package. *Trigger:* the second internal package.

## 165. The orders page discards the weeks it already read — the machine; `[OPEN]` (the 2026-11-08 structure review, 2026-11-09, Low)

`ui/src/pages/client/OrdersPage.tsx#L15` makes one call per week and `weeks` is state (`#L29`), so "7 more days"
refetches the weeks already on screen. It is the one file the data-and-cache reading names as worth
fixing, and the one place where accumulation, not volume, bites first — orders is already paged a
week at a time. *Fix:* keep the weeks already read and ask only for the new one, inside `readWeeks`
and the `weeks` state. Not a cache: it is the trigger that would otherwise argue for one
([the code convention](conventions/code.md#server-data-and-client-state)).

## 166. Which of the 148 flat UI files belongs to which app is readable only by opening the two app files — the machine; `[OPEN]` (the 2026-11-08 structure review, 2026-11-09, Medium)

28 screens mount in one app, 18 in the other, four in common, and the layout says none of it. A
reader told to add a screen cannot tell where it goes or what it may reuse, and a change meant for
one app can land in a file the other mounts. A convention now says how a package decides its own
directories ([the shape of a package](conventions/code.md#the-shape-of-a-package)), and `ui` is one of
the two packages that has yet to write its set, so the undivided directory is no longer the stated
shape. *Fix:* the layout the human approved for piece 100, moves only, with `ui`'s own directory set
written into `ui/CLAUDE.md` in the same change — the one structural change every piece in the coming
weeks would feel. *Trigger:* before the next several screens, since the move gets dearer with each
one.

## 167. Where a test goes is unstated, and two tests live in the wrong package — the machine; `[OPEN]` (the 2026-11-08 structure review, 2026-11-09, Medium)

`visual/src/import-file.test.ts` tests code that lives in the UI, under Node, so whoever changes
that UI file runs the UI's own tests green and hears nothing: a move and one import.
`visual/src/walks.test.ts` makes 15 assertions over the *source text* of twelve `walk/` files, one a
whitespace-exact regex over a function body, so a reformat in `walk/` reddens another package — the
two that are really rules about the walk (no screenshot comparator, the raster flag) move into
`walk/`, and the whitespace regex waits for a check on behaviour. And nothing says which test covers
what: in the UI 12 test files have no same-named source and 40 sources have no same-named test,
including the five largest screens; in the tooling 17 sources have no same-named test,
`scripts/src/cli.ts` among them. The 100 % gate means the cases exist, nothing says where. *Fix:*
the two moves, and one line in each grouping test naming what it covers; any renaming is parked.

## 168. `knip.json` does not set `includeEntryExports`, so unused exports in 26 entry files are invisible to the gate — the machine; `[OPEN]` (the 2026-11-08 structure review, 2026-11-09, Low)

`knip.json` is 12 lines, and the six packages declare 26 entry files between them — the
widest-surface files in the repo. The legacy project's own rule, which this base has never written,
is that unconsumed code is dead code and how hard liveness is to prove depends on where the caller
lives, with the warning that an unused-export checker cannot answer route reachability because a
test is a reference. *Fix:* set the option, run it once and read what it prints; that run settles
whether this is theoretical. *Trigger:* none needed.

## 169. Four structural duplications named for the record, each needing a designed signature rather than a move — the machine; *parked* until one is touched (the 2026-11-08 structure review, 2026-11-09, Low)

A walk's opening is hand-written in eleven specs, whose per-spec differences need a designed
signature, not a copy (the two pure helpers it also found, `exactly()` in eight specs and
`unfocus()` in five, are byte-identical and a move each). A page is split from its form three
different ways. Route paths have three homes in `shared` (`wire.ts`, `signins.ts`, `import.ts`).
And every screen's flow is described twice — declaratively in `visual/src/walks.ts`, imperatively in
its spec — with only the screen *names* held in agreement, so a step added to one and not the other
leaves both green while the two draw different states. Four derivations of the repository root and
its logs folder also cannot share a shell helper and stay as they are (`walk/run.sh#L70`,
`services/c-storage/scripts/e2e.sh#L38`, `visual/src/home.ts#L48`, `scripts/src/demo-files-main.ts#L6`).
*Trigger:* the next change to any one of them.

## 170. None of the 121 Markdown files is formatted or checked, and there is no commit hook — the machine; *parked*, and both may be deliberate (the 2026-11-08 structure review, 2026-11-09, Low)

`.prettierignore` excludes `*.md`, so `prettier --check` on a Markdown file inspects nothing, and
every "prettier passed" receipt on a docs-only change here has read no Markdown. The repository has
no `core.hooksPath`, no `.githooks` and no hook package, and the stated convention is that the local
gate and CI are the checks. Both are recorded because a receipt naming a check that cannot fail is a
shape this project keeps paying for, not because either is a defect. *Trigger:* the first Markdown
defect a formatter would have caught.

## 171. Two gate runs that start in the same second with the same package share one log, and `tee -a` interleaves them — the machine; `[DEFERRED]` (the one-gate-command piece, step 5, 2026-11-09, Low)

`ops/lib.sh#L82` names a log `<date>-<time to the second>-<script>-<env>.log` and opens it with `tee -a`. The gate lock admits one run at a time, but a run that is waiting for the lock or giving up logs from its first line, so a second `ops/gate.sh shared` begun in the same second as a first writes its wait lines into the first run's log, and the first's `== exit` line then closes both. *Trigger:* two lanes starting the same package's gate in one second, which needs a lock held at that moment by a third run, or a retry loop. *Not fixed here:* the stamp is `log_start`'s, shared by every `ops/` script, and a suffix there would change every log name. *Cheapest fix when it bites:* `log_start` appends `$$` to the stamp (not a counter, which needs the folder to be read).

## 172. A lock the gate fails to release is prose only, and the run still exits 0 — the machine; `[OPEN]` (the one-gate-command piece's review, L1, 2026-11-09, Low)

`ops/gate.sh`'s `cleanup_extra` runs from `ops/lib.sh`'s `on_exit` after `verdict` has already printed `== green`; when the `rmdir` fails it only echoes `lock free at the end: NO`, and the echo returns 0, so the log ends `== exit 0` with the lock still on disk and the next gate, walk and full run blocked. *Trigger:* something else written into the lock folder. *Cheapest fix when it bites:* have `cleanup_extra` set a non-zero status that `on_exit` folds into the exit code.

## 173. `ops/gate.sh` validates the package name after it takes the lock, so a typo waits up to 1800 s and then refuses — the machine; `[OPEN]` (the one-gate-command piece's review, L3, 2026-11-09, Low)

`run_each` dies with `no package <name>` only inside its loop, after `take_lock`, where `ops/full-run.sh` refuses before it takes its lock. A mistyped package behind a held lock waits the full wait and then refuses on the lock, never saying the name was wrong. *Cheapest fix when it bites:* check `[ -f "$REPO_DIR/$d/package.json" ]` for each directory before `take_lock`.

## 174. The gate's `== steps:` codes are pnpm's exit codes, not the tools' — the machine; `[OPEN]` (the one-gate-command piece's review, Info, 2026-11-09, Info)

`typecheck 1` means the `pnpm --filter ... run typecheck` call exited 1, and the same for `test`; for eslint, prettier and knip the code is `pnpm exec`'s, which passes the tool's own through. A reader taking the number for the tool's own code (for example prettier's 2 against 1) can misread a red. *Trigger:* a red read by its number rather than its name.

## 175. Nothing lints `ops/gate.sh` or the other `ops/` shell locally; shellcheck runs only in CI — the machine; `[OPEN]` (the one-gate-command piece's review, Info, 2026-11-09, Info)

`.prettierignore` excludes `ops/`, and no script or hook runs shellcheck locally (it is installed, but only CI runs it), so the gate's own shell is checked by `ops/test.sh` and CI's shellcheck job alone; a quoting slip passes every local run. *Trigger:* the first CI shellcheck red on a gate change.

## 176. `pnpm -r run check` now exists and is the wrong command — the machine; `[OPEN]` (the one-gate-command piece's review, Info, 2026-11-09, Info)

Six packages each have a `check` script that calls `ops/gate.sh`, so `pnpm -r run check` starts six gates on one lock (they queue) and runs eslint, prettier and knip six times. The right command is `pnpm check` (the root's, over every package). *Cheapest fix:* one line in the gate's header and one in `ops/README.md` saying so.

## 177. `walk/run.sh` writes the stack's environment names by hand, outside any typecheck, and still carries the dead `CREDO_OPERATOR_PASSWORD` — the machine; *parked* (the one-home review, 2026-11-09, Low)

`walk/run.sh#L296` lists the names a spec listing needs (`CREDO_URL`, `CREDO_SEED_URL`, `CREDO_CLIENT_CODE`, `CREDO_ROOT_NAME`, `CREDO_ROOT_PASSWORD`, `CREDO_OPERATOR_NAME`, plus `CREDO_OPERATOR_PASSWORD`) in shell, where `STACK_ENV`'s type error does not reach. `CREDO_OPERATOR_PASSWORD` is the name dropped when the operator console replaced it with `CREDO_OPERATOR_LINK`. *Trigger:* the next change to that line, which then reads the names from a check against `shared/src/env.ts`.

## 178. The walk config and the legacy capture spell the PC width by hand — the machine; *parked* (the one-home review, 2026-11-09, Low)

`walk/playwright.config.ts#L28` has `viewport: { width: 1280, height: 800 }` and `walk/legacy-capture.ts#L211` the same pair: `WIDTHS.pc` written out, in a file the one-home piece edited. *Trigger:* the next change to either file.

## 179. The two plain-JS mock pages hold the three widths again, so the widths were six spellings, not the four the structure review named — the machine; *parked* (the one-home review, 2026-11-09, Low)

`ui/frame-mock/frame.js` (the width buttons, `#L264`) and `ui/signin-mock/signin.js` (`#L278`, 1280 and 390) spell the widths in JS with no typecheck, beyond reach of `shared/src/widths.ts`. *Trigger:* the next change to either page.

## 180. `scripts/src/demo/apply-support.ts`'s `staffOf` lists under a prefix and parses each record with no truncation guard at all — the machine; *parked* (the one-home review, 2026-11-09, Medium)

**A live failure mode:** `staffOf` (`#L60`) reads `listed.records` and never asks `listed.more`, so a staff list longer than one answer is read short and every caller goes on with part of the staff, silently. Its sibling `demo/apply.ts`'s `isFresh` does guard. The package cannot import the back end's one home (`bff/src/records/records.ts`), so the guard must be written here or lifted to `shared`. *Trigger:* any demo copy with a long staff list; the fix is small and need not wait.

## 181. `bff/src/routes/lists.ts`'s `readOne` parses one record inline with its own message — the machine; *parked* (the one-home review, 2026-11-09, Low)

`#L184`, while the one home's helper (`bff/src/records/records.ts`) is already imported in that file. *Trigger:* the next change to `lists.ts`.

## 182. What a 401 means is declared twice, and the new 403 home spells `401` inline — the machine; *parked* (the one-home review, 2026-11-09, Low)

`ClientApp.tsx#L62` and `OperatorApp.tsx` each hold their own `SIGNED_OUT = 401`, and `ui/src/page.ts`'s `refusal` writes `401` inline. The next shape of this kind, not the one-home piece's. *Trigger:* the next change to any of the three.

## 183. `visual/src/walks.test.ts`'s replacement assertion trips on a reformat of the re-export line, not on a fifth copy — the machine; *parked* (the one-home review, 2026-11-09, Low)

It checks that `walk/support.ts` contains `export { WIDTHS } from '@credo/shared';` as text. What really holds the report and the walks level is the re-export's identity and the type derived from `shared/src/widths.ts`; the text check is the weaker part. *Trigger:* piece 98's conformance work.

## 184. The settings save's 401 now sets `'failed'` where the old chain left it null, and no run has shown the redraw wins — the machine; *parked* (the one-home review, 2026-11-09, Low)

One-home step 2 collapsed `SettingsPage`'s own status check into `refusal`; a 401 on the save now signs out and also sets the outcome to failed. The reviewer reasoned the sign-out redraw replaces the page and did not run it; the test pins the outcome, not the redraw. No data effect. *Trigger:* a run of the settings save under a 401 in the walk or the browser.

## 190. A mixed-indent `pnpm-workspace.yaml` gives the gate a shorter package list, which it checks and calls green — the machine; `[OPEN]` (the one-gate-command piece's reread, R3, 2026-11-09, Medium)

The gate's M1 refusal fires on *no* packages, not on *fewer packages than the file lists*. `dirs` is read by `sed -n 's/^  - //p'`, which needs exactly two spaces: a list with one line indented differently yields a shorter `dirs`, and the whole-repo gate then checks only those packages, prints `== green` and exits 0. Only CI's count-of-six assertion catches it, never the local gate. It is the same shape as the empty-list refusal, narrowed. *Cheapest fix when it bites:* count the `- ` lines of the file by a looser pattern (`^ *- `) and refuse when the two counts differ.

## 191. `give_up` with no lock held says the load was never under the ceiling, but `held` only records the last look — the machine; `[OPEN]` (the one-gate-command piece's reread, R4, 2026-11-09, Low)

`take_lock` resets `held` each iteration, so an empty `held` at the give-up means only that the last look was blocked by the load; the wait may have been lock-blocked throughout. The refusal now says "the last look found the one-minute load not under N", which is true but may hide a long lock wait. *Cheapest fix:* keep a flag for whether any look was lock-blocked and name it.

## 192. The "run lock goes mid-wait, the gate then runs green" leg of the gate's tests has no mutation of its own — the machine; `[OPEN]` (the one-gate-command piece's reread, R6, 2026-11-09, Low)

The mutation run turned that case's "having waited first" line red through a mutation of the wait itself, but nothing breaks only the go-on-after-release path (for example a gate that stops waiting yet never takes its own lock). *Cheapest fix:* one named mutation of `take_lock`'s success branch and a run of that case.

## 193. `docs/conventions/collaboration.md`'s loop cell still presents the gate as a list of steps — the machine; `[OPEN]` (the one-gate-command convention's cross-model read, 2026-11-09, Low)

The loop's cell in `collaboration.md` describes the gate as steps a session runs, while `qa.md`'s rule 6 now names one command, `pnpm --filter @credo/<pkg> check` or `pnpm check`. It is descriptive, in a document the convention piece did not touch. *Fix:* the next conventions pass words that cell as the one command.

## 194. `ops/gate.sh`'s own comment says "the loop is --no-bail", and the loop is a hand-rolled `for` — the machine; `[OPEN]` (the one-gate-command convention's cross-model read, 2026-11-09, Low)

The comment above `run_each` says the loop is `--no-bail`; the loop is a plain `for d in $dirs` over `pnpm --filter` calls, which runs every package whatever one did but is not pnpm's flag. A comment saying the wrong mechanism sends a reader to look for a flag that is not there. It is in `main`'s script, not in the convention's diff, so it was filed, not fixed. *Fix:* reword the comment when `ops/gate.sh` is next touched.

## 195. `describeRun` never prints `report.empty`, so a citation scope pattern that has gone stale shows only as a red in the gate — the machine; `[OPEN]` (the guideline skeleton's cross-model review, 2026-11-09, Low)

`scripts/src/citations.ts`'s `describeRun` lists the documents found and the counts but not which scope pattern matched nothing, so a `LIVING` entry that no tracked file matches any more is seen only when `citations.test.ts` reds inside the gate, never in `pnpm counts`. *Trigger:* the next change to `LIVING`, or a move of files.

## 196. A citation to a file that is written but not yet staged reds the gate until `git add` — the machine; `[OPEN]` (the guideline skeleton's cross-model review, 2026-11-09, Low)

The citation test reads `git ls-files`, so a living document that cites a newly written, unstaged file is red with "the file is not there". Recommended: accept it and add one sentence to `docs/conventions/documentation.md`'s citation section ("stage a new file before the gate reads the page that cites it"), since reading the working tree instead would let a cited file pass that is never committed. *Trigger:* the next piece that cites a file it has just written.

## 197. `shared/CLAUDE.md`'s SH6 says `isHexColour` is "the one other spelling", which is true of exports only — the machine; `[OPEN]` (the guideline skeleton's cross-model review, 2026-11-09, Low)

Two private helpers also break the `<thing>IsValid` suffix: `shared/src/extra.ts`'s `isBoundedJson` and `shared/src/fields.ts`'s `keyIsReadable`. Recommended: say "the one other exported spelling" in SH6 and leave the helpers, since a private name binds no caller. *Trigger:* the next edit to SH6.

## 198. The counted rules' scope patterns are bound to a flat package layout, and piece 100 moves files — the machine; `[OPEN]` (the guideline skeleton's cross-model review, 2026-11-09, Medium; **piece 100 reads this first**)

`scripts/src/counts.ts`'s `RULES` match `^bff/src/[^/]+\.ts$` (C5, C7) and `^ui/src/[^/]+\.tsx$` (C6, C4). After a move into folders, C5 and C7 print "0 of 0" and C6 reports every screen compliant, silently, because a screen in a subfolder is simply not in scope. Piece 100 must update those patterns in the same change as the move and read `pnpm counts` before and after; the cheaper guard is for `counts` to refuse (exit 1) when a rule's scope matches no file. *Trigger:* piece 100.

## 200. A package outside the pnpm gate must be added to the root's ignore lists, and no document says so — the machine; `[OPEN]` (the audit backbone's move, 2026-11-09, Medium)

The one-gate-command convention gives every package one check command, and the root's steps run over the whole tree. A Go package has no `package.json`, so it has no `check` script, yet the root formatter and the unused-code check still reach its files: the audit backbone arrived with its own `make check` green and 17 of its files reported by the root formatter. The fix is two lines, one in `.prettierignore` and one in `knip.json`, and it was found by running the formatter on the moved tree, not by any rule. *Cheapest fix:* one sentence in the gate convention naming both files, so the next non-pnpm package costs two lines rather than an unexpected red.

## 201. A piece that ships no product owes its recap a `docs/products.md` row the convention does not need — the machine; `[OPEN]` (the guideline skeleton's recap, 2026-11-09, Low)

`docs/conventions/documentation.md` requires a piece's recap to add or change the piece's row in `docs/products.md` in the same commit, with no exemption. Four recaps written on 2026-11-09 added none: the gate command, the one-home piece, the gate convention and the guideline skeleton. All four are internal and change no product anyone opens. Recommended (a recommendation, not a decision): the convention gains an explicit exemption for a piece that ships no product, with the recap saying "no row" in its evidence, rather than four rows being owed. *Trigger:* the next recap of an internal piece.

## 203. A line citation can name an entirely unrelated sentence, and nothing reports it — the machine; `[OPEN]` (the architecture page's audit-backbone section, 2026-11-09, Medium)

[`architecture.md`](architecture.md) cited `services/c-storage/CLAUDE.md#L11` for the claim that `pnpm check` never reaches that directory. Line 11 of that file says "A route belongs only with a caller named above"; the sentence cited is at line 45. The citation check verifies that a line citation's *file* exists and, in its own words, never that its line says anything — `scripts/src/citations.ts`'s header: "a line citation (`path#L12`) is counted per document and its line is never checked" — so the page was green with that citation throughout, and the only reason it surfaced is that this piece happened to touch the claim. `docs/architecture.md` carried **106** line citations when this was written (the 2026-11-09 rearrangement took it to a lower count, and five of the ones it touched did name unrelated lines), `docs/client-readiness.md` 110 and `docs/conventions/code.md` 52, and **how many of them name an unrelated line is unknown**. The conversion-on-touch policy is the only thing that finds them, so the rot is discovered at the rate pieces happen to touch it. Recorded with nothing recommended: the alternative is the sweep that policy deliberately refuses, and that is the human's call rather than an item's.

## 204. The citation check never sees a name citation whose file sits inside a markdown link, so it is green because of its parser — the machine; `[OPEN]` (the ui move's cross-model read, 2026-11-09, Medium)

`citationsOf` in `scripts/src/citations.ts` recognises a file and its symbol only when the text between two backtick spans is exactly `'s `, so a file written as a markdown link (``[`path`](../path)'s `name` ``) is not recognised and its symbol is never looked for. Measured: `docs/README.md` registers 0 name citations out of 48, and `docs/client-readiness.md` 1 out of 185. Three citations written during the ui move passed for that reason alone while naming something the file does not declare, and were found by a reader. Recommended: teach `citationsOf` to see through a markdown link, and expect it to red any citation that is not fixed properly when it does; the first run will list what the reds are.

## 205. Both of C6's patterns identify the API module by the shape of a path, so a second `api.ts` would be counted as the client — the machine; `[OPEN]` (the ui move's cross-model read, 2026-11-09, Low)

`UI_API` and `UI_SCREENS` in `scripts/src/counts.ts` match an import ending in `api` at any depth, so a future `ui/src/pages/client/api.ts` would be counted as the one API client while pointing at something else. The old pattern, `from './api'`, had the same hole; the move widens the surface from one directory to five. Recorded with nothing recommended until a second module of that name is proposed.

## 206. `pnpm --filter <pkg> check` does not narrow three of the gate's five steps — the machine; `[OPEN]` (the story-rule convention's gate run, 2026-11-09, Medium)

`ops/gate.sh` runs its five steps as two kinds: `run_each` asks the selected packages for `typecheck` and `test`, and `run_step` runs `eslint .`, `prettier --check .` and `knip` over the whole repository, which no filter narrows. `pnpm install --filter` populates only the filtered scope's projects. **So in a worktree where the install was run filtered, a package-scoped gate reds on packages the change never touched.** Measured on a docs-only change to one markdown file: `eslint` exit 1 with **6,501 errors across 32 files**, every one of them "a type that could not be resolved" on a Playwright call, and `knip` exit 2 reporting 13 unused files, 2 unused dependencies and 2 unlisted binaries. All of it came from `@playwright/test` being absent in `visual/` and `walk/`, the two of seven workspace projects with no `node_modules` in that worktree; `typecheck`, `prettier` and `test` were green, and no reddening step reads markdown at all.

**The cheap discriminator, worth more than the diagnosis:** group the eslint error paths by top-level folder — all 32 files were under the two uninstalled packages and none outside them — and read `knip`'s first line, which names the cause outright, `ERROR: Error loading walk/playwright.config.ts (Cannot find module '@playwright/test')`. Both are one command each, against a red that is otherwise large and convincing enough to be read as the change's own.

*Recommended, and the preference is deliberate:* **the gate refuses a filtered run that meets a partial install, rather than narrowing those three steps.** Narrowing is the wrong fix on principle — `knip` exists to find dead code and unlisted dependencies *across* packages, and scoped to one it would report every cross-package export as unused, turning a real check into noise; the whole-repo scope of those three steps is the guarantee, not an oversight. The refusal is cheap and fits the script's own manner: one look, beside the load and lock waits it already does, for a workspace project in scope with no `node_modules`, then a `die` naming the packages and the install that would fix them, before any step runs. **Installing Playwright is not the workaround, and this is the reason:** an install deletes other projects' browsers, including mid-run, so an agent that installs to clear this red can red a sibling worktree's live run. The judgement here was to leave the red standing and say what caused it, with two other agents active; an item that recommended the install would have the next agent undo that. *Trigger:* the next filtered gate run in a fresh worktree, or whoever next reads a red they did not cause.

## 207. The kind-to-spec pairing in the record page and the add page is untyped, so a mis-paired kind draws another kind's words — the machine; `[OPEN]` (the ui shape piece's review, 2026-11-10, Medium)

`ui/src/pages/client/RecordPage.tsx#L77-L80` and `ui/src/pages/client/AddRecordPage.tsx#L85-L88` each hold a `Record<ListKind, …>` whose entry for a kind builds the page from a spec: `customers` takes the customer spec and `products` the product spec. The record is keyed by the kind, so a kind with no entry is a type error, but nothing ties an entry to its own spec: `customers: (kind, page) => <Record kind={kind} spec={PRODUCT} …/>` typechecks, and the kind then draws the other kind's form and words. The convention's "not a screen that silently draws the wrong one" (`docs/conventions/code.md`, C3) is therefore true for a *missing* entry and not for a *mis-paired* one. *Fix:* needs type design rather than a line, for example a spec that carries the kind it answers for and an entry that checks it, so this piece is not the place. *Trigger:* the third kind, or the first edit to either record.

## 208. The local-env plan took the front and the seed door for children; they are servers inside the starting process — the machine; `[OPEN]` (the local environment's first step, 2026-11-10, Medium)

`scripts/src/stack.ts` starts only c-storage and the BFF as processes; `createFront` and `createSeeding` are `http` servers in the process that called `withStack`. The plan's step 1 (`keepOnExit` on `startProcess`) would have left c-storage and the BFF standing and the front dead as `up` returned, so its done-when (`curl` on 3180 from a second shell) could not hold. Step 1 was built with a keeper process instead (`scripts/src/local.ts`, `local keep`): it holds all four parts and is the only process started with `keepOnExit`. Steps 2 and 5 read the handle's `keeper` pid, and the seed door's status is the keeper's. Nothing here is run detached by the build: the real reading is the human's.

## 209. The teardown's read-back checks three paths, not the whole environment folder — the machine; `[OPEN]` (the local environment's review, 2026-11-10, Low)

`down` (`scripts/src/local.ts`, the read-back at the end of `down`) reads the data folder, the build folder and the handle, not `.local-env` as a whole, so a file left in the folder beside them (the keeper's log, for one) is not named when the removal half-failed. The removal itself is of the whole folder, so only the naming is short.

## 210. A zombie child can stall the teardown of an already-dead stack — the machine; `[OPEN]` (the local environment's review, 2026-11-10, Low)

`down` asks a process whether it is alive with `kill(pid, 0)`, which also succeeds for a zombie that has ended but not been reaped; the stop loop (`scripts/src/local.ts`, the wait after the signal) then waits out the whole settle time and ends red naming a process that is already dead. It resolves once the parent reaps it.

## 211. The ownership matchers are substrings, so another checkout's process could match on an exact pid collision — the machine; `[OPEN]` (the local environment's review, 2026-11-10, Low)

`down` signals a pid only when its command line contains `local-main.ts`, the build folder's `c-storage` path, or `bff/src/main.ts` (`scripts/src/local.ts`, the ownership matchers in `down`). The first and the last are not specific to this checkout, so another checkout's keeper or BFF that took a handle's pid after its process died would be signalled. It needs an exact pid collision with a live process of the same shape.

## 212. The staff walk's test titles say thirty-three screens; it walks thirty-four — the machine; `[FIXED]` 2026-11-21 by the screens-on-parts piece's step 5, with item 650 (the ui shape piece's picture run, 2026-11-10, Low)

`walk/specs/piece-2.spec.ts` names its tests "walks all thirty-three screens" (the title in the loop at the end of the file) and its header comment counts thirty-three (A's sixteen, B's seven, C's six and D's four, 33 × 2 × 3 = 198). Its committed pictures are `walk/specs/piece-2.spec.ts-snapshots/`, six a screen (two languages at three widths), 204 files naming 34 distinct screens, and the picture run compared 204. So a screen was added and the count was left. The verdict is untouched (the bases hold the same 204); the fault is a title that miscounts its own subject and later reads as evidence. *Fix:* correct the title and the comment's arithmetic, or say which group gained the screen.

*Update 2026-11-21, the screens-on-parts piece's step 5:* the title in `walk/specs/piece-2.spec.ts` says thirty-four and the header counts thirty-four (34 × 2 × 3 = 204), the same change as item 650's. The item is closed.

## 213. The picture walk's log ends with a verdict and `== done`, not the `== exit` line the QA convention asks for — the machine; `[OPEN]` (the ui shape piece's picture run, 2026-11-10, Low)

`docs/conventions/qa.md` says a gate's log ends `== exit <code>` and that a one-off script appends `== exit $rc` itself, because "a receipt whose own marker cannot be read is the same class of fault as a check that cannot fail". `walk/run.sh`'s `finish` writes `== verdict: …` and `== done at … (elapsed …)`, then exits with the code, and its last line tees the log and exits with the pipe's status; the code never reaches the log. The run's log (`2026-11-10-ui-shape-picture-run.log`) ends exactly so. A reader looking for the marker cannot tell a finished run from a killed one by it; `== done` is the nearest sign, and the convention names one like it as a fault. *Fix:* have `finish` print `== exit <code>` last, through `ops/lib.sh`'s helper.

## 214. The stop reports the keeper's own children as "was not running", though its ending them is what removed them — the machine; `[OPEN]` (the local copy's stop reading, 2026-11-10, Low)

`stop` and `down` signal the keeper first and wait for it to go (`endProcesses` in `scripts/src/local.ts`). The keeper ends c-storage and the BFF itself when signalled (`keep`: `await io.stopped`, then `stack?.stop()`; the signals are held in `scripts/src/local-main.ts`). So by the time `endProcesses` reaches them they are already gone, and it prints `<part> (pid N): was not running`. The human's stop log (`2026-11-10-local-stop.log`) reads, on both lines, as though both had died before the stop, when both were serving. Nothing is lost and the read-back is right; only the wording misleads. *Fix:* when a part is gone only after the keeper was asked to end, say "ended with the keeper" instead of "was not running". *Trigger:* the next edit to `endProcesses`, or the next reader of that log who looks for a crash.

## 215. The activity command asks for a record id, because the audit service reads only by record or by person — the machine; `[OPEN]` (the activity log plan, step 1, 2026-11-10, Medium)

The plan's slice has `pnpm local activity <client code>` print "that customer's history", but the service has no read of a client's every entry, only `GET /api/activities/by-actor/{actorId}` and `by-target/{targetId}` (`services/audit-backbone/internal/activity/handler.go`, `RegisterReader`). The command as built takes the client code and a record id (`pnpm local activity <client code> <record id>`) and reads by record; a by-person form is not built. Also still so: its log level stays `info`, because `waitUntilUp` waits for the word "listening" in the child's log.

## 217. Entries that name no target or no client where the route has none to name — the machine; `[OPEN]` (the activity log plan, step 2, 2026-11-10, Low)

Three routes write an entry with a gap on purpose. A person's own password change (`app.ts`) has no target, since the change is to the signed-in person and a read by person is the one that finds it (item 218). A client made by the operator is entered only once made (it has no id before), so a refused create (the code taken) writes nothing. A reconciliation close names the driver's id as its target, because the closed day has no id of its own; its memo lists the waiting requests it cancelled, each with its state before and after. A client deleted is entered from the moment its index is read, and a press that resumes a deletion after the index is gone enters under the client's id from the deletion record, marked saved; only a code with neither an index nor a deletion record (a 404) writes nothing. The reads by record and by person (`pnpm local activity`, item 215) show each of these as they are. *Fix:* if the history screen needs more, give a day close its own target. *Trigger:* the history screen.

## 218. A person's own password change has no target, so no command can read it — the machine; `[DEFERRED]` (the activity log plan, review of step 4, L2, 2026-11-10, Low)

`bff/src/app.ts#L406` declares the entry with `declare(request, personOf(who))`, no target. Item 217 says a read by person is the one that finds it, but no read by person is built (item 215), and `pnpm local activity` takes a record id, so the entry is written and nothing reads it. The root's change of the same person's password is targeted (`bff/src/routes/staff.ts#L578` declares the person's id). *Fix:* `declare(request, personOf(who), who.employeeId ?? 'root')`. *Trigger:* the history screen, or a by-person read.

## 219. A `#` in a URL id makes the audit service refuse the whole entry — the machine; `[DEFERRED]` (the activity log plan, review of step 4, L4, 2026-11-10, Low)

The routes declare the target from the URL before `idOf` checks it (`bff/src/routes/lists.ts#L263` and every `declare(…, request.params.id)`). The audit service's key separator is `#` (`services/audit-backbone/internal/activity/model.go#L23`), and `validateID` (`#L90`) refuses an id holding it, so one signed-in caller who sends `PUT /api/customers/x%23y` makes the service answer 400 to the whole batch (`handler.go#L167-L168`), and that refused attempt is lost from the log. The change itself is refused as usual, so only the caller's own refused attempt is kept out. *Fix:* declare the target only after `idOf` has validated it, or have the hook leave out a target the service would refuse. *Trigger:* the history screen, or any reader who counts refused attempts.

## 220. A timeout is logged as "audit entry lost" when the service may have saved it — the machine; `[DEFERRED]` (the activity log plan, review of step 4, L5, 2026-11-10, Low)

On a timeout the audit service may already have committed the entry: `AbortSignal.timeout` (`shared/src/activity.ts#L94`) ends the wait, and the client throws an `ActivityError` with no status (`#L97`). The hook then writes `audit entry lost` for it (`bff/src/app.ts#L147`), the same words it uses for a status the service did send, so anyone replaying "lost" entries from the request log would write some twice. *Fix:* word a timeout (status `null`) "audit entry not confirmed" and keep "lost" for a refusal or an answer the service sent. *Trigger:* the first replay of lost entries, or the ridge move.

## 221. A day close's `before` is the list of cancelled requests, not the record as stored — the machine; `[DEFERRED]` (the activity log plan, reread of the fix pass, N1, 2026-11-10, Low)

`bff/src/routes/reconciliations.ts#L157-L163` enters the close with `before` set to `{ cancelled: [...] }`, where the plan's memo contract (`docs/plans/2026-11-10-audit-bff.md`) says `before` is the record as stored, so that a restore can push it back as it stands. A later restore would write that list over the day's record, and the printout reads a close as `changed:` across every field where it would otherwise say `new`. Nothing is lost today, since no restore exists. *Fix:* keep `before` empty and carry the cancelled requests in `after`, or in a memo field of their own. *Trigger:* the history screen's undo.

## 222. The other-client test's first case accepts any status below 500 — the machine; `[DEFERRED]` (the activity log plan, reread of the fix pass, 2026-11-10, Low)

`bff/tests/customer-audit.route.test.ts#L98` expects `toBeLessThan(500)` where it expected exactly 200, so a 400 refusal also passes. The case still checks that the entry's client is the caller's own and that none is written under `someone-else`, which is its point. *Fix:* expect the status the save answers once the body's extra field is accepted or refused, and name which. *Trigger:* the next change to that test file.

## 223. GitHub's run never checks a push that changes only documents — the machine; `[OPEN]` (the lighter check's research, 2026-11-11, Medium)

`.github/workflows/ci.yml`'s `on.push.paths` lists the packages, `ops/`, the root manifests and the two workflow files, and no `docs/` and no `*.md`, so a push of documents alone starts no run, and `walks.yml` runs only on `main`. The citation test is the whole check of a documents-only change ([QA](conventions/qa.md#the-whole-check-on-pre-merge)), and nothing on GitHub's side reads it. A page citing a file that a later code push moves is caught by that code push's run; a documents-only push whose citations are already broken is caught by no run until a code push follows. Open: whether the citation test earns a path-free job, or the local check stays the only reader.

## 224. The gate's log names neither the worktree nor the commit it checked — the machine; `[OPEN]` (the lighter check's research, 2026-11-11, Medium)

`log_start` in `ops/lib.sh` prints the script, the package and the time (`== <script> <package> started <time>`) and writes the log under a name made of the date, the time, the script and the package. A fast-forward of `main` needs the commit a run checked ([QA](conventions/qa.md#the-whole-check-on-pre-merge)), so today the command that starts the run reads `git rev-parse HEAD` first and the log cannot confirm it; and placing 2026-11-10's 70 runs in their worktrees took vitest's own `RUN` line in each. Open: a `== tree` line with the folder and `git rev-parse HEAD`, written by `log_start` itself.

## 225. No convention says that every number a convention writes is measured, with its pattern quoted — the machine; `[DEFERRED]` (the lighter check's conventions drain, 2026-11-11, Low)

Piece 99's rounds on one convention fixed five numbers and sentences nobody had measured, and the conventions skill now holds the rule (every number the change writes is in the report with the pattern that measured it), but `docs/conventions/documentation.md` does not, so a session that has not loaded the skill is not bound. Deferred: the rule would be one bullet in documentation.md's rules for a convention; written when the next conventions change touches that section.

## 226. No convention says which branch renumbers when two branches mint the same item number — the machine; `[DEFERRED]` (the lighter check's conventions drain, 2026-11-11, Low)

documentation.md says an item is numbered and never renumbered, which holds for `main`'s published numbers and says nothing of two branches that each take the next free number. The practice, from 2026-11-09, is that the side not yet in `main` renumbers; two branches appending to the end of the open-items log also conflict even with distinct numbers, and the merge keeps both hunks. Deferred: one sentence in documentation.md's open-items rule; written with the next change to that rule.

## 227. Some handlers in orders, staff and closed days still have no second-company case — the machine; `[DEFERRED]` (the cross-company tests' review, 2026-11-11, Low)

`bff/src/routes/cross-tenant.route.test.ts` puts two companies in one service and has the second try the first's records; it reaches 14 of the 31 handlers in `bff/src/routes/orders.ts`, `bff/src/routes/staff.ts` and `bff/src/routes/reconciliations.ts` (the review's count before the fix pass, which added the photo, the drivers list, the password set and the lists). Still without such a case: the QR issue and the other sign-in routes of a person in staff.ts, a code change, a photo save and the import there, the pricing and the driver lookup inside order create, confirm and send, a driver's own list and delivering, and the rest of those three files. Deferred: a handler is added to the file when its route is next changed. A key under another company's prefix now meets the company's client's refusal (`bff/src/records/records.ts`'s `tenantStorage`) in every handler of those files, since `request.storage` is the only client they can reach, so a missing case leaves only an untested wiring line; what the refusal does not catch is a client made for the wrong company, whose own keys pass, and `resolveTenant` alone decides that. *Trigger:* the first change to a handler in those three files, or the pooling of tenants on one box.

## 256. A guess over many names leaves one small record a name, which nothing but the company's delete removes — the machine; *parked* until the watch reads a box's free disk (the wrong-password wait's plan, 2026-11-11)

The wait after wrong passwords (`docs/plans/2026-11-11-password-wait.md`) counts a name nobody holds as it counts a real one, so the wait says nothing about who exists, and only a right password clears a count. A guessing run over many invented names therefore leaves one record a name under the company's prefix, a few dozen bytes each, at most as many a second as the door's throttle lets through; a company's delete sweeps them with the rest. Nothing else does. *Limit of the keyed hash:* a wait's key is the name's HMAC under a key derived from the service key, so a copy of the store's data cannot be run against a dictionary for the passwords mistyped into the name box; whoever holds the service key as well (the box's root-only environment file) can, and a changed service key orphans every record (their counts start again, the records stay until the company's delete). *Fix, if it shows:* a sweep of waits whose time ended long ago, or a cap on a company's waits. *Trigger:* the watch's free-disk reading, or a company's wait records passing ten thousand.

## 230. The open-items log is outside the citation check's living set — the machine; `[DEFERRED]` (the architecture page's fixes, 2026-11-11, Low)

`LIVING` in `scripts/src/citations.ts` lists the living documents by path, and `docs/open-items.md` is not among them, so no step reads it. On 2026-11-09 a merge-conflict marker sat in that file through a full green gate for that reason. The log cites many files and symbols that later moved, and its dead citations have not been audited, so adding it today would turn the check red on old entries. *Fix:* audit the log's citations and repair or delete the dead ones, then add a `docs/open-items.md` entry to `LIVING`; a grep for a line starting with the conflict markers is the cheaper stopgap. *Trigger:* the next change to the citation check, or the next conflict in this file.

## 271. A demo copy on a box other than the home box is neither seeded nor given a root password by the scripts — the machine; *parked* until a demo copy is needed on a second box (the pooled shape's plan, 2026-11-11, Low)

The pooled shape's plan (`docs/plans/2026-11-11-pooled-shape.md`, decision 9) routes the seed (`scripts/src/demo/apply.ts`) and the root password script (`scripts/src/root-password.ts`) through a company's client over the home box alone, and has them refuse by name a copy whose line names another box: `ops/seed.sh` and `ops/root-password.sh` open one tunnel, to the home box. So a demo copy moved to a second box keeps its records but is no longer brought up to yesterday, and its root password is the console's. *Fix:* the two ops scripts open the copy's own box by name, as the plan teaches `box_open`, and hand the scripts that box. *Trigger:* a demo copy wanted on a box other than the home box, such as a walk of the move with seeded data.

## 272. The operator's services page checks the home box alone — the machine; *parked* until a second box holds a real company (the pooled shape's plan, 2026-11-11, Low)

The services page (`ui/src/pages/operator/ServicesPage.tsx`) reads `shared/src/wire.ts`'s `servicesReplySchema`, one `storage` answer, which the back end takes from its one client's `health`. Once the pooled shape hands the back end more boxes, that page still says whether the home box answers and nothing of the others; the add form's list of boxes shows a box that does not answer, which covers the operator's choice but not the page an operator opens to see what is down. *Fix:* the reply names each box's build and time, the page a row a box, its walk's screens appended. *Trigger:* the first real company on a second box, or the watch's alarm on each box, whichever comes first.

## 276. A list screen still takes its whole list in one answer — the machine; *parked* (the store's pages and copy plan, 2026-11-11, Low)

After `docs/plans/2026-11-11-store-pages-copy.md` the store answers in pages and the back end's `every` (`bff/src/records/records.ts`) reads them all, so a customer, product or staff list past 1,000 comes back whole, in one answer, and the order page still loads both whole lists for its pickers (`ui/src/pages/client/OrderPage.tsx`'s `api.listCustomers()` and `api.listProducts()`). Nothing on screen asks for a part today, and the lists of the human's companies are far under any size a phone cannot draw. Fix: a list screen that asks for a page or a search, and pickers that search the back end. *Trigger:* the first company whose list a phone draws slowly, or whose answer nears the back end's answer limit, which that plan did not read.

## 241. The log count misses a bare name in Markdown dress and one elided with an ellipsis — the machine; `[DEFERRED]` (the dead log citations' review reread, 2026-11-11, Low)

The bare-name shape (`LOG_NAME` in `scripts/src/citations.ts`) excludes `*` and `_` before a name, so a name written in bold, in stars or in underscores is not counted. A bare name led by an ellipsis (`…` or `...`) is not counted either, though the comment above `logCitations` and the account `describeLogs` prints both say it is; a plain grep for such names finds 38 on the tree of 2026-11-11, and the review counted 31 outside the pinned 456 (the two counts were not reconciled, and a grep for the dressed names found none today). A bold path with a `#L` fragment counts 0, because the trim `WITH_EXTENSION` stops at the `#`. The paragraph under "Nothing machine-local" in `docs/conventions/documentation.md` says the test lists every `logs/` path and every bare log name, which is more than the count does. *Fix:* let `*` and `_` stand before a bare name and trim them after it, let a bare name start with an ellipsis, trim the dress after a `#L` fragment, re-pin `scripts/src/log-citations.pinned.txt`, and reread every case the earlier shape caught. *Trigger:* the next change to the citation check, or the first new citation in these shapes.

## 242. The log count's pin has small gaps in how a red reads — the machine; `[DEFERRED]` (the dead log citations' review reread, 2026-11-11, Info)

A row cited twice in one document is the one shape where two branches each removing one copy can merge as a single deletion and leave a red neither had. A file name ending in `.log` written in prose for a different reason, such as a call on the console, would now count as a citation, and the red's advice to take it out would be wrong for a convention that names it; no such convention exists today. Two names still call `docs/open-items.md` "the log": the progress bullet in the At a glance of `docs/conventions/documentation.md` ("the to-do log") and a link in `.claude/skills/session/SKILL.md`, which sits one row from the rule that a record names no log. *Fix:* give a repeated row its count in the list, let the red's advice name the other cause, and rename the two mentions to "the open items". *Trigger:* the next change to the citation check, or the first convention that names such a file.

## 306. The confirm dialog is a base part with no caller yet — the machine; *parked* (the design system's plan, 2026-11-12, Low)

The design skeleton the human judged draws five base parts, the legacy's confirm dialog among them, but no screen of the new app opens a confirm dialog: the deletes confirm on a page of their own, and the one dialog drawn is the session-ended prompt (`ui/src/parts/SessionEnded.tsx`'s `SessionEnded`). The design system's plan gives the dialog its look through the theme's dialog entry and builds no part nothing calls. *Fix:* the part, from the legacy's `ConfirmModal` (a message, then Cancel and a red Confirm, right-aligned), in the step of the first screen that needs one. *Trigger:* the first screen that asks before an act in a dialog.

## 307. Dark mode is parked, light only by the human's answer — the human; *parked* (the design system's plan, 2026-11-12)

The human answered on 2026-11-11 that the app stays light only for now, as the legacy is. The design system's plan forces light in `ui/src/frame/Providers.tsx`'s `Providers` and deletes the frame's dark rules, which stay in git at the plan's commit. *Fix:* a dark set of tokens beside the light one in `ui/src/design-system/`, the provider following the device again, and the walks taken in both schemes. *Trigger:* the human's word, or a partner's ask.

## 308. The legacy draws a page title a level smaller on a phone — the machine; *parked* (the design system's plan, 2026-11-12, Low)

The legacy's list page title is a level-3 heading on a computer and a level-4 one on a phone (the old repository's `workspace/uis/c-mngt/src/components/ListPageHeader.tsx`, its two `Title` branches), 22 against 18 pixels; the new app draws 22 at every width. The skeleton the human judged did not show it, so the plan leaves it out. *Fix:* the phone's size as a token and the heading rule at the phone width, then a picture run over every walk. *Trigger:* a look the human asks for, or the next change to the page title.

## 251. The activity log's key, once it runs on ridge, has no way to be replaced — the machine, the activity log's lane; *parked* until that key reaches a deployed environment (the front door and keys plan, 2026-11-11)

The front door and keys plan (`docs/plans/2026-11-11-front-door-keys.md`) makes `ops/keys.sh` replace the four keys a deployed environment holds once it is built: the store's internal and super-admin keys, the back end's service key and the front door's key. The back end's fifth, `AUDIT_KEY` (`bff/src/env.ts`'s `auditShape`), is set only by the local stack, since `ops/app.sh` sets no `AUDIT` variable; the activity log's own lane carries it to ridge. *Fix:* when that lane writes the key to the box and the function, it adds the key to `ops/keys.sh` as one more kind, in its own order (the service first, then the function), and to the function's variable list in `ops/lib.sh`. *Trigger:* the activity log running on any deployed environment.

## 266. Deleting a company leaves its delivery photos on R2 — the machine, then the human for the run; `[DEFERRED]` (the delivery photos' plan, 2026-11-11, Medium)

Once photos leave the records (`docs/plans/2026-11-11-delivery-photos.md`), the operator's delete of a company (`bff/src/routes/clients-delete.ts`) sweeps its records and cannot reach its pictures: the back end has no route out of its network (`ops/network.yml`, "nothing here can leave the VPC"). Every object's name starts with the company's minted id, so one prefix holds them all. Deferred: a terminal command the human runs after a delete, removing that prefix with the bucket's key, or a lifecycle rule; a company's pictures are personal data, so which one is the human's. *Trigger:* the first real company deleted, or the photos' landing on `main`, whichever comes first.

## 267. No keeping window for delivery photos — the human, for a real client; `[PARKED]` (the delivery photos' plan, 2026-11-11, Low)

A delivery photo lives in the bucket until something deletes it, and nothing does (the product has no delete); the legacy app laid its folders out for a sweep by day and never ran one. How long a client keeps its delivery evidence is that client's rule. R2's lifecycle rule, by name prefix and age, is the means once a window is stated (step 2 of the plan reads R2's own page on it). *Trigger:* the first real client, or a bucket past its free storage.

## 286. The write measurement on ridge is in the final page's order of work and in no milestone of the week's cut — the orchestrator places it; `[OPEN]` (the activity log on ridge's plan, 2026-11-12, Medium)

The final architecture page's order of work puts the write measurement beside the activity log's memory reading ("the write measurement taken, all three programs running"), and its table of the store's limits says one measurement on ridge settles whether one writer a box keeps up with twenty companies, reading the box's processor credits and free memory across it. The week's cut names that milestone "the box's memory read once" and drops the measurement, and no other milestone carries it, so the activity log's plan (`docs/plans/2026-11-12-activity-log.md`) leaves it out rather than grow by a load run. *Fix:* the orchestrator gives it a lane, most likely the pooled shape's, which is the one whose box count it decides, run on ridge once the store, the log and the copy all run there. *Trigger:* the pooled shape's box added by command, or the activity log's memory reading, whichever comes first.

## 287. The activity log's reading listener stays on loopback on the box, so the history screen's back end cannot read entries on ridge — the machine, the history screen's piece; *parked* until the history screen is planned (the activity log on ridge's plan, 2026-11-12, Low)

The activity log's plan binds the service's writing listener to the box's private address and leaves the reading one on loopback, since the back end only writes and nothing on ridge reads entries but the environment check, which reads them on the box itself. The history screen will have the back end read a record's entries, which needs the reading listener on the box's address, a rule from the back end's group to that port, and the read token minted per request (`shared/src/activity.ts`'s `createActivityClient`, `/api/read-tokens`). *Fix:* in the history screen's plan, the reading listener takes the same address setting, and the template gains its rule each way as the writing port's did. *Trigger:* the history screen's plan.

## 301. A revert of what production runs waits for `pre-merge`'s whole check, which runs at most every two hours — the machine, by the conventions kind; *parked* until the production plan's rehearsal reads the way back's minutes (the production plan, 2026-11-12)

The way back from a bad release is a revert that travels the whole path: the piece's branch,
`pre-merge`, the whole check, `main`, the human's push, ridge's deploy, then the production lane
([the plan](plans/2026-11-12-production.md#hazards-no-gate-catches)). `docs/conventions/qa.md`'s
"The whole check on `pre-merge`" runs that check at most once every two hours, so a revert landing
soon after a run waits up to two hours before `main` may move. Fix: one line in that section, that a
revert of the commit production runs starts the whole check at once, outside the two-hour cadence.
*Trigger:* the rehearsal's minutes, or the first real revert of a production release.

*The rehearsal's minutes (the production plan, 2026-11-17):* from the revert's commit to ridge running the code from before, 65 min 58 s. 52 min 41 s of that passed before `main` moved, waiting on `pre-merge`'s whole check; then 2 min 18 s to the human's push and 10 min 59 s from push to ridge green. Whether the whole check was started at once for the revert is not shown by the stamps. The wait for the check is most of the way back, so the fix stands as written; whether this length is acceptable is the plan's point 2.

## 302. The production lane's read job holds ridge's whole deploy role to read one commit — the machine; *parked* until a second reader of ridge's commit or a review asks for it (the production plan, 2026-11-12)

The lane's first job takes ridge's deploy role, which can also release to ridge, only to read what
ridge runs and that its run was green ([the plan](plans/2026-11-12-production.md#decided-the-machines),
decision 2). The seed workflow takes the same role for its own reading. A read-only role for ridge's
commit would narrow it, at one more role in `ops/env.yml` and one more secret. *Trigger:* a second
workflow that only reads ridge, or a review finding on the read job's rights.

## 283. The company's client throws synchronously from methods typed to return a Promise — the machine; `[DEFERRED]` (the storage client that serves one company's review, 2026-11-12, Low)

`bff/src/records/records.ts`'s `tenantStorage` refuses a foreign key by throwing before it sends, from four methods typed to return a Promise, and `bff/src/records/records.test.ts` pins that shape (`expect(() => ...).toThrow`). Every caller today is an `await` inside an async function, so the throw becomes that function's rejection and answers 500. The one place a synchronous throw would escape is a `.map` inside `Promise.all` in `bff/src/records/clients.ts`, where removes already sent would be left with no handler; that site sweeps keys c-storage listed under the company's own prefix, so the throw cannot happen there today. No change is required. *Fix, if taken:* make the four methods `async`, keeping `within` first so nothing is sent, and change the tests to `await expect(client.getRecord(key)).rejects.toThrow(...)`. *Trigger:* a new caller that calls one of the four methods outside an `await`.

## 284. The memo's "only `resolveTenant` decides that" leaves out the operator's three acts — the machine; `[DEFERRED]` (the storage client that serves one company's review, reread 2026-11-12, Info)

`docs/memo/bff.md`'s sentence on a client made for the wrong company says only `resolveTenant` in `bff/src/app.ts` decides which company a client serves. The operator's three acts also decide it, each for the client it makes from an id it has just read or minted: the root password route in `bff/src/routes/root-password.ts`, and `createClient` and `deleteClient` in `bff/src/records/clients.ts`. The memo's route tests cover them ("reaches one client only" in the delete and root password route tests), so nothing is unguarded; the sentence is short by three callers. *Fix:* "`resolveTenant`, and the operator's three acts for the client they make". *Trigger:* the next change to that memo section, or a fourth place that calls `tenantStorage`.

## 291. At a company's own address, `/operator` still draws the operator's sign-in, where every passkey is refused — the machine; `[DEFERRED]` (the company address plan, 2026-11-12, Low)

`ui/src/App.tsx`'s `isOperatorPath` chooses the console by the path alone, so `https://<code>.<domain>/operator` draws the operator's sign-in there, and its passkey ceremony is refused, since the back end checks every ceremony against `APP_ORIGIN`, the operator's own address (`bff/src/routes/operator-auth.ts`'s `registerOperatorAuth`). Nothing leaks: a company's address keeps its own browser storage and holds no operator handle. Fix: on a company's address, send `/operator` to the operator's address, which the company address plan's link maker can derive the same way. *Trigger:* an operator who reaches the console from a company's address, or the first real client's address.

## 296. By hand, `ops/release.sh` and `ops/app.sh` ship any commit of `main` to production, one ridge never ran included — the production lane; `[OPEN]` (the safe scripts' plan, 2026-11-12, Medium)

Both refuse a commit `main` lacks and one older than what the environment runs (`ops/release.sh#L42`, `#L67`; `ops/app.sh#L48`, `#L92`), and nothing more. The final architecture ships to production only a commit ridge has already run and checked, by the human's own act; the deploy job is the lane's to hold to that, and the by-hand path, used while GitHub Actions is down, holds nothing of it. *Fix:* the production lane decides how a commit reaches production and holds the by-hand path to the same rule, or refuses it there. *Trigger:* the production lane's plan.

## 297. `ops/stack.sh` rewrites an environment's GitHub environment on every run, and whether production's protection rules survive it is unread — the production lane; `[OPEN]` (the safe scripts' plan, 2026-11-12, Low)

Each `ops/stack.sh env <name>` run sends a body naming a branch policy and no reviewers (`ops/stack.sh#L296-L298`). If production's act rests on rules set on its GitHub environment (required reviewers, a wait), a later stack run may clear them; GitHub's own words on what an update keeps were not read. *Fix:* read GitHub's page (the fetch kind), then keep the rules the update would drop, or set them in the same call. *Trigger:* the production lane choosing a protection rule.

## 314. Ridge's teardown has a terminal script, and still no workflow to press it — the machine; *parked* until the human brings the workflow back (ridge cycle, 2026-11-12)

`ops/destroy.sh ridge` and `ops/remake.sh ridge` now take ridge down and back up from a terminal ([the runbook](../ops/README.md#ridge-down-and-back)). What stays parked is the workflow half. The human's word on the deploy ideas page, 2026-11-10: "For the teardown part, let skip it from github action for now (will add later)". The deploy role can only read its stack, so a press needs a role that may delete, and the destroy's typed name needs a gate that is not a terminal. *Trigger:* the human asks for the workflow.

## 322. The stance test reads only calls at column 0, so a new script that calls `main_synced` indented is skipped without a word — the machine; `[OPEN]` (review of the safe scripts, 2026-11-12, Low)

`ops/test.sh`, the stance section: `grep -qE '^main_synced( |$)' "$f" || continue` selects the scripts it checks, and the awk keys on `^log_start `, `^(refuse_real|real_ok) ` and `^main_synced` too. A tenth script whose `main_synced` sits inside an `if` or a function, or after `step "…";` on one line, is never counted, and the control row (`stance_n -ge 9`) stays green with the nine. Today all nine call it at column 0. *Fix:* select every file outside `lib.sh` that calls `main_synced` at any indentation, and fail one whose call is not at column 0; the README's "every such script" then reads true. *Trigger:* the next script that reaches an environment, or the three later lanes' scripts.

## 323. Two rows of the check's case 7 cannot go red — the machine; `[OPEN]` (review of the safe scripts, 2026-11-12, Low)

`ops/test.sh`, case 7: "no Bruno file is written" counts `bruno_files`, which is 0 after every run in any mode, because `ops/check.sh` deletes the file in line and `on_exit`'s `bruno_env_remove` deletes it on every exit; only the `skipped:` half of the row and the `bru.calls` row hold the claim. "The log holds neither key" is 0 in ridge's full run too, since the keys are masked there: it checks that the log is clean, not which mode ran. *Fix:* make the stand-in clone's `bruno/environments` unwritable for the two reads-only runs, so a write would die and turn the run red; or drop that half of the row and label the key row as the log check it is. *Trigger:* the next change to the check's reads-only mode.

## 324. Ridge's full check run pins no read, so the composition in `ops/check.sh` that picks `edge_reads` is held by nothing in the run — the machine; `[OPEN]` (review of the safe scripts, 2026-11-12, Low)

`ops/test.sh` (the check's full run, the row asserting calls) and `ops/check.sh`'s last step: changing `edge_reads` to `edge_reads_client` there would drop the six reads from ridge's deploy check and every row would stay green; the function-level rows call `edge_reads` directly, not `check.sh`. *Fix, cheap half:* `$(six_reads "$S/out")` = 6 joins the row (`edge_reads_client`'s reds are `expect` lines, not `die`s). *Fix, verdict half:* the stand-in edge answers `check-t` alone while `check.sh` mints `check-<stamp>`; a mode in `edge.py` that accepts any `check-<digits>t<digits>z` code, named `Check <code>`, lets the row assert `== green`. *Trigger:* the next change to `edge_reads` or to the check's last step.

## 319. A guesser can keep a known name waiting with no end, and only the company's delete clears it — the human's choice; *open* (the wrong-password wait's review, 2026-11-12, Medium)

One wrong try sent as each wait ends (four requests an hour at 15 minutes) restarts the wait, and the person's own window is a few milliseconds. A new password given by the root or the operator does not clear a wait; only a right password with no wait running does, or the company's delete. The root's name is `root` in every company and staff codes are numbered, so one guesser can hold out every name in a company. A person already signed in keeps their session (a week) but cannot change their password during a wait. `docs/memo/bff.md` and the plan's decision 6 now say so. *Remedy, the human's to choose:* (a) an operator act that clears one name's wait; (b) a right password let through during a wait when it comes from a device that already holds a session for that name; or (c) leave it as priced, until a client's risk says otherwise. The machine has not chosen and built nothing. *Trigger:* the human's answer.

*Parked by the human, 2026-11-12 12:05:* the remedy, by device or any lock as a whole, is parked and everything stays as it is, the cloud firewall doing its part. Whether the wait itself lands with this hold left in is asked of the human, not decided.

## 325. `ops/README.md`'s deploy passage says "that push's own deploy carries it" after naming a press as well — the machine; `[DEFERRED]` (ridge's pressed deploy, reread of the fix pass, 2026-11-12, Info)

`ops/README.md`'s line on a deploy shown cancelled now names a newer push or a newer press of `ci` on `main` as the one that took its place, then ends "that push's own deploy carries it". "That run's own deploy" would fit both. Nothing turns on it: the sentence is read by a person at a cancelled run. *Trigger:* the next change to that passage.

## 332. `release.sh`'s and `app.sh`'s reasons claim more than the code holds on a real environment — the machine; `[OPEN]` (review of the safe scripts, 2026-11-12, Low)

"It ships main's commits alone" (the `real_ok` line of `ops/release.sh` and of `ops/app.sh`): set by hand outside the job, `RELEASE_BINARY` or `APP_BUNDLE` and `APP_UI_DIR` ship any file; only HEAD must be on main, the release does not check the file at all, and the app's ship checks only that the bundle carries HEAD's sha. `real_ok` refuses the tests' two switches so the code run there is the reviewed tree's, but not these two job switches: a larger form of item 143's hole, the shipped code itself. And "changes nothing else" in `ops/app.sh`: on a box without them it makes the BFF's service and `bff.env`, and it rewrites the function's environment at every run. *Fix:* on a real environment refuse those variables unless `GITHUB_ACTIONS` is `true`, or name them in item 296; word app.sh's reason as what it does. *Trigger:* the production lane's plan (item 296).

## 333. Two sentences say a save is proved on ridge first, which no code holds — the machine; `[OPEN]` (review of the safe scripts, 2026-11-12, Low)

`ops/README.md`, "On production" ("A save is proved by ridge's full check, on the same commit, before a production check reads") and `docs/client-readiness.md`'s "Only reads" bullet say it as fact. Nothing orders the two checks, and item 296 says the by-hand path can ship a commit ridge never ran. *Fix:* word both as the production lane's rule ("must be proved first; item 296"). *Trigger:* the production lane's plan (item 296).

## 338. `docs/client-readiness.md` lists what the wait leaves without the endless hold of item 319 — the machine; `[DEFERRED]` (the wrong-password wait's reread, 2026-11-12)

Gap 4 and the passage near it say what the wait leaves: one guesser trying many names meets only the stage's throttle, and each invented name leaves a small record (item 256). Neither names that a guesser can also keep a known name waiting with no end (item 319). *Fix:* add that to both places, or point both at item 319. *Trigger:* the human's answer on item 319.

## 339. The memo, the plan, item 256 and `sign-in-wait.ts`'s comment name the box's root-only file as the only other holder of the service key — the machine; `[DEFERRED]` (the wrong-password wait's reread, 2026-11-12)

`ops/app.sh` also puts `SERVICE_ACCESS_KEY` into the function's environment (its `update-function-configuration`), so whoever can read that configuration holds the key too. The four places say "the box's root-only environment file" as if it were the one other copy. *Fix:* name both in the four places. *Trigger:* the next change to the wait's pages.

## 340. A unit test title says a wait's key ends in the name's SHA-256, and case 14 would stay green if the key came from the service key's SHA-256 — the machine; `[DEFERRED]` (the wrong-password wait's reread, 2026-11-12)

`shared/src/records.test.ts`'s title near line 97 ("A sign-in wait's key ends in the name's SHA-256") is out of date: the BFF now keys the hash. Case 14 (`bff/src/sign-in-wait.route.test.ts`, near line 223) asserts the key is not the name's bare SHA-256 and differs between two service keys, which a key derived from the service key's own SHA-256 would also satisfy. *Fix:* reword the title to "a hash", and give case 14 an expected value computed by the intended derivation. *Trigger:* the next change to the wait's key.

## 341. Nothing catches the read-only check's function query drifting to take in the environment again, so the BFF's two keys could reach the shell with every test green — the machine; `[DEFERRED]` (the reread of the safe scripts' fix pass, 2026-11-12)

`ops/lib.sh`, `BFF_FN_QUERY`, is the one query the check reads the function with, and it returns names and two non-secret values only. If it drifts to return `Environment` again, the text check and the stand-in in `ops/test.sh` match it loosely and stay green, while `INTERNAL_ACCESS_KEY` and `SERVICE_ACCESS_KEY` reach the shell and, through bash 3.2's here-strings, a temp file. *Fix:* pin the query's exact string in the test. *Trigger:* the next change to `BFF_FN_QUERY` or to a reader of it.

## 342. `scripts/src/running/claim.ts`'s draft cleanup is pinned by no case, so deleting it stays green — the machine; `[DEFERRED]` (the root-proof tests' review, 2026-11-12)

`claim.ts`'s `rmSync` of the draft after a failed write is run by every failing case but asserted by none: each fails at the folder's creation, before any draft exists. The case it guards, a written draft whose rename then fails, cannot be staged as root without a mock (a directory standing at the claim's name throws earlier, at the existence check). *Fix:* pin the draft's removal on a failed rename with a mocked `renameSync`, or drop the line as unreachable. *Trigger:* the next change to `claim.ts`.

## 365. A changed Slack workspace ID is two runs by the runbook, which no real run has shown — the machine; `[OPEN]` (the Slack alarm's review, 2026-11-12, Low)

`ops/README.md` ("The watch") now says a changed workspace ID is `none` and `none` with `--take AlertsChannel --take AlertsChannelRole` first, then the new IDs, because the channel's configuration name is fixed and both it and the workspace ID need a replacement that would create the new one while the old still holds the name (CloudFormation's page for `AWS::Chatbot::SlackChannelConfiguration`). The review read that page and did not run it; the stack run on ridge has not been made yet. *Fix:* read the first real change of a workspace ID, or the change set of the second run, and correct the runbook if the replacement works in one run. *Trigger:* the first change of the workspace ID on any stack, or the stack run on ridge.

## 366. Whether AWS lists parameters on a `REVIEW_IN_PROGRESS` stack is unread; the Slack IDs now take no previous value on a creation either way — the machine; `[OPEN]` (the Slack alarm's review, 2026-11-12, Low)

`slack_param_plan` in `ops/lib.sh` answers `previous` only when the run is not a creation (`CS_TYPE` is not `CREATE`), because a creation would otherwise send `UsePreviousValue` for a parameter that has no previous value. A stack left in `REVIEW_IN_PROGRESS` is a creation (`ops/lib.sh#L346`). The review could not tell whether `describe-stacks` lists the template's parameters on such a stack; the guard is a precaution that costs nothing either way. *Fix:* on the next real run that meets such a stack, read what `describe-stacks` returned; if it lists none, the extra condition is dead and goes. *Trigger:* a stack run meeting `REVIEW_IN_PROGRESS`.

## 367. The forced alarm's count of actions run rests on AWS's wording for a successful action, not seen on a real run — the machine; `[OPEN]` (the Slack alarm's review, 2026-11-12, Medium)

The one-off `watch-force` counts an alarm-history Action item as a success when its summary starts "Successfully executed action" or its data says `actionState` is `Succeeded`, and waits for two delivered notifications in the topic's metrics. Both shapes come from AWS's reference examples and the reviewer's reading, and a failed action is counted nowhere; the field names and the delivered count's lag are untested against a real alarm. *Fix:* after the first forced alarm on ridge, read the log, and set the filter to the exact fields seen. *Trigger:* the first run of the forced alarm.

## 368. The watch's two one-offs leave three smaller gaps — the machine; `[OPEN]` (the Slack alarm's review, 2026-11-12, Info)

`watch-stack` gives no end time for its wait; neither one-off refuses when ridge is absent (the stack script would then create the whole environment); and step 10 of the plan counts "seven Add lines", which becomes two if ridge is rebuilt from `main` after the merge. AWS also says a metric alarm returns to its state "quickly, often within seconds", where the runbook, the force script's header and the plan say about five minutes, so the two messages can arrive close together. *Fix:* print an end time, add a refusal when the ridge stack is absent, and say "two or seven" at step 10. *Trigger:* before the stack run on ridge.

## 369. The destroy's stop line names every workflow as off, though only the ones this run switched off are — the machine; `[DEFERRED]` (the reread of the ridge cycle's fix pass, 2026-11-12, Low)

`ops/destroy.sh`, the stop line near `#L87` with the disable at `#L346-L362`: `WF_OFF=1` is set once the first workflow is off, and the line then says "the workflows (ci.yml and seed.yml) were switched off, and they are still off". If `seed.yml`'s disable fails under `set -e`, or its read-back finds it still `active` (`#L362`), the line is false for `seed.yml`; in the second case the line above it says so. *Fix:* make `WF_OFF` the list of workflows this run switched off or found off, added to as each disable returns; at `#L362` take the one that read back active out of the list before the `fail`, and have the line name the list. *Trigger:* the next change to the destroy's stop line, or before the rehearsal on ridge.

## 370. After the box is terminated, the destroy's stop line tells the reader to run the remake, which a half-deleted stack cannot take — the machine; `[DEFERRED]` (the reread of the ridge cycle's fix pass, 2026-11-12, Low)

`ops/destroy.sh`, the same line near `#L87`, from the terminate at `#L406` until the stack reads back gone at `#L456`: it says to bring ridge back with `ops/remake.sh`. On that stretch the stack still stands with its box gone; the remake's first step updates that stack and waits for a box that does not come (`stack.sh#L285`), and a stack in `DELETE_FAILED` (`#L454`) refuses any update. Not run: no test runs a remake on a half-deleted stack. *Fix:* set a flag just before `#L406`; once set, the line says part of ridge is already deleted, to run `ops/destroy.sh ridge` again until it ends on its verdict, then `ops/remake.sh ridge`. *Trigger:* the same as item 369, or the first real stop in that stretch.

## 371. The rerun the stop line advises cannot see the disk, and ends saying the disk is gone — the machine; `[DEFERRED]` (the reread of the ridge cycle's fix pass, 2026-11-12, Low)

`ops/destroy.sh#L226-L240`: the disk outlives the box (`DeleteOnTermination: false`, `env.yml#L128`). After a stop between the box's termination and the disk reading back gone (`#L419`, `#L422`, `#L423`, `#L427`), a rerun finds the box terminated and clears `BOX`, never reads `VOL`, skips step 6d and the last read at `#L485`, deletes the stack, and ends on "Gone: the box and its disk" (`#L518`). The disk is still there, holding the records and still billed. This is the original code; the stop line now sends people to it. *Fix:* on a stop in that stretch, the line names the disk `$VOL` and says a rerun cannot see it, so it is kept or deleted by hand; or, when the box is already terminated, the stack path lists the unattached volumes, as the no-stack path does at `#L320-L324`. *Trigger:* the same as item 369.

## 372. `slack_params_guard` passes the `add_slack_params` call moved inside the creation branch — the machine; `[DEFERRED]` (the Slack alarm's reread of the fix pass, 2026-11-12, Low)

The guard in `ops/test.sh` counts the call once and asks for `add_param BoxPort` within the three lines above it, so the call moved to the first line under `if [ "$CS_TYPE" = CREATE ]` still passes, although its message says "before the creation and update paths split". The loss on an update would be loud: no Slack parameter is sent, the parameters fall to the default `none`, and the change-set guard refuses the channel's removal at `--plan`. *Fix:* pin the env branch's depth (the call at four spaces) or check that the next line is the creation `if`. *Trigger:* the next edit of the env branch of `ops/stack.sh`.

## 373. The forced alarm reads a failed action as "not seen" after 14 minutes, not as failed — the machine; `[DEFERRED]` (the Slack alarm's reread of the fix pass, 2026-11-12, Low)

The one-off `watch-force` counts only successful Action items, so a refused publish leaves the count at 0 and the run ends "not seen by" the deadline; the next reader hunts a lag instead of a failure. *Fix:* count the "Failed to execute action" items beside the successes and name them in the note. *Trigger:* the first run of the forced alarm (with item 367).

## 378. The check cannot read the copy's lag after a restart, and the deploy job's check always runs just after one — the machine; `[DEFERRED]` (the continuous copy's review, fix pass, 2026-11-12, Medium 2)

c-storage keeps the time of its last write in memory only (`lastWriteAt` in `services/c-storage/internal/store/store.go`), so after any restart, and every release is one, the check has no write time to compare the newest copy with. The fix pass made the check say so (its green line reads "the lag was NOT read" and no longer claims the copy holds the last write); it did not make the reading. *Fix:* a reading that survives a restart, read on the box under `sudo` as `copy_status` already is: compare the newest local level-0 file name under `.c-storage.db-litestream/ltx/0/` with the bucket's largest `0000/` key (equal maximum transaction ids mean everything written is copied, with no clock), or take the mtime of the file and its `-wal` as the floor of the last write. *Trigger:* the drill on ridge, which reads the copy for real; until then Litestream stopping while saves go on is seen only by a check run after a save.

## 379. The six-day red names no action — the machine; `[DEFERRED]` (the continuous copy's review, fix pass, 2026-11-12, Info)

When the newest full copy is six days old, the check is red and nothing in the runbook says what to do. Without a write Litestream makes no new full copy, and the bucket's rule removes the only one on day seven. *Fix:* one line in the restoring section of `ops/README.md`: a write (or the drill) makes a new full copy, and a red at day six is to be answered before day seven. *Trigger:* the first six-day red, or the drill's close.

## 380. Three sentences say c-storage "holds the only copy of the data", which stops being true at the drill — the machine; `[DEFERRED]` (the continuous copy's review, fix pass, 2026-11-12, Info)

`services/c-storage/internal/config/config.go` (its first comment, there to justify fatal configuration errors, a reason that still holds), `ops/unsafe-changes.jq` (its opening comment) and a comment in `ops/test.sh` carry the sentence. *Fix:* reword each with the recap or at the drill's close, once a restore has been read back. `services/audit-backbone`'s same sentence stays true. *Trigger:* the drill's close.

## 381. The blank-disk restore has not been walked, and the restored file's owner is left to systemd — the machine; `[DEFERRED]` (the continuous copy's review, fix pass, 2026-11-12, Medium 3)

`ops/restore.sh <env> --onto-blank` (`box_restore_blank` in `ops/lib.sh`) formats a disk with no filesystem, mounts it and restores onto it as root with mode 600, then the release starts c-storage as its dynamic user. It relies on systemd re-owning the state directory's contents when the unit starts (documented for `StateDirectory=` with `DynamicUser=`, never seen here), and it has run only on stand-ins and as text guards. *Fix:* none until seen; if c-storage cannot open the restored file, `chown` it to the directory's owner in the script. *Trigger:* the first replacement box, or the drill if it is made to walk a blank disk.

## 382. The destroy's copy-bucket and records-disk steps have run only on stand-ins — the machine; `[DEFERRED]` (the continuous copy's review, fix pass, 2026-11-12, Medium 1)

`ops/destroy.sh` now empties and deletes the copy bucket and reads back the stack delete's snapshot of the records disk (`RecordsVolume` has `DeletionPolicy: Snapshot`, so the stack delete takes one and deletes the disk); it also accepts a box with the records disk attached. All of that is read from AWS's documented behaviour and exercised on `ops/test.sh`'s stand-in for `aws`; it has not run against a real stack. The snapshot the stack delete leaves stays until the human deletes it (a few cents a month). *Fix:* none until seen. *Trigger:* the next `ops/destroy.sh ridge` after ridge holds the copy. Two reread notes, deferred: (a) the destroy counts the copy bucket's files before the prompt, while the box still runs and Litestream still uploads, and compares that count with what `aws s3 rm` reports in 6e2 after the box is terminated; an upload in between makes them differ and the run stops with the box and its root disk already deleted (a rerun counts again and finishes). *Fix:* count again after 6c, or compare with the listing taken after the delete alone. (b) Not read: how the stack delete treats `RecordsAttachment` once 6c has terminated the box, which detaches the disk first; a `DELETE_FAILED` there would show at 6f's read-back. (c) The same per-page count sits in `ops/destroy.sh` (`#L280`, `#L322`, `#L496`, `#L511`): each reads `list-objects-v2 --query 'length(Contents || `[]`)' --output text`, and the AWS CLI's text output runs the query on each page of 1000 keys, so a bucket of more than 1000 files reads as one number a page; the move fixes' review found it and fixed `copy_count` in `ops/lib.sh` (the json output, which merges the pages first), not these. *Fix:* the same `--output json | jq` read in each.

## 383. The ci fix's new case tests the error handler, not the new order, and the child ports can still collide — the machine; `[DEFERRED]` (the review of the ci fix, 2026-11-12, Low)

`scripts/src/stack.test.ts` "fails at once, naming the port, when the front's port is taken, and takes down what it had started": without the `error` handler it hangs, so the handler is tested; but with the old start order plus the handler every assertion would still pass, so the new order (the front bound first) is not tested. Its title also promises more than it checks: it asserts only `EADDRINUSE`, not the port, and only c-storage's being down, not the audit service or the seed door. The race the diagnosis named is closed only for a front port the stack picks. The two cases that pick the front's port with `freePort()` and the four child ports of every stack (c-storage, the BFF, the audit service's two) are still picked and bound later; if one is taken it is now a fast red naming `EADDRINUSE` or "exited", never a hang. *Fix, if wanted:* assert `toThrow(String(front))` and that the audit service's `/health` refuses.

## 384. The demo copies' remake restates the history length in bash, so a change to it leaves the closing line false — the machine; `[DEFERRED]` (the review of the demo copies by script, 2026-11-12, Low)

`ops/demo-remake.sh` holds "21 days" in its closing line; it restates `HISTORY_DAYS` in `scripts/src/demo/apply.ts`. A change to `HISTORY_DAYS` leaves it false with everything green, and the run's case 14 pins the literal "21 days". *Fix, if wanted:* have `mapping_read`'s node call also print the constant (the test's stand-in half then copies it too), and compute the closing line from it. *Trigger:* the next change to `HISTORY_DAYS`.

## 387. `ridge-seed.test.ts` no longer asserts the exit status of seven of its runs — the machine; `[DEFERRED]` (the review of the demo copies by script, 2026-11-12, Info)

The old test asserted every run's status; with the 21-day fill the loop of seven extra runs (`for (let night = 0; night < 7; ...) await run()`) asserts none. The ledger's `lastDay` moving exactly 14 days over them covers it in practice. *Fix, if wanted:* collect the statuses and assert them all 0. *Trigger:* the next edit of that test.

## 388. Another ui test counts an api load right after a heading drawn on the page's first render, with no wait — the machine; `[DEFERRED]` (the ui race fix, 2026-11-12, Low)

The shape of the red at `fdfdf90e` in `MyDeliveries.test.tsx` (heading awaited, then a call count at once, while the load starts in a `useEffect`): one more case has it, found by reading every `expect(api.<member>).toHaveBeenCalled…` after an awaited find in `ui/src`. `ui/src/OperatorApp.test.tsx#L449` awaits the heading "Operators", reads the "Add an operator" link, then asserts `listOperators` was called once; `OperatorsPage.tsx` draws both before its load (`ui/src/pages/operator/OperatorsPage.tsx#L20-L28`). The others read were safe: they await text that only the loaded data draws (`pages/client/ListPage.test.tsx#L125`, `#L184`, `#L413`; `pages/client/Reconcile.test.tsx#L41`; `pages/client/OrdersPages.test.tsx#L71`; `pages/client/DeliveriesPages.test.tsx#L36`; `pages/operator/JoinPage.test.tsx#L21`; `pages/operator/OperatorsPage.test.tsx#L43`), or follow a call the app itself waits on (`App.test.tsx#L106`, `OperatorApp.test.tsx#L220`, `pages/client/Access.test.tsx#L97`). The fix is the same one line: the count inside `await waitFor(...)`.


## 392. The stop of the second c-storage can signal a reused pid and races the process it stops — the machine; `[DEFERRED]` (the review of the store pages and the company copy, 2026-11-13, Low)

`ops/lib.sh`'s `box_stop_restored` signals the pid in `/run/c-storage-restored.pid` as root, and nothing clears that file when `timeout` ends the process by itself, so a later stop can signal a reused pid. It removes the file without waiting for the process to exit, and a c-storage still running can recreate an empty file at that path (the unit's header says it makes a new, empty file wherever it is pointed). *Fix, if wanted:* read `/proc/<pid>/cmdline` before the kill, wait up to a few seconds for the process to end, then remove the files, and give `timeout -k`. *Trigger:* the first run on ridge that meets a leftover pid file, or the next edit of the helper.

## 393. The second c-storage's health wait cannot tell it from another listener on 3182, and a failed start leaves no reason — the machine; `[DEFERRED]` (the review of the store pages and the company copy, 2026-11-13, Low)

`ops/lib.sh`'s `box_serve_restored` sends the binary's output to `/dev/null` and waits for `/health` on the port. *Fix, if wanted:* check `kill -0 $!` along with the answer, and keep the first lines of the binary's stderr. *Trigger:* a run that stops at "the second c-storage did not start".

## 394. The JavaScript key compare is not the store's key order for characters above U+FFFF — the machine; `[DEFERRED]` (the review of the store pages and the company copy, 2026-11-13, Low)

`bff/src/records/records.ts` (`first.key <= cursor`) and `bff/src/records/company-copy.ts` (`s.key <= t.key`) compare keys in UTF-16 code units, while SQLite orders them by bytes (code-point order). They disagree for a character above U+FFFF set against one in U+E000 to U+FFFF; a sign-in name (`user(name)`) may carry either. At worst: a false "longer than c-storage returns" 500 on a list of more than one page, or a mispaired key in the copy, which shows as a false stop or a red compare; never another company's key and never a silent green. *Fix, if wanted:* one code-point comparator for both sites and one test with that pair of keys. *Trigger:* a key with such a character on a real list, or the next edit of either file.

## 395. The runbook says the seed ends on STILL BEHIND — the machine; `[DEFERRED]` (the ridge guide's second read, 2026-11-13, Low)

In `ops/README.md`, the seed's third check says a run that ends on the STILL BEHIND line is green, but `scripts/src/ridge.ts` prints that line before the summary and `ops/seed.sh` then prints `seeded <sha>`. *Fix, if wanted:* say "a run that prints". *Trigger:* the next edit of `ops/seed.sh`.


## 389. The whole-check test's stand-in edge never knew the check's own client, so its sign-in reds went unread — the machine; `[DEFERRED]` (the activity log's step 6, 2026-11-13, Low)

In `ops/test.sh`, the stand-in edge answers one fixed client code (`FAKE_EDGE_CODE`), while `ops/check.sh` makes a client whose code carries the date. So in the whole-check runs of `ops/check.sh ridge` the stand-in could not know the client the root signs in to, by the code alone, and no case read the run's green. It was found when the step added a customer through that edge and needed the sign-in to hold. *Done at that step:* the stand-in edge takes any `check-2…` code when `FAKE_EDGE_ANYCODE` is set, and the whole-check cases read that run's `RED` lines. *Left:* the other whole-check runs (`reads-only`, the copy cases) still do not read their own `== green`; they read single lines. *Trigger:* the next edit of the check's stand-ins.

## 390. By hand, the log's gate and build run after c-storage has restarted — the machine; `[DEFERRED]` (the activity log's review, 2026-11-13, Low 4)

In `ops/release.sh` the by-hand path builds and checks the store before anything is sent (`#L62-L68`), but the log's `make check` and `make dist` run in its second half (`#L245-L249`), after c-storage has restarted. A red log gate then leaves c-storage on the new commit and the log behind. The job's path is unaffected, since the binary is built there before the role is taken. *Fix, if wanted:* move the by-hand `make check` and `make dist` of the log up beside the store's; the send stays in the second half, so the log's half still does not touch c-storage. *Trigger:* the first by-hand release after GitHub Actions has been down.

## 391. Two values of the activity log are each written in several places — the machine; `[DEFERRED]` (the activity log's review, 2026-11-13, Low 5; code convention C1)

The keys file path `/etc/audit-backbone/keys.env` is spelled out in six places: `ops/release.sh` (two), `ops/app.sh`, `ops/check.sh` (two) and `ops/audit-backbone.service`. The open port is read by a second `sed` in `ops/lib.sh` beside `unit_port`. The store's keys path is spread the same way today. *Fix, if wanted:* `unit_port <file> [<name>]` with `OPEN_PORT` as the name, and the keys path as one name in `ops/lib.sh`, passed to the here-documents as an argument. *Trigger:* the next change of either value.

## 397. `ops/CLAUDE.md`'s counts of scripts (OP5 and OP9 "10 of 10", OP6 "9 of 10") do not match the folder, and its port line named a taken port — the machine; `[DEFERRED]` (the key script, 2026-11-13, Info)

The folder holds fourteen scripts that call `main_synced` (with `ops/keys.sh`); the rules say ten. OP4's counts are right since 2026-11-18, recounted when `ops/walks-refused.sh` went: seventeen scripts print a usage line and five hand-run ones refuse a bad call. OP6's hand-run "4 of 4" is to be recounted with the rest. The port line said a new script takes 3197, which `ops/demo-remake.sh` already holds; this step set `ops/keys.sh` to 3198 and the line to "3191 to 3198; next 3199". *Fix, if wanted:* drop the counts from the rules (the stance test already holds the glob) or have a test compare them.

## 398. A service-key run restarts every sign-in wait and voids every open operator challenge, because both are derived from the service key — the machine; `[DEFERRED]` (the review of the front door's keys, 2026-11-13, Medium; the cost is now said, the separate secrets are parked)

`bff/src/records/sign-in-wait.ts` (`waitKeyFrom`) names each wait's record by an HMAC under a key derived from the back end's service key, and `bff/src/calling/challenge.ts` (`createChallenges`) signs the operator's challenges under another key derived from the same one. After `ops/keys.sh <env> service`, a name that was in a wait is looked up under a new record name and gets five fresh tries, the old wait records stay in the store, and an operator mid-sign-in fails once (a challenge lives 5 minutes). The script's header, its closing line and the runbook now say so. *Fix, if wanted:* a secret of their own for the waits and for the challenges, held beside the service key on the box and in the function, so a service rekey leaves them alone; it adds one more key to the four. *Trigger:* the first production company, or a service-key replacement that happens during a sign-in wait someone cares about.

## 399. `wait_store`'s failure message in `ops/keys.sh` is shared by the internal and the admin runs, and says "the function still the old" for both — the machine; `[DEFERRED]` (the review of the front door's keys, 2026-11-13, Low)

The admin run never touches the function and the internal key does not change in it, so the clause is false there. The reread added two more of the same kind. The admin run's `STOPPED` line says no call of the app is refused, but when the store does not come back after its restart (`wait_store`'s 40 seconds) every call is refused. And the service run's rekey-refusal stop says "nothing was changed" even when a rekey that timed out may have landed in the store. *Fix, if wanted:* pass the message in, or word it for both. *Trigger:* the next edit of `ops/keys.sh`.

## 400. `everything` reads pages without `pagesOf`'s check — the machine; `[DEFERRED]` (the review of the store pages and the company copy, 2026-11-13, Low)

`scripts/src/demo/apply-support.ts`'s `everything` ends silently on a page that says `more` but holds no records, and loops for ever on a c-storage that ignores `after`: the fault `pagesOf` raises. Only tests call it today. *Fix, if wanted:* call `pagesOf` or copy its check. *Trigger:* the first non-test caller.

## 401. The wrapper's smaller faults: the check order, the stop advice, the copy's rate — the machine; `[DEFERRED]` (the review of the store pages and the company copy, 2026-11-13, Low)

Three of the review's list that the fix pass left. (1) The check for node and `pnpm install` in `ops/company-restore.sh` comes after the first `ridge_cli`, so a missing install is reported as "<code> is refused". (2) The stop advice, "the same run again goes on from the compare", does not match a rerun, which restores a new newest copy and starts over. (3) No rate tells whether a demo copy's copy fits inside the second c-storage's 900 s. *Fix, if wanted:* move the two checks above the first `ridge_cli`; reword the advice; print the copy's seconds and records on a run and compare them with 900 after the first real run. *Trigger:* the first real run on ridge (the rate), the next edit of the script.

## 402. Ctrl-C reaches the ssh proxy, so the cleanup's calls may find the connection gone — the machine; `[DEFERRED]` (the review of the store pages and the company copy, 2026-11-13, Low; needs a real run to be certain)

`box_open`'s `ssh -f` daemonizes only itself; its ProxyCommand (`aws ec2-instance-connect open-tunnel`) was forked before that and stays in the terminal's foreground process group, so it gets the SIGINT and drops the connection before `on_exit` runs. The wrapper now says what it could not remove (a `WARN` line), but a Ctrl-C will still often leave the second c-storage to end by itself. *Fix, if wanted:* shield the proxy (`(trap '' INT; exec ssh -f ...)` in `box_open`); it changes every ops script, so it is a change of its own. *Trigger:* the first real Ctrl-C on a run, or the next change to `box_open`.

## 403. `docs/client-readiness.md` holds 14 line citations to `bff/src/routes/orders.ts` that were already wrong — the machine; `[DEFERRED]` (the review of the store pages and the company copy, 2026-11-13, Info, pre-existing)

The page (a living document) cites `bff/src/routes/orders.ts#L218` to `#L483`; read at their targets at the merge base they were already wrong, and the piece's two added lines in `priced` move them by two more. *Fix, if wanted:* re-derive the 14 citations, as symbols where one exists. *Trigger:* the next change to that page.

## 404. The stand-in's check of the live file looks at the link's target, not at the stand-in box's own path — the machine; `[DEFERRED]` (the reread of the store pages fix pass, 2026-11-13, Low)

`ops/test.sh` checks that the live file is there at `$S/db/c-storage.db`, the target of the box's symlink, so a wrapper that moved the link itself would not show. *Fix, if wanted:* check `$BOX/records/c-storage.db` too, as a link still pointing at that target. *Trigger:* the next edit of the stand-in section.

## 405. The restored file's path is worked out in two places — the machine; `[DEFERRED]` (the reread of the store pages fix pass, 2026-11-13, Low)

`ops/company-restore.sh` builds `restored-c<stamp>.db` itself before the restore, and `box_restore` in `ops/lib.sh` builds the same name on the box. The wrapper checks the answer against its own, so a drift stops the run, but the name has two homes. *Fix, if wanted:* one helper in `ops/lib.sh` that both read. *Trigger:* the next change to the name.

## 406. No test reaches the wrapper's 30-second line — the machine; `[DEFERRED]` (the reread of the store pages fix pass, 2026-11-13, Low)

The stand-in's copy ends in seconds, and the slow variants are stopped before 30 seconds, so the "still copying" line is read by no test. *Fix, if wanted:* a variant whose node waits past 30 seconds and a count of the line. *Trigger:* the first real run that shows the line wrong.

## 410. The binary the deploy ships is built with a different Go than the one CI tests — the machine; `[DEFERRED]` (the activity log's review, 2026-11-13, Low 6)

The deploy job's Go is c-storage's (its `toolchain go1.26.7`), while the `audit` job tests on the service's own `go 1.25.0`. Because `go.mod` says 1.25.0, the runtime defaults stay those of 1.25, so the risk is small. *Fix, if wanted:* give the service's `go.mod` the store's `toolchain` line, or set up Go a second time in the deploy job before the log's build. *Trigger:* a Go release that changes a runtime default the service meets.

## 412. `FRONT_DOOR_KEY_FILE` is a switch carried by the shell's environment, so a shell that still exports it turns an ordinary stack run into a key run — the machine; `[DEFERRED]` (the review of the front door's keys, 2026-11-13, Low)

`ops/stack.sh` reads the variable at four places (the step count, the key, the guard, the box step). A shell that exports it with a valid file makes `ops/stack.sh env <env>` change the door's key with no function update, so every API call is 403 until `ops/app.sh` runs, and the box and GitHub steps are skipped. *Fix, if wanted:* take it as an argument (`--door-key-file <path>`; a path is no secret), which `ops/keys.sh` passes. *Trigger:* the next edit of `ops/stack.sh`, or the first time a key run is left exported in a shell.

## 413. The door header's name is written out three times in TypeScript, while its sibling `CLIENT_HEADER` is declared once — the machine; `[DEFERRED]` (the review of the front door's keys, 2026-11-13, Low; `code.md` C2)

`bff/src/server.ts`, `scripts/src/running/front.ts` and `scripts/src/stack.ts` each hold `x-front-door-key`; `shared/src/wire.ts` declares `CLIENT_HEADER` once. *Fix, if wanted:* export `FRONT_DOOR_HEADER` there and import it in the three. *Trigger:* the next edit of any of the three.

## 414. The door hook writes its own 403 reply instead of throwing `HttpError(403, 'Forbidden')` for the one error handler — the machine; `[DEFERRED]` (the review of the front door's keys, 2026-11-13, Low; `code.md` C7)

`bff/src/server.ts` replies inside the hook; `bff/src/app.ts` holds the one error handler that turns an `HttpError` into a reply. *Fix, if wanted:* throw. Check first that the not-found path and the log line (case 6) are unchanged. *Trigger:* the next edit of the hook.

## 416. Knip says an ignore entry is no longer needed — the machine; *parked* until a review (the long runs plan's fill, 2026-11-13, Low)

Every scripts gate's knip step ends with one configuration hint, `services/audit-backbone/**` in `knip.json`'s `ignore`: "Remove from ignore". The entry was added when the Go service came in, so the root check would not claim files the Go gate owns; knip now reads it as an entry it does not need, for a reason not read. It is a hint, not a red: the step ends 0. *Fix, if wanted:* remove the entry and read that knip still ends 0 with no hint. *Trigger:* the next change to `knip.json`.

## 421. act's audit job alone ran 13 minutes 45 against an expected 2, its Go cache neither restored nor saved — the machine; *parked* until the long runs plan's act step (the orchestrator's measurement, 2026-11-13, Low)

The orchestrator's act run of the `audit` job alone, for the day's push, took 13 minutes 45 seconds where about 2 were expected, and 17 minutes 6 seconds in all with 3 minutes 16 seconds waiting for the gate lock. The Go cache's restore and its save were both refused (connection refused), so the toolchain and the modules were downloaded again. A cache that never restores is the same as none. *Fix, if wanted:* read why act's cache server refuses before the act step bounds its run at 15 minutes, since a job that downloads its toolchain each run spends its minutes there. *Trigger:* the plan's act step (`docs/plans/2026-11-13-long-runs.md`, step 4).

## 417. Two conditions of the key run's partner test are pinned by no case: the Dynamic detail's `DirectModification` source and its absent cause — the machine; `[DEFERRED]` (the review of the front door's key-run guard, 2026-11-13, Low)

`ops/key-run-changes.jq#L9` requires a Dynamic detail with source `DirectModification` and no cause. With both conditions deleted, every change set the suite builds keeps its verdict (`ops/test.sh#L4451`'s loop and the extra case before it). A Dynamic detail of another cause on the same Target, for example a `ResourceAttribute` from the `!GetAtt Api.ApiEndpoint` in `ops/env.yml`, would then pass; today a changing `Api` is a change of its own in the set and the distribution test refuses it, so nothing is lost yet. The Static test on the key's own detail (`#L8`) is unpinned the same way. Still so in the tree at filing. *Fix, if wanted:* one more variant in the loop at `ops/test.sh#L4451`, with `Details[0]` turned into a Dynamic `ResourceAttribute` with cause `Api.ApiEndpoint`; it must be refused, and it goes red once both conditions are deleted. *Trigger:* the next edit of `ops/key-run-changes.jq`.

## 418. The "no parameter value" count in the key run's refusal row cannot go red for the new detail print — the machine; `[DEFERRED]` (the review of the front door's key-run guard, 2026-11-13, Low)

The fourth count of the row at `ops/test.sh#L4441-L4442` greps the output for the key, but the stand-in's `describe-change-set` (`ops/test.sh#L4112`) returns a fixed file that never holds the key. So the count pins the parameter echo at `ops/stack.sh#L232` and not the detail print at `ops/stack.sh#L261`; the claim itself holds by construction. Still so in the tree at filing. *Fix, if wanted:* say so in the row's name, or put the key into one Target's `AfterValue` in the extra variant, so that a print of a value field goes red. *Trigger:* the next edit of the detail print.

## 419. The plan's case list says "a second parameter" for a case the suite does not have — the machine; `[DEFERRED]` (the review of the front door's key-run guard, 2026-11-13, Low)

`docs/plans/2026-11-11-front-door-keys.md#L299` and `#L301` name "a second parameter", but the case at `ops/test.sh#L4448` replaces the key's cause with `SubjectPrefix`; it is not a second parameter beside the key. The shape the words describe (the key's pair plus another parameter's Static detail) is not a case, though the code refuses it through the `all` of `ops/key-run-changes.jq#L11`, which the extra case pins. Still so in the tree at filing. *Fix, if wanted:* word it "another parameter in place of the key", or add the beside-the-key shape as a fourth variant. *Trigger:* the next edit of the plan's step 8a.

## 420. Nothing enforces the demo remake's "up to 15 minutes": the notice names the bound and a clock time, and a run that outlives it is not stopped — the machine; `[DEFERRED]` (the review of the demo copies' remake, 2026-11-13, Low)

`ops/demo-remake.sh` prints "the remake may take up to about 15 minutes, until about HH:MM" and a line every 30 seconds while the remake runs, but no timer ends a run past it; the old script, with its 160-minute notice, was the same. A stuck copy on ridge is read by the human from the lines, not stopped by the script. *Fix, if wanted:* end the remake at the bound with the same stop as a dropped tunnel (naming `--go-on`). *Trigger:* the first run on ridge that passes 15 minutes.

## 423. A package whose folder is not named for its package (`@credo/<dir>`) would be a green no-op in the local `pnpm check`: `ops/gate.sh` runs `pnpm --filter "@credo/$d" run "$script"` with no `--fail-if-no-match` — the machine; `[DEFERRED]` (the review of the split of the app job, 2026-11-14, Low)

`ops/gate.sh#L188` takes `$d` from `pnpm-workspace.yaml` and tests only that the folder has a `package.json`, so it does not see a folder whose package.json `name` is not `@credo/<dir>`; the filter then matches nothing, and with pnpm 12.10.1 that exits 0 (read in a scratch run), where `--fail-if-no-match` makes it exit 1. CI catches it since the split: the workflow's six package lines carry the flag. The local `pnpm check` does not. *Fix, if wanted:* add the flag at `ops/gate.sh#L188`, with a case in `ops/test.sh`'s gate section. *Trigger:* the next edit of `ops/gate.sh`'s package loop.

## 424. Node 26 is pinned to one release in `.node-version`, so a Node security release reaches CI only when someone raises it — the machine; `[DEFERRED]` (the toolchain cache step of the split, 2026-11-14, Low)

Every job named `node-version: 26`, which took the newest 26.x each run; the toolchain cache is keyed on the release (a floating number would restore a stale Node for as long as the cache lives), so the release is now one line in `.node-version`, which `ops/test.sh` requires to be an exact 26.x.y. *Fix, if wanted:* a scheduled or manual job that opens the bump when a newer 26.x exists. *Trigger:* the first Node 26 security release, or the first run whose log shows `.node-version` behind the newest 26.x by a minor.

## 425. Each package job repeats the repository-wide eslint, prettier and knip, about 52 seconds of the 11-13 run — the machine; `[DEFERRED]` (the toolchain cache step of the split, 2026-11-14, Low)

`ops/gate.sh` runs those three over the whole repository whichever package it was asked for, so the six jobs of the split do the same work six times; the downloads they also repeated are cached since this step. *Fix, if wanted:* run the three in one job and the packages' typecheck and tests in the rest. *Trigger:* GitHub's run of the split with its caches, read for the per-job minutes of those three steps.

## 432. A restored Node toolchain may keep the Bruno CLI's whole dependency tree as it was at the first save, so e2e would test a frozen tree — the machine; *parked* until the first re-run of the cache change (the review of the toolchain cache, 2026-11-14, Low)

The e2e job's cache holds the Node prefix, and `npm install -g @usebruno/cli@4.2.0` over a restored prefix may keep the dependency versions it finds rather than resolve the newest; the e2e comment's promise that bru works without its newest dependencies would then cover one old tree. The deploy no longer restores anything (its Bruno install resolves fresh each run), so a broken new transitive version would pass e2e and fail only in the deploy's ridge check. *To read:* the "Install Bruno CLI" step of e2e's second run on one ref: "up to date" or "added 0" means the old tree is kept; "added N" or "changed N" means it resolves anew. *Fix, if it is kept:* install Bruno with `--prefix` into `$RUNNER_TEMP`, as the walks deploy does for wrangler, or save the Node prefix before the install. *Trigger:* that second run's log.

## 433. `cache_guards`' credential reading has two holes: a `cache: false` under another step satisfies the setup-go test, and `permissions: write-all` is not read as a credential — the machine; `[DEFERRED]` (the reread of the toolchain cache, 2026-11-14, Low)

`ops/test.sh#L1782` tests `cache: false` against the whole job block, so a deploy whose setup-go keeps its cache passes while `cache: false` sits under setup-node. The credential mark at `ops/test.sh#L1779` reads `environment:`, `id-token: write` and `secrets.` only, so a job with the job-level `permissions: write-all` (which grants the OIDC token, recalled, not read here) is not marked and passes with caches. Both seen passing in a scratch copy at the reread. *Fix, if wanted:* read `cache: false` inside the setup-go step's own `with:`, and count `write-all` as a credential, each with a case among the guard's cases. *Trigger:* the next edit of `cache_guards`.

## 435. The Services status page shows the app's page by the build its tab loaded, so a tab left open across a deploy shows that row a build behind and calls the deploy half done — the machine; at the next change to the page (the build version plan, 2026-11-14, Low)

The app's row is the commit compiled into the scripts the tab loaded (`ui/src/main.tsx#L32`), while the BFF's and c-storage's are asked each minute (`ui/src/pages/operator/ServicesPage.tsx#L85-L100`). After a deploy, a tab opened before it marks the app's page "Different build", and the sentence above the rows (`ui/src/i18n/en.ts#L260-L261`) says c-storage is updated first, then the BFF and the app, which reads as "wait" when a reload is the whole remedy: `index.html` is served `no-cache` (`ops/app.sh#L156-L157`), so a reload shows the new build. It bites at a deploy's look and in the rehearsal of the way back, both read on this page. *Fix:* the sentence also says "or this page was opened before it: reload it", in both languages, which moves the services walk's half-done screen. *Trigger:* the next change to the Services page, or a no at the build version plan's look.

## 441. Four comments sit on the wrong declaration after the boxes' inserts — the machine; `[DEFERRED]` (the review of the pooled shape's first landing, 2026-11-14, Low)

Each inserted declaration went between an existing comment and the thing it describes, so an editor shows the comment on the wrong name: `resolveTenant`'s "Runs first on every client route…" now heads `boxStorage` in `bff/src/app.ts`; `clientCodeSchema`'s "A client's code: 3 to 32…" now heads `HOME_BOX` in `shared/src/records.ts`; `storageShape`'s "What the BFF needs to reach c-storage…" now heads `boxesSchema` in `bff/src/env.ts`; and in `scripts/src/demo/ledger.ts` a type now sits between two imports. *Fix, if taken:* move each declaration below the comment's own subject. *Trigger:* the next edit of any of the four files.

## 442. The operator's boxes route drops a box the back end does not hold, together with its companies — the machine; `[DEFERRED]` (the review of the pooled shape's first landing, 2026-11-14, Low)

`bff/src/app.ts`'s boxes route counts every line by box and then lists only the held boxes. With a line naming a box this back end was not handed, the counts sum to fewer companies than the client list holds and the box does not appear, while every call of that company answers 503. *Fix, if taken:* list such a name with `freeBytes: null`, which the form already shows as not answering; or leave it, since decision 5 of the pooled shape's plan treats it as a fault of the setting, which every call logs. *Trigger:* a second box held in a deployed environment.

## 443. Case 3's test of the pooled shape watches the home box's reads alone — the machine; `[DEFERRED]` (the review of the pooled shape's first landing, 2026-11-14, Low)

The wrap in `bff/src/boxes.route.test.ts` covers `getRecord` and `listRecords` of the home box, not `putRecord` or `removeRecord`, so "the home box for its line alone" is proved for reads only; for writes it holds by the routes' structure (every client route reaches its box through `forClient`). *Fix, if taken:* wrap the two writes too. *Trigger:* the next edit of that test.

## 445. The pooled shape's row 18 ("no existing test changed to pass") is checked by a command that cannot see most test files — the machine; `[DEFERRED]` (the review of the pooled shape's first landing, 2026-11-14, Low)

The row's check, `git diff --stat pre-merge -- '*.test.ts'`, misses `*.test.tsx`, `*.spec.ts` and the walks' base pictures, so a loosened ui test or a rewritten base passes it unseen; the first landing's screens 2, 4, 8, 9 and passkeys' 6 gained a mask, with their bases rewritten, outside it (disclosed in step 4's tick). *Fix, if taken:* the check's pathspec lists `*.test.ts`, `*.test.tsx`, `*.spec.ts` and the walks' `bases` folder, and the plan row says which of them it expects to move. *Trigger:* the next plan with a row of this kind.

## 446. What CloudFormation's own transform does with an empty collection is read from no page of AWS's — the machine; `[DEFERRED]` (the pooled shape's step 6, 2026-11-14, Low)

Two AWS pages disagree: the Parameters page says a `CommaDelimitedList` "should be one more than the total number of commas", so a blank is one empty name, while the SAM CLI page says a collection that resolves to an empty list is "silently skipped". Neither says what CloudFormation's own `AWS::LanguageExtensions` does. The template no longer depends on it: the default and the runbook's removal are the word `none` (never a blank), the loop's ids have a stem of their own (`More`), so no name, an empty one included, makes one equal to the home box's, and `HasMoreBoxes` keeps the loop out for the word `none`; `ops/test.sh` expands the loop for the word, for an empty name and for one name. What stays unread is only that `ops/stack.sh env ridge --plan` with the word `none` on a stack with no box added shows no loop resource; the sitting's first `--plan` can name it.

## 447. A box added has no alarm, and the destroy's list of what a stack delete keeps names the home box's ids alone — the machine; `[DEFERRED]` (the pooled shape's step 6, 2026-11-14, Low)

`ops/env.yml`'s `AlarmBox` watches `Box` alone, so a box added that fails its status check says nothing to Slack; and `DESTROY_BY_HAND` in `ops/lib.sh` (read by `ops/destroy.sh` and compared with the template by `ops/test.sh`) lists the home box's ids, while a stack delete also keeps each box added's instance and records disk (`MoreBoxb2`, `MoreRecordsVolumeb2`), which the destroy's own check of retained resources would not name. Ridge runs one box and returns to one after each rehearsal (the plan's acts), so neither bites yet; a client's stack with a box added needs both first.

## 448. A key run drops `STORAGE_BOXES` from the function's settings — the machine; `[DEFERRED]` (the pooled shape's step 6, 2026-11-14, Low)

`ops/keys.sh` sets the function's environment through `bff_settings_set` from the keys it holds, and a settings call replaces the whole environment; `STORAGE_BOXES` is written only by `ops/app.sh` (`other_boxes_read`), so after a key run on a stack that holds a box added, a company on that box answers 503 until `ops/app.sh` runs again. The runbook's "Adding a box" says so. A key run that reads the function's own `STORAGE_BOXES` first, or refuses on a stack with boxes added, closes it.

## 449. Each box added's release downloads Litestream again in the human's terminal — the machine; `[DEFERRED]` (the review of the pooled shape's second landing, 2026-11-14, Low)

`ops/release.sh`'s run for each box added is handed the c-storage and activity log binaries, the tree and the commit, but not `LITESTREAM_ARCHIVE`, so `litestream_binary` fetches the pinned archive once more for each box (`ops/lib.sh`), though the home box's run checked one into its own work folder. In the deploy job the variable is the job's own and the sub-run inherits it. Passing `LITESTREAM_ARCHIVE=${LITESTREAM_ARCHIVE:-$WORK/litestream.tar.gz}` to the sub-run closes it; ridge runs one box, so it does not bite yet.

## 458. A local refresh of the shard table measures something other than CI's shards, and a partial refresh mixes units — the machine; `[DEFERRED]` when the table is next refreshed (the table of times review, 2026-11-14, Low B)

`pnpm --filter @credo/scripts times` runs on this Mac without `--coverage` and outside the gate lock, a `-t` filter writes skipped tests' near-zero times as real, a run of some files overwrites only those over GitHub's times, and the first whole refresh rewrites about 41 lines, so two branches that both refresh conflict. Review section "The table of times at 5af37fc3", Low B; the effect on CI's balance needs a GitHub run to know. A partial refresh also drops the entries of other edited files, which then fall back to bytes until a whole refresh (`scripts/src/shard-times.ts#L76-L77`; review section "Reread at 0556d766", Low I).

## 459. The shard balance case's name claims more than it holds — the machine; at the next change to `scripts/src/shard-sequencer.test.ts` (the table of times review, 2026-11-14, Low F)

"Keeps the slowest shard near a third of the table time, so the table is worth keeping" measures the greedy's balance over the weights it is handed, so it stays green with the table emptied or stale; only the presence case goes red. Review section "The table of times at 5af37fc3", Low F.

## 460. Nothing checks that the config wires `TableShardSequencer` or the reporter switch, and the vite file-extension warning is three lines — the machine; at the next change to `scripts/vitest.config.ts` (the table of times review, 2026-11-14, Low G)

A config that dropped the sequencer would give vitest's hash split with every case green, and the "import without a file extension" notice of `configLoader: 'native'` names three imports now. Review section "The table of times at 5af37fc3", Low G, carried from the review of 600f0eff.

## 461. The package's own sequencer cases print each miss six more times into the test output — the machine; `[DEFERRED]` at the next change to `scripts/src/shard-sequencer.test.ts` (the table of times review, 2026-11-14, Low H)

The cases at `scripts/src/shard-sequencer.test.ts#L12`, `#L49` and `#L58` run the real sequencer, whose `say` writes each miss to the process output, so a gate shows the lines six more times beside the shard step's. Review section "Reread at 0556d766", Low H.

## 462. No check pins `Box`'s `Env` tag, which the deploy role's key push now rests on — the machine; `[DEFERRED]` (the review of the pooled shape's second landing, 2026-11-14, Low)

The key push is held to this environment's boxes by `ec2:ResourceTag/Env` (`ops/env.yml`, `PushKeyToOwnBox`); case 14 reads the role alone and case 12 compares the loop's instance with `Box`, so with `Env` taken off both, both are green. A lost tag fails closed (the push is denied at `box_open`, before anything is sent). Case 14's guard asserting that `Box` carries `{"Key":"Env","Value":{"Ref":"Env"}}` closes it, and case 12 then carries it to every box added.

## 463. The box-list condition joins the names with nothing between them, so a list spelling `none` reads as no box — the machine; `[DEFERRED]` (the review of the pooled shape's second landing, 2026-11-14, Low)

`HasMoreBoxes` in `ops/env.yml` is `!Join ['', !Ref MoreBoxes]` against `none`, so `--more-boxes no,ne` or `n,one` (both accepted by `boxes_list_refusal`) joins to `none` and an add silently makes nothing; and a blank set outside `stack.sh` (the console, the CLI by hand) is one empty name on AWS's Parameters page, so the condition is true and CloudFormation would make a box named nothing (`MoreBox`), which `stack_boxes` cannot see, so no script releases or reads it. Neither case reaches the home box. Joining with `','` (a name holds no comma), making the condition false for `''` as well, and keying case 12's `expand` on `$names == ["none"]` closes it.

## 464. The box name `es` makes the loop's instance id `MoreBoxes`, the parameter's own name — the machine; `[DEFERRED]` (the review of the pooled shape's second landing, 2026-11-14, Low)

`boxes_list_refusal` accepts `es`, and `MoreBox${Name}` (`ops/env.yml`) is then `MoreBoxes`; cfn-lint 1.59.0 answers `E3007 Resources and Parameters must not share name`, and AWS's Parameters page says a logical name must be unique within the template, so the change set is refused before anything runs. Refusing a name for which `MoreBox<name>` is an existing logical name, or `es` by name, closes it.

## 465. Not run: AWS's conditions page does not list `Fn::Join` inside `Fn::Equals` — the machine; `[DEFERRED]` (the review of the pooled shape's second landing, 2026-11-14, Low)

The page for conditions lists `Fn::FindInMap`, `Ref` and other condition functions as usable inside `Fn::Equals` and `Fn::Or`, and `Fn::Join` only for `Fn::If`; `HasMoreBoxes` (`ops/env.yml`) puts it inside `Fn::Equals`. cfn-lint 1.59.0 accepts the template and the idiom is common, but if CloudFormation refuses it, every change set made from this template fails at its creation, before anything runs. The sitting's first `--plan` on ridge is the run that settles it; the condition would then need another shape (item 463's fix may change it anyway).

## 469. The data set's pictures are PNGs and the back end takes a JPEG alone, so the seed, the generator and the walk ask for `image/jpeg` for a PNG's bytes — the machine; `[DEFERRED]` (the delivery photos' plan, step 4, 2026-11-14, Low)

`DEMO_PROOFS` in `shared/src/demo-proofs.ts` are drawn PNG data URLs; the ask (`bff/src/routes/delivery-photo.ts`) refuses any type but `image/jpeg`. `sendPicture` in `scripts/src/running/photo-store.ts` says JPEG for the same length and the stand-in keeps the bytes under that type; a browser sniffs a PNG shown as JPEG, but a real bucket holds a mislabelled object. Real JPEG pictures in the data set end it; wanted before the ridge seed sends pictures to the real bucket.

## 470. The ridge seed asks photo addresses and keeps no picture, so its delivered requests name objects the bucket does not hold — the machine; `[DEFERRED]` to step 8 of the delivery photos' plan (2026-11-14, Low)

`applyAll` and `applyCopy` called from `scripts/src/ridge.ts` use `FORGETTING_SINK` (`scripts/src/running/photo-store.ts`): the record names an object and the picture goes nowhere, since the ridge seed has no key of the real bucket. `pnpm demo` and `pnpm stack` pass the stand-in's sink and keep every picture. A photo read on ridge's seeded deliveries answers an address that leads to a 404 until step 8 gives the seed the bucket's key or the seed's delivered requests are left without photos there.

## 471. A request that its users delivered between the seed's read and its ask of the photo address stops the run red instead of being skipped — the machine; `[DEFERRED]` (the delivery photos' plan, step 4, 2026-11-14, Low)

In `dayDeliveries` (`scripts/src/demo/apply.ts`) the ask is `driver.must`, so a 409 or a 404 from it throws, where the deliver after it was a skip (`unlessChanged`, "only a 409 or a 404 is a skip"). The read just before shows the request waiting, so only users acting within milliseconds reach it; no test provokes it, since the ask writes no delivery record to hook. Wanted: the ask through `unlessChanged`, with a case that moves the request between the read and the ask.

## 472. The company's own address on a ridge run is built in no tested line, and the setting that replaces it is honoured outside the tests — the machine; `[DEFERRED]` (the review of the company address, 2026-11-14, Low)

`ops/check.sh`'s `"${CHECK_OWN_BASE:-https://$tenant.$own_domain}"` is only ever run with `CHECK_OWN_BASE` set, so a wrong default that still answers (the app's address) would pass every test and read the operator's address twice on ridge, green; and nothing limits `CHECK_OWN_BASE` to the tests, as `OPS_TESTS_RUNNING` limits the other switches. Fix: one `own_address <code> <domain>` in `ops/lib.sh` with a test of its output, and `CHECK_OWN_BASE` read only under `OPS_TESTS_RUNNING`, refused by name otherwise.

## 473. The template guard does not read which condition each address branch names, nor the rule's logic or the domain's pattern — the machine; `[DEFERRED]` (the review of the company address, 2026-11-14, Low)

`resolved()` in `ops/test.sh` takes every `Fn::If` one way and the rule's check asks only for one rule mentioning both names; six mutations of a copied guard (aliases or certificate under `HasSlack`, the app's address under `HasMoreBoxes`, the rule asserting `Domain` alone or always true, `AllowedPattern` set to `.*`) all passed it. Fix: `resolved` takes only `Fn::If`s on `HasDomain` and asserts the three conditionals name it; the rule and the pattern pinned by value.

## 474. The operator's name has three homes, the script's refusal message says a client exists when none does, and the fake makes the kept-back codes — the machine; `[DEFERRED]` (the review of the company address, 2026-11-14, Low)

`https://operator.${Domain}` in `ops/env.yml`, `'operator'` in `KEPT_CODES` and `OPERATOR_PART` in `shared/src/wire.ts` agree today and no check ties them (one exported `OPERATOR_NAME`, and the domain guard comparing it with `AppAddress`); `ridge_cli tenant` answers "names a client already" for a kept-back code, where `tenant-id` then finds none (the message says it is taken or kept back); `ui/src/fake.ts`'s create refuses only a code it holds, so a fake walk typing `operator` or `www` shows the made screen where ridge says taken (`KEPT_CODES.includes(code)` joins the refusal).

## 475. The company address's reader-facing text: an orphaned comment, a case-5 label and a stale comment — the machine; `[DEFERRED]` (the review of the company address, 2026-11-14, Low)

`normaliseClientCode`'s doc comment in `shared/src/records.ts` still sits above `KEPT_CODES`'s own and wants moving back; the case-5 check in `ops/test.sh` labelled "a stack that names no domain masks neither" reads only the domain, since `DistributionName` stays masked; the comment above `bff_settings_set` in `ops/lib.sh` still says the passkeys' address is "CloudFront's name, kept for good", where under a domain it is `operator.<Domain>`.

## 476. The plan's order of acts assumes step 1 lands alone; landing whole, an app deploy must follow the stack run before the operator's passkey — the machine; `[DEFERRED]` (the review of the company address, 2026-11-14, Low)

The function's `APP_ORIGIN` is written only by `bff_settings_set`, which only `ops/app.sh` and `ops/keys.sh` call, so a push before the stack run leaves it at CloudFront's name and the passkey at the operator's address is refused until a later deploy. Fix at step 6 and in step 7's one-off: push, certificate, stack run, wildcard record, then `ops/app.sh ridge` or any deploy, before the passkey; and one line that the check is red on the own-address pass until the wildcard record exists.

## 480. The photo probe's second and fifth lines expect what R2 has not been read to do, and it leaves one object a run — the machine; `[OPEN]` (the delivery photos' step 6, 2026-11-15, Low)

`one-off/photo-store-probe.sh` (outside git) expects R2 to refuse a PUT longer than the length it signed with a 403, and the preflight from a company's own address (`<code>.<Domain>`) to be allowed; neither is read from R2's documentation, both are the probe's to find out at step 7, and a red line there is a finding, not a script fault (whether R2's rule takes a wildcard origin is the fifth line). The probe puts one object, `probe/<stamp>.jpg`, in the bucket each run and nothing deletes it (the product has no delete); the human may empty the `probe/` folder from the dashboard.

## 481. Case 2's send half is untested: the cross-company test reads only (the review of the delivery photos, 2026-11-15, Low) — the machine; `[DEFERRED]`

`bff/src/routes/cross-tenant.route.test.ts#L219-L231` shows company beta reading company alpha's photo as a 404, but no test has beta's driver ask for an address on alpha's request. It needs the second company's driver in `twoCompanies`.

## 482. In both photo one-offs a `die` inside an `ops/lib.sh` helper ends the run with "== done" and no verdict line (the review of the delivery photos, 2026-11-15, Low) — the machine; `[DEFERRED]`

`die` prints to the terminal's error stream and exits 1, so the one-offs' own log (outside git, `one-off/`) ends on "== done" with no `== verdict` line; the human reads the terminal, the log does not say red. Fix by a `die` wrapper in each one-off that writes the verdict line first.

## 484. The `ops` limit's pin sits inside the scripts' guard, so a red names the wrong gate — the machine; `[DEFERRED]` (the reread of the jobs' limits, 2026-11-15, Low)

In `ops/test.sh`, `scripts_guards` holds the `ops` job's 20-minute pin, so a red reads "the scripts' gate lacks: [ops: a 20-minute cap]", and the passes row after the function names only the scripts' gate. *Fix:* give the pin its own guard named for `ops`, or retitle the row to cover both.

## 486. The route's JPEG-only rule has two homes, and the photo record is read and written in the route module (the review of the delivery photos, 2026-11-15, Low) — the machine; `[DEFERRED]`

`bff/src/routes/delivery-photo.ts#L44-L46` refuses any type but `image/jpeg` while `shared/src/photo.ts#L31` lists three types (`PROOF_TYPES`); and the photo record's read and write sit in the route module. Move the rule to one home and the record's access beside the other records' helpers.

## 487. The here-string guard is a list of names, and the root's session handle still goes through a here-string (the reread of the delivery photos, 2026-11-15, Low) — the machine; `[DEFERRED]`

The guard in `ops/test.sh` refuses `<<<` on a line naming `kv`, `SECRET`, `STORAGE_BOXES_JSON` or `pass`, so a here-string of a variable under any other name (a `$keys`, say) passes it. At the root's sign-in in `ops/lib.sh` (`auth=$(jq -r '.authId // empty' <<<"$EDGE_BODY" ...)`, masked as a secret on the next line) the session handle goes through a here-string, which bash 3.2 writes to a temp file. Fix by reading the body from a pipe there, and by a guard that refuses every here-string in `ops/lib.sh` once the rest are converted.

## 488. The comment in `photo_store_read` says a sudo refusal reads as a failed read, but `sudo` exits 1, as "absent" does (the reread of the delivery photos, 2026-11-15, Low) — the machine; `[DEFERRED]`

`ops/lib.sh#L1225-L1226` says the exit codes other than 0 and 1 (ssh's 255, sudo's refusal) are a failed read. `sudo test -e` that sudo refuses exits 1, the same as an absent file, so only ssh's failure (255) stops the deploy; the comment is wrong, the code is as intended.

## 492. The new case-12 line has no standing refusal row, so its red is seen only once (the review of the list right fix, 2026-11-16, Low) — the machine; `[DEFERRED]`

`loop_refusals` in `ops/test.sh#L1034-L1064` plants a fault in the template for each line of `boxes_loop_guard`, but none for the line at `ops/test.sh#L1001` ("leaves a ${Name}"). One row that plants a plain `${Name}/*` as the role's list condition and expects "leaves a ${Name}" keeps that red seen on every run; today it was seen red by hand on the old template only.

## 493. The expansion renames `${Name}` in keys at every depth, but AWS was measured only on top-level ids (the review of the list right fix, 2026-11-16, Low) — the machine; `[DEFERRED]`

The comment at `ops/test.sh#L963-L966` and `named` at `ops/test.sh#L967` replace `${Name}` in a key at any depth, while the measure covers only the loop's resource and output ids. All 8 such keys sit at depth 1 in `ops/env.yml`, and a nested one already goes red on the instance's equality row, so nothing is wrong today; narrow `named` to the ids, or measure a nested key, if one is ever added.

## 495. A whole `ops/check.sh` run with a box in the stack, on the test stand-ins, leaves the stand-in's master holding its port, so the cases after it die on a taken port (the check's list of a box added, 2026-11-16, Low) — the machine; `[DEFERRED]`

The product is not the leak: the real check opens one master per run on its own control socket and closes it on every exit (`ops/lib.sh#L609`, `ops/lib.sh#L101`, `ops/lib.sh#L622-L624`). The leak is the test stand-in's one `$S/master.pid` per state folder (`ops/test.sh#L2836-L2864`), which the nested run inherits: in `ops/test.sh`, `FAKE_BOX2=1 chk_run … check.sh ridge` (the home run, which then runs `bash "$0" --box b2` from `ops/check.sh#L337`) opened a second stand-in master on the one state folder, so the check's local port answered for the rest of the run: the next whole check ended "something already answers on 127.0.0.1:<port>", and so did every one after it, and the port still answered after the run ended. Run with `FAKE_BOX2_DOWN=1` (`ops/test.sh#L2785`) the nested run stops at its `send-ssh-public-key`, before it opens a forward, so it leaves none, and the sitting's cases for a box added read the whole check's verdict on the function's names that way. A whole check with the nested run reaching b2 would need a state folder of its own for the stand-in's master per run. The human clears the listeners left by the first session's runs from their own terminal.

## 496. The check's red on the function's names does not name its fix (the review of the check's list of a box added, 2026-11-16, Low) — the machine; `[DEFERRED]`

The red at `ops/check.sh#L237`, when the function's variables differ from the wanted names (`STORAGE_BOXES` missing after a box was added, or left after one was removed), says only the two lists. The fix is a deploy that writes the variables, `ops/app.sh <env>`; the red should name it, as the photo store's red names its one-off.

## 497. Port 3191 is shared by the tests, 3196 with `root-password.sh`, and a "no layer four" line in box mode is false (the review of the check's list of a box added, 2026-11-16, Low) — the machine; `[DEFERRED]`

The check's local port (`ops/check.sh#L54`, 3191) is the one the test stand-ins take as well, so a test run and a real check cannot run together; the nested run's port, the check's plus 5 (`ops/check.sh#L337`), is 3196, the port `ops/root-password.sh#L33` takes. And in box mode (`--box <name>`) `LAYER4` is set to 0 (`ops/check.sh#L105`), so the "skipped: <env>'s stack holds no layer four yet" line (`ops/check.sh#L219`) is printed for a stack that holds it. Give the nested run a port of its own, and say "not read in box mode" there.

## 498. Two homes for the pieces a screen is built from, `parts/` and `components/` — the machine; *parked* until the human's answer on the design system's landings 2 and 3 (the design system's plan, 2026-11-16, Low)

The design system's first landing adds `ui/src/components/` in three levels beside `ui/src/parts/` and moves no part across, by the human's "we should not touch current code" of 2026-11-16. Until the parts that are only look have moved, a reader looking for a shared piece checks both folders, and the gallery shows the organisms while the screens still draw the parts. The plan's landing 3 makes `ui/src/parts/DetailCards.tsx`'s `DetailCard` and `ui/src/parts/PageShell.tsx`'s `PageShell` draw the organisms `SectionCard` and `PageHeader`, their call sites unchanged. *Fix:* a part moves across at a landing that changes its look, and goes once its last caller imports the component; a part that knows the app's records, words or calls stays in `parts/`. *Trigger:* the human's answer to the plan's second point, then each change to a part's look.

## 502. The print in `keys_run` fires on every expected refusal (the reread of the box lows, 2026-11-16, Low) — the machine; `[DEFERRED]`

`keys_run` (`ops/test.sh#L5036`) prints the last five lines of `keys.sh`'s output whenever its exit is not 0, and six of its ten callers expect exit 1 (`ops/test.sh#L5120`, `#L5161`, `#L5169`, `#L5176`, `#L5182`, `#L5196`), so a green run carries about 36 extra lines, among them indented `== exit 1` and `STOPPED:` lines. Print only when `RC` differs from the case's expected exit.

## 504. The direction's lint misses an atom importing an atom, a `./../` path and a dynamic `import()`, and its message reads "A atom" (the review of the design system's steps 1 and 2, 2026-11-16, Low) — the machine; `[DEFERRED]`

`eslint.config.js#L61` holds one regex a level: an atom importing another atom passes, as does a path written `./../molecules/X` and an `import('../molecules/X')`, which `no-restricted-imports` with `patterns` does not read as a static import. The message built from `level.slice(0, -1)` reads "A atom". Cover the three forms or say they are out of the rule, and write the article from the level's name.

## 505. The gallery's test checks a heading named after each file, not the component drawn (the same review, Low) — the machine; `[DEFERRED]`

The gallery's test (`ui/src/design-system/Gallery.test.tsx`, its cases 4 and 8) looks for a link named like each component file and reads each file's doc comment and props, and `ui/src/design-system/entries.tsx`'s `ENTRIES` keys are typed by hand, so an entry's states may draw another component under the right name. A test mounting each entry's component by its export, or a key typed from the folder's exports, would close it.

## 506. `ui/CLAUDE.md` states the rule of three twice, never names the six samples as its exception, and leaves C17's sentence unfinished (the same review, Low) — the machine; `[DEFERRED]`

The rule of three is written at the `components/` note and again in the levels' lines; neither says the six day-one samples are the exception, and the `design-system/` note does not finish C17's "everything in here is a ___". One statement, the exception named, the sentence finished.

*Update 2026-11-21, the design skeleton's rework of landing 1:* `ui/CLAUDE.md` no longer states the rule of three; the design guideline's rule of three (`ui/src/design-system/guideline.ts`) states it once, with the folders (`ui/src/components/` at the third use, `ui/src/parts/` or the screen for the first two), the first six parts as the exception and "never to wrap a Mantine part alone". *Still open:* the `design-system/` note's sentence of C17.

## 507. The theme drops the dialog header's padding, and the gallery draws no dialog or table (the same review, Low) — the machine; `[FIXED]` 2026-11-22 by the gallery parts piece's step 10: the entry Dialog draws the dialog a press opens, after step 4's table

The dialog's entry (`Modal.extend`) in `ui/src/design-system/appTheme.ts` carries the dialog's centring and title but not the header's padding of the legacy's `theme/index.ts#L89-L91`, and the gallery shows neither a dialog nor a table row under the pointer, so the two entries of case 1 are held by the test alone and cannot be judged by eye. Add the padding with the first screen that opens a dialog, and a dialog and a table to the gallery.

**Half done (design system, the fix pass of landing 3, 2026-11-17).** The dialog header's padding half is done at step 12: the legacy's `var(--mantine-spacing-sm) var(--mantine-spacing-md)` is `TOKENS.dialogHeader` in `ui/src/design-system/tokens.ts`, read by the dialog's entry in `ui/src/design-system/appTheme.ts` and held in `ui/src/design-system/appTheme.test.tsx`. The gallery half is still open: the gallery draws no dialog and no table row.

**Table half done (gallery parts, step 4, 2026-11-22).** The gallery draws a table and its rows under the pointer: the entry `DataTable` (`ui/src/components/molecules/DataTable.tsx`), whose rows light at the theme's colour and whose test (`DataTable.test.tsx`) holds it. *Still open:* the dialog, which step 10 draws; the item closes there.

**Closed (gallery parts, step 10, 2026-11-22).** The gallery draws the dialog: the entry `Dialog` (`ui/src/design-system/Dialog.tsx`), a button that opens the ended session's dialog in its own words, held by case 12 in `ui/src/design-system/Gallery.test.tsx`. Both halves are done; closed by `b4433841`.

## 509. A company too large to be compared in one press cannot switch from the page — the machine; `[DEFERRED]` (the move's plan, 2026-11-16, Low)

`compareCompany` (`bff/src/records/company-copy.ts`) walks the whole company on both boxes in one press, inside the function's 10 seconds (`bff/src/records/company-move.ts`'s `pressMove`). No copy rate was measured, so the size at which a compare passes the limit is unknown; past it every press ends in a failure after its copy is done and the move can only be stopped. Fix: a compare in presses, kept from a key on the line as the copy's is. *Trigger:* a move press near 10 seconds in the ridge sitting, or a company whose records pass the figure that sitting reads.

## 514. The detail field's empty value follows the memo, not the legacy's own field (the same reread, Low) — the machine; `[DEFERRED]`

`ui/src/components/molecules/DetailField.tsx#L9` draws an em dash for a missing value, as the legacy's design memo says; the legacy's own `DetailField` draws a hyphen, and the memo's empty value is dimmed and italic, which the sample is not. Settle the dash and the dimming with the first screen that shows an empty value.

## 515. The picture run cannot take one picture per part of the gallery by its address — the machine; *parked* until the first change to a part that no walk's screen shows (the design system's plan, landing 4, 2026-11-16, Low)

A walk opens an address on the front (`walk/playwright.config.ts#L25`) and `shot` writes each picture by screen name (`walk/support.ts#L46`, `#L63`); `visual` takes no picture (`visual/src/capture.ts#L1-L4`). A `walk/specs/gallery.spec.ts` would open each part's address and call `walk/support.ts`'s `shot`. Three things stand in its way (the first, the fronts answering `/gallery.html` with the app, is struck: the gallery left `gallery.html` for `/48b74d079/gallery`, a route of the app, 2026-11-17, the gallery workbench's plan): every walk has a stack lane and is green only when the fake equals the stack (`walk/run.sh#L45-L58`); every `at` in a spec must be a screen of the walks page (`visual/src/walks.test.ts#L163-L171`), which draws the app's screens, not the gallery; and every spec shoots three widths in two languages (`#L204-L211`), where a part needs one picture.

The gallery-parts piece's step 11 (2026-11-22): the trigger, a change to a part no walk shows, fired here (five parts added, one moved), but that piece's look is the gallery itself, kept against no picture, so the item stays parked.

## 517. The delivery photos' card is not on the walks page, where partners already answer (the check without code, 2026-11-16) — the machine; `[DEFERRED]`

The card for checking a piece on ridge lives on the products page, which a person opens in the editor. Partners already open the walks page by its link and their answers arrive in the block the machine reads, so it is the right home once a partner checks a piece. The price is a code step in `visual/` with its tests, and a push to redeploy. Bring it in with the first piece a partner is to check on ridge.

## 518. The photos' receipt is a one-off outside git, not an `ops/` script with its cases in `ops/test.sh` (the check without code, 2026-11-16) — the machine; `[DEFERRED]`

The receipt that prints a card's calls from the access log was copied from the earlier access log read and kept outside git, with its four stand-in runs read by hand. Make it an `ops/` script with its cases in `ops/test.sh` when a second piece's card wants a receipt, when the copy would be the third.

## 521. The copy rows that expect a sound copy capture neither stderr nor the exit code (the cross-model review of piece 144, 2026-11-16, Low) — the machine; `[DEFERRED]`

`ops/test.sh#L1401-L1403` compare the output of `copy_eval` alone for a sound copy, so a `copy_problems` whose `jq` dies still prints nothing and passes. With the pipe at `ops/lib.sh#L718` deleted, those rows stayed ok while the fault rows went red. Capture the exit code and stderr in those rows with the next change to the copy's rows.

## 522. `copy_problems` reads the first JSON document on stdin and ignores any after it (the same review, Low) — the machine; `[DEFERRED]`

`input` at `ops/lib.sh#L721` takes the first document, where `--argjson` refused two. The AWS CLI's JSON output is one document, so the real path cannot meet a second. Make it refuse more than one document if the listing ever comes from another source.

## 524. A doc comment sits above the wrong function in `bff/src/app.ts` — the machine; `[DEFERRED]` until the next piece that touches `app.ts`

The comment "Runs first on every client route, before the body is read and before any session" sits above `boxStorage`'s own doc comment, and `boxStorage` is not what it describes: it belongs to `resolveTenant`. Move it down onto `resolveTenant`, and leave `boxStorage` with its own line.

## 532. `copy-company` checks only the target line's id, so a target line naming another box or moving gets records it never reads — the machine; `[DEFERRED]` (the move's review, 2026-11-16, Low)

`runRidge`'s `copy-company` (`scripts/src/ridge.ts`) checks the target's line by its id alone, while `carryCompany` writes to the target's home box. A target line that names another box, or carries a move, is handed records its calls never read, and the run still reports "0 differ". Fix: refuse such a target line by name, writing nothing, as the source's line is refused. *Trigger:* the next use of `copy-company` over a target that holds a line.

## 533. The activity line prints only "client moved" for the mark, the switch and the stop — the machine; `[DEFERRED]` (the move's review, 2026-11-16, Low)

`entryLine` (`shared/src/activity.ts`) names the action and not the step: the entries `bff/src/routes/client-move.ts` enters for `mark`, `switch` and `stop` read the same, though each carries its step and both boxes in its detail. Fix: print the step and the boxes. *Trigger:* the first reading of a move's entries in the activity log's page.

## 534. The move's route repeats `storeOfLine`'s refusal of a box not held — the machine; `[DEFERRED]` (the move's review, 2026-11-16, Low)

`registerMoveClientRoutes` (`bff/src/routes/client-move.ts`) has its own `boxOf`, which logs "a company names a box this back end does not hold" and answers 503, as `storeOfLine` in `bff/src/app.ts` does. Fix: one held-box helper both call. *Trigger:* the next change to either's wording or status.


## 535. The move page names the wrong box when it never saw the ending answer — the machine; `[DEFERRED]` (the move's reread, 2026-11-16, Low)

`ui/src/pages/operator/MoveClientPage.tsx`'s `boxes` assumes a switch when the page never saw the ending answer: opened mid-copy, its first answer `sweeping`, because another tab stopped the move or this page's stop answer was lost. The sweep line and a failed-press line then name the box the company lives on as the one being cleared; the server sweeps the right box. Fix: name no box when the ending is unknown, or reload the list once on such an answer. *Trigger:* the next change to the page's lines.

## 536. Two small wording points on the move page — the machine; `[DEFERRED]` (the move's reread, 2026-11-16, Info)

In `ui/src/pages/operator/MoveClientPage.tsx` the box choice stays live while the passkey prompt and the first press run, so a click then changes the box later lines name. And `moveRefused` (`ui/src/i18n/en.ts`, `vi.ts`) says the move did not start when only its answer may have been lost; "may not have started" claims only what the page knows. Fix: lock the choice from the touch on, and reword the line. *Trigger:* the next change to the page's lines.

## 539. The two literal checks miss some colours, flag some strings that are not one, and keep the pattern in two places — the machine; `[DEFERRED]` (the design system's review, 2026-11-16, Low)

`ui/src/design-system/literals.test.ts` and the `no-restricted-syntax` block in `eslint.config.js` read a hex value or a lower-case `rgb(`, `rgba(`, `hsl(` or `hsla(`, so they miss `white`, an upper-case `RGB(`, `oklch(` and a hex built as `#${...}`; they flag a string such as `'Order #1234'` under the colour message; and the pattern is written in both. Fix: the `i` flag, the other colour functions and `white|black`, one home for the pattern, and what is left out named in case 7's row of the plan.

## 541. Two dead branches after the light-only step — the machine; `[DEFERRED]` (the design system's review, 2026-11-16, Low)

`GROUND` in `ui/src/pages/SignIn.tsx` keeps a `light-dark()` that can only resolve light, and the "narrows to one theme" row of `ui/src/mock/MockPage.test.tsx` clicks the only theme there is. Fix: the plain light value, and the row's click taken out with its count.

## 542. The new app's sign-in has no "remember me" — the human; *parked* until a partner asks for it (the sign-in's parts, 2026-11-16, Low)

The old app's sign-in offers "remember me", on by default (the old repo's `workspace/uis/c-mngt/src/pages/auth/SignInPage.tsx#L81`, drawn by `base/src/components/auth/pages/LoginUI.tsx#L106-L112`); the only lines of `ui/src`, `bff/src` and `shared/src` that say "remember" are about the fake's switch (`ui/src/fake.ts`). The gallery draws the box in the legacy's sign-in card as a look only ([the plan](plans/2026-11-16-sign-in-parts.md)); a door draws it only with a session that keeps the choice. *Trigger:* a partner who misses it, or the doors taking the sign-in's parts.

## 543. No page signs in by scanning a code inside the app or typing it — the human; *parked* until a partner asks for it (the sign-in's parts, 2026-11-16, Low)

The old app's `/login-via-qr-code` (the old repo's `workspace/uis/c-mngt/src/pages/auth/AccessViaQRCodePage.tsx`) scans a code with the camera or from a picture, or takes it typed, and its sign-in links to it. The new app's QR code is opened by the phone's own camera (`shared/src/signins.ts`'s `qrLink`, `ui/src/pages/client/QrLanding.tsx`'s `QrLanding`), and no page or button offers the other two ways. The sign-in's parts draw that page in the gallery as a look only; the divider and the back link have no door until this is built. *Trigger:* a partner whose people cannot open a link from the camera.

## 549. An English word changed by a partner reddens the `ui` tests that query it by its text — the machine; `[FIXED]` 2026-11-17 by the ui tests' words plan: every ui test but those item 589 names finds a word by its key in `DICTIONARIES`, and `ui/CLAUDE.md` says so (the words file's plan, 2026-11-16, Low)

29 test files under `ui/` hold 384 queries by a capitalised literal (`getByText`, `getByRole` with a `name`, `getByLabelText`, `getByPlaceholderText`), counted by `git grep` on 2026-11-16, while the walk's specs read the dictionaries. A word changed in `ui/src/i18n/en.ts` by `pnpm words in` (`docs/plans/2026-11-16-words-csv.md`) therefore turns each test that queries the old text red, and that change carries their edits. Fix, if the edits cost more than the change: those tests query by the dictionary's word. *Trigger:* the first returned file that changes an English word.

## 553. The parts' back link reloads the page under the router, and the band says the company twice to a screen reader — the machine; `[DEFERRED]` (the sign-in parts' review, 2026-11-16, Info)

For the piece that moves the doors onto these parts. `ui/src/components/atoms/BackLink.tsx`'s plain `href` reloads the page where the app routes with react-router, so a door needs it to take the router's own link or a click handler. `ui/src/components/molecules/BrandBand.tsx` gives the logo the company's name as its alt text, beside the same name as text, so a screen reader says it twice; the tile in the band wants an empty alt.

## 555. The app's entry is past the 1,000 kB its build warns at — the machine; *parked* until the next page that adds to the entry (the gallery workbench's plan, 2026-11-17, Low)

A build of `pre-merge` at `a0514569`, made into a scratch folder for that plan, wrote an entry of 1,010.91 kB (297.55 kB gzipped) and printed Vite's "larger than 1000 kB" warning, against the limit `ui/vite.config.ts`'s `chunkSizeWarningLimit` raises. The gallery workbench's piece rewrote the memo's figure in `docs/memo/ui.md`'s bundle section (about 1,010 kB), and that section's trigger, "the entry reaching 1,000 kB, when the build starts warning again", has fired unnoticed: nothing fails on the warning. The gallery workbench adds only its address test to the entry, its page going into a chunk of its own. *Fix:* the memo's numbers rewritten, then either a heavy route split off as the gallery is, or the limit raised with its reason. *Trigger:* the next page that adds to the entry.

## 563. Taking a box out still ends in hand acts after the stack run — the machine; *parked* until the next box taken out (the move fixes' plan, 2026-11-17, Low)

`ops/stack.sh env <env> --more-boxes <list>` with its five `--take` keeps the instance and its root disk (the instance is `RetainExceptOnCreate`) and leaves the records disk's snapshot, so `ops/README.md`'s "Adding a box" step 6 sends the rest to the hand paths: stop the box first, terminate the instance by its recorded id, delete its root disk, keep or delete the snapshot. Each sitting so far (2026-11-15, 2026-11-17) wrote that rest as a one-off and copied it, which `ops/CLAUDE.md`'s OP1 says a one-off should not do. After the move fixes the copy in the bucket is the box command's own; the rest is not. *Fix:* one `ops/` command for the rest, copied from the 2026-11-17 removal one-off with the box's name as its argument, its refusals kept. *Trigger:* the next box taken out.

## 564. A box's copy cleared by the box command has run only on stand-ins — the machine; *parked* until the next box sitting (the move fixes' plan, 2026-11-17, Low)

The move fixes make `ops/stack.sh env` delete the copy under a box's name when it takes the box out, and clear a leftover under a name it adds, through `copy_clear` in `ops/lib.sh` (`aws s3 rm --recursive` under `<name>/records/`, the deletes counted against a listing, read back empty). The ops tests prove the path, the order and every red on stand-ins; S3's own answer is unread, as for the destroy's copy bucket (item 382). The 2026-11-17 removal left that morning's b2 copy under `b2/records/`, which the bucket's rule expires about seven days after its last write. *Trigger:* the next `--more-boxes` add of b2 on ridge: its `--plan` names that leftover and its count, and its run must read the path back empty before the change set executes.

## 565. The copy's versioning read counts a failed read as off — the machine; *parked* until the box command's next run (the move fixes' review, fix pass, 2026-11-17, Low)

`ops/lib.sh#L590` (at `5efc0f71`): `copy_clear` reads the bucket's versioning with `2>/dev/null || true`, so a read that fails (a denied `s3:GetBucketVersioning`, a network error) leaves the answer empty, which the next line takes as no versioning, and the delete goes on. *Trigger:* the deploy role losing that one permission, or a failed call, on a versioned bucket (the template has none). *Fix:* tell a failed read from an empty answer, and die on the first.

## 566. A die after the update says nothing of the update or how the leftover clears — the machine; *parked* until the box command's next run (the move fixes' review, fix pass, 2026-11-17, Low)

`ops/stack.sh#L392` (at `5efc0f71`): `copy_clear` after the update dies with its own generic text, so a red there does not say that the stack's update completed, that the box is out, or that only the copy remains and a second `copy_clear` by hand or the same run again clears it. *Trigger:* any red of `copy_clear` after the update (a delete count that differs, a read-back that holds a file). *Fix:* a line before the loop naming the update as complete and the leftover's clearing.

## 567. A landing by `ops/words-in.sh` while a whole check waits for the gate lock enters the tree that check runs, after the commit it was read at — the machine; `[OPEN]` (the words paste's plan, 2026-11-17, Low)

The whole check's commit is read by `git rev-parse HEAD` in `pre-merge`'s worktree as the check starts ([QA](conventions/qa.md#the-whole-check-on-pre-merge)), before `ops/gate.sh`'s `take_lock` may wait. The words paste lands only while it holds the gate lock itself (`docs/plans/2026-11-17-words-paste.md`), so a check that holds the lock never meets a landing; but one that is still waiting runs on the landed tree and records the earlier commit, and a green then moves `main` to a commit whose tree it did not check. The orchestrator's own landings cannot fall in that window; a landing from the human's terminal can. Fix: the commit read after `take_lock`, inside the gate, which places item 224's line after the lock rather than in `log_start`. *Trigger:* the first words paste that lands while a whole check waits, or item 224's fix, whichever comes first.

## 568. A new sent file for a partner whose earlier return is still out reads that return against the new file — the machine; *parked* until a second send to one partner (the words paste's plan, 2026-11-17, Low)

`ops/words-in.sh` reads a return against `words-sent/<label>.csv` in the credo root, one sent copy a partner (`docs/plans/2026-11-17-words-paste.md`). Sent a second file before the first comes back, a partner's return of the first is read against the second, and every word changed between the two sends shows as a change back to the old word; the import shows each before the y, so nothing is written unseen, but nothing tells the reader why. Fix, if a second send happens: the sent copy's name carries its date and the returned file names which copy it was made from, or the script refuses a return whose unchanged rows disagree with the sent copy. *Trigger:* a second send to one partner.

## 571. A staff or list file made from a template downloaded before a words change no longer imports — the machine; *parked* until the first real client, or a partner who meets it (the ui tests' words plan, 2026-11-17, Low)

The staff import finds each column by the dictionary's word for it in either language (`ui/src/importSheet.ts#L48`), and a file without the name column fails whole (`#L202`); the lists read their columns the same way. A template downloaded before a returned words file lands carries the old headings: after p1's file, `addPerson.name` reads "Full name" and "Họ và tên" where it read "Name" and "Tên", so a file filled from the earlier template fails as having no name column. Nothing is lost, and a fresh template imports. *Trigger:* the first real client, or a partner who reports it; the likely fix is to also accept the headings the template had before a change.

## 573. No mechanical check stops a new ui test from finding a word by its typed text — the machine; *parked* until a returned file reddens on such a test (the ui tests' words plan, 2026-11-17, Low)

After the ui tests' words piece, every ui test reads its words from `DICTIONARIES`, and `ui/CLAUDE.md`'s "The file to copy" says so; nothing else stops the next test from typing one, which then goes red only when a partner changes that word. *Trigger:* a returned file that reddens a test on a typed word; the fix is a run of the ui tests against a dictionary whose every word is altered, or a scan of the test files' literals against the dictionaries.

## 575. The env run's step count is 10 where an ordinary run takes 8 — the machine; *parked* until the next edit of `ops/stack.sh`'s steps (the move fixes' review, fix pass, 2026-11-17, Low)

`ops/stack.sh#L95` (at `5efc0f71`): `STEPS=10` counts the two steps the copy adds even on a run that never reaches them, so an ordinary env run (no box added or taken out) ends its step lines at 8 of 10. *Trigger:* any env run with no `--more-boxes` change. *Fix:* count the steps from what the run holds, or word the count as at most.

## 576. A second `--box` on the restore silently overrides the first — the machine; *parked* until the next edit of `ops/restore.sh` (the move fixes' review, fix pass, 2026-11-17, Low)

`ops/restore.sh#L46-L50` (at `5efc0f71`): `--box` sets `BOX_WANTED` each time it is read, so `--box b2 --box b3` restores onto b3 and says nothing of b2, where `ops/release.sh` and `ops/check.sh` refuse a second one (`[ "$BOX_WANTED" = home ] || usage`). *Trigger:* a hand-typed command with the flag twice. *Fix:* the same guard before the assignment.

## 577. The refusal on a run that only adds a box reads "so the copy of cannot be found" — the machine; *parked* until the next edit of `ops/stack.sh`'s refusals (the move fixes' review, fix pass, 2026-11-17, Low)

`ops/stack.sh#L212` (at `5efc0f71`): the refusal for a stack with no `CopyBucketName` builds its words from the boxes taken out, which a run that only adds a box has none of, so the line reads "so the copy of cannot be found". *Trigger:* an add of a box on a stack whose outputs lack `CopyBucketName`. *Fix:* name the added boxes when none is taken out, or word the line without the list.

## 578. A delete CloudFormation's cleanup cannot make may leave the taken-out box's role able to write after the read-back — the machine; *parked* until the next box taken out, or a fetch of AWS's own wording on cleanup after an update (the move fixes' review, fix pass, 2026-11-17, Low)

`ops/stack.sh#L386` (at `5efc0f71`): the reviewer recalls, unverified, that a delete which fails in CloudFormation's cleanup after an update still ends the stack at `UPDATE_COMPLETE`, so the old box's role (retained, not deleted) might write to `<name>/records/` again after `copy_clear`'s read-back and leave a file the bucket's rule expires in seven days. Not read in AWS's documentation or seen on a real run. *Trigger:* a taken-out box whose role CloudFormation could not delete. *Fix:* none until read; if true, name the leftover in the runbook, or clear again after the role is gone.

## 579. Without `pipefail`, `copy_newest` returns an empty time with exit 0 where `copy_count` dies — the machine; `[DEFERRED]` (the move fixes' review, second round, 2026-11-17, Low)

`ops/lib.sh#L577` (at `b49f07c0`): `copy_newest` reads the listing through a pipe to `jq`, so a failed `aws` call under a shell without `pipefail` leaves the time empty and the function ends 0, where `copy_count` ends on its number guard. No caller runs without `pipefail` today (`ops/stack.sh#L18`). *Trigger:* a script that sources `ops/lib.sh` without `set -o pipefail` and calls `copy_newest`. *Fix:* guard the time as `copy_count` guards its number, or set `pipefail` inside the function.

## 580. `pre-merge`'s clean check runs before the lock wait, so a merge left open during the wait is aborted — the machine; `[DEFERRED]` (the words paste's review, 2026-11-17, Low)

`ops/words-in.sh#L122` (at `5bdfdba3`) reads `pre-merge`'s worktree as clean, then waits up to 5 minutes for the gate lock; `#L141-L142` runs `git merge --abort` on a failed landing, which also drops a merge someone began in that worktree during the wait. Fix: read the worktree clean again after the lock is taken, and abort only the merge this run began. *Trigger:* a person or session starts a merge in `pre-merge`'s worktree while a landing waits for the lock.

## 581. A failed worktree removal makes the branch delete fail and the printed line blame `pre-merge` — the machine; `[DEFERRED]` (the words paste's review, 2026-11-17, Low)

`ops/words-in.sh#L147-L148`: when `git worktree remove` fails, `branch -d` fails too (the branch is still checked out) and the line says `pre-merge` does not hold all the branch's commits, which is untrue. Fix: delete the branch only when the removal succeeded, and say the real reason. *Trigger:* a worktree that cannot be removed (a file open in it) at a landing's end.

## 582. A Ctrl-C after the worktree is made leaves it and its branch behind, unnamed — the machine; `[DEFERRED]` (the words paste's review, 2026-11-17, Low)

`ops/words-in.sh#L55-L62`: `cleanup_extra` frees the lock but the worktree and branch made in step 2 are removed only on the script's own stops, so an interrupt (exit 130) between the making and the commit leaves `wip-words-p…` and its branch with no line naming them. Fix: `cleanup_extra` drops what a run made before the commit, or prints its names. *Trigger:* Ctrl-C during the offline install or the import's question.

## 583. Any failure of the import without the read-back text reads as "the import refused the file" — the machine; `[DEFERRED]` (the words paste's review, 2026-11-17, Low)

`ops/words-in.sh#L222-L226` tells a read-back failure from every other non-zero exit of `pnpm words in`, and prints the refusal verdict for all the rest, so a crash or a missing tool reads as the partner's file being wrong. Fix: take the refusal verdict only for the import's own refusal line, and say "the import failed" otherwise. *Trigger:* `pnpm words in` dying for a reason that is not a refusal.

## 584. The runbook's table lacks a failed offline install, a failed take-in of `pre-merge` and a failed add or commit — the machine; `[DEFERRED]` (the words paste's review, 2026-11-17, Low)

`ops/README.md`'s table in "A partner's returned words" has no row for `verdict: the offline install failed`, `taking pre-merge in failed` or `git add failed` / `the commit failed`, which the script prints. Fix: three rows, each saying to tell the orchestrator. *Trigger:* the first of those stops in a real paste.

## 585. The plan's "15 minutes at most" is 20 on the take-in path, and nothing is reinstalled after the take-in — the machine; `[DEFERRED]` (the words paste's review, 2026-11-17, Low)

`docs/plans/2026-11-17-words-paste.md` bounds the paste at 15 minutes, but the ui check's wait is 600 s and the take-in's second check 300 s, 20 minutes with the landing's own wait; and `ops/words-in.sh` takes `pre-merge` in without `pnpm install`, so a take-in that adds a workspace package runs its checks on a tree without its install. Fix: say 20 in the plan, and install offline after a take-in that changed `pnpm-lock.yaml`. *Trigger:* a landing while `pre-merge` has moved past the branch's base.

## 586. The printed `--land` line's paths are unquoted, so a credo root whose path holds a space would break it — the machine; `[DEFERRED]` (the words paste's second review round, 2026-11-17, Low)

`ops/words-in.sh#L75` prints `cd $REPO_DIR && bash $OPS_DIR/words-in.sh --land $BRANCH` with the two paths bare, so a credo root with a space in its path pastes as two words. This root has none. Fix: print each path single-quoted. *Trigger:* a credo root moved to a path with a space.

## 587. The operator page's test reads `words.app.name` for the brand's name — the machine; `[DEFERRED]` (the ui tests' words review, 2026-11-17, Low)

`ui/src/frame/OperatorPage.test.tsx#L22` reads the page's heading as `words.app.name`. The heading shows `CREDO_BRAND.name` (`ui/src/brand.ts#L14`), which is data, and `app.name` is drawn only by `ui/src/frame/Boot.tsx#L29`; the two hold the same text today, so the test is green, and the fix pass's proof run (each key's word given a suffix) went red on it. The doors' pin keeps "Credo" typed as data. Fix: keep the brand's name typed, or read `CREDO_BRAND.name`. *Trigger:* a returned file that changes `app.name`, or the next edit of that test.

## 588. `visual/src/words.test.tsx` has a stranded doc comment, two doc blocks stacked — the machine; `[DEFERRED]` (the ui tests' words review, 2026-11-17, Low)

`visual/src/words.test.tsx#L27-L28`: the key pattern's doc comment went in between `hasNote`'s doc comment and `hasNote`, so two doc blocks stack above the pattern and `hasNote` (`#L41`) has none. Nothing fails. Fix: move `hasNote`'s comment back above `hasNote`. *Trigger:* the next edit of the file.

## 589. A few ui tests still find a word by its typed text — the machine; `[DEFERRED]` (the ui tests' words review's reread, 2026-11-17, Low)

Words found by hand on the branch after the fix pass: `ui/src/listSheet.test.ts#L283` types the forms a person writes for three column headings, `['ĐỊA CHỈ', 'tên *', 'MA']`, which are `lists.columns.address`, `.name` and `.code` in Vietnamese in upper, lower and unaccented case, where case 5 says the forms are applied to the dictionary word (`ui/src/importSheet.test.ts#L256-L261` does); and `ui/src/pages/client/StaffPages.test.tsx#L186` types "Active" inside the person card's whole text, which is `words.staff.chipActive`. A returned file that changes those words reddens them. Not confirmed: the fix pass's proof run left 16 reds in 12 files, and its author's list of words left typed is in no commit or plan text; of those reds, the template and sheet-name ones read as artefacts of the suffix it appended, and the three in `ui/src/pages/client/Reconcile.test.tsx` (money cells that were not found) and `ui/src/listSheet.test.ts#L223` were not classified. Fix: read those two from the dictionary, then run the proof again, key suffix and all, to find any other. *Trigger:* the next returned words file, or a proof run.

## 590. `frameKept.test.tsx`'s id mask needs nine characters, and Mantine's random id is sometimes eight — a snapshot taken then holds a live id and fails the next run — the machine; `[DEFERRED]` (design system step 10, 2026-11-17, Low)

`ui/src/frame/frameKept.test.tsx#L13` masks `mantine-[a-z0-9]{9}`, but Mantine's fallback id is `Math.random().toString(36).slice(2, 11)`, which is eight characters about one time in thirty-six; the first `-u` rewrite of the ways snapshot took `mantine-nevtwxk2` as it was, and a second rewrite masked it. Fix: mask `{8,9}`. *Trigger:* a snapshot red on an id nobody changed.

## 591. The plan's account of which chunks share the theme is wrong — the machine; `[DEFERRED]` (the fake build's style fix review, 2026-11-17, Low)

`docs/plans/2026-11-17-ui-tests-words.md`, step 5a, says the theme is shared by "the gallery and the fake chunk". The review of the style fix (`e0654fa7`) read the built page: the entry and the gallery share the theme, and the fake chunk imports neither. The fix stands and nothing breaks; the sentence is history, not a living document. Fix: none unless the plan is reopened. *Trigger:* the plan reopened.

## 595. Case 13 pins two of its five values, and its feature came after its test (design system landing 3's review, 2026-11-17, Low) — the machine; `[DEFERRED]`

`ui/src/frame/Shell.test.tsx#L176-L177` pins the menu's 14 px and 600, but `#L197-L198` only checks that the bar's line, the bar's shadow and the header's shadow each have some value, so a shadow cast downward or ten times darker passes, and the snapshots show only the variable names; the two negatives at `#L195` and `#L196` pass with the feature or without it. The test was committed two hours before its feature (873e4165 and c3f1acbe, then ffb02689), which `docs/conventions/qa.md#L222` does not ask. Fix: assert the three values as `FRAME_VALUES` in `ui/src/design-system/tokens.ts` writes them. *Trigger:* the next change to the frame's values.

## 603. The BFF's two largest closures still share inner values, and its routes read path parameters two ways — the machine; `[DEFERRED]` (the BFF made clearer, 2026-11-18, Low)

`bff/src/app.ts`'s `buildApp` (`#L111-L598`, 488 lines) and `bff/src/routes/operator-auth.ts`'s `registerOperatorAuth` (`#L75-L480`, 406 lines) are still one closure each. Their routes share inner values: `viewOf`, `signedIn` and `endKept` in the first (`bff/src/app.ts#L236`, `#L272`, `#L320`), `storage`, `rpID`, `challenges` and `sessions` in the second (`bff/src/routes/operator-auth.ts#L76-L79`). So splitting them means handing a named context to each group, and the memo's line on the routes `app.ts` declares (`docs/memo/bff-code.md#L28`) changes with it. Also, the operator's route types its path parameter in Fastify's `Params` generic (`bff/src/routes/operator-auth.ts#L452`) while the company routes use `paramsOf` and `idOf` (`bff/src/routes/staff.ts#L98`, `#L101`), two ways for one job. *Fix:* split each closure into named groups over one named context, as `registerStaffRoutes` and `registerOrderRoutes` were split on 2026-11-18, updating the memo's line in the same change; pick one way to read path parameters for both. About 30 minutes each, with their route tests. *Trigger:* the next route added to either closure, or the next change to how a route reads its path parameters.

## 604. The site's config names a Pages address in a committed file — the machine; `[CLOSED BY DECISION, NOT FIXED]` (the address stays committed, 2026-11-18; the docs site's workflow, 2026-11-18, Medium)

`site/docusaurus.config.ts#L22` sets the site's `url` to an address on `pages.dev`, written by the site's first step. The walks page keeps its project's name out of every committed file and log (`docs/recaps/2026-10-29-walks-share.md`, the rejected row on the project's name), and the docs site's deploy reads its project's name from a secret, so the config contradicts it; whether that address is the project's real one is not known. Fix: the `url` read from an environment variable the deploy job sets from the same secret, a placeholder when unset (the site is `noIndex`, so the `url` only feeds the sitemap and the canonical links).

**Closed by decision, not by fix, 2026-11-18 (branch `docs-site`).** The orchestrator decided the address stays in `site/docusaurus.config.ts#L22` and the Fix above is not done: the site shows only the public repository's own Markdown, so its address exposes nothing the repository does not. What the decision leaves, from the branch's review the same day: the deploy's project name comes from the secret `CLOUDFLARE_PAGES_DOCS_PROJECT` (`.github/workflows/docs.yml#L112`), and nothing ties that secret to the committed address, so the two can differ and the sitemap and canonical links then name a project the deploy never wrote; no check reads one against the other. *Trigger:* the project renamed, or the site given a domain of its own.

## 605. The site's CI job does not run on a change to the site alone — the machine; `[OPEN]` (the docs site's review, 2026-11-18, Low)

`.github/workflows/ci.yml#L9-L28`'s push paths name neither `site/**` nor `docs/**`, so `app-site` (the site's `pnpm check`) runs only when the same push touches a path the list names; a push that changes only the site, or only a page it shows, runs `docs.yml`'s build and not the site's typecheck. Adding the path is not plain: `push_paths` (`ops/lib.sh#L1084`) reads those same lines as the paths ridge's deploy runs on, and `ops/seed.sh#L66` and `ops/demo-remake.sh#L181` compare ridge's commit against them, so a new path there makes a site-only push a deploy. Fix: either the site's check in `docs.yml`'s build job, or a push path `push_paths` is taught to leave out of the deploy's list, with its `ops/test.sh` pins. *Trigger:* the next change to `ci.yml`'s triggers, or a red `app-site` met after a site-only push.

## 606. The site's link rewrite reads the working tree, and two of its edge cases are unhandled — the machine; `[OPEN]` (the docs site's review, 2026-11-18, Low)

`site/links.ts#L42` turns a link into a GitHub link when its file exists on disk, not in git, so a file the repository ignores (a local log, a build output) becomes a GitHub link that opens nothing; `#L45` writes the decoded path back, so a link with an encoded space (`%20`) leaves a raw space in the GitHub address; and `#L40`'s `decodeURI` throws on a stray `%`, an unnamed `URIError` that fails the build without naming the page or the link. Fix: read existence from `git ls-files` once per build, re-encode the path with `encodeURI`, and catch the decode to name the page and the link. *Trigger:* the next change to `links.ts`, or a page linking an ignored file or a name with a space or a `%`.

*2026-11-20, the docs map's step:* `site/links.ts` changed once, `githubBase` no longer exported and a comment on `githubLinks`' pages reworded, because the map's sidebar stopped importing it; the rewrite itself is unchanged, so the three edge cases above are all still open and the trigger stays as written.

## 607. `architecture-detail.md` says CI has twelve jobs, and `ci.yml` has fifteen — the machine; `[OPEN]` (the docs site's reread, 2026-11-18, Low)

`docs/architecture-detail.md#L325` (the paragraph "What CI does") counts twelve jobs and says the `app` job waits on seven package jobs, `app-bff` to `app-walk`; `.github/workflows/ci.yml` holds fifteen keys under `jobs:` (`check`, `audit`, `e2e`, the seven package jobs, the two scripts jobs `scripts-shard` and `scripts-stages`, `app`, `ops` and `deploy`), and the `app` job's last line (`#L649`) still echoes "all six package gates are green". Fix: say fifteen and name the two scripts jobs in the paragraph, and make the echo say seven. *Trigger:* the next change to `ci.yml`'s jobs or to that paragraph.

## 608. c-storage's database has no bound on its write connections — the machine; `[OPEN]` (the audit store's fix, 2026-11-18, Low)

`services/c-storage/internal/sqlitedb/open.go#L22` (`Open`'s comment) has each handler write on a connection of its own, each transaction beginning IMMEDIATE and `busy_timeout(5000)` making the others wait; no call bounds the pool (`SetMaxOpenConns` is not in the file), so a burst opens as many connections as it has handlers. The audit store had the same shape and was bounded to one writer connection with a reader pool beside it (`services/audit-backbone/internal/sqlitedb/open.go#L42` and `#L54`). Fix: the same split in c-storage, or a line in `Open`'s comment saying why its load never needs it. *Trigger:* the next change to `Open`, or a measured `database is locked` under load.

## 609. A queued audit write waits as long as its request lives — the machine; `[OPEN]` (the audit store's fix review, 2026-11-18, Low)

The audit store's writer pool is one connection (`services/audit-backbone/internal/sqlitedb/open.go#L42`), and `Store.inTx` (`services/audit-backbone/internal/activity/store.go#L81`) asks for it with `BeginTx` on the request's own context, so a write queued behind a slow one is bounded by nothing but the caller's patience: the servers set a header timeout and no write timeout. Fix: give `inTx` a deadline of its own, shorter than the callers' patience, and a test that a write held past it is refused. *Trigger:* the next change to the store's write path, or a slow write seen on ridge.

## 610. The audit store's reader pool can write — the machine; `[OPEN]` (the audit store's fix review, 2026-11-18, Low)

`OpenReads` (`services/audit-backbone/internal/sqlitedb/open.go#L54-L57`) opens the feeds' pool with `busy_timeout(5000)` and no `query_only`, so a statement run through it that writes would take the write lock beside the one writer connection; today only selects go through it. Fix: add the `query_only(1)` pragma to the pool and a test that a write through it fails. *Trigger:* the next change to `OpenReads` or to what the feeds run.

## 611. Every whole check prints a `grep` error for a log folder that holds no log — the machine; `[OPEN]` (the whole checks of 2026-11-18, Low: noise, not a red)

The signal case of the demo remake's tests sets `OPS_LOG_DIR` to `$E2E/logs-dr-sig` (`ops/test.sh#L4710`), and a `grep` over `logs-dr-sig/*.log` finds no file and prints "No such file or directory" in every whole check, its test's `ok` beside it, so a reader of the log meets an error line that is not one. Fix: find which `grep` reads that folder and make it quiet or give it the file it expects. *Trigger:* the next change to the demo remake's tests in `ops/test.sh`.

## 612. A convention forbids the deploy state the declared home holds — the machine; `[OPEN]` (the review before main, 2026-11-19, Medium)

`docs/conventions/documentation.md#L255-L257`, under "Never in a doc", forbids "Deploy state ... who shipped what, where and when, and what was eyeballed", while `README.md#L67` makes `docs/products.md` the home of what runs on ridge and that page's State column holds exactly such lines (`#L91`, `#L101`, `#L102`). A writer who follows the convention would cut the rows. Fix: one line in "Never in a doc" that names the products page's State column as the exception. *Trigger:* the next change to `documentation.md`'s "Never in a doc", or a writer cutting a State line on that rule.

## 615. Where the one review's findings are listed has no home on `main` — the machine; `[OPEN]` (the review before main, 2026-11-19, Low)

`docs/conventions/qa.md#L114-L115` says "Each finding is listed and tagged `[FIXED]` ..." and, since the range cut "in the recap", names no place; the `pre-main-review` skill names its own folder on the orchestrator branch. Fix: name the place in the rule, or say it is the orchestrator branch's review page. *Trigger:* the next change to rule 5, or a reader asking where the list is.

## 616. The review skill's questions miss three duties `main` gives the reviewer, and QA lists the questions again — the machine; `[OPEN]` (the review before main, 2026-11-19, Low)

`docs/conventions/qa.md#L109` (each test against its case), `#L385` (each new coverage hint against its reason) and `docs/conventions/documentation.md#L72` (a rule's line in the human version read beside it) are duties of rule 5's reviewer that the skill's questions do not list; `qa.md#L107-L109` lists the questions the skill lists too, in different words. None applied to the docs-only range. Fix: the skill points to rule 5 for the questions and adds the three duties; QA keeps the list. *Trigger:* the next review before `main` that touches code or a rule.

## 617. The products page has two writers and names one — the machine; `[OPEN]` (the review before main, 2026-11-19, Low)

`docs/products.md#L12` says "The page stays true at each piece's recap" and `docs/conventions/documentation.md#L182` says the same, while piece 180 changed five rows with no recap and made the `inventory` skill a writer of the page. Fix: the page and the convention name both writers, the recap and the inventory, with the rule that each row is read on disk when written. *Trigger:* the next inventory run, or the next recap that changes a row.

## 619. The first attempt of GitHub's `scripts-shard (2)` red of 2026-11-15 was never read — the human; `[OPEN]` (the board's parked list, 2026-11-15, Low)

The job was red on its first attempt at 16:45 and green on its rerun (run 43700424182); a job's log needs a credential this sandbox has not, so the log is unread and the red is not yet known to be flaky. Fix: read it in the human's terminal with `gh run view 43700424182 --attempt 1 --log-failed` before anyone calls the job flaky. *Trigger:* the next red of a scripts shard, or the word "flaky" said of it.

## 620. The ShellCheck step's two-minute limit is tight under load — the machine; `[OPEN]` (the board's parked list, 2026-11-15, Low)

`.github/workflows/ci.yml#L714` gives the ShellCheck step `timeout-minutes: 2`; it took 33 to 47 seconds on GitHub and passed two minutes under load here. Fix: raise it with the next change to `ci.yml`. *Trigger:* the next change to `ci.yml`.

## 621. One scripts test file sets the scripts path's floor on CI — the machine; `[OPEN]` (the board's parked list, 2026-11-15, Low)

`scripts/src/ridge-remake.test.ts` ran 282 seconds on GitHub, longer than any other file, so the scripts' shards cannot go below it. Fix: split it into files of one case each so the shards balance. *Trigger:* someone waits on the scripts' CI.

## 622. The photo bucket's cross-origin rule is not set, and names no company yet — the human; `[OPEN]` (the board's parked list, 2026-11-15, Low)

No file in `ops/` carries a cross-origin rule for the photo bucket. The orchestrator branch's research page of 2026-11-15 on the bucket's origins recommends one entry, the pattern `https://*.ridge.<domain>` for each company's own address, plus the app's address spelled out. Fix: set the rule once ridge has its domain, then run the probe's fifth check. *Trigger:* ridge's domain is set.

## 623. The whole `ops/test.sh` takes about six minutes at a low load, and once took fifty — the machine; `[OPEN]` (the board's parked list, 2026-11-16, Low)

The whole `ops/test.sh` took about six minutes with the machine at a low load, and 50 minutes once (2026-11-16, 11:59), with no cause read. Fix: time its stages in one run under a high load and in one under a low, and name what grew. *Trigger:* the next run past fifteen minutes, or the next change to the script's stages.

## 624. A page of 2026-11-13's failures, and a read of it, were decided and never made — the machine; `[OPEN]` (the board's parked list, decided 2026-11-13 13:38, Low)

The day's decision was a page listing that day's failures, then a read of it by the Fable model: the hand-written change-set fixtures that modelled neither real set, the page's rerun button not taking twice, a Monitor that missed an exit line without a newline, and act's `audit` job at 13 minutes 45 with its cache refused. No such page is on disk. Fix: decide whether each of the four still holds, file those that do, and drop this entry. *Trigger:* the next read of how a session's failures were met.

## 625. The size rule in collaboration says the kit's word "kind" while its reason argues for the shape — the machine; `[OPEN]` (the evening review before main, 2026-11-19, Low)

`docs/conventions/collaboration.md#L245-L249` says "the minutes of the last run of the same kind", then its *Why* says the kind's mean mixes two shapes; `main` said "the same shape, never of its kind", and the machine sizes by shape. The file's head (`#L5-L7`) lists where credo's wording wins and leaves this rule out, so the kit's "kind" wins. Fix: say "the same shape (the kit says kind; credo's wording wins here)" and add the rule to the head's list. *Trigger:* the next change to the size rule, or the kit's next release.

## 626. The documentation convention's new line names a home, which the line above it rejects — the machine; `[OPEN]` (the evening review before main, 2026-11-19, Low)

`docs/conventions/documentation.md#L118-L121` names `architecture-detail.md` as the home of whether a part is built, while `#L116-L117` rejects listing homes in the convention ("a second list is the copy this rule forbids"); the front page's Where to look already declares that home. Fix: keep the hazard (a page that words "not built" itself is a copy; it points to the home Where to look names) and drop the page's name. *Trigger:* the next change to `documentation.md`.

## 627. What comes next is copied onto main from a home outside it — the machine; `[OPEN]` (the evening review before main, 2026-11-19, Low)

`docs/products.md#L156` holds the order of what comes next, refreshed each evening from the human's page on the orchestrator branch, while `docs/conventions/documentation.md#L111-L113` says a home outside `main` is named and never copied in, and the front page names `products.md` that home. Fix: either `products.md` is the home and the human's page draws from it, or `documentation.md` names this copy as its one exception with its writer. *Trigger:* the next evening refresh of the order, or the move of main.

## 628. A partner's words read in is fenced in two pages — the machine; `[OPEN]` (the evening review before main, 2026-11-19, Low)

`ops/README.md#L609` and `docs/operator-guide.md#L307` each hold the `ops/words-in.sh` command, in two forms, and the front page sends the operator to the guide; the move of the human's commands took only the four ridge commands. Fix: the runbook's step 3 points to the guide's section, as its four ridge steps do. *Trigger:* the next change to either command block.

## 629. The gallery's Show buttons carry a hidden name different from their visible words, and the tests press them by the hidden one — the machine; `[FIXED]` 2026-11-21 by the design skeleton's step 1: the labels are dropped and the tests press the visible words (the gallery review before main, 2026-11-19, Low)

`ui/src/design-system/Gallery.tsx#L88` and `#L98` set `aria-label="All states side by side"` and `"One state at a time"` over the visible "Side by side" and "One at a time"; `Gallery.test.tsx` presses both by the hidden name, so the visible words can change and stay green, which kept the products card's step 3 stale unseen, and a screen reader's user hears other words than a sighted one reads. Fix: drop the labels and press by the visible words, or put the visible words back to the labels. *Trigger:* the next change to the Show switch's words, or the next read of the gallery's tests.

## 632. The partner pages still send a reader off the site, and the map leaves one question and one name open — the machine; `[OPEN]` (the docs map's review before main, 2026-11-20, Low)

Four follow-ups of the docs map's review. (1) Three partner-page links now open GitHub, not the site: "the project's front page" (`docs/partners/README.md#L6`) and "The order to read them" (`docs/partners/developer.md#L8`, `docs/partners/tester.md#L3-L4`), the plan's `docs/plans/2026-11-20-docs-map.md#L97`. (2) A tester is given two reading orders that disagree: the map's branch top to bottom (`docs/partners/map.md#L38-L40`) and the tester page's own order (`docs/partners/tester.md#L3-L4`). (3) "ask the human" is not explained on the map (`docs/partners/map.md#L10`). (4) One reader has two names: the branch "The QA engineer" (`docs/partners/map.md#L37`) over "For a tester" (`#L38`). Fix: rewrite the partner pages in plain words, one reading order each, the three links pointing at pages on the map, "ask the human" given the page where a question goes, and one name for the tester. *Trigger:* the partner pages' rewrite in plain words.

`[DEFERRED]` 2026-11-20, the review's reread, two more follow-ups for 632: (5) the role list in `docs/partners/README.md#L12-L18` repeats the map's branches, so it drifts from the map; point it at the map or drop it. (6) The products page, the operator guide and the runbook are written for people at a terminal (the map's mock notes said so); each wants a rewrite for a partner before one is sent there.

*Update 2026-11-20, each part read against the pages as built after the docs map's step 13.* (1) *Settled:* the three links are gone from the pages that held them: `docs/partners/developer.md` and `docs/partners/tester.md` now carry their own steps and no link to "The order to read them", and `docs/partners/README.md` has no link to the project's front page; the plan's line is a dated record. (2) *Settled* by `docs/partners/tester.md`, which gives one order of five steps and ends at the QA rules, the same order the map's branch lists. (3) *Settled* by the fix pass of 2026-11-20: the map's opening paragraph now says "ask us" (`docs/partners/map.md#L10`). (4) *Still open:* the map's branch is still "The QA engineer" over "For a tester", for the same reason. (5) *Still open:* the role list in `docs/partners/README.md` ("Open the page for your part") still repeats the map's branches. (6) *Settled for two of three:* the products page by `docs/partners/what-credo-has.md`, the operator guide by `docs/partners/operator-console.md` (with `docs/partners/operator.md`); *still open* for the runbook, which keeps `ops/README.md` as the operator's reason page with its first screen and "Use this when" lines, its prose moves held by item 635. The item stays open on parts 4, 5 and the runbook of 6.

`[DEFERRED]` 2026-11-20, piece 198 step 6: the products page's partner version is done (`docs/partners/what-credo-has.md`, paired with `docs/products.md`); the operator guide and the runbook remain for (6).

## 633. Two scripts test files run near their time limit, so a loaded whole check reddens them — the machine; `[OPEN]` (the docs map's review before main, 2026-11-20, Low)

`src/demo.test.ts` and `src/demo/apply.users-changed-after-cut.test.ts` of `@credo/scripts` each hold a test that can run past the 120 s `testTimeout` (`scripts/vitest.config.ts#L17`), which limits each test, not each file: in the 2026-11-20 whole check on `pre-merge`, "row 22: a command reads each copy’s staff count through the API, and it is the count the generator says" (`src/demo.test.ts`) and "row 6: a hire into a department or position its users renamed is skipped and named, never added with none in silence" (`src/demo/apply.users-changed-after-cut.test.ts`) each ran past 120 s alone in a loaded run, and a lone rerun the same morning passed both files in 49 s. `[DEFERRED]` 2026-11-20, the review's reread: this corrects the first wording, which set a file's total time from `scripts/src/shard-times.json` against the per-test limit. Fix: a longer timeout for those two files, or a split of each. *Trigger:* the next whole check red on either, or any change to either file.

## 634. Five small notes of the products page's review, held for the next change to the pair check or the partner pages — the machine; `[DEFERRED]` (the review before main, 2026-11-20, Low)

All five are the reviewer's claim, not checked since. (1) The partner card changed in three small ways against the old card: the old card opened a `-3` copy, the human's, while the partner card opens "your demo copy" (`docs/partners/what-credo-has.md#L41`), not checked against the receipt; step 2 drops "keep today's day" while step 4 opens "today's request" (`#L44`, `#L46`); "one machine" (`#L33`) copies the products page's "one box" (`docs/products.md#L12`) while row F records a second box on ridge since 11-16 (`docs/products.md#L54`). (2) The pair's key is read strictly (`site/map.ts#L93-L96`): a capitalised `Source:` or a CRLF file reads no key, but since the check now reads every doc under `docs/` and each side demands the other's key, either is refused (the reread of 2026-11-20, run on a copy of the code); what stays is the `as string` cast, which hides a `null` that `exec` turns into the text "null". Harmless today. (3) Two open items cite products-page lines that moved: `docs/open-items.md#L2061` cites `products.md#L12`, now `#L16`, and `#L2097` cites `#L156`, now inside a different line of "Next, in order" (heading `#L137`); item 517's premise, that the card lives on a page opened in the editor (`docs/open-items.md#L1836`), changed, since it is now on the docs site. (4) "One reader a page" is a rule for every doc but lives only in `site/CLAUDE.md#L15-L21`; `docs/conventions/documentation.md` holds no line of it, acceptable while the site is the rule's only checker. (5) The gallery's card still sits on the products page (`docs/products.md#L124`, "The gallery's card"), and no rule now says where such a card lives. *Trigger:* the next change to the pair check or to the partner pages.

## 635. The prose moves the docs map's drafts asked of pages whose reader codes, left by steps 10 to 12 — the machine; `[DEFERRED]` (the docs map's build, 2026-11-20, Low)

The drafts of the runbook and of the code rules each carry a table of prose moves. Steps 10 to 12 applied the first screens, the "Use this when" lines and the named splits, and left two moves of whole sections. (1) The runbook (`ops/README.md`, from the table in section 2 of its draft) moves its backticked spans outside code blocks and tables into blocks with a "you will see" line, and splits its long sentences. The draft counts 705 spans and 101 sentences over 30 words; recounted on `ops/README.md` at this step by the draft's own rule (a backticked span counts as one word, spans in code blocks and tables left out), 688 spans and 55 sentences, the sentence count read by joining lines and splitting at a full stop, so a list item with no full stop joins the next. (2) The code rules (`docs/conventions/code.md`, the "All sections" row of section 2 of its draft) move their backticked names in prose into the tables and lists beside them; the draft says "roughly 130", recounted at this step 130 spans outside code blocks and tables (and 32 sentences over 30 words). *Reason:* the operator works only in the console today (the human, 2026-11-20), and the readers of these pages code, so the first screens, the "Use this when" lines and the named splits are in and the moves are not. The citation check reads each backticked name, so each move keeps every name and puts it in a table cell or a block, never deletes it. *Trigger:* someone other than us works from a terminal by these pages, or the page is next rewritten.

## 636. The switch's thumb sits on a track that fails 3:1 on two colours — the machine; `[OPEN]` (piece 203's plan, 2026-11-20, Low)

The brand-coloured text half closed at piece 203 step 7: `onWhite` (`ui/src/design-system/onBrand.ts`) gives links and brand text the first shade that reads 4.5:1 on white, written as Mantine's `--mantine-color-anchor`, `-brand-text` and `-brand-outline` and as `--credo-brand-text`. What stays: the switch's thumb (Mantine's `Switch`, in `ui/src/parts/Settings.tsx`) is a white disc on a track that, checked, is the filled shade the buttons wear. Measured at step 7, white against that shade: steel 4.71, emerald 3.77, brick 5.57, bronze 5.38, plum 5.56, indigo 5.40, the walks' company 4.91, pure red 3.94, and two fail 3:1, terracotta 2.91 and amber 1.61. The unchecked track is Mantine's own grey, 1.2:1 against white for every colour, not a colour's matter. *Fix:* the checked track takes a darker shade, or the thumb a dark edge, where the filled shade is under 3:1 against white; a decision for the next change to `Settings.tsx` or the switch. *Trigger:* that change, or a client with a light colour.

## 637. Three small follow-ups of the pages-remade review, held for the next change to those pages or to the QA rules — the machine; `[DEFERRED]` (the review before main, 2026-11-20, Low)

(1) `docs/architecture.md#L94-L102`: "none" in the "Where in the code" column reads as "no code does this"; step 4, for one, is `bff/src/app.ts`'s `resolveTenant` (`docs/client-readiness.md#L36-L38`). A dash would say the step names no file. (2) `docs/partners/tester.md#L5` sends a partner to the machine's products page, which is off the map, as does `docs/partners/product-owner.md`'s link to "Next, in order" on `docs/products.md`, and calls the last column "the plan" where `docs/products.md#L28` names it "Recap or plan"; the page was drafted so. (3) `docs/conventions/qa.md`'s rule that for a change to `.md` files only the citation test is the whole check says no step reads a `.md` file, but the site's tests and build read the map and every published page (`site/map.ts`, its test, the build's broken-anchor check), so a markdown-only change can redden the site gate with the citation test green. *Fix:* for (1) a dash; for (2) a link to a page on the map and the column's own name; for (3) a conventions change naming the site gate beside the citation test. *Trigger:* the next change to those pages or to that rule.

## 638. Four new palette names in Vietnamese are the machine's own, read by no Vietnamese reader — the machine; `[CLOSED BY DECISION, NOT FIXED]` (the human read the four names in the gallery and answered yes, 2026-11-20; piece 203 step 1b, Low)

`ui/src/i18n/vi.ts`'s `settings.palettes` gained `brick: 'Đỏ gạch'`, `bronze: 'Đồng thanh'`, `plum: 'Tím mận'` and `indigo: 'Chàm'`; nothing in the repository gives a Vietnamese word for them, and it holds no mark for an unchecked word, so this item is the mark. `Đồng thanh` is the alloy's name, and the old `coin` entry's `Đồng kim loại` it replaces was the human's. *Fix:* the human or a partner reads the four and corrects any in `vi.ts` alone. *Trigger:* the first Vietnamese-speaking tester of Settings. *Closed 2026-11-20:* the human read the four names in the gallery's colour picker and answered yes to "read right"; `vi.ts` stays as it is, and a partner's later correction is a new item.

## 641. The node release has three homes, and the walks' two pin one the repository no longer uses — the machine; `[DEFERRED]` (the review before main of the design fixes and the site gate, 2026-11-20, Low)

`walk/run.sh#L75` and `ops/full-run.sh#L52` pin `v26.12.1` (the walks refuse any other release), while `.node-version` has said 26.13.1 since 2026-11-14. The walks' pictures come from the Chromium pinned the same way in both, so their verdict stands. *Fix:* the two runners read `.node-version`, beside item 424. *Trigger:* the next change to the walk machinery, or a Node bump.

## 642. Two small gaps the reread after the design fixes found: the docs site's test passes on an empty gate module, and the password rule says nothing of work `pre-merge` holds unchecked — the machine; `[DEFERRED]` (the review before main of the design fixes and the site gate, 2026-11-20, Low)

`site/config.test.ts#L17-L18` checks only that `gate-client.ts` exists, so an empty client module keeps it green; the head tags beside it are pinned. And the password rule's "moves `main`" (`docs/decisions.md#L26-L27`, `ops/README.md#L35`, `#L522-L523`) runs the site's gate and the walks page's build but says nothing for the case where `pre-merge` already holds work the whole check has not passed; that is the human's yes, so a note. *Fix:* the test reads the module's content (that it sets the open attribute), and the rule names the whole check as its first condition. *Trigger:* the next change to the site's gate or to the password rule.

## 644. The ten-colour check holds only what the root variables carry, not what each colour's resolver computes — the machine; `[FIXED]` 2026-11-21 by the screens-on-parts piece's step 5: its header says which half is held (the review before main of landing B, 2026-11-20, Low)

`visual/src/resolved.test.ts#L408-L431` changes each colour's root variables, but draws each screen once per language at the scene's own colour (`visual/src/words.tsx#L148-L152`). What `variantColorResolver` (`ui/src/design-system/appTheme.ts#L104`) and the checks' `iconColor` compute per colour is held for that one colour only, for example emerald's buttons drawing dark text through an inline `--button-color`, so a change to the resolver for emerald passes the check. The header's "the theme's variables, which are all a colour changes" and the plan's palette-check section are untrue in that half. Nothing in landing B changes that resolver's result. *Fix:* draw each screen per colour, or say in the header and the plan which half is held. *Trigger:* a step that leans on the check for a change to `appTheme.ts`'s resolver, or the skeleton piece's first look change.

*Update 2026-11-21, the screens-on-parts piece's step 5:* the header of `visual/src/resolved.test.ts` (its opening comment) now says the half held: the theme's root variables are read for each of the ten colours, and what a colour's resolver computes (`variantColorResolver`, the checks' `iconColor`) is held at the scene's own colour only. Each screen is still drawn once per language; drawing it per colour stays a choice for a step that changes the resolver. The item is closed by the header's words.

## 645. The shade guard misses three forms — the machine; `[DEFERRED]` (the review before main of landing B, 2026-11-20, Low)

Neither `SHADE` pattern (`ui/src/design-system/literals.test.ts#L8`, `eslint.config.js#L18`) reads Mantine 9.6.3's `--mantine-primary-color-0` to `-9`, a `theme.colors.<name>[n]` read through `useMantineTheme()`, or a built `` `brand.${n}` ``. Today none of the three is used outside the design system (grep 0). *Fix:* one alternation each in the test and the lint, or a rule that says the three are out. *Trigger:* the first screen that reads the theme's colours in a script, or the next change to either pattern.

## 646. `resolved.test.ts` holds a copy of `capture.ts`'s two functions — the machine; `[DEFERRED]` (the review before main of landing B, 2026-11-20, Low)

`stylesheet()` in `visual/src/resolved.test.ts#L318-L353` copies `appStyles` and `asProduction` from `visual/src/capture.ts#L42`, `#L60-L75`; its one addition is `css.modules.generateScopedName`. If a plugin or the entry changes in one copy, the check reads a stylesheet the walks page does not build, and nothing turns red. *Fix:* make the scoped name a parameter of `appStyles`, so the test calls it. *Trigger:* the next change to `capture.ts`'s plugins or entry, or to `resolved.test.ts`'s stylesheet.


## 647. The theme draws three weights that `WEIGHTS` also names, and a fourth outside the table — the machine; `[FIXED]` 2026-11-21: its theme half by the design skeleton's step 5, its 550 half by the screens-on-parts piece's step 1, the dialog's title at `WEIGHTS.emphasis` (the review before main of landing C, 2026-11-21, Low)

`ui/src/design-system/appTheme.ts#L150` gives every heading `'600'`, `#L151` gives the page title (h2) `'700'`, and `#L177` gives every field's label `500`; `WEIGHTS` in `ui/src/design-system/tokens.ts` names the same three (`title` 700, `emphasis` 600, `label` 500), and `TOKENS.dialogTitle`'s `550` (`tokens.ts#L78`) is a fourth weight outside it. The values agree today, so nothing moves. But a change to `WEIGHTS.title` would move the cards' and doors' titles and leave the page titles, and a change to `WEIGHTS.label` would leave every field label beside the settings page's logo label. `TYPE.pageTitle`'s comment ("which the theme draws at 22 px, 700") describes the copy. *Fix:* the three theme lines read `WEIGHTS` (`appTheme.ts` already imports `tokens.ts`); decide whether 550 joins the table; the pinned file holds the result. *Trigger:* the next change to a weight or to the theme's headings.

*Update 2026-11-21, the design skeleton's step 5:* the theme's three lines read `WEIGHTS` (`appTheme.ts`: the headings `emphasis`, the page title `title`, a field's label `label`), held by `appTheme.test.tsx`'s case 11, and `TYPE.pageTitle`'s comment names the theme's weight by role. *Still open:* `TOKENS.dialogTitle`'s `550`, which the next milestone's first move sets to `WEIGHTS.emphasis`, the pinned file naming `operator-passkeys/pk-6-sign-in-ended` alone.

*Update 2026-11-21, the screens-on-parts piece's step 1:* `TOKENS.dialogTitle` reads `WEIGHTS.emphasis` (`ui/src/design-system/tokens.ts#L85`), held by `appTheme.test.tsx`; the pinned file changed for `operator-passkeys/pk-6-sign-in-ended` alone, and its six pictures are rewritten. The item is closed.

## 648. Case 13's two checks each miss forms the other catches, and both miss a few — the machine; `[DEFERRED]` (the review before main of landing C, 2026-11-21, Low)

The lint (`eslint.config.js#L98`, `#L103`) matches only a bare number, so it misses `fontSize: '14px'`, which the test catches. The test's pattern (`ui/src/design-system/literals.test.ts#L12-L13`) needs the number right after `=` or `:`, so it misses `fw={on ? 600 : undefined}` (the form the recount found in `Shell.tsx`) and `fz={rem(12)}`, which the lint catches as a descendant. Both miss `fw="600"`, `fz="14px"`, `fw={'600'}`, `fontSize: rem(14)`, a `Text`'s `size="14px"` and the stylesheet `font:` shorthand. Words such as `bold` are out by choice. Today none of these is written outside the design system. *Fix:* widen both patterns to the same set of forms, each with a planted case, beside item 645's shade forms. *Trigger:* the next screen that writes one of them, or the next change to either pattern.

## 649. Four small leftovers of landing C's text and gallery — the machine; `[FIXED]` 2026-11-21 by the design skeleton's step 5: the lint message and its comment reworded, the gallery's Values entry names `WEIGHTS`, the gallery's local `SIZES` renamed and its rule column reads `TOKENS.primaryShade`, the frame's two 14 px sizes one name and its two 600 weights one name, and `SignIn.tsx`'s repeated `fw` dropped; `TYPE.body` stays, the guideline's six styles being typed over `TYPE`'s keys (the review before main of landing C, 2026-11-21, Low)

(1) The new lint message, "A weight or size is named in the design system: read `WEIGHTS`, `SIZES` or `TYPE` of `ui/src/design-system/tokens.ts`." (`eslint.config.js#L99`, `#L104`), can be read as describing the fault, the form the shade message had before it was reworded; clearer: "Name no weight or size here: read `WEIGHTS`, `SIZES` or `TYPE` of `ui/src/design-system/tokens.ts`." The block's comment (`#L79-L80`) still names colour alone. (2) The gallery's Values entry (`ui/src/design-system/entries.tsx#L185-L187`) names `ROLES` alone, not `TYPE`, `WEIGHTS` or the washes it also draws, and the comment that describes `Roles` sits on `ON_THE_BRAND` (`#L151`). (3) `ui/src/design-system/OnTheBrand.tsx#L7` declares a local `SIZES` beside the exported one in `tokens.ts#L24`, and its `onWhite(tuple, 6)` (`#L131`) copies `TOKENS.primaryShade`, which `cssVariables.ts#L51` reads: if the primary shade moves, the gallery's "The rule" column draws a link the app does not. (4) `TYPE.body` is `{}` and only the gallery reads it; `FRAME_VALUES`' `menu-weight` and `weight-emphasis` are two names for one value, and `menu-size` and `link-size` are both 14 px; `SignIn.tsx`'s `fw={WEIGHTS.title}` repeats what `TYPE.pageTitle`'s h2 already draws. *Fix:* the four, in one small change. *Trigger:* the next change to the lint block, the gallery's Values or `OnTheBrand.tsx`.

## 650. Two walk test titles name counts the files no longer hold — the machine; `[FIXED]` 2026-11-21 by the screens-on-parts piece's step 5: the titles and the second header say the counts the files hold (the walks' read at the whole check of landing C, 2026-11-21, Low)

`walk/specs/piece-1.spec.ts#L235` and `#L239` are titled "walks all nine screens in Vietnamese" and "in English", where the file's header (`#L16-L18`) says twelve screens (12 × 2 × 3 = 72) and 72 pictures are on disk in `walk/specs/piece-1.spec.ts-snapshots`. `walk/specs/piece-2.spec.ts#L541` is titled "walks all thirty-three screens in ${name}" and its header (`#L10-L11`) says thirty-three (A's sixteen, B's seven, C's six and D's four; 33 × 2 × 3 = 198), where 204 pictures are on disk, 34 screens by their names (34 × 2 × 3). So the second file's header sum and its pictures differ by one screen as well as its title. Titles only: each walk compared its pictures with its committed base and no verdict moves. *Fix:* the titles (and the second header's sum) say the counts the files hold. A walk test's title may name its pictures, so before the change check whether the visual report, `walk/run.sh`, `walks.json` or any `-g` filter selects a walk by its title (grep each of the three titles across `walk/`, `ops/` and `visual/`), and rename in the walks' own step with a run, never in a documents pass. *Trigger:* the next change to either spec, or the walks' next own step.

*Update 2026-11-21, the screens-on-parts piece's step 5:* the grep of the three titles across `walk/`, `ops/` and `visual/` found no reader: no `-g` filter, no `walk/run.sh` line and no report selects a walk by its title, and a base picture is named by its screen, not the test. `walk/specs/piece-1.spec.ts#L235` and `#L239` now say "twelve"; `walk/specs/piece-2.spec.ts#L541` says "thirty-four" and its header (`#L10-L11`) counts thirty-four screens (34 × 2 × 3 = 204), the group split dropped since the file's own list counts 34 and the split summed to 33. The item is closed. Item 212 named the same piece-2 title and sum and closed with it, at the same step.

## 651. The screens still write their own colours, gaps, sizes and widths, where the guideline says a screen picks parts only — the machine; `[DEFERRED]` (the design skeleton's rework of landing 1, 2026-11-21, Medium)

The guideline's rule "a screen picks parts, never a style" (`ui/src/design-system/guideline.ts`, `followed` this item) holds for no screen yet. Outside the design system and the mock, the screens write Mantine's colour names `red`, `green`, `orange`, `gray` and `yellow` about 130 times and `dimmed` about 50 more, gaps and paddings of their own, about 17 `Text` lines with a `size` or `fw` and no comment (for example `ui/src/components/molecules/DetailField.tsx#L9`, `ui/src/parts/Settings.tsx#L132`), widths and icon sizes as numbers (45 icons, 30 at 14 px), and the frame's stylesheets a 6 px corner twice and a 12 px one (`ui/src/frame/frame.module.css#L30`, `frameLook.module.css#L93`). No check refuses a colour name or a gap, so the guideline's `followed` is the only record. *Fix:* the next milestone moves the screens one rule at a time (the plan's "The next milestone", `docs/plans/2026-11-21-design-skeleton.md`): each part takes content and meaning and reads its look from the theme, and the screens' own looks go; step 12 of the plan lists the counts rule by rule. *Trigger:* the design skeleton's landing 3, or the first screen built after it. *Recount, step 12 (2026-11-21):* the plan's "The next milestone" is the one home of the order; this item holds the counts by part. Of the 18 parts with a contract, 8 follow the rule today (`PageHeader`, `DetailColumns`, `FieldPair`, `FieldLabel`, `DoorHeading`, `LogoTile`, `BrandBand`, `DetailField`) and 8 name this item: `FormMessage`, `PageState` and `StatusBadge` (the screens draw their own messages, states and chips), `PageShell` (no back link or status; the screens draw them), `SectionCard` and `SectionTitle` (the callers pass the icon's size), `BackLink` (no screen draws it; 14 places draw a back link by hand) and `DoorCard` (no screen draws it; the sign-in frame draws a card of its own); `ActionButton` is item 655's and `ListTable`'s least width is item 653's. The counts above are as filed: no step moved a screen. *Sites of the gallery-parts piece's five parts, counted on the tree of 2026-11-22 (step 11) by `git grep -ohP '<pattern>'` over `ui/src/*.tsx` less `ui/src/design-system`, `ui/src/components`, `ui/src/mock` and the tests, each in `n` in files:* `DataTable`, `<Table(?![\w.])` 15 in 12; `Panel`, `<Paper(?![\w.])` 33 in 23; `MenuRow`, `className=\{classes\.moreRow\}` 3 in 1; `CopyText`, `<CopyText(?![\w.])` 5 in 5 (the five already import the part from its new home); `Tag`, `<Badge(?![\w.])` 5 in 4 (four light with no status, one the frame's filled). No screen draws `DataTable`, `Panel`, `MenuRow` or `Tag` yet.

*Update 2026-11-23, the colour-check piece's step 2:* the colour names are done. The 130 was gone before the piece (piece 222's messages and buttons took most); nine lines were left in four screens (`ImportPage.tsx`, `ListImportPage.tsx`, `PermissionEditor.tsx`, `ServicesPage.tsx`), now drawn through `TONES`, and `literals.test.ts` case 1 refuses a palette's name in a screen. What remains of the colours is `dimmed` (about 50 uses, no meaning).

*The kinds of page and their screens, the move's targets (the gallery pages plan, step 10, 2026-11-23):* each kind of page is a gallery entry, and each screen below is moved onto it, by its kind's "must have" lines, when the milestone behind this item reaches it.

- **The list page:** `ListPage.tsx#L25-L51`, `OrdersPage.tsx#L57`, `StaffListPage.tsx#L276`, `ClientsPage.tsx#L52`, `OperatorsPage.tsx#L37`, `PasskeysPage.tsx#L91`.
- **The phone page:** `MyDeliveriesPage.tsx#L28-L62`, `MyDeliveryPage.tsx#L94-L161`.
- **The form page:** `AddPersonPage.tsx#L249`, `AddRecordPage.tsx#L115`, `NewOrderPage` (`OrderPage.tsx#L431`), `OwnPasswordPage.tsx#L84`, `AddOperatorPage.tsx#L121`, `NewClient.tsx#L89`, `StaffSetupPage.tsx#L165`.
- **The day sheet:** `DeliveriesPage.tsx#L37-L134`, `DriverDayPage.tsx#L116-L258`.
- **The import page:** `ImportPage.tsx#L234-L340`, `ListImportPage.tsx`.
- **The menu page:** `MorePage.tsx#L20-L44`.
- **The confirm page:** `DeleteClientPage.tsx`, `DeleteOperatorPage.tsx`, `MoveClientPage.tsx`, `RootPasswordPage.tsx`, `OperatorLinkPage.tsx`.
- **The settings page:** `SettingsPage.tsx`, `Settings.tsx#L95-L252`.

The files are named as the plan names them, their directories not repeated; the look at the plan's step 10 decides whether they stay the targets.

## 652. The formats have no place for a number, and five `new Intl.NumberFormat` stand in screens — the machine; `[FIXED]` 2026-11-22 by the screens-on-parts piece's step 18: `ui/src/number.ts` holds a number's, a price's and the marks' formats, the five sites read it, and a check refuses `Intl.` in a screen (the design skeleton's rework of landing 1, 2026-11-21, Low)

Outside `ui/src/day.ts`, five `new Intl.NumberFormat` stand in four files; one is `useMoney`'s own (`ui/src/parts/OrderParts.tsx#L23`), the other four write a price, a quantity or the marks of a number by hand, and a number has no place of its own. The guideline's formats note says so. *Fix:* a number's one place beside `day.ts`, the four moved to it, then a check that refuses `new Intl` in a screen. *Trigger:* the next milestone's formats move (its 7th rule), or the next screen that writes a number.

## 653. Which least width a table takes is no part's rule, and the screens write five — the machine; `[FIXED]` 2026-11-22 by the screens-on-parts piece's step 17: the 12 tables draw `TableScroll`, which writes the one least width, `WIDTHS.table`, and a check refuses a least width in a screen (the design skeleton's rework of landing 1, 2026-11-21, Low)

The screens set a table's least width (`Table.ScrollContainer minWidth`) 12 times (counted again at step 10 of the plan; the first count said 14, and its own list sums to 12): 480 once (`ui/src/pages/operator/PasskeysPage.tsx#L88`), 560 three times, 640 twice (`ui/src/parts/ListTable.tsx#L40`), 720 four times (`ui/src/pages/client/OrdersPage.tsx#L49`) and 760 twice (`ui/src/pages/operator/ClientsPage.tsx#L47`). `WIDTHS` has no key for them and no use line names them, so a coder of the next list page cannot choose one without asking. *Fix:* a table's look is the design-system coder's to choose, the gallery their check: a table part decides its least width (one value, or by the number of columns), read from `WIDTHS` with a use line, and the screens stop writing it. *Trigger:* the design skeleton's landing 3 (the page base). *Update, step 10 (2026-11-21):* the trigger fired: `WIDTHS` has a `table` key (640, the list table's own) with its use line, and `ListTable`'s contract decides it; the part's code is unchanged and still writes 640, and the screens' 12 widths stay for the next milestone's table move.

## 654. `WEIGHTS` and `SIZES` have no use line in the guideline, and the gallery draws no weight by its role — the machine; `[FIXED]` 2026-11-21 by the design skeleton's step 7: `GUIDELINE.values` holds `weights` and `sizes`, typed over `WEIGHTS` and `SIZES`, and Values draws them as its Weights and Sizes states (the design skeleton's rework of landing 1, 2026-11-21, Low)

The guideline's rule on text sends the design-system coder to the weights and sizes of their own tables, and `ui/src/design-system/tokens.ts#L27-L29`'s comment is the only place that says what each is for. Landing C's Type state drew "weight {role}: {weight}", which landing 1's values step dropped without a line saying so. *Fix:* two tables typed over `WEIGHTS` and `SIZES` in `GUIDELINE.values`, drawn as states of Values, each with its case. *Trigger:* the next change to `WEIGHTS` or `SIZES`, or the design-system coder's first part.

## 655. The screens draw their 109 buttons by Mantine's variant and colour, and no part says which is the page's main action — the machine; `[FIXED]` 2026-11-22 by the screens-on-parts piece's step 17: the screens' buttons are drawn by `ActionButton` by meaning, the doors the only raw `Button`s, and a check refuses any other (the design skeleton's step 8, 2026-11-21, Medium)

The guideline's rule "a page has one main action" (`ui/src/design-system/guideline.ts`, `followed` this item) holds for no screen yet, and `ActionButton` is a part to come (its entry is drawn from Mantine, its four meanings main, other, quiet and danger in `GUIDELINE.contracts`). The screens write 109 `Button`s outside the design system, 49 with `variant="default"`, 40 with none (filled), 3 `subtle` and 2 `subtle` in gray, 4 `outline` in red, 4 filled in red, one each of `subtle` red, `default` red and filled red by a condition, and 4 whose variant a condition picks (`ui/src/pages/client/ImportPage.tsx`, `ui/src/pages/operator/AddOperatorPage.tsx`); `GUIDELINE.buttons` maps each look to a meaning, and the test of case 15 refuses a look it does not name. No check counts a page's filled buttons, so which pages draw two main actions is not known. *Fix:* the next milestone builds `ActionButton`, moves the 109 to it a page at a time, reads each page's one main action, and turns red to a delete's last step only (a confirm is a page, item 306); a check then refuses a `Button` outside the part. *Trigger:* the design skeleton's landing 3, or the first screen built after it.

## 658. A message's children can be a node, which lets a screen put a style back into the message — the machine; `[DEFERRED]` (the pre-main review of the screens-on-parts piece's landing 2, 2026-11-22, Low)

`FormMessage`'s `children` is words, and the contract says a screen passes content and meaning only, yet seven sites pass a node: the words and an act (a button) inside their own `Stack gap="xs"`, six with `align="flex-start"` (`ui/src/pages/client/DeliveryPage.tsx#L74`, `PersonPage.tsx#L97` and `#L424`, `RecordPage.tsx#L161`, `StaffSetupPage.tsx#L145`, `ui/src/parts/OrderParts.tsx#L254`, `Settings.tsx#L104`). The act's gap, place and size are each screen's: five buttons are `size="xs"` and two are not, and one field keeps its own `styles`. *Fix:* an `act` take on the part (the content, a node) that the part lays out, with `children` back to words. *Trigger:* landing 3 of the screens-on-parts plan, which moves those buttons.

*Update (222 step 10, 2026-11-22):* six of the seven sites now use `act` (the settings page, the conflict reloads of the person, record and staff set-up pages, the outcome's theirs button), so `children` is not narrowed yet: `ui/src/pages/client/DeliveryPage.tsx`'s cancelled line (its open-order button was left in its own `Stack` at step 8 and moved onto `act` at step 10's fix) is done, and one site still passes a node, `ui/src/pages/client/PersonPage.tsx#L97` (the shown password, words and a read-only field, which `act` cannot take as it is no act), and `act` itself takes any node. *Trigger:* the first change to either page, or landing 4.

## 659. The green messages moved from `alert` to `status` may go unheard by a screen reader when they appear — the machine; `[DEFERRED]` (the pre-main review of the screens-on-parts piece's landing 2, 2026-11-22, Low)

Twenty-two sites draw a success or saved message and each mounts it at the moment it appears (for example `ui/src/parts/Settings.tsx#L97`). A live region inserted already holding its words is announced unreliably (VoiceOver especially), where an inserted `alert` is read, so "Saved" and "Delivered successfully" may go unheard. Not proved: the sandbox has no screen reader and a role finder cannot hear. *Fix:* keep one `status` region mounted per page and change its words, or check the saved line on VoiceOver and NVDA first. *Trigger:* landing 4's `PageState`, or the next look on ridge, whichever comes first.

## 660. The same words got two kinds across sites, and the driver's cancelled line stays an error though read at load — the machine; `[DEFERRED]` (the pre-main review of the screens-on-parts piece's landing 2, 2026-11-22, Low)

"Client not found in directory." (`operator.rootUnknown`) is a standing note on the move page (`ui/src/pages/operator/MoveClientPage.tsx#L149`) and an alerting warning on the root-password page (`RootPasswordPage.tsx#L80`): each kept its old role. The driver's "This delivery was cancelled by the dispatch office. Do not deliver." (`ui/src/pages/client/MyDeliveryPage.tsx#L101`) is read from the page's load like the archived line (`PersonPage.tsx#L412`, which went `standing`) yet stays `error`. Four not-found lines moved onto `FormMessage` while `RecordPage.tsx#L137`'s waits for landing 4. *Fix:* read the five not-found lines together and the load-time messages by one rule, then set their kinds. *Trigger:* landing 4 of the screens-on-parts plan.

*Update (222 fix 4, 2026-11-22):* the not-found half is done: the four operator lines (`ui/src/pages/operator/DeleteOperatorPage.tsx`, `MoveClientPage.tsx`, `OperatorLinkPage.tsx`, `RootPasswordPage.tsx`) now draw `PageState` `notFound` beside their way back, as `RecordPage`'s does, so the five read alike (a grey line spoken `status`). Not done: the driver's cancelled line (`ui/src/pages/client/MyDeliveryPage.tsx#L102`) stays an `error` though read at load, like the archived line (`PersonPage.tsx#L400`, `standing`); the item stays open for it. *Trigger:* the next change to `MyDeliveryPage.tsx`.

## 662. The logo refusal on the settings page is still red text spoken as an alert, not a `FormMessage` — the machine; `[FIXED]` 2026-11-23 by the colour-check piece's step 1: the refusal is drawn through `FormMessage` as an error, still spoken as an alert, and `Settings.test.tsx` asks it is the message part's (the pre-main review of the screens-on-parts piece's landing 2, 2026-11-22, Low)

`ui/src/parts/Settings.tsx#L150` draws the refusal of a logo (too large, wrong kind) as `Text c="red" role="alert"`, a field's message, where the plan's landing 2 moved every message under a form or an act and no later landing (3 buttons, 4 page states, 5 chips, 6 page base, 7 formats) takes it. *Fix:* draw it through `FormMessage` as an error, or give a field's message its own part, and move the finders with it. *Trigger:* the next change to the settings page, or the landing that decides a field's message.

## 663. Case 7 reads files, not pages, so a part's main drawn on a page beside the page's own main passes it — the machine; `[DEFERRED]` (the pre-main review of the screens-on-parts piece's landing 3, 2026-11-22, Low)

Case 7 (`ui/src/design-system/guideline.test.ts#L310`) counts `meaning="main"` per file, so a page that draws a part naming the main meaning beside its own passes: the draft order page, whose save (`ui/src/pages/client/OrderPage.tsx#L258`) and the confirm's send (`ui/src/parts/OrderParts.tsx#L194`) are both main. *Fix:* case 7 counts a page with the parts it draws, or `SendPanel` takes its submit's meaning from the page (the order page's save turning other while a confirm is offered). *Trigger:* the human's answer on point 2 of landing 3's card (whether two main actions on the draft order is right), or the next change to `OrderPage.tsx` or `SendPanel`.

## 664. The page base's plan check reads two titles, not one, and the pages that gained a back link or a status lost the tight stack of title and subtitle — the machine; `[FIXED]` 2026-11-22 by the screens-on-parts piece's step 16b: `PageHeader` takes the record's status and a subtitle, `PageShell` draws its heading through it and takes the subtitle, so it writes no title of its own, the title half of step 17's count is 1 and the four pages' line stacks tight (the screens-on-parts piece's step 16, 2026-11-22, Low)

Step 17's done-when counts `<Title {...TYPE.pageTitle}>` in the screens as 1, the sign-in door's; after step 16 it reads 2, since `PageShell`'s record-status branch (`ui/src/parts/PageShell.tsx`) writes the title itself where `PageHeader` cannot take a chip. Separately, the four pages that moved onto `PageShell` with a subtitle under the title (`AddRecordPage`'s intro, `PersonPage`'s code, `RecordPage`'s code, `DriverDayPage`'s day) now have it one `lg` gap below the title, where they stacked at `xs` or none; the part takes no subtitle. *Fix:* `PageHeader` takes the record's status, so `PageShell` draws one heading in both cases and the count is 1; and `PageShell` takes a subtitle line, or the review accepts the gap. *Trigger:* step 17's done-when, and the pre-main review's look at the pictures.

## 665. `PageShell`'s `status` and `PageHeader`'s `status` name two things, and a dead retry is drawn where no page gave one — the machine; `[DEFERRED]` (the pre-main review of the screens-on-parts piece's landings 4 to 7, 2026-11-22, Low)

`PageShell`'s `status` is the load state, `PageHeader`'s is the record's, and `PageShell` passes `status={recordStatus}` through (`ui/src/parts/PageShell.tsx`, `ui/src/components/organisms/PageHeader.tsx`): one word, two meanings one layer apart. Seven of the 11 screen calls pass a constant `status="ready"` from inside an outer `Loaded`, and five of those also pass an `onRetry` that can never fire (Delivery, DriverDay, MyDelivery, Order, Record); `NO_RETRY` turns "no retry" into a retry button that does nothing, which `PageState`'s own contract avoids, and `PageShell.test.tsx` requires it. No screen reaches it today. The review page is the orchestrator branch's `worktrees/reviews/2026-11-22-pre-main-screens-on-parts-4/review.md`, its finding 6. *Fix:* `PageHeader`'s take becomes `recordStatus` (one caller), `PageShell` defaults `status` to ready, and `onRetry` passes through so `PageState` draws no dead retry, or `PageShell` owns the load. *Trigger:* the next change to `PageShell`, or the first page that passes a load state other than ready.

## 666. `frameKept` case 9 (the ways to sign in, an email and a QR code) went red once under load on a timing-dependent attribute — the machine; `[DEFERRED]` (the gallery-parts piece's step 2 gate, 2026-11-22, Low)

`ui/src/frame/frameKept.test.tsx` case 9 failed once in a whole `ui` gate at a load of about 9 (the run of 2026-11-22 20:27, lines 18 to 35): its snapshot received `data-resizing="true"` on the `AppShell` root, an attribute Mantine sets while the window is measured and removes after, so the snapshot holds it or not by timing. The case passed alone and on the rerun with no change, in a file the step never touched. *Fix:* strip `data-resizing` from the snapshot's html before it is compared, or wait for the shell to settle before reading it. *Trigger:* the next red of this case, or the next change to `ui/src/frame/frameKept.test.tsx`.

## 667. The lists scroll sideways at the phone's width where the staff list draws a card a row — the machine; `[DEFERRED]` (the gallery pages plan, step 1, 2026-11-22, Medium)

At 390 px the list page (`ui/src/parts/ListTable.tsx`, drawn by `ListPage`), the orders (`ui/src/pages/client/OrdersPage.tsx#L56`) and the operator's three (`ui/src/pages/operator/ClientsPage.tsx#L51`, `OperatorsPage.tsx#L36`, `PasskeysPage.tsx#L90`) draw a table inside `TableScroll`, so a phone reads the first columns and scrolls for the rest, with nothing that says so (item 31). Only the staff list draws a card a row at the phone's width (`ui/src/pages/client/StaffListPage.tsx#L243`, `hiddenFrom="sm"`), a card of its own, not a part's. The gallery pages plan's step 3 draws the list page with a card a row at the phone's width, the name and its chip first and the other columns as captions; the human's look at step 10 (its point 1) decides whether cards are the phone's rule for a list. *Fix:* a yes: the list part draws the card from that rule, the staff list's own card goes onto it, and the five screens above move with their walk pictures (a picture run and a review, QA rule 5); a no: the sideways table is the rule, and the staff list's card is the one to move. *Trigger:* the human's answer at step 10 of the gallery pages plan.

The human answered yes on 2026-11-23 (the gallery pages plan, step 10, point 1): a card a row is the phone's rule for a list, so the move of the lists this item names is the screens' move's work. The item stays open for that move.

## 668. The driver's call link is one line of text high, shorter than the 36 px the plan holds every phone press to — the machine; `[DEFERRED]` (the gallery pages plan, step 1, 2026-11-22, Low)

`ui/src/pages/client/MyDeliveryPage.tsx#L25` draws the customer's phone as an `Anchor` inside a `Text`, so its tap is the height of one line of text, below the 36 px that `ActionButton` stands at (`size: 'sm'`, Mantine's `--button-height-sm`) and that the gallery pages plan's phone page holds every press to. The driver taps it with a thumb, outdoors. *Fix:* draw the call as a press at least 36 px tall (an `ActionButton` with the phone's icon, or the link given a 36 px least height by a part), and the screen's picture moves with it. *Trigger:* the gallery pages plan's step 2, which draws the phone page and reads each press against the 36 px, or the next change to `MyDeliveryPage.tsx`.

*Read at step 2 (2026-11-22):* the phone page's entry draws the call as the screen does, Mantine's own `Anchor`, the one line shorter than 36 px, and its must-have line holds the presses (`ActionButton`, `size: 'sm'`) to 36 px; the item stays open, the screen's move being the milestone behind (651).

## 671. Three `Gallery.test.tsx` cases time out at 5000 ms in a whole `ui` gate under load, and pass alone — the machine; `[FIXED]` in the sign-in card piece's step 10c (the step 6 note, 2026-11-23, Low)

In five runs of `ui`'s whole gate on 2026-11-23, from 17:00 to 17:13 (a load of 8 to 14, the step 6 logs in the credo root's `logs/`), three cases of `ui/src/design-system/Gallery.test.tsx` timed out at 5000 ms: "8: each component's description and props in the table are its file's doc comment and props", "213 case 2: an entry's instead names an entry that exists, and the panel links to its address" and "213 case 3: the side panel shows the part's use lines under its description, before its props". Each run showed one to three of them, the file taking 45 to 54 s; the next whole run passed with no change, and the file alone passes in 22 s. A fact, not a diagnosis. *Trigger:* the landing's whole check, or the next `ui` gate red on one of these cases.

**`[FIXED]` in step 10c (2026-11-23):** the landing's whole check on `pre-merge` (22:36 to 22:44) hit it again, case 3 at 5,938 ms. Run alone at load 1.3 the three cases take 1,600 ms (case 8), 1,524 ms (213 case 2) and 1,802 ms (213 case 3), the file 16.6 s, so each is slow rather than hung. Case 8 walks the 22 component files (21 at `591dfedb`); cases 2 and 3 walk `ENTRIES`, 92 entries now against 87 at `591dfedb`, so this piece's entries lengthened the loops by about 6 percent, not the cause. Each of the three now has its own 10 s timeout (three times its alone time or more; 5 s is the global default, so a rounded 5 s would change nothing) as the `it`'s third argument; the global `testTimeout` and every other case are unchanged.

## 672. The passkeys walk's add-a-passkey step waited past 5 s on the stack's reply once, the table one row short — the machine; `[DEFERRED]` (the sign-in card piece's step 10, 2026-11-23, Low)

In the recheck run of 2026-11-23 at 21:44, the passkeys walk's tablet English test, on the stack pass, failed at `walk/specs/operator-passkeys.spec.ts#L235`: `getByRole('row')` expected 3 and received 2 after the 5000 ms wait, the press on "add a passkey" having not yet had its reply from the stack, so two pictures were missing. The same walk passed in the run of 20:19 and in the rerun of the passkeys walk alone at 22:05, the failing test among them, with no change between. Not this piece's change: of the 48 non-picture files in `git diff --name-only 591dfedb..HEAD`, none has `operator` or `passkey` in its path. A fact, not a diagnosis. *Fix:* the spec waits for the reply (`page.waitForResponse` on the options call, started before the press) before it counts the rows. *Trigger:* a second red at that line.
