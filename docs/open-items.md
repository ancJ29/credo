# Open items

Numbered, never renumbered; an entry is deleted when done
([documentation](conventions/documentation.md)).

**"A client's own stack" or "a client's stack", in a trigger or a severity below, means the first
stack that holds a real tenant's data.** The items were written when each client was to have a
stack of its own; since 2026-11-11 the shape intended for production, and not built, is one stack
per environment with its tenants pooled on boxes
([how a call finds its tenant's box](architecture-detail.md#how-a-call-finds-its-tenants-box)), so
such a trigger fires at that environment's stack, not at a stack for each client.

## 1. A client's server that stops reaches no one — the machine proposes, the human places the alert; waits for a signed client (the architecture plan, 2026-10-27)

Written in `ops/env.yml`, guarded by `ops/test.sh` and not yet applied to ridge: four alarms (the
API's `5xx`, the back end's `Errors` and `Throttles`, the box's `StatusCheckFailed`) send each alarm
and its return to normal to one topic, and with a Slack workspace ID and a channel ID the stack makes
AWS's Slack app carry the topic into one channel ([the runbook](../ops/README.md#the-watch), [the
plan](plans/2026-11-11-slack-alarm.md)). Not built: the scheduled check that fails when the continuous
copy lags or the disk is low, production's alarms (one more stack, the same four), and a spend alarm.
Before the first client goes live the alarms must be applied and one forced; where an alert lands is
the human's (production).

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
and still waits for a client; in the pooled shape, intended and not built, it holds every tenant
group's box, and its tenants' names sit under one wildcard certificate requested in `us-east-1`,
with one wildcard name in Cloudflare
([how a call finds its tenant's box](architecture-detail.md#how-a-call-finds-its-tenants-box)). A
tenant takes a stack of its own only where its contract needs its keys apart.

## 5. The arm64 builds and how each release lands — the machine writes, GitHub Actions runs on the human's push to main; c-storage's first, for ridge (the architecture plan, 2026-10-27)

Home: [the ridge plan](plans/2026-10-28-ridge.md#deploys-from-github-actions). c-storage's Go binary
for arm64, built from `main` alone, sent to its box over the Instance Connect tunnel and run under
systemd. `ops/release.sh` does this, run by GitHub Actions' `deploy` job on each push to `main`, or
by the human while Actions is down. The BFF's function for arm64 comes with piece 1, in the ridge
plan's fourth layer, which decides how CD ships it (planned in [ridge-app](plans/2026-10-28-ridge-app.md#layer-four)).

## 6. The nightly backup and its restore, with no copy of the records yet — the machine writes it, the human runs it; waits for a signed client (the architecture plan, 2026-10-27)

**There is no copy of any client's records. This item's backup half is open, and nothing below it is
built.** The fence half is the backup-policy piece's (below).

The box's role may only put, so it cannot restore itself: the restore runs from the human's
terminal under the human's AWS session, reads a version from S3, and sends it to the box over the
Instance Connect tunnel.

The backup's copy goes through SQLite's own backup (`VACUUM INTO`, or the shell's `.backup`), or
is taken with the service stopped: a plain tarball taken mid-write can miss saves or hold a torn
file ([the c-storage memo](memo/c-storage.md#the-file-is-the-only-copy)).

ridge, the first box, holds no real data, so the backup still waits for a signed client
([the ridge plan](plans/2026-10-28-ridge.md#left-behind)). The S3 gateway endpoint (`ops/network.yml`
holds none) and the box's put-only role (`ops/env.yml#L116`: "no instance role") come with it. Still
to do, as one piece: the copy, a restore script run from the human's terminal, and a drill that
reads a restored file, beside `ops/drill.sh`'s rows. Until a drill has read a restored file, nobody
knows a copy would be readable.

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
`--take Box`), is not a backup: no copy exists and no restore has been run.

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
([the memo](memo/c-storage.md#no-public-url-for-now)). Trigger: someone other than the human, or a
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
`Table.ScrollContainer`s, the import preview's (`ui/src/pages/client/ImportPage.tsx#L261`) and the staff list's
(`ui/src/pages/client/StaffListPage.tsx#L191`), so a field manager who opens the list on a phone sees the first
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
- **`[FIXED]` in edit-an-order (step 2: the page sends the order's stored `extra`, case 10).** **Finding 4, `ui/src/pages/client/OrderPage.tsx#L117`:** every save sends `extra: {}`, a draft's re-save
  included, and the BFF stores it as given (`bff/src/routes/orders.ts#L274`); nothing writes an order's
  `extra` yet, so nothing is lost today. *Fix:* send `existing?.doc.order.extra ?? {}`, as
  `ui/src/pages/client/PersonPage.tsx#L328` merges into the stored one.
- **`[FIXED]` in edit-an-order (steps 2 and 4: the page draws a saved draft at its saved prices and marks a moved line, and a save reprices it, so the page's total and the request's agree).** *Fixed by that earlier piece on 2026-11-07, not by money-defects; the money-defects piece (2026-11-08; it was thought still open from `docs/client-readiness.md`) built nothing for it and only re-read the code and corrected the stale prose (recap `docs/recaps/2026-11-08-money-defects.md`). The form draws a saved draft at its saved prices and marks a moved line (`ui/src/pages/client/OrderPage.tsx#L89-L92`), a moved price alone makes the save worth making (`#L106`), and the moved price is shown (`#L219-L222`).* As filed: **Finding 5, `ui/src/pages/client/OrderPage.tsx#L85-L89` and `bff/src/routes/orders.ts#L303-L317`:** the form prices a
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
- **Finding 4, `bff/src/routes/orders.ts#L473-L483` and `ui/src/pages/client/MyDeliveryPage.tsx#L73-L76`:** when only the order's write fails, deliver answers 503 and the phone says "Not sent" for a request it delivered. *Fix:* treat the fulfil write as best effort, catch it, answer 200, and change `bff/src/routes/deliveries.route.test.ts#L242` to expect 200.
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
- **Half `[FIXED]` in money-defects (`f6a12579`, 2026-11-08); the page's reload stays open on purpose.** *The closer is now read before the first write, so a gone person stops the close with nothing cancelled. The `catch` calling `loaded.reload()` was out of this piece's scope and stays open; the 409 wording still blames a delivery.* As filed: **Finding 5, `ui/src/pages/client/DriverDayPage.tsx#L69-L72`, `bff/src/routes/reconciliations.ts#L109-L130`, `ui/src/fake.ts#L449-L486`:** a close that stops part way leaves the page showing requests it already cancelled, and its retry meets a 409 whose words blame a delivery; the fake's 503 moves nothing, so it differs from the stack. *Fix:* read the closer before the first write; in the page's `catch` call `loaded.reload()` too.
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

The page's half of the case table's rows 5 and 7 has no test. Lines: `ui/src/pages/operator/RootPasswordPage.tsx#L61` (the catch), `ui/src/pages/operator/RootPasswordPage.test.tsx#L124` (the 503 test to copy). *Fix:* one test with the fake's `setRootPassword:403` cue, asserting the "not changed" alert and that the code and passwords are still typed.

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

## 84. The demo company can wear steel — the machine; `[DEFERRED]` (palettes, plan step 4, review, Opus, 2026-11-04, Info)

The demo script draws a client's colour from seven (`scripts/src/demo/company.ts#L5`); one is steel's shade 7, so such a company shows Steel checked in Settings, as meant. The other six are no stock shade and check none.

## 85. The legacy's lookup also takes a palette's name — the machine; `[DEFERRED]` (palettes, plan step 4, review, Opus, 2026-11-04, Info)

`ui/frame-mock/frame.js#L44` matches a palette's name as well as its shade 7, so moving a legacy client's data needs each name turned into its shade 7.
*Trigger:* the first legacy client's data move.

## 86. The services walk's sv-5 does not move with a palette — the machine; `[DEFERRED]` (palettes, full run, 2026-11-04, Info)

The full run named "sv-5-unavailable" and moved 0 of its 6 pictures, so 210 pictures were committed, not the plan's 216 (log line "named, not moved: sv-5-unavailable" in `20261104-1447-palettes-full-run.log`). It is right: the screen is `Boot` in its unavailable state (`ui/src/frame/Boot.tsx#L19-L39`), a red alert, a title and a Retry button, and the button draws shade 7 only (`ui/src/theme.ts#L109`), which is the colour itself in the mix and in steel's own ten. Nothing on it draws another shade.

## 87. A lane's child could not set its process group — the machine; `[DEFERRED]` (palettes, full run, 2026-11-04, Info)

The run printed "walk/run.sh: child setpgid (11085 to 11085): Operation not permitted" (`20261104-1447-palettes-full-run.log`, line 996), in lane 2's driver walk, which still passed 6 of 6 and exited 0. A lane's child could not set its own process group, so the stop path's KILL may not reach that group. Harmless here. *Trigger:* the next piece touching `walk/run.sh`.

## 88. A named screen that does not move reads green — the machine; **Done (walk-machinery, step 3, 2026-11-06)**; was `[DEFERRED]` (palettes, full run, 2026-11-04, Info)

`ops/full-run.sh`'s verdict line lists the asked `--moved` names, not what moved (`20261104-1447-palettes-full-run.log`, line 1821): it listed 36 where 35 moved. *Trigger:* the next piece touching `ops/full-run.sh`.

**Done (walk-machinery, step 3, 2026-11-06).** The verdict line now reads run 1's `full-1 to the bases` compare lines and names the screens that moved, the screens that are new, and the named screens that were seen and moved nothing; the asked list is printed as `asked`. The counts still decide the exit. Row 4 in `ops/test.sh`.

## 89. `person.signIn` is left unused — the machine; **Done (staff-fields, 2026-11-05)**; was `[DEFERRED]` (staff-cards, plan step 5, review, Opus, 2026-11-04, Low)

The key `person.signIn` ('How they sign in' / 'Cách đăng nhập') stays in `ui/src/i18n/en.ts#L403` and `ui/src/i18n/vi.ts#L404` after the sentence moved into the first card. Nothing reads it, and the missing-key test cannot catch an unused key. *Fix:* delete both lines when the files are next touched.

**Done (staff-fields, `ed30369`, 2026-11-05).** Both lines are deleted; no reader was left.

## 90. The frame draws its side column even when empty — the machine; **Done (customer-cards, 2026-11-05)**; was `[DEFERRED]` (staff-cards, plan step 5, review, Opus, 2026-11-04, Low)

`ui/src/parts/DetailCards.tsx#L12` always draws `side`. A viewer who gets no side panel (photo field off, neither root nor allowed to delete) sees the details at 7/12 beside a blank. *Trigger:* the first detail page that takes the frame. *Fix:* make `side` optional and give `main` the full 12 when it is absent.

**Done (customer-cards, `a71e6a1`, 2026-11-05).** The fix is the one named: `side` is optional and `main` spans 12 when it is absent (`ui/src/parts/DetailCards.tsx#L12-L13`), held by `ui/src/parts/DetailCards.test.tsx#L12-L20`; the customer with no note is its first live case. What is left of the symptom — a side passed but empty — is item 99.

## 91. Eight walk specs press a loading button and take a picture with no wait for its loader — the machine; **Done (walk-machinery, step 6, 2026-11-06)**; was `[DEFERRED]` (staff-cards, full run, 2026-11-04, Info)

Found while fixing the services walk (`926c1b2`): `operator-services` sv-5 and its sign-in at `#L202`, `operator-passkeys`, `operator`, `operator-team`, `operator-root-password`, `driver`, `lists` and `orders` press a `loading` button and take a picture with no wait for its loader. All green so far. *Fix:* the wait for any button loader belongs inside `at()` itself (`walk/support.ts`), so no spec can forget it. *Trigger:* the next walk piece, or the next flake.

**Done (walk-machinery, step 6, 2026-11-06).** `shot()` in `walk/support.ts`, the one picture-taker, now waits for no `.mantine-Button-loader` on the page before it parks the pointer and takes the first shot; the services walk's own local waits are left as they are. The count is of loaders mounted, not visible: a loader whose exit has not finished stays mounted at opacity 0 (Mantine's Button keeps it through the exit transition, and Playwright reads opacity 0 as visible), so the services walk, whose clock is paused, advances it with its own `settled()` before sv-3, sv-4 and sv-5 as it already did before sv-1 and sv-2 (the review's High; the advance moves the clock 500 ms and a loader at opacity 0 draws nothing, which step 8's run must confirm: no base moves). Blast radius: a break shows at once on every walk, as a red naming the screen (`<screen>: a button's loader is still on the page`), and deleting the one line in `shot()` reverts it, the three `settled()` lines being harmless without it. The proof is the full run (step 8): every base must come back unmoved.

## 92. The card's avatar condition is untested — the machine; `[DEFERRED]` (staff-list, review, Opus, 2026-11-04, Low)

The photo-off and photo checks read the table row only (`ui/src/pages/client/StaffRecord.test.tsx#L67-L70`, `#L565`); the phone card's avatar condition has no test of its own. *Fix:* the same two checks scoped to the card, when the card is next touched.

## 93. At 992 the last filter select wraps — the machine; `[DEFERRED]` (staff-list, second look, 2026-11-04, Low)

At 992 px of screen width the content is 710 px and the last select wraps; the five filters sit on one line only from about 1166 px. The human's looks were at 1280 and the phone. *Trigger:* the next look at a tablet; say so then, it is known.

## 94. White on the brand shade 7 is under 3:1 on the menu mark and about 3:1 on the header and button — the machine; `[DEFERRED]` (white-frame, plan, 2026-11-04, Info; widened by the sign-in look, 2026-11-05)

One pairing fault, line 54's own (the old app's colours kept as they are), not the sign-in look's and not line 60's. It shows in two places. (1) On the white menu the open page's mark (brand shade 7) falls under 3:1 for terracotta, autumn, olive and coin (2.72 to 2.99); kept as decided, since the page's name carries the meaning. (2) The sign-in mock measured the same pairing wider: white text on the header and on the primary button, as the app draws them, is 2.84 to 3.40:1 across six palettes, the four above plus sandstone and ocean — terracotta 3.12, sandstone 3.32, autumn 2.84, olive 3.10, ocean 3.40, coin 3.05 (`one-off/20261105-1755-signin-look-round-1/check.log#L16-L17`, `#L19-L20`, `#L23-L24`, logged as notes "white on <palette>'s shade 7"). The other palettes sit at 4.91 to 6.38. The human was given the recommendation to leave the pairing as it is and answered with their yes on the look (18:12), so this is a record, not a pending fix. *Trigger:* a client on one of the six asks, or a contrast pass over the palettes (the fix would be a darker shade for the fill, or dark text on the light palettes).

## 95. The icon strip's tip is tested by the CSS file's text, never drawn — the machine; `[DEFERRED]` (white-frame, review, Opus, 2026-11-04, Low)

The strip's tip on `:focus-visible` is held by a test that reads `ui/src/frame/frameLook.module.css` as text, since jsdom has no computed styles; a browser check would be the first to see it drawn. *Trigger:* the first browser check of the app, or the next change to the strip.

## 96. The start, birth and address values are checked in the browser only — the machine; `[DEFERRED]` (staff-fields, review, 2026-11-05, Low)

The BFF stores `extra` untouched (`shared/src/extra.ts#L3-L5`), so a stored non-day shows as a blank date input and is re-sent unchanged (`ui/src/parts/personalFields.tsx#L23`). The company's own date field behaves the same, so this is consistent, not new. *Fix:* a day check on the three keys in the BFF's save of a person, about a route test and ten lines; *trigger:* a second client that writes `extra` (an import of the dates, or a partner's tool).

## 97. The day check's production path is nearly unreachable on these two fields — the machine; `[DEFERRED]` (staff-fields, review, 2026-11-05, Low)

A real browser's date input never yields a day that is not one, so `dayIsValid` (`shared/src/fields.ts#L117`) guards an older browser's text fallback; it is right and covered, and its refusal is tested with the input made a text input. *Cost:* none to keep; *trigger:* none, noted so a reader does not look for the path.

## 98. The customers and the products have no detail page to re-lay — the machine; **Done (products-cards, 2026-11-06)**; was `[DEFERRED]` (customer-cards, plan, Opus, 2026-11-05, Info)

The campaign reads "each remaining detail page onto the old app's two columns", but both lists are a list page and an Excel import only (`ui/src/ClientApp.tsx#L367-L379`): the customer's page is built new in this milestone, and the product's will be in the next, from the list reply with no server work. Only the order has a page already (`ui/src/pages/client/OrderPage.tsx`). *Trigger:* sizing the products milestone — it is a new page, not a re-lay, and its own column set (unit, price, stocked) is not the customer's.

**Done (products-cards, `02bbebc`, 2026-11-06).** The trigger was met: this milestone's plan sized the product's page as a new page with its own columns, and the page is built (`ui/src/pages/client/ProductPage.tsx`, `/products/:id` at `ui/src/ClientApp.tsx#L383-L386`). Both lists now have a detail page, so nothing of the campaign's "re-lay" reading is left unsized; the order's page, already there, is lane B's.

## 99. An empty side still draws its column — the machine; **Done (orders-cards, 2026-11-06)**; was `[DEFERRED]` (customer-cards, review, Opus, 2026-11-05, Low)

Item 90's fix reads `side !== undefined` (`ui/src/parts/DetailCards.tsx#L13`), so the two other ways a page says "nothing here" still draw a blank 5/12 column: `side={null}` and the usual `side={has && <Card />}`, which is `false` when `has` is false. The person's page passes a `<Stack>` that is always defined (`ui/src/pages/client/PersonPage.tsx#L552`), so a viewer with no photo field, not the root and not allowed to delete still reads the details at 7/12 beside a blank — the case item 90 opened. *Fix:* treat a falsy side as absent, or have the person's page pass `undefined` when every panel is out; line 58's milestone 2 is in that file. *Trigger:* the next detail page or the next change to the person's page's side.

**Done (orders-cards, `d96f810`, 2026-11-06).** Of the two fixes named above this build took the first: a falsy `side` counts as absent (`ui/src/parts/DetailCards.tsx#L11`, `#L14-L15`), held for `null`, `false` and `undefined` alike by `ui/src/parts/DetailCards.test.tsx#L34-L43`. That closes the two shapes this item opened with — `side={null}` and the usual `side={has && <Card />}` — and the order's page is the live proof: a new order passes `side={existing && <OrderActions/>}`, which is `null` there (`ui/src/pages/client/OrderPage.tsx#L256`), and the built screen draws one column at 100 %. **The second fix was not made, so the case this item was opened for survives the fix that closes it:** the person's page still passes an always-truthy `<Stack>` (`ui/src/pages/client/PersonPage.tsx#L552-L553`), so a viewer with no photo field, neither the root nor allowed to delete, still reads the details at 7/12 beside a blank half. That residue is **item 106**, where it is now held with its own fix and trigger — read the two together before believing the blank half is gone everywhere.

## 100. The walk and the page disagree on what "has a note" means — the machine; **Done (products-cards, 2026-11-06)**; was `[DEFERRED]` (customer-cards, review, Opus, 2026-11-05, Info)

The walk picks its two customers by `'note' in one.extra` (`walk/specs/lists.spec.ts#L18-L19`, `visual/src/walks.ts#L183-L184`), while the page draws the Note card on the text being non-empty (`ui/src/pages/client/CustomerPage.tsx#L19`, `#L68`). A customer whose `note` is `''` or not a string would be the walk's "noted" one and show no Note card, so screen 10 would fail on a heading that is correctly absent. The data set has no such customer, so nothing fails today. *Fix:* pick by the same rule the page uses. *Trigger:* a change to the data set's customers, or a second page that draws a conditional card.

**Done (products-cards, `02bbebc`, 2026-11-06).** The fix is the one named: all four pickers read a `hasNote` of "a string that is not empty", the page's own rule — `walk/specs/lists.spec.ts#L17-L19`, `visual/src/walks.ts#L181-L183`, `visual/src/words.test.tsx#L26-L28`, and `visual/src/walks.test.ts#L668`, whose opener check no longer reads `DEMO_CUSTOMERS[0]` by index. The customers' two records are unchanged by the new rule (only `KH-001` carries a `note`, and it is a non-empty string), which step 2's picture compare proves: 118 screens against `main`'s 116, with screens 10 and 11 byte-identical. What is left — the rule written out four times with nothing shared — is item 105.

## 102. The QR landing card's heading sits outside the announced region — the machine; `[DEFERRED]` (signin-look, review, Opus, 2026-11-05, Low)

`ui/src/pages/client/QrLanding.tsx#L34` moved `role="status"` from the card onto the inner `Stack`, so the heading ("Signing you in" / "This code cannot sign you in") now sits outside the announced region and a screen reader hears only the body text and the button. Every word is unchanged and no test or walk reads the region. *Fix:* move the one attribute back to the element that holds the heading. *Trigger:* the first accessibility pass over the doors, or the next change to `QrLanding`.

## 103. A door draws the client's logo, the shell does not — the machine; `[DEFERRED]` (signin-look, review, Opus, 2026-11-05, Info)

A door draws `brand.logo` when there is one (`ui/src/pages/SignIn.tsx#L74-L78`), while `Shell` draws its generic mark unconditionally and never reads `brand.logo` (`ui/src/frame/Shell.tsx#L145-L147`), so a client with a logo sees its logo on the door and the generic mark one click later. `Shell` was outside this piece's bound and the human approved the mock's choice at 18:12. *Fix:* have `Shell` draw `brand.logo` when there is one, as the door does. *Trigger:* the first client with a logo, or the next change to `Shell`'s header.

## 104. The words test's BEFORE table was written by hand, not rendered from the old doors — the machine; `[DEFERRED]` (signin-look, review, Opus, 2026-11-05, Info)

Case 8's `BEFORE` table (`ui/src/i18n/words.test.tsx#L10-L11`) was hand-written from the doors as they then read, not rendered from `c759c43`, so it pins the words firmly from now on but did not itself prove the rewrite changed no word; the reviewer hand-checked three entries (`qr-busy`, `signin-refused`, `operator-notgiven`) and they matched. *Fix:* render the doors at `c759c43` once and compare the table to the output. *Trigger:* a doubt about a door's wording after this piece, or the next rewrite of the doors' markup.

## 105. One rule for "has a note", written out six times — the machine; `[DEFERRED]` (products-cards, review, Opus, 2026-11-06, Low)

Item 100 is closed by making every picker read the page's rule, but each reads its own copy of it: `walk/specs/lists.spec.ts#L18-L19`, `visual/src/walks.ts#L183-L184`, `visual/src/words.test.tsx#L27-L28`, the inline pair in `visual/src/walks.test.ts#L668`, and a fifth shape in the unit test, `ui/src/pages/client/ListPage.test.tsx#L12` with `#L240` and `#L301`. The pages themselves hold the sixth, as the truthiness of `textIn` (`ui/src/listSheet.ts#L63`, used at `ui/src/parts/ProductForm.tsx#L55` and `ui/src/parts/CustomerForm.tsx#L34` and `#L36`). Nothing fails today — all six agree — but the next change to what a page counts as a note (a trim, say, so that a note of spaces draws no card) moves one and leaves five, and the red appears only in the human's full picture run, where a walk opens the record it still calls noted and waits for a heading that is correctly absent. *Fix:* export the rule once beside `textIn` (`noteOf`, or `hasNote` taking `extra`) and add `./lists` to `ui/package.json`'s exports, which today offers `./import-demo`, `./mock`, `./scene` and `./words` only; the walk and the visual package already import `@credo/ui/words`, so both can take it. *Trigger:* the next change to how a page decides to draw a conditional card, or a seventh copy of the rule.

## 106. The person's page can still draw a blank half, and no test says so — the machine; `[DEFERRED]` (orders-cards, review, Opus, 2026-11-06, Low)

Item 99 is marked done on the first of the two fixes it named, and this is the second, unmade: the case that item was opened for is still live. The person's page passes `side={<Stack>…</Stack>}` (`ui/src/pages/client/PersonPage.tsx#L552-L553`), an element that is always truthy, and every panel inside it is conditional (`#L554`, `#L564`, `#L567`, `#L577`, `#L587`, `#L590`). A viewer who is not the root, may not delete and has no photo field gets an empty `Stack`, so `DetailColumns` still draws the details at 7/12 beside a blank 5/12 — the symptom item 90 opened. No screen shows it: of the 116 built screens 40 draw a 5/12 column and none of them is empty, so the fix would move no picture. Nothing tests the case either: only `ui/src/parts/DetailCards.test.tsx` and `ui/src/pages/client/OrdersPages.test.tsx` read a grid column, so the person's page's own tests (`ui/src/pages/client/StaffPages.test.tsx`) never count its columns. *Fix:* have the page pass `undefined` when every panel is out — one `const` over the six conditions — with a test for that viewer; or, narrower, let `DetailColumns` count an element with no rendered children as none. *Trigger:* the next change to the person's page's side, or a client whose office staff are neither root nor deleters.

## 107. The new column tests count every grid column in the document — the machine; `[DEFERRED]` (orders-cards, review, Opus, 2026-11-06, Info)

`columnOf` and `columnCount` (`ui/src/pages/client/OrdersPages.test.tsx#L349-L353`) query `document` for `.mantine-Grid-col`, so they hold only while the page's frame draws no other `Grid`. They are right today and read the real class the component emits, which is the point; but a `Grid` added to the shell or a banner would turn the column *indexes* wrong rather than merely failing, and the message would point at the order's page. *Fix:* scope both to the page's own grid (the `.mantine-Grid` nearest the found heading). *Trigger:* a `Grid` added to `ui/src/frame/Shell.tsx`, or the next page to copy these helpers.

## 108. Two full runs can overlap: the lock is refused on, never taken — the machine; **Done (walk-machinery, step 2, 2026-11-06)**; was `[DEFERRED]` (walk-machinery, plan, 2026-11-06, Medium)

`ops/full-run.sh` refused on the gate lock and took none, since `walk/run.sh` refuses a run while that lock exists; its only guard against a second full run was `walk/run.sh`'s refusal while a credo process lives, and the compare step starts none (13m50s on 2026-11-06, unguarded). **Done (walk-machinery, step 2, 2026-11-06).** The full run takes `.full-run-lock` (a folder made with `mkdir`, atomic, as the gate lock is) after its refusals and releases it at the end, on every red path and on an interrupt; `--check` takes none and the gate lock still refuses first. A lock left behind is refused on, never cleared by the script: the refusal names the owner (pid, start time, walks) and prints the one command that clears it. The rows are in `ops/test.sh`, "ops/full-run.sh's run lock".

## 109. The compare step says neither the time nor the load of each comparison — the machine; **Done (walk-machinery, step 4, 2026-11-06)**; was `[DEFERRED]` (walk-machinery, plan, 2026-11-06, Low)

`walk/run.sh`'s compare step printed no elapsed time or load: 1m50s in one run against 13m50s in the next on the same work, and nothing in either log says why. *Fix:* step 4 of the walk-machinery plan stamps each comparison with its elapsed time and the Mac's load, as `pass_of` does.

**Done (walk-machinery, step 4, 2026-11-06).** `compare_stamp` prints `-- compare <label> (load N; elapsed XmYYs)` before every comparison, in the shape of `pass_of`'s line, so the lines either side give each comparison's own time. No verdict reads the line. Held in `scripts/src/walk-run.test.ts`.

## 110. One stalled walk blocks the bases of every other walk — the machine; **Done (walk-machinery, step 5, 2026-11-06)**; was `[DEFERRED]` (walk-machinery, plan, 2026-11-05, Medium)

`walk/run.sh` writes the bases all or nothing: one stalled pass discarded three green walks' 156 pictures (27m24s, `20261105-1934-walk-piece-1-piece-2-operator-passkeys.log`). *Fix:* step 5 of the walk-machinery plan writes each walk's bases on its own reads; a red walk, or a lane that ended red, is left untouched and the run still ends red.

**Done (walk-machinery, step 5, 2026-11-06).** `walk/run.sh` keeps the walks whose own passes or comparisons were red, and every walk of a lane that ended red, in `red_walks`, and writes the bases of the others; the red ones keep their bases as they were and the run still ends red, exit 1. A red run 1 therefore leaves the green walks' new bases uncommitted in the worktree (`ops/full-run.sh` commits nothing on a red run 1, as before): the next full run refuses a dirty tree until the human decides: commit those pictures if they are good, or discard them with `git -C <worktree> checkout -- walk/specs`. Rows 6 to 8 in `scripts/src/walk-run.test.ts`.

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

## 121. The API address in front of the BFF answers anyone — the human; *partly closed* by the access log (2026-11-08): the readable half is done and live on ridge, its change set run and three lines read back (2026-11-08); the wall, a signed origin, a key or a WAF, stays *parked* until a client signs or real client data reaches a deployment (the architecture page, 2026-11-07)

*Readable half, done in the access log (`docs/plans/2026-11-08-access-log.md`):* the one stage now has an access log, `ApiLogs` at `/aws/apigateway/credo-${Env}` for 14 days, and a guard in `ops/test.sh` (`api_log_guard`) that reddens if a later change takes it away. **It is live on ridge**: the change set ran green there at 17:10 (the project's logs folder, `logs/2026-11-08-171042-stack-ridge.log`) and three lines were read back at 18:12 (`logs/20261108-1809-ridge-access-log-read.log`). **The wall is not done and stays open and parked as the human's**; this closure covers only the readable half, never the signed origin, the key or the WAF. The log does not name the client whose records were read (item 152). **More useful than written, measured 2026-11-08 18:11:** a call through the distribution left a line carrying one public address consistent with the caller's own, so a guessing run against a real client would leave its own address in the log, which is what this item wanted to be able to read; one run, cause open (item 157). As filed:

The day-one plan specified that only CloudFront would call the back end ([the architecture plan](plans/2026-10-27-architecture.md), its diagram and "Each client gets its own back end"), signed by origin access control on a Lambda function URL. Function URLs are not offered in the Region, so CloudFront reaches an API Gateway HTTP API instead ([ridge-app's call 2](plans/2026-10-28-ridge-app.md#the-humans-calls)), and the signed-origin property went with the function URL and was never regained. **Nobody decided this**: it followed from the Region's limit. Until this item, no open item and no convention recorded it — the template's own comment was the only place it was stated, and then [the architecture page](architecture.md), which is what raised it. What stands today: payload 2.0, one catch-all route, one stage, 10 requests a second with bursts of 50 and, then, nothing logged at the stage (the function's own group already held a line per request, which this item did not say); the API's address answers anyone and the throttle bounds what that costs (`ops/env.yml#L285`). The position is accepted rather than broken, on the same premise item 6 gives for deferring the backup: ridge holds no real client records, and both premises stop being true on the same day. No fix is proposed here — what a signed origin, a key or a WAF would be worth is weighed when the conditions are known. *Trigger:* a client signs, or real client data reaches any deployment, whichever comes first.

## 122. A run green in every pass is turned red by a browser that vanishes before the join, and `--write` still writes — the machine; `[DEFERRED]` (browser-guard, review of line 72, 2026-11-07, Low)

Deferred from line 72's review, not a fault of the piece. The post-join check (`walk/run.sh#L523`, `#L604`) adds a red rather than only labelling reds already collected, which was the plan's intent: a run green in every pass and comparison exits 1 if the browser vanishes in the second between the last pass and the join. `red_walks` is untouched, so `--write` still writes the bases while the run exits 1. *Trigger:* a green run turned red by that check; then make it label only.

## 123. A prune undone before the join leaves no signal — the machine; `[DEFERRED]` (browser-guard, review of line 72, 2026-11-07, Low)

Deferred from line 72's review, not a fault of the piece. `browser_lost` is set only when a pass was blocked, and the post-join check is a fresh stat, so an install that deletes and re-downloads the same revision mid-pass fails the pass silently. Harmless today. *Trigger:* a pass failing on `Executable doesn't exist` with no browser line; then record the first missing stat.

## 124. A crash between the claim's draft and its rename leaves `.claim-<pid>` in the shared folder for good — the machine; `[DEFERRED]` (browser-guard, review of line 72, 2026-11-07, Low)

Deferred from line 72's review, not a fault of the piece. `scripts/src/running/claim.ts` writes the draft beside `.links` and renames it; a crash between the two leaves `.claim-<pid>` in the shared browser folder, and nothing prunes it. It sits outside `.links`, so no install reads it. *Trigger:* a `.claim-*` file seen in the browser folder; then remove it by hand.

## 125. The generic hint on every claim failure made a revision mismatch read as two instructions — the machine; `[DONE]` (browser-guard, review of line 72, 2026-11-07, Low)

Deferred from line 72's review, folded into its Medium 1 fix: `walk/run.sh` now appends the way to write the claim only where writing was the failure, and names a walk in it because `--checks` alone is refused by the parser.

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

## 134. No rotation path for any of the four keys, and two of them are plain Lambda variables — the machine; *parked* until a key must be replaced, or before a client's own stack (the client-readiness read, 2026-11-07)

c-storage's internal key and super-admin key are made once from the kernel into a root-only file and a release
never rewrites them — one that found them changed refuses (`ops/release.sh#L91-L109`, `ops/lib.sh#L598-L601`). The
BFF's own service code and access key are made once the same way (`ops/app.sh#L100-L115`, "present, left as it is").
Nothing in `ops/` rotates any of the four: there is no script, and no order written down. The two the BFF needs sit
in the function's environment as plain variables (`ops/app.sh#L134-L140`), so anyone in the account who can read a
function's configuration reads them, which `ops/check.sh#L140` notes while taking care not to print them. Rotating
by hand means editing the box's file, re-pushing the function's environment and re-registering the service, in that
order. *Fix:* one script that does the three in order and reads back, or the order written into `ops/README.md` as
a runbook entry. Related: item 50 (how the end-of-run search handles the keys it already holds). *Trigger:* a key
that must be replaced — a leak found by the end-of-run search, or an operator leaving — or before a client's own
stack.

## 135. A clerk cannot add a customer or a product: the import is the root's alone and no page offers an add — the machine proposes the form, the human decides which right it sits under; `[FIXED]` (add records, `4552e6ea` to `cee6a814`, 2026-11-08, High; was *parked*, the client-readiness read)

*Fixed in add records (`4552e6ea` to `cee6a814`, recap `docs/recaps/2026-11-08-add-records.md`):* an Add path now exists beside the import on both lists, for whoever holds `orders.canEdit`: `POST /api/customers` and `POST /api/products` through the import's own row rule and write, an Add button on each list, and a page that copies the detail form with the code box open. **The import is still root-only**, deliberately, and a review re-proved it with a test using a person holding every permission; the closure does not open it. The right chosen is `orders.canEdit`, because the catalogue holds no `orders.canCreate` and that right already makes records on these pages. As filed:

The only way a record enters the customers or the products list is the Excel import, and the import is the
root's: `bff/src/routes/lists.ts#L141` calls `mustBeRoot`, and `ui/src/ClientApp.tsx#L393` says why in its own
comment — "Only the root imports (case-table row 22): no permission allows it." Neither list page draws an
Add, and the Import button is drawn for the root alone (`ui/src/pages/client/ListPage.tsx#L26`), so a person with
`orders.canEdit` sees no path at all, not even a refused one. That person can already *correct* a customer
and a product on its page (`bff/src/routes/lists.ts#L212`, the same right), so the gap is the add and the add only.
**What it costs a real client:** a new customer telephones, and the order cannot be taken until the owner
signs in and builds a spreadsheet. Of everything the client-readiness read found, this is the one that
blocks the first order. *Fix:* one add form a list, over the add path the import already uses
(`bff/src/routes/lists.ts`'s `addRow`), under a right the human names — `orders.canEdit`, as the correction is, is
the cheapest answer and the weaker decision. *Severity:* High for a first client; none for ridge, where the
demo seed writes both lists. *Trigger:* the first client takes an order.

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
count and re-reads *every* week from today (`ui/src/pages/client/OrdersPage.tsx#L13-L19`, `#L83`): at twelve weeks that
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
The walks page's partner sign-in by emailed code is Cloudflare's, not the product's, so it is no precedent.
*Fix:* a sender, and then the human's decision on what may leave a client's system; the staff reset is the
smallest first use and does not need one if a one-time link shown on the root's screen is accepted instead.
*Trigger:* before a client's own stack, or the first staff member who forgets a password.

## 140. The stack's generator cannot make the stale-price draft, so `scripts` goes red — the machine; `[FIXED]` (edit-an-order, step 5's whole check, 2026-11-07, High)

`shared/src/demo.ts` gives order DH-00017 a line saved at 1,800,000 where today's list says 1,900,000, so the fake lane draws it as screens 13 and 14 need. `scripts/src/generator.ts#L271`'s `replayWeek` makes every order by `POST`ing it to the BFF, which prices the lines from the list as it is now (`bff/src/routes/orders.ts#L181-L193`), so the stack's DH-00017 comes back at 1,900,000, total 3,950,000 against the data set's 3,850,000. `scripts/src/generator.test.ts#L416`, "The week of orders and requests the BFF lists is the data set's", fails on exactly that, in two whole-package runs (`logs/20261107-1941-edit-order-step5-check.log` and `logs/20261107-1952-edit-order-step5-rerun2-nobail.log`). The plan's line "both lanes take it from the one data set, so the new screens need no lane of their own" is false for the stack lane, and the stack's walk would draw screens 13 and 14 without a moved line. Step 2's gate did not run `scripts`. *Fixed in edit-an-order (`05bb852b`):* `replayWeek` sets a product to the price a line was saved at, takes the order, and puts today's price back, through the product's own route, closed in a `finally` (review fix); the stack lane thus carries the fixture and `generator.test.ts` is green unchanged.

## 141. The page's "Now X" figure is the list as read when the editor mounted — the machine; `[DEFERRED]` (edit-an-order, review of line 64, milestone 3, 2026-11-07, Low)

`ui/src/pages/client/OrderPage.tsx#L86-L92` takes the moved-price advisory from the product list read at mount, so a price moving while the page stays open shows a stale figure and a save takes another. No money diverges: the screen and the driver both carry the saved prices until a save, and the save's answer redraws the page. *Trigger:* a second office editing prices while an order is open, or a reader of a test names it.

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

`ui/src/pages/client/DriverDayPage.tsx#L108` renders `money(figures.toCollect)`. The only holder is `walk/specs/reconcile.spec.ts`, whose own `CASH` is derived from `driverDay` (`#L23`) and so is tautological on the UI side; what actually pins the rendered number is the base-image byte compare. `ui/src/fake.test.tsx#L2301`'s literal pins the fake Api's arithmetic, not the render. *Fix:* one `ui` test that mounts the page over a known day and asserts the rendered sum as a literal. *Trigger:* the next edit of the page's figures.

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

**Trigger:** a client signs, or real client data reaches any deployment, whichever comes first, the same as item 121's wall. *Fix, a sketch and not a design:* join the two trails on one id, or have the BFF log the client's code on a read, whichever the reading shows is cheaper.

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

*To decide, not decided here:* (1) who the addresses are acceptable to, and who may read the group; (2) whether a client must be told its API's callers' addresses are kept; (3) whether 14 days is the right retention. *Also open, smaller:* why the field shows the caller and not an edge node, when `$context.identity.sourceIp` is documented as the immediate connection's address; one run, one caller, one network, and no mechanism is claimed. *Trigger:* before a client signs, or before real client data reaches a deployment, whichever comes first, the same as item 121's wall.

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
| the three screen widths are declared once | one exported set in `shared/`, replacing `visual/src/walks.ts#L26`, `walk/support.ts#L9`, `ui/src/mock/MockPage.tsx#L16`, `ui/src/mock/Frame.tsx#L8` — and retiring the regex in `visual/src/walks.test.ts` that reads one of them as source text |
| the retry bound is one number | one export imported by `bff/src/records/staff-records.ts#L58`, `operators.ts#L21`, `orders.ts#L48`, `sessions.ts#L27` |
| the next route in the two big modules goes in its own module | an eslint `max-lines` on `bff/src/routes/staff.ts` and `bff/src/routes/orders.ts` (single closures of 629 and 453 lines) |
| the shellcheck glob covers every tracked script | a test comparing `.github/workflows/ci.yml#L197`'s glob with `git ls-files '*.sh'` (item 161 is the two it misses today) |
| one `refuse()` and one log opener, one shebang | two greps in `ops/test.sh`: `ops/lib.sh#L75`'s opener used by all seventeen scripts, and `#!/usr/bin/env bash` on each — four scripts the human runs by hand pin `#!/bin/bash` (bash 3.2) and define `refuse()` separately, one of them already using newer-bash arrays |
| no client is named in shared code | a grep in the gate, as the divergence rule's mechanical test |
| a walk has one identity | `walk/playwright.config.ts#L30-L96` derives its projects from the table at `walk/run.sh#L45-L57`, or one test fails when the two disagree |

## 161. Two scripts that are themselves gates are read by no tool, and two comments in one of them say the opposite — the machine; `[OPEN]` (the 2026-11-08 structure review, 2026-11-09, Medium)

`services/c-storage/scripts/cover.sh` (the coverage gate, 70 lines) and `services/c-storage/scripts/e2e.sh` (the
end-to-end gate, 138 lines) fall outside the repository's one ShellCheck invocation
(`.github/workflows/ci.yml#L197`, glob `ops/*.sh walk/*.sh`), outside lint and outside the
formatter, so 19 of 21 tracked `.sh` files are checked and these two are not. Worse, `cover.sh#L29`
and `#L37` carry suppression comments written for a checker that never reads them, telling the next
reader the opposite of the truth. The small Node file that proves a request run actually asserted
something (`services/c-storage/scripts/bruno-proof.cjs`, three callers) is read by no tool either. *Fix:* add
`services/c-storage/scripts/*.sh` to `ci.yml#L197` and to `ops/README.md#L569`, one line each, then delete or
correct the two comments. *Trigger:* none needed; it is one line and a read.

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

`ui/src/pages/client/OrdersPage.tsx#L14` makes one call per week and `weeks` is state (`#L28`), so "7 more days"
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

## 202. The architecture page is past one sitting, and the activity-log section is the split — the machine; **Done (the architecture page rearranged for a person, 2026-11-09)**; was `[OPEN]` (the architecture page's audit-backbone section, 2026-11-09, Low)

[`architecture.md`](architecture.md) is 594 lines and about 6,731 words now that the activity log is on it, and [`CLAUDE.md`](../CLAUDE.md) makes its `## At a glance` part of every session's opening, so its length is paid by every session that starts. *Recommended:* move `## The activity log: intended, and not built` into a page of its own and leave the architecture page pointing at it, as it points at the day-one plan. **Trimming is not the answer — moving is:** every paragraph of that section is a measured fact, a decision with its price, or a hazard no gate catches, which is what the documentation convention asks a doc to hold. *Trigger:* the piece that builds the actor change, which is the first thing that will read it.

**Done (the architecture page rearranged for a person, 2026-11-09).** The section was carried whole into [`activity-log.md`](activity-log.md) — nothing shortened, its own "what this page did not read" written for it — and `architecture.md` points at it as it points at the day-one plan. The move was made inside a larger rearrangement the human asked for after reading the page: "the only thing a human can read is the diagram". The page now opens with one sentence, the diagram, one request walked end to end and a one-line codemap, with the detail below a line; it is 506 lines against 594, and the detail it lost went to the nine packages' own `CLAUDE.md` files rather than being trimmed. The root [`CLAUDE.md`](../CLAUDE.md)'s reading instruction was rewritten in the same change, since the per-package sections it named no longer exist.

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

`ui/src/pages/client/RecordPage.tsx#L76-L79` and `ui/src/pages/client/AddRecordPage.tsx#L84-L87` each hold a `Record<ListKind, …>` whose entry for a kind builds the page from a spec: `customers` takes the customer spec and `products` the product spec. The record is keyed by the kind, so a kind with no entry is a type error, but nothing ties an entry to its own spec: `customers: (kind, page) => <Record kind={kind} spec={PRODUCT} …/>` typechecks, and the kind then draws the other kind's form and words. The convention's "not a screen that silently draws the wrong one" (`docs/conventions/code.md`, C3) is therefore true for a *missing* entry and not for a *mis-paired* one. *Fix:* needs type design rather than a line, for example a spec that carries the kind it answers for and an entry that checks it, so this piece is not the place. *Trigger:* the third kind, or the first edit to either record.

## 208. The local-env plan took the front and the seed door for children; they are servers inside the starting process — the machine; `[OPEN]` (the local environment's first step, 2026-11-10, Medium)

`scripts/src/stack.ts` starts only c-storage and the BFF as processes; `createFront` and `createSeeding` are `http` servers in the process that called `withStack`. The plan's step 1 (`keepOnExit` on `startProcess`) would have left c-storage and the BFF standing and the front dead as `up` returned, so its done-when (`curl` on 3180 from a second shell) could not hold. Step 1 was built with a keeper process instead (`scripts/src/local.ts`, `local keep`): it holds all four parts and is the only process started with `keepOnExit`. Steps 2 and 5 read the handle's `keeper` pid, and the seed door's status is the keeper's. Nothing here is run detached by the build: the real reading is the human's.

## 209. The teardown's read-back checks three paths, not the whole environment folder — the machine; `[OPEN]` (the local environment's review, 2026-11-10, Low)

`down` (`scripts/src/local.ts`, the read-back at the end of `down`) reads the data folder, the build folder and the handle, not `.local-env` as a whole, so a file left in the folder beside them (the keeper's log, for one) is not named when the removal half-failed. The removal itself is of the whole folder, so only the naming is short.

## 210. A zombie child can stall the teardown of an already-dead stack — the machine; `[OPEN]` (the local environment's review, 2026-11-10, Low)

`down` asks a process whether it is alive with `kill(pid, 0)`, which also succeeds for a zombie that has ended but not been reaped; the stop loop (`scripts/src/local.ts`, the wait after the signal) then waits out the whole settle time and ends red naming a process that is already dead. It resolves once the parent reaps it.

## 211. The ownership matchers are substrings, so another checkout's process could match on an exact pid collision — the machine; `[OPEN]` (the local environment's review, 2026-11-10, Low)

`down` signals a pid only when its command line contains `local-main.ts`, the build folder's `c-storage` path, or `bff/src/main.ts` (`scripts/src/local.ts`, the ownership matchers in `down`). The first and the last are not specific to this checkout, so another checkout's keeper or BFF that took a handle's pid after its process died would be signalled. It needs an exact pid collision with a live process of the same shape.

## 212. The staff walk's test titles say thirty-three screens; it walks thirty-four — the machine; `[OPEN]` (the ui shape piece's picture run, 2026-11-10, Low)

`walk/specs/piece-2.spec.ts` names its tests "walks all thirty-three screens" (the title in the loop at the end of the file) and its header comment counts thirty-three (A's sixteen, B's seven, C's six and D's four, 33 × 2 × 3 = 198). Its committed pictures are `walk/specs/piece-2.spec.ts-snapshots/`, six a screen (two languages at three widths), 204 files naming 34 distinct screens, and the picture run compared 204. So a screen was added and the count was left. The verdict is untouched (the bases hold the same 204); the fault is a title that miscounts its own subject and later reads as evidence. *Fix:* correct the title and the comment's arithmetic, or say which group gained the screen.

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

## 228. The test photo in the cross-company tests is a third copy of one value — the machine; `[DEFERRED]` (the cross-company tests' review, 2026-11-11, Low)

`PHOTO` in `bff/src/routes/cross-tenant.route.test.ts` is a third copy of the same test photo, after `bff/src/routes/reconciliations.route.test.ts` and an inline one in `bff/src/routes/orders.route.test.ts` (code.md's C1, one home for a value). Fix: export it once from `bff/tests/orders.ts`. *Trigger:* the next change to any of those three test files.

## 246. The terminal scripts reach a company's records with the whole store, so the pooled shape must route them too — the machine; `[OPEN]` (the one-company storage client's plan, 2026-11-11, Medium)

The back end's calls for one company go through that company's client once the one-company storage client lands (`docs/plans/2026-11-11-store-one-company.md`), but the scripts build a company's keys and call the whole client themselves: `scripts/src/demo/apply.ts`, `scripts/src/demo/apply-support.ts`, `scripts/src/demo/ledger.ts` and `scripts/src/root-password.ts` (a search of `scripts/src` for `recordKeys.tenant(` and the record helpers). Today one service holds every company, so they reach the right records. In the pooled shape a company's records sit on the box its index names, and each of these must find that box first, or it writes to the wrong one. `scripts/src/ridge.ts` and `scripts/src/generator.ts` reach a company only through `@credo/bff/clients`' `createClient` and `deleteClient`, and follow the back end without a change. *Fix:* the pooled shape's plan routes each script through `tenantStorage` over the company's box. *Trigger:* that plan.

## 241. The log count misses a bare name in Markdown dress and one elided with an ellipsis — the machine; `[DEFERRED]` (the dead log citations' review reread, 2026-11-11, Low)

The bare-name shape (`LOG_NAME` in `scripts/src/citations.ts`) excludes `*` and `_` before a name, so a name written in bold, in stars or in underscores is not counted. A bare name led by an ellipsis (`…` or `...`) is not counted either, though the comment above `logCitations` and the account `describeLogs` prints both say it is; a plain grep for such names finds 38 on the tree of 2026-11-11, and the review counted 31 outside the pinned 456 (the two counts were not reconciled, and a grep for the dressed names found none today). A bold path with a `#L` fragment counts 0, because the trim `WITH_EXTENSION` stops at the `#`. The paragraph under "Nothing machine-local" in `docs/conventions/documentation.md` says the test lists every `logs/` path and every bare log name, which is more than the count does. *Fix:* let `*` and `_` stand before a bare name and trim them after it, let a bare name start with an ellipsis, trim the dress after a `#L` fragment, re-pin `scripts/src/log-citations.pinned.txt`, and reread every case the earlier shape caught. *Trigger:* the next change to the citation check, or the first new citation in these shapes.

## 242. The log count's pin has small gaps in how a red reads — the machine; `[DEFERRED]` (the dead log citations' review reread, 2026-11-11, Info)

A row cited twice in one document is the one shape where two branches each removing one copy can merge as a single deletion and leave a red neither had. A file name ending in `.log` written in prose for a different reason, such as a call on the console, would now count as a citation, and the red's advice to take it out would be wrong for a convention that names it; no such convention exists today. Two names still call `docs/open-items.md` "the log": the progress bullet in the At a glance of `docs/conventions/documentation.md` ("the to-do log") and a link in `.claude/skills/session/SKILL.md`, which sits one row from the rule that a record names no log. *Fix:* give a repeated row its count in the list, let the red's advice name the other cause, and rename the two mentions to "the open items". *Trigger:* the next change to the citation check, or the first convention that names such a file.

## 301. A revert of what production runs waits for `pre-merge`'s whole check, which runs at most every two hours — the machine, by the conventions kind; *parked* until the production plan's rehearsal reads the way back's minutes (the production plan, 2026-11-12)

The way back from a bad release is a revert that travels the whole path: the piece's branch,
`pre-merge`, the whole check, `main`, the human's push, ridge's deploy, then the production lane
([the plan](plans/2026-11-12-production.md#hazards-no-gate-catches)). `docs/conventions/qa.md`'s
"The whole check on `pre-merge`" runs that check at most once every two hours, so a revert landing
soon after a run waits up to two hours before `main` may move. Fix: one line in that section, that a
revert of the commit production runs starts the whole check at once, outside the two-hour cadence.
*Trigger:* the rehearsal's minutes, or the first real revert of a production release.

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

## 296. By hand, `ops/release.sh` and `ops/app.sh` ship any commit of `main` to production, one ridge never ran included — the production lane; `[OPEN]` (the safe scripts' plan, 2026-11-12, Medium)

Both refuse a commit `main` lacks and one older than what the environment runs (`ops/release.sh#L42`, `#L67`; `ops/app.sh#L48`, `#L92`), and nothing more. The final architecture ships to production only a commit ridge has already run and checked, by the human's own act; the deploy job is the lane's to hold to that, and the by-hand path, used while GitHub Actions is down, holds nothing of it. *Fix:* the production lane decides how a commit reaches production and holds the by-hand path to the same rule, or refuses it there. *Trigger:* the production lane's plan.

## 297. `ops/stack.sh` rewrites an environment's GitHub environment on every run, and whether production's protection rules survive it is unread — the production lane; `[OPEN]` (the safe scripts' plan, 2026-11-12, Low)

Each `ops/stack.sh env <name>` run sends a body naming a branch policy and no reviewers (`ops/stack.sh#L296-L298`). If production's act rests on rules set on its GitHub environment (required reviewers, a wait), a later stack run may clear them; GitHub's own words on what an update keeps were not read. *Fix:* read GitHub's page (the fetch kind), then keep the rules the update would drop, or set them in the same call. *Trigger:* the production lane choosing a protection rule.

## 314. Ridge's teardown has a terminal script, and still no workflow to press it — the machine; *parked* until the human brings the workflow back (ridge cycle, 2026-11-12)

`ops/destroy.sh ridge` and `ops/remake.sh ridge` now take ridge down and back up from a terminal ([the runbook](../ops/README.md#ridge-down-and-back)). What stays parked is the workflow half. The human's word on the deploy ideas page, 2026-11-10: "For the teardown part, let skip it from github action for now (will add later)". The deploy role can only read its stack, so a press needs a role that may delete, and the destroy's typed name needs a gate that is not a terminal. *Trigger:* the human asks for the workflow.

## 315. One press of the seed should reach yesterday, however long the copies went unused — the machine; *parked* until the human's answer at ridge by script's step 8 (2026-11-12)

Today a press applies at most 2 days a copy (`MAX_DAYS_PER_RUN` in `scripts/src/demo/apply.ts`), held under the Seed step's 18 minutes and the role's 20 by `ops/test.sh`, so after a gap of n days the copies need about n/2 presses. Recommended to the human: a copy more than 2 days behind skips to the last 2 days, and the days skipped stay empty and are named in the log. Before it is planned, read which of a skipped day's events later days need: the people hired and leaving (`dayEvents`) are not orders. *Trigger:* a yes at that point.

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

## 261. The layer-four change-set test reads every resource the template gains as layer four's — the machine; `[FIXED]` in the Slack alarm's fix pass, 2026-11-12 (the Slack alarm's plan, 2026-11-11, Medium)

`adds_and_one_modify` in `ops/test.sh` compares the recorded layer-four change set (`ops/testdata/changeset-app.json`) with every resource of `ops/env.yml` outside a fixed list of five, so any piece that adds a resource to the template turns `bash ops/test.sh` red there, whatever the resource is for. Three lanes of the final architecture add resources to that template at once (the continuous copy, the watch, the front door's key), and each would meet the same red and change the same lines. *Fix:* pin layer four's own resource names in the test, so the recorded change set is compared with the resources it recorded and a later resource leaves it alone; the first lane to land does it, the later ones take it in and add nothing (docs/plans/2026-11-11-slack-alarm.md, step 2). *Trigger:* the first of those lanes to change `ops/env.yml`. *Fixed 2026-11-12:* `adds_and_one_modify` now pins layer four's sixteen names, compares the recorded change set's Adds with them and checks the template holds each; a resource a later piece adds to the template leaves it alone (three new rows).

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

## 383. The ci fix's new case tests the error handler, not the new order, and the child ports can still collide — the machine; `[DEFERRED]` (the review of the ci fix, 2026-11-12, Low)

`scripts/src/stack.test.ts` "fails at once, naming the port, when the front's port is taken, and takes down what it had started": without the `error` handler it hangs, so the handler is tested; but with the old start order plus the handler every assertion would still pass, so the new order (the front bound first) is not tested. Its title also promises more than it checks: it asserts only `EADDRINUSE`, not the port, and only c-storage's being down, not the audit service or the seed door. The race the diagnosis named is closed only for a front port the stack picks. The two cases that pick the front's port with `freePort()` and the four child ports of every stack (c-storage, the BFF, the audit service's two) are still picked and bound later; if one is taken it is now a fast red naming `EADDRINUSE` or "exited", never a hang. *Fix, if wanted:* assert `toThrow(String(front))` and that the audit service's `/health` refuses.
