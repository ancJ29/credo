# Open items

Numbered, never renumbered; an entry is deleted when done
([documentation](conventions/documentation.md)).

## 1. A client's server that stops reaches no one — the machine proposes, the human places the alert; waits for a signed client (the architecture plan, 2026-10-27)

The old app counted each 5xx in its Lambda logs and posted it to a chat channel. Before the first
client goes live, something must watch the BFF and the box; the machine proposes what watches,
and where an alert lands is the human's (production).

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
gateway, its Instance Connect Endpoint; the S3 gateway endpoint with its first caller),
`ops/github.yml`, the account's OIDC provider for GitHub's tokens, and `ops/env.yml`, one
environment's stack (subnet, box, the role its deploys take; with piece 1 its function, bucket and
distribution). ridge is the first stack from each. A signed client's stack is one more from
`env.yml`, and still waits for a client, with its ACM certificate requested in `us-east-1` and its
name in Cloudflare.

## 5. The arm64 builds and how each release lands — the machine writes, GitHub Actions runs on the human's push to main; c-storage's first, for ridge (the architecture plan, 2026-10-27)

Home: [the ridge plan](plans/2026-10-28-ridge.md#deploys-from-github-actions). c-storage's Go binary
for arm64, built from `main` alone, sent to its box over the Instance Connect tunnel and run under
systemd. `ops/release.sh` does this, run by GitHub Actions' `deploy` job on each push to `main`, or
by the human while Actions is down. The BFF's function for arm64 comes with piece 1, in the ridge
plan's fourth layer, which decides how CD ships it (planned in [ridge-app](plans/2026-10-28-ridge-app.md#layer-four)).

## 6. The nightly backup and its restore — the machine writes it, the human runs it; waits for a signed client (the architecture plan, 2026-10-27)

The box's role may only put, so it cannot restore itself: the restore runs from the human's
terminal under the human's AWS session, reads a version from S3, and sends it to the box over the
Instance Connect tunnel.

The backup's copy goes through SQLite's own backup (`VACUUM INTO`, or the shell's `.backup`), or
is taken with the service stopped: a plain tarball taken mid-write can miss saves or hold a torn
file ([the c-storage memo](memo/c-storage.md#the-file-is-the-only-copy)).

ridge, the first box, holds no real data, so the backup still waits for a signed client
([the ridge plan](plans/2026-10-28-ridge.md#left-behind)). The S3 gateway endpoint and the box's
put-only role come with it.

## 8. Two places start c-storage — the machine; *parked* until a third caller (the app frame plan, step 6, 2026-10-28)

`bff/tests/c-storage.ts` (the route tests) and `scripts/src/processes.ts` with `scripts/src/stack.ts`
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
(`scripts/src/processes.ts`). The route tests retry on another port. *Trigger:* a second
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

`scripts/src/processes.test.ts`, "it logged that it is listening, and the url still does not answer",
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
`ui/src/StaffRecord.test.tsx#L301`, "The editor refuses fields it cannot take and says so…", `Test timed out in 5000ms` (5139 ms; the
file took 32079 ms): the load was 4.58 at the start and 15.55 at the end, with a second agent testing in another worktree, and the
`scripts` package was killed by that first failure. This is the same test as in run 2 above; it is load, and still unexplained.

Cause found for the `StaffRecord.test.tsx` reds (main merge, 2026-10-30). The first test typed 28 characters one key at a time with
`userEvent.type`: each key draws the whole staff editor (30 to 45 ms a key at a load of 4) and waits a turn of the event loop, so the
test took 1667 ms alone (`ui/src/StaffRecord.test.tsx#L310`) and a loaded machine stretched it past 5 s. The second test's "Saved."
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

`ui/src/StaffRecord.test.tsx#L315` (the editor's refusal of three bad fields) timed out at 5302 ms in a loaded whole check (`logs/20261101-0852-orders-delivery-check.log`). `4760ad9` cut it from 975 to 803 ms alone, a margin of about 2x under load. The next step, after 11-04 or at its next red: split it into its three cases, one behaviour a test (QA rules 1 and 4). **Done (line 36, 2026-11-01).** The next red was on GitHub, the push of `main`@`fae4dee`: 5351 ms of 5000 (`logs/20261101-1333-push-and-save-runs-ci.log#L2215`), where the test had run 1.9 to 5.4 s for days and 4813 ms at `fe7d31f`. What was left in it was the page's own draws, so it is split into four tests, each opening `/staff-setup` once: a field with no key is refused, the same key twice is refused, a choice with no options is refused and saved once it has one, and an option and a field are removed (the old test's tail, which its name never held). Alone: 267, 290, 614 and 477 ms (`logs/20261101-1356-staff-test-split-alone2.log`). Each is red from its own assertion with its rule's line changed and put back (`logs/20261101-1353-staff-test-split-red-*.log`, `20261101-1356-staff-test-split-red-nokey2.log`); the no-key test gives both names, since with them empty the names' own rule refused the field and the key's rule was held by nothing (two reds with the key's rule changed passed, `20261101-1353-staff-test-split-red-nokey.log` and `20261101-1355-staff-test-split-red-nokeyretry.log`). No budget or retry changed; `SLOW` stays as it was.

Line 32's review (2026-11-01): at slice 3's step 4 `scripts`' `apply.test.ts` row 22 went red at 123 s of its 120 s, and `visual` ran 227.67 s of its 240 s (`logs/20261101-0942-driver-phone-red-scripts-generator-and-apply-timeout.log`).

## 28. No limit on wrong passwords at the sign-in route or at one's own password — the human places it; *parked* until before the first client's own stack (the employee list plan, step 20, 2026-10-30)

Nothing slows a guess at a password: the sign-in route (by code, by email, by operator name) and the current password asked by
one's own password route answer every try, and each wrong one costs the guesser one hashing. On ridge the stage's throttle
(10 a second) is the only brake. The review accepted that for ridge. A client's own stack has no such stage. The fix is one piece
for both routes together: a per-name limit (a count of wrong tries in a window, kept as a record under the name, the same 401
after it so that it names nothing), so a limit on one route does not leave the other as the way round. The human places it before
the first client's own stack.

## 29. A deploy stopped between the function's description and its code leaves new words on old code — the machine; *parked* until the next change to `ops/app.sh` (the demo seed plan, step 8, 2026-10-30)

`ops/app.sh` writes the BFF function's description (the commit `ops/seed.sh` compares with
`/health`) before it writes the function's code. A deploy that stops between the two leaves a
description naming the new commit on the old code, so the seed's check passes and it runs against a
BFF that is a commit behind. It needs a deploy that is already red to bite, and the next one is
red anyway. Fix: write the description after the code, in `ops/app.sh`, and a stand-in `aws` test in
`ops/test.sh` that stops the code's write and reads the description unchanged.

## 30. Adding a passkey in Safari may be refused — the machine, with the human's 3 minutes; *parked* until the console is used in Safari (the operator console plan, step 8, 2026-10-30)

One click on "Add a passkey" (`ui/src/PasskeysPage.tsx`) runs two WebAuthn ceremonies: the touch of a
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
`Table.ScrollContainer`s, the import preview's (`ui/src/ImportPage.tsx#L261`) and the staff list's
(`ui/src/StaffListPage.tsx#L191`), so a field manager who opens the list on a phone sees the first
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
(`scripts/src/strays.ts`), so a Mac where `lsof` is denied leaves such a BFF running and the next run
refuses on it by name. A Ctrl-C during the first step's listings ends as a refusal (exit 2), not 130;
nothing was acted on. *Trigger:* a refusal naming a stray the script did not stop, or a log with
`stopped` lines that look wrong.

## 34. Three technical rows of the lists are held weakly: the list's 500 log, the write's precondition, the fake's code order — the machine; *parked* until the lists are next touched (the customers and products plan, step 6, 2026-10-31)

The review of the lists found three technical rows (the case table's 13, 14 and 19) whose test passes
with the behaviour broken. Under the demo's ceremony (Decide 46) only the High and the Medium findings
are fixed; these stay.
- **Row 14:** the 500 on a short or unparsable list is asserted by status and by the key being absent
  from the body, but the log line is never read. Capture the logger as
  `bff/src/employees.route.test.ts#L1132` does and assert it names the kind and never the key.
- **Row 13:** the record is written with `If-None-Match: *`, but no test would fail if the precondition
  went. Record the `ifTag` the wrapped client receives in the "adds each row" test of
  `bff/src/lists.route.test.ts` and assert it is `null`.
- **Row 19:** the fake lists in code order, but no test imports a code that sorts first. Import one at
  `ui/src/fake.test.tsx#L594` and assert the list starts with it.

*Trigger:* the lists get a by-hand add or edit, or a reader of a test names one of these three.

## 35. Orders and requests: four small things left under the demo's ceremony — the machine; *parked* until the orders are next touched (orders-delivery, step 6, 2026-10-31)

Found while building the BFF half; none breaks a demo step or the gate, so none is fixed now.
- **A first save that carries a `version`** is accepted and the version ignored; the create route
  could refuse it (400). Nothing sends one.
- **A cancelled request's order is freed by one write that may not land** (`bff/src/orders.ts`, the
  request's cancel; the same again in the close of a driver's day, item 41 finding 3): a moved order is left as it is and the page reads the request as none, so the
  order offers to send again either way; no test moves the order between the two writes. Also a
  false conflict (`bff/src/orders.ts#L388-L406`): a send pressed on a page read between the two
  writes meets a 409 though nothing the page showed has moved, in a window of milliseconds; a
  re-read that compares the shown order would recover it.
- **The orders list reads each day of the span and each day its requests name**, one list read a day:
  at S2's busiest, a week is at most 14 reads. A report over a longer span would need an index.
- **`GET /api/drivers` asks `orders.canEdit`**, as the fake does, not `orders.canView`; a viewer who
  opens Confirm has none to see. Right while only an editor confirms.

*Trigger:* the orders get a second caller (a report, a driver's phone), or a reader of a test names one.

## 36. Orders, review findings 3 to 8, deferred under the 11-04 demo's exception — the machine; *parked* until the orders are next touched, and worked after the demo (orders-delivery, step 7, 2026-11-01)

Found by the line 30 review; only its High and Medium findings are fixed under the demo's ceremony
(Decide 46). None breaks a demo step or the gate.
- **Finding 3, `bff/src/orders.ts#L341-L347`:** the order's cancel drops the request write's `moved`
  result, so from slice 3 a request delivered between the read and the write leaves a cancelled order
  beside a delivered request. *Fix (slice 3):* on `moved`, re-read the request; if still waiting, retry
  a bounded number of times; if delivered, answer 409 with the order.
- **Finding 4, `ui/src/OrderPage.tsx#L117`:** every save sends `extra: {}`, a draft's re-save
  included, and the BFF stores it as given (`bff/src/orders.ts#L274`); nothing writes an order's
  `extra` yet, so nothing is lost today. *Fix:* send `existing?.doc.order.extra ?? {}`, as
  `ui/src/PersonPage.tsx#L328` merges into the stored one.
- **Finding 5, `ui/src/OrderPage.tsx#L85-L89` and `bff/src/orders.ts#L303-L317`:** the form prices a
  saved draft from today's lists, but Confirm copies the saved lines, so after a price change the
  page's total and the request's total to collect differ. *Fix:* draw a saved draft at its saved
  prices and mark a line whose product's price has since moved, so that a save reprices it.
- **Finding 6, `bff/src/orders-records.route.test.ts#L338-L347`:** row 18's second half ends at the
  503, so a numbering that hands out the lost number again would stay green. *Fix:* one more `made()`
  after the 503, expecting `DH-00002`.
- **Finding 7, `bff/src/orders.ts#L367-L369` and `ui/src/fake.ts#L629-L632`:** requests sort by number
  as text, so the order breaks past 99,999 requests. *Fix:* one shared comparator for both, as
  `newestOrdersFirst` (`shared/src/orders.ts#L183-L186`) compares the length first, the next time
  either is touched.
- **Finding 8, `bff/src/orders.ts#L262-L265`:** the PUT body extends `saveOrderRequestSchema` with
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
- **Finding 7, `bff/src/operator-auth.ts#L274`:** sv-5 is provoked by an options 503 the BFF never answers for c-storage (cue
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
- **Finding 2, `bff/src/orders.ts#L362-L365`:** the order's cancel still drops its request write's `moved` result (slice 2's finding 3, the plan's parked 6), so a cancel racing a delivery leaves a cancelled order beside a delivered request with a photo. *Fix:* read the write's result; on `moved` re-read the request: delivered, answer 409 with `orderDoc`; still waiting, retry a bounded number of times. Test: a flaky client that delivers the request just before the cancel's request write.
- **Finding 3, `bff/src/orders.ts#L396`:** no test holds the "not allowed to deliver" check on a request's read (`someone` and the other driver are refused at `#L398` anyway), so a driver whose right was taken away still reads their own photo. *Fix:* two assertions in `bff/src/deliveries.route.test.ts#L368-L397`: that driver reads their delivered request's photo, 403; `someone` on a request id that is not there, 403.
- **Finding 4, `bff/src/orders.ts#L473-L483` and `ui/src/MyDeliveryPage.tsx#L73-L76`:** when only the order's write fails, deliver answers 503 and the phone says "Not sent" for a request it delivered. *Fix:* treat the fulfil write as best effort, catch it, answer 200, and change `bff/src/deliveries.route.test.ts#L242` to expect 200.
- **Finding 5, `bff/src/app.ts#L76` and `bff/src/orders.ts#L453-L455`:** a body up to 1 MiB (Fastify's default) is read and parsed before the sign-in and the 200 KB check. *Fix:* a route `bodyLimit` of about 300 KB on deliver and about 80 KB on the person's photo route.
- **Finding 6, `ui/src/photo.ts#L45`:** `imageOrientation: 'from-image'` is a TypeError in a browser that predates the value, so every picture fails to shrink. *Fix:* on a TypeError, retry `createImageBitmap(file)` without the option. The human's phone at step 13 settles whether it is needed.
- **Finding 8, `ui/src/photo.ts#L8`:** the rule 8 hint says the walk's browser and the human's phone hold the bound, the quality loop and the orientation; the walk's 240x180 PNG meets none. *Fix:* "the walk's browser runs it on a small PNG; the bound, the quality loop and the orientation meet a real photo only on the human's phone (step 13)".
- **Finding 9 (skew and rollback), `shared/src/orders.ts`:** an office tab opened before the deploy fails to parse `fulfilled`, `delivered` and `deliveredAt` until reloaded, and a BFF rolled back past this slice answers 500 for any day with a delivered request. *Fix:* a line in the recap's hazards (same class as slice 2's finding 9).
- **Finding 10, `bff/src/orders.ts#L52-L55` and `ui/src/fake.ts#L699`:** the module comment says an order naming a request that is "not waiting" reads as having none, which a delivered one no longer does; the fake stamps the real clock into `deliveredAt` (QA rule 7). *Fix:* "not there, or cancelled"; a fixed time, such as the data set's today at 10:00.
- **Finding 11, `scripts/src/generator.ts#L253`:** the generator signs a driver in once per delivered request, about a dozen scrypt checks and session records per seed. *Fix:* sign each driver in once per seed, keyed by code.
- **Finding 14, `bff/src/orders.ts#L444-L451`:** two delivers of one request at once by its driver let the losing call's photo overwrite the winner's (same driver, same goods). *Fix:* none now.
- **Finding 14, `walk/specs/piece-2.spec.ts#L125` and `walk/specs/orders.spec.ts#L126`:** `withoutDriversAllowed` is written twice with two signatures. *Fix:* fold it into `walk/support.ts` when either spec is next touched.

*Trigger:* after the 11-04 demo, the deliveries next touched, a cancel and a delivery seen racing, or the human's phone at step 13 showing a picture refused.

## 40. The five address masks carry no label — the machine; *parked* (check-host-yes-no, line 37, 2026-11-01)

`app_load` masks the app's and the API's address and host with no label (`ops/lib.sh`, the four `mask` calls in `app_load` and `outputs_show`'s `mask "$(out ApiAddress)"`), so a match in a log reads "a key is in this log: delete it and replace the key" when the value is an address. *Fix:* pass a label such as "the app's host" as `mask`'s second argument, so the red reads "redact it in this log; nothing to replace"; a test case holds the words.

*Trigger:* the next red that names a key where an address matched.

## 41. Slice 4, đối soát: line 35's review findings 1 to 11, deferred under the 11-04 demo's exception — the machine; *parked* until the day's end is next touched, and worked after the demo (driver-reconcile, step 6, 2026-11-01)

Found by the line 35 review (Opus 5.5, 2026-11-01 14:27, `review-a`@`beeaedb`; its file is `logs/20261101-1427-driver-reconcile-review.md`, its runs `logs/20261101-1424-driver-reconcile-review-runs.log`). It found no High and no Medium, so under the demo's ceremony (Decide 46) nothing is fixed now; each finding is `[DEFERRED]` here. None breaks a demo step or the gate.
- **Finding 1, `docs/plans/2026-11-01-driver-reconcile.md`, step 5's evidence:** row 5's two clauses were seen red only through other rows' assertions (the BFF's through the 409 body, the UI's through the Closed table). *Fix:* none in code; the reviewer's runs 1 and 3 hold them (BFF `bff/src/reconciliations.route.test.ts#L220`, UI `ui/src/Reconcile.test.tsx#L379`) and step 6's tick names that log.
- **Finding 2, `bff/src/reconciliations.ts#L41`:** the closed day's `If-None-Match` is held by no test (dropping the `null` kept all 14 green); two closes at once would let the later overwrite the first's cash. *Fix:* a `flaky()` mode that writes another close under the key and passes ours on to c-storage with its own tag; expect 409, the record theirs.
- **Finding 3, `bff/src/reconciliations.ts#L115-L126`, tests `#L153-L154` and `#L420-L432`:** the order's free and its guard are held by no test, item 35's second bullet a second time. *Fix:* assert the stored order's `request` in the close test; at `#L420` make the order name another request id and expect it kept.
- **Finding 4, `bff/src/reconciliations.route.test.ts#L406` and `#L371-L372`:** a test name and a comment say more than their tests hold (a throwing order write, not a `moved` one; a fresh body, not the old). *Fix:* rename `#L406` and add the `moved` case (200, the order left); at `#L372` send the old body first (409), then the fresh one (200).
- **Finding 5, `ui/src/DriverDayPage.tsx#L69-L72`, `bff/src/reconciliations.ts#L109-L130`, `ui/src/fake.ts#L449-L486`:** a close that stops part way leaves the page showing requests it already cancelled, and its retry meets a 409 whose words blame a delivery; the fake's 503 moves nothing, so it differs from the stack. *Fix:* read the closer before the first write; in the page's `catch` call `loaded.reload()` too.
- **Finding 6, `ui/src/i18n/en.ts#L172`, `ui/src/i18n/vi.ts#L173`, `shared/src/permissions.ts#L6-L7`:** the editors' words for `orders.canEdit` do not say it closes a driver's day. *Fix:* a code comment now; the words with the next change to piece 2's editors or the cashier right (re-asks their screens).
- **Finding 7, `bff/src/reconciliations.ts#L128-L140`:** a person whose record cannot be read at the close is recorded as the root (a race only). *Fix:* branch on `who.root`; a gone person is a 401; read it before the writes (finding 5).
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

`ops/seed.sh#L13` "Runs each morning" and `#L15` "about a minute" (now 8 to 10); `.github/workflows/seed.yml#L6-L7`, `ops/README.md#L199` and `#L214` "next morning" and "the morning's run". *Fix:* say night, 03:17 +07, and the run's real length. *Severity:* Low.

## 45. The closed-day change: small things — the machine; *parked* until after the 11-04 demo (seed-demo-safe, review of line 42, 2026-11-02)

*Severity:* Info.
- `scripts/src/demo/apply.ts#L404`: when every driver is closed the draft is named "no driver who delivers".
- `apply.ts#L359`: the "closed, sent nothing" line is logged for every closed driver, is not in `report.skipped`, and is absent from the log lines `ops/README.md` lists.
- `scripts/src/demo/apply.first-fill-orders.test.ts#L377`: the closed record is written straight to storage, so that driver's requests stay waiting.
- A close between `closedFor` and the confirm still answers 400; negligible at 03:17.
- `ops/test.sh#L759`: the 15-minute check matches any step, and `#L754` is now redundant.
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

`ops/lib.sh#L121`, `#L126`, `#L164`, `#L497-L498`, `#L702-L703`: the keys the end-of-run search looks for are on grep's argument list, and a here-string is written to a temp file by bash 3.2 (the Mac's). *Fix:* one lib.sh change: split without here-strings and `grep -f /dev/stdin` on a pipe, as `search_extra` in `ops/root-password.sh` does.

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

## 55. `OPS_TEST_NO_TTY` or `RIDGE_SCRIPTS_DIR` in the environment bypass two checks — the machine; *parked* until after the 11-04 demo (ridge-root-password, review of line 41, 2026-11-02, finding I7)

`ops/root-password.sh` (and `ops/operator.sh`, the same pattern) takes both from the environment, the test's own switches. *Fix:* read them only under a test marker, or drop the switches for a test-only wrapper.

*Trigger:* the next change to either script.

## 56. Two ui tests failed once in a whole `pnpm check` at load 12.6 — the machine; *parked* until after the 11-04 demo (2026-11-02)

In a whole `pnpm check` at load 12.6 (the gate's limit is 8) on 2026-11-02, two ui tests failed in files the change did not touch, and both passed on a rerun at load 4.7, which is no verdict (QA rule 6: a flaky red is a defect). [`SignIns.test.tsx#L129`](../ui/src/SignIns.test.tsx#L129), "C: the root turns the email and the QR sign-in on…", timed out at 5000 ms; [`MyDeliveries.test.tsx#L39`](../ui/src/MyDeliveries.test.tsx#L39), "a driver … lands on My deliveries", saw `myDeliveries` called 0 times. *Fix:* find what each waits on that load starves, and hold it by the test's own signal, not a time.

Seen again on 2026-11-03 at load about 12, in the walks page's step 2: `MyDeliveries.test.tsx` alone, the same no call, with nothing in `ui` changed (once item 57, folded in here; `logs/20261103-walks-page-step2-gate-run3-red-ui.log`).

*Trigger:* the next red of either, or a quiet machine's whole check.

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

c-storage saves the root's record but its answer misses the BFF's 5-second timeout: the BFF answers 503 and the page says the password is as it was, while the root is signed out and holds the new one. A retry repairs it. Lines: `ui/src/i18n/en.ts#L104`, `ui/src/i18n/vi.ts#L103`, `bff/src/root-password.ts#L50`. *Fix:* word it "may not have been set: set it again" in both languages and re-take screen 4; or `setSignInPassword` re-reads once after a write with no answer.

*Trigger:* the first client's root, or the next change to the route.

## 62. The root-password touch is not tied to the client — the machine; `[DEFERRED]` (D, plan step 6, review at `e6320b9`, 2026-11-03, Low)

Within its 5 minutes and before it is spent, a touch made for client A, posted to client B's route, sets B's root; this goes beyond the plan's row 11 (the act and the operator). Lines: `bff/src/operator-auth.ts#L375` (mint), `#L264` (open), used at `bff/src/root-password.ts#L48`. *Fix:* confirm-options takes the client's code and mints with the subject `${operator.id}:${code}`; the route opens it with the same subject.

*Trigger:* before a second operator or a client signs.

## 63. No page test for the BFF refusing the touch (403) — the machine; `[DEFERRED]` (D, plan step 6, review at `e6320b9`, 2026-11-03, Low)

The page's half of the case table's rows 5 and 7 has no test. Lines: `ui/src/RootPasswordPage.tsx#L61` (the catch), `ui/src/RootPasswordPage.test.tsx#L124` (the 503 test to copy). *Fix:* one test with the fake's `setRootPassword:403` cue, asserting the "not changed" alert and that the code and passwords are still typed.

*Trigger:* the next change to the page.

## 64. The scripts' coverage missed 100 % once, at the wait's retry sleep — the machine; *parked* (B1, plan step 2, 2026-11-03)

`scripts/src/processes.ts#L83` (`await sleep(25)` in `waitUntilUp`, run only when the first look finds nothing listening)
and the function around it showed uncovered in one whole run of the scripts' tests (263 pass, statements 99.92 %,
branches 99.82 %), under a load near 8; the same tests passed at 100 % when run again with nothing else changed (the
only change between the two runs was a type in `bff/src/challenge.ts`, which `scripts` does not run). So the retry is
covered by timing, not by a test of its own. *Fix:* a test that answers the first poll "not yet" on purpose, with the
stand-in's own clock. *Trigger:* the next red of this kind, or the next change to `scripts/src/processes.ts`.

## 69. A BFF rolled back past B1 cannot read the accounts B1 writes — the machine; `[DEFERRED]` (B1, plan step 5, review at `5bae528`, 2026-11-03, Low)

`signedInAt` and the strict schema (`shared/src/records.ts#L125`) make an older BFF answer 503 to those operators. The precedent is `docs/open-items.md#L359`. *Fix:* none now; a line in B1's recap's hazards.

*Trigger:* a rollback past B1.

## 70. An add or a link the target began before its delete can land after the sweep — the machine; `[DEFERRED]` (B2, plan step 5, review at `44db639`, amended after the reread of `4131696`, 2026-11-03, Low)

`createOperator`'s retry (`bff/src/operators.ts#L135-L143`) checks the name, not that `addedBy` is still on the roster, and `makeLink` (`#L83-L95`) can finish after the sweep passed that account, so a deleted operator could end up holding a working link. The gap is wider since the fix at `4131696`: the target stays signed in until the roster write, so a link they make after the sweep has passed that colleague's account and before the roster write survives the 204 (`bff/src/operators.ts#L181-L190`). The comment at `#L165-L166` ("no link of theirs or of their making is left") claims more than this. *Fix:* none now; check the maker on the roster at the last write, and say so in the comment.

*Trigger:* two operators acting in the same instants.

## 71. The link's kind comes from a roster read that can be stale — the machine; `[DEFERRED]` (B2, plan step 5, review at `44db639`, 2026-11-03, Low)

A colleague who joins between the read (`bff/src/operator-team.ts#L100-L107`) and `makeLink` gets a `join` link while active; using it replaces their passkeys (`bff/src/operator-auth.ts#L328-L332`) without raising the generation, so their sessions are not ended. *Fix:* none now; make the link's kind from the account, not the roster.

*Trigger:* a join in the instant a link is made for the same colleague.

## 72. `--replace` refuses roster names with a space or an accent — the machine; `[DEFERRED]` (B2, plan step 5, review at `44db639`, 2026-11-03, Low)

`scripts/src/ridge.ts#L77-L78` accepts only `^[a-z0-9][a-z0-9._-]{0,31}$`; item 68's compare helps only plain names. The console's New link covers those operators. *Fix:* none now.

*Trigger:* a command-line replace for an operator named with a space or an accent.

## 73. A delete refused at its roster write has already removed the links of an operator who stays listed — the machine; `[DEFERRED]` (B2, plan step 5, reread of `4131696`, Opus, 2026-11-03, Low)

A delete that stops at its roster write (an actor gone, 401; three roster moves, 503; a write that throws) has already removed, in `bff/src/operators.ts#L178-L191`, the links of an operator who stays listed. In the race of two deletes the survivor loses its own recovery link and its invitees' join links, and nobody is told until a colleague opens a dead link. A new link recovers each. The plan's case 3 ("one remains … deletes nothing more") no longer holds for links. *Fix:* none now; remove the links only after the actor is checked at the last roster read, or note that a refused delete may need new links.

*Trigger:* two operators deleting each other, or a roster that keeps moving.


## 76. A client's own logo in the header — the human; `[PARKED]` (legacy frame, plan 2026-11-03)

The header shows the company's name beside a stand-in logo (Tabler's `IconBrandAdobe`), not the stored one.

*Trigger:* a client's ask for its own logo.

## 77. A process left in a lane's group holds the wait with no line saying why — the machine; `[DEFERRED]` (full-run-speed, plan step 5, reread of `f9e33a0`, Opus, 2026-11-04, Low)

In a run nobody stops, a process left in a lane's process group holds the wait after the last pass, and no line says why (`walk/run.sh#L459`). Unlikely, since the stack kills its children at exit (`scripts/src/processes.ts#L47-L48`). *Fix:* once every lane's `.rc` is written, a short grace, then name what is left and TERM it.

## 78. On the stop path bash prints its job lines unprefixed — the machine; `[DEFERRED]` (full-run-speed, plan step 5, reread of `f9e33a0`, Opus, 2026-11-04, Info)

On the KILL path, bash still prints its job lines without the `[lane n]` prefix (`walk/run.sh#L459`). No verdict reads them.

## 79. A rare port clash between lanes — the machine; `[DEFERRED]` (full-run-speed, plan step 5, review at `56bc475`, Opus, 2026-11-04, Info)

`freePort` releases its port before the child binds it (`scripts/src/processes.ts#L7-L18`), so two lanes can meet on one. It shows as a named red, never a green. *Fix:* only if a run meets it.

## 80. The full run's stray filter does not take a staged rename — the machine; `[DEFERRED]` (full-run-speed, plan step 5, review at `56bc475`, Opus, 2026-11-04, Info; older than the piece)

`ops/full-run.sh#L180` takes only `A`, `M` or `D`, so a staged rename (`R `) would red as "more than base pictures". *Fix:* add `R` when a run stages one.

## 81. The lanes are not balanced — the machine; `[DEFERRED]` (full-run-speed, adoption run, 2026-11-04)

Lane 1, piece-2 alone, is the long pole at 13m04s against lane 3's 9m49s (`walk/run.sh#L38-L50`). Splitting piece-2's passes or moving a walk could take about 3 more minutes off a run.
The staff-cards full run (rerun, 2026-11-04, 16m00s) shows it again: lane 3 ended about 3 minutes before the others, 10m17s against about 13 (`20261104-1732-staff-cards-full-run.log`). Rebalance when a run's length matters.

## 82. A test types a hex with no letters and calls it a case check — the machine; `[DEFERRED]` (palettes, plan step 4, review, Opus, 2026-11-04, Low)

`ui/src/Settings.test.tsx#L277` types `'#047857'.toUpperCase()`, which has no letters, so it proves no case handling. *Fix:* a stock shade 7 with a letter in it, such as `#4A76A9`, when the file is next touched.

## 83. Six palettes' menu text falls below 4.5:1 at shade 8 — the machine; `[DEFERRED]` (palettes, plan step 4, review, Opus, 2026-11-04, Info)

For six palettes the legacy's own shades 8 and 9 are lighter than mixed ones, so the menu's white text on its 9-to-8 gradient reads below 4.5:1 at shade 8: autumn 3.65, coin 3.78, terracotta 4.02. The legacy's own, as decided.

## 84. The demo company can wear steel — the machine; `[DEFERRED]` (palettes, plan step 4, review, Opus, 2026-11-04, Info)

The demo script draws a client's colour from seven (`scripts/src/demo/company.ts#L5`); one is steel's shade 7, so such a company shows Steel checked in Settings, as meant. The other six are no stock shade and check none.

## 85. The legacy's lookup also takes a palette's name — the machine; `[DEFERRED]` (palettes, plan step 4, review, Opus, 2026-11-04, Info)

`ui/frame-mock/frame.js#L44` matches a palette's name as well as its shade 7, so moving a legacy client's data needs each name turned into its shade 7.
*Trigger:* the first legacy client's data move.

## 86. The services walk's sv-5 does not move with a palette — the machine; `[DEFERRED]` (palettes, full run, 2026-11-04, Info)

The full run named "sv-5-unavailable" and moved 0 of its 6 pictures, so 210 pictures were committed, not the plan's 216 (log line "named, not moved: sv-5-unavailable" in `20261104-1447-palettes-full-run.log`). It is right: the screen is `Boot` in its unavailable state (`ui/src/Boot.tsx#L19-L39`), a red alert, a title and a Retry button, and the button draws shade 7 only (`ui/src/theme.ts#L109`), which is the colour itself in the mix and in steel's own ten. Nothing on it draws another shade.

## 87. A lane's child could not set its process group — the machine; `[DEFERRED]` (palettes, full run, 2026-11-04, Info)

The run printed "walk/run.sh: child setpgid (11085 to 11085): Operation not permitted" (`20261104-1447-palettes-full-run.log`, line 996), in lane 2's driver walk, which still passed 6 of 6 and exited 0. A lane's child could not set its own process group, so the stop path's KILL may not reach that group. Harmless here. *Trigger:* the next piece touching `walk/run.sh`.

## 88. A named screen that does not move reads green — the machine; **Done (walk-machinery, step 3, 2026-11-06)**; was `[DEFERRED]` (palettes, full run, 2026-11-04, Info)

`ops/full-run.sh`'s verdict line lists the asked `--moved` names, not what moved (`20261104-1447-palettes-full-run.log`, line 1821): it listed 36 where 35 moved. *Trigger:* the next piece touching `ops/full-run.sh`.

**Done (walk-machinery, step 3, 2026-11-06).** The verdict line now reads run 1's `full-1 to the bases` compare lines and names the screens that moved, the screens that are new, and the named screens that were seen and moved nothing; the asked list is printed as `asked`. The counts still decide the exit. Row 4 in `ops/test.sh`.

## 89. `person.signIn` is left unused — the machine; **Done (staff-fields, 2026-11-05)**; was `[DEFERRED]` (staff-cards, plan step 5, review, Opus, 2026-11-04, Low)

The key `person.signIn` ('How they sign in' / 'Cách đăng nhập') stays in `ui/src/i18n/en.ts#L403` and `ui/src/i18n/vi.ts#L404` after the sentence moved into the first card. Nothing reads it, and the missing-key test cannot catch an unused key. *Fix:* delete both lines when the files are next touched.

**Done (staff-fields, `ed30369`, 2026-11-05).** Both lines are deleted; no reader was left.

## 90. The frame draws its side column even when empty — the machine; **Done (customer-cards, 2026-11-05)**; was `[DEFERRED]` (staff-cards, plan step 5, review, Opus, 2026-11-04, Low)

`ui/src/DetailCards.tsx#L12` always draws `side`. A viewer who gets no side panel (photo field off, neither root nor allowed to delete) sees the details at 7/12 beside a blank. *Trigger:* the first detail page that takes the frame. *Fix:* make `side` optional and give `main` the full 12 when it is absent.

**Done (customer-cards, `a71e6a1`, 2026-11-05).** The fix is the one named: `side` is optional and `main` spans 12 when it is absent (`ui/src/DetailCards.tsx#L12-L13`), held by `ui/src/DetailCards.test.tsx#L12-L20`; the customer with no note is its first live case. What is left of the symptom — a side passed but empty — is item 99.

## 91. Eight walk specs press a loading button and take a picture with no wait for its loader — the machine; **Done (walk-machinery, step 6, 2026-11-06)**; was `[DEFERRED]` (staff-cards, full run, 2026-11-04, Info)

Found while fixing the services walk (`926c1b2`): `operator-services` sv-5 and its sign-in at `#L202`, `operator-passkeys`, `operator`, `operator-team`, `operator-root-password`, `driver`, `lists` and `orders` press a `loading` button and take a picture with no wait for its loader. All green so far. *Fix:* the wait for any button loader belongs inside `at()` itself (`walk/support.ts`), so no spec can forget it. *Trigger:* the next walk piece, or the next flake.

**Done (walk-machinery, step 6, 2026-11-06).** `shot()` in `walk/support.ts`, the one picture-taker, now waits for no `.mantine-Button-loader` on the page before it parks the pointer and takes the first shot; the services walk's own local waits are left as they are. The count is of loaders mounted, not visible: a loader whose exit has not finished stays mounted at opacity 0 (Mantine's Button keeps it through the exit transition, and Playwright reads opacity 0 as visible), so the services walk, whose clock is paused, advances it with its own `settled()` before sv-3, sv-4 and sv-5 as it already did before sv-1 and sv-2 (the review's High; the advance moves the clock 500 ms and a loader at opacity 0 draws nothing, which step 8's run must confirm: no base moves). Blast radius: a break shows at once on every walk, as a red naming the screen (`<screen>: a button's loader is still on the page`), and deleting the one line in `shot()` reverts it, the three `settled()` lines being harmless without it. The proof is the full run (step 8): every base must come back unmoved.

## 92. The card's avatar condition is untested — the machine; `[DEFERRED]` (staff-list, review, Opus, 2026-11-04, Low)

The photo-off and photo checks read the table row only (`ui/src/StaffRecord.test.tsx#L67-L70`, `#L565`); the phone card's avatar condition has no test of its own. *Fix:* the same two checks scoped to the card, when the card is next touched.

## 93. At 992 the last filter select wraps — the machine; `[DEFERRED]` (staff-list, second look, 2026-11-04, Low)

At 992 px of screen width the content is 710 px and the last select wraps; the five filters sit on one line only from about 1166 px. The human's looks were at 1280 and the phone. *Trigger:* the next look at a tablet; say so then, it is known.

## 94. White on the brand shade 7 is under 3:1 on the menu mark and about 3:1 on the header and button — the machine; `[DEFERRED]` (white-frame, plan, 2026-11-04, Info; widened by the sign-in look, 2026-11-05)

One pairing fault, line 54's own (the old app's colours kept as they are), not the sign-in look's and not line 60's. It shows in two places. (1) On the white menu the open page's mark (brand shade 7) falls under 3:1 for terracotta, autumn, olive and coin (2.72 to 2.99); kept as decided, since the page's name carries the meaning. (2) The sign-in mock measured the same pairing wider: white text on the header and on the primary button, as the app draws them, is 2.84 to 3.40:1 across six palettes, the four above plus sandstone and ocean — terracotta 3.12, sandstone 3.32, autumn 2.84, olive 3.10, ocean 3.40, coin 3.05 (`one-off/20261105-1755-signin-look-round-1/check.log#L16-L17`, `#L19-L20`, `#L23-L24`, logged as notes "white on <palette>'s shade 7"). The other palettes sit at 4.91 to 6.38. The human was given the recommendation to leave the pairing as it is and answered with their yes on the look (18:12), so this is a record, not a pending fix. *Trigger:* a client on one of the six asks, or a contrast pass over the palettes (the fix would be a darker shade for the fill, or dark text on the light palettes).

## 95. The icon strip's tip is tested by the CSS file's text, never drawn — the machine; `[DEFERRED]` (white-frame, review, Opus, 2026-11-04, Low)

The strip's tip on `:focus-visible` is held by a test that reads `ui/src/frameLook.module.css` as text, since jsdom has no computed styles; a browser check would be the first to see it drawn. *Trigger:* the first browser check of the app, or the next change to the strip.

## 96. The start, birth and address values are checked in the browser only — the machine; `[DEFERRED]` (staff-fields, review, 2026-11-05, Low)

The BFF stores `extra` untouched (`shared/src/extra.ts#L3-L5`), so a stored non-day shows as a blank date input and is re-sent unchanged (`ui/src/personalFields.tsx#L23`). The company's own date field behaves the same, so this is consistent, not new. *Fix:* a day check on the three keys in the BFF's save of a person, about a route test and ten lines; *trigger:* a second client that writes `extra` (an import of the dates, or a partner's tool).

## 97. The day check's production path is nearly unreachable on these two fields — the machine; `[DEFERRED]` (staff-fields, review, 2026-11-05, Low)

A real browser's date input never yields a day that is not one, so `dayIsValid` (`shared/src/fields.ts#L117`) guards an older browser's text fallback; it is right and covered, and its refusal is tested with the input made a text input. *Cost:* none to keep; *trigger:* none, noted so a reader does not look for the path.

## 98. The customers and the products have no detail page to re-lay — the machine; **Done (products-cards, 2026-11-06)**; was `[DEFERRED]` (customer-cards, plan, Opus, 2026-11-05, Info)

The campaign reads "each remaining detail page onto the old app's two columns", but both lists are a list page and an Excel import only (`ui/src/ClientApp.tsx#L367-L379`): the customer's page is built new in this milestone, and the product's will be in the next, from the list reply with no server work. Only the order has a page already (`ui/src/OrderPage.tsx`). *Trigger:* sizing the products milestone — it is a new page, not a re-lay, and its own column set (unit, price, stocked) is not the customer's.

**Done (products-cards, `02bbebc`, 2026-11-06).** The trigger was met: this milestone's plan sized the product's page as a new page with its own columns, and the page is built (`ui/src/ProductPage.tsx`, `/products/:id` at `ui/src/ClientApp.tsx#L383-L386`). Both lists now have a detail page, so nothing of the campaign's "re-lay" reading is left unsized; the order's page, already there, is lane B's.

## 99. An empty side still draws its column — the machine; **Done (orders-cards, 2026-11-06)**; was `[DEFERRED]` (customer-cards, review, Opus, 2026-11-05, Low)

Item 90's fix reads `side !== undefined` (`ui/src/DetailCards.tsx#L13`), so the two other ways a page says "nothing here" still draw a blank 5/12 column: `side={null}` and the usual `side={has && <Card />}`, which is `false` when `has` is false. The person's page passes a `<Stack>` that is always defined (`ui/src/PersonPage.tsx#L552`), so a viewer with no photo field, not the root and not allowed to delete still reads the details at 7/12 beside a blank — the case item 90 opened. *Fix:* treat a falsy side as absent, or have the person's page pass `undefined` when every panel is out; line 58's milestone 2 is in that file. *Trigger:* the next detail page or the next change to the person's page's side.

**Done (orders-cards, `d96f810`, 2026-11-06).** Of the two fixes named above this build took the first: a falsy `side` counts as absent (`ui/src/DetailCards.tsx#L11`, `#L14-L15`), held for `null`, `false` and `undefined` alike by `ui/src/DetailCards.test.tsx#L34-L43`. That closes the two shapes this item opened with — `side={null}` and the usual `side={has && <Card />}` — and the order's page is the live proof: a new order passes `side={existing && <OrderActions/>}`, which is `null` there (`ui/src/OrderPage.tsx#L256`), and the built screen draws one column at 100 %. **The second fix was not made, so the case this item was opened for survives the fix that closes it:** the person's page still passes an always-truthy `<Stack>` (`ui/src/PersonPage.tsx#L552-L553`), so a viewer with no photo field, neither the root nor allowed to delete, still reads the details at 7/12 beside a blank half. That residue is **item 106**, where it is now held with its own fix and trigger — read the two together before believing the blank half is gone everywhere.

## 100. The walk and the page disagree on what "has a note" means — the machine; **Done (products-cards, 2026-11-06)**; was `[DEFERRED]` (customer-cards, review, Opus, 2026-11-05, Info)

The walk picks its two customers by `'note' in one.extra` (`walk/specs/lists.spec.ts#L18-L19`, `visual/src/walks.ts#L183-L184`), while the page draws the Note card on the text being non-empty (`ui/src/CustomerPage.tsx#L19`, `#L68`). A customer whose `note` is `''` or not a string would be the walk's "noted" one and show no Note card, so screen 10 would fail on a heading that is correctly absent. The data set has no such customer, so nothing fails today. *Fix:* pick by the same rule the page uses. *Trigger:* a change to the data set's customers, or a second page that draws a conditional card.

**Done (products-cards, `02bbebc`, 2026-11-06).** The fix is the one named: all four pickers read a `hasNote` of "a string that is not empty", the page's own rule — `walk/specs/lists.spec.ts#L17-L19`, `visual/src/walks.ts#L181-L183`, `visual/src/words.test.tsx#L26-L28`, and `visual/src/walks.test.ts#L668`, whose opener check no longer reads `DEMO_CUSTOMERS[0]` by index. The customers' two records are unchanged by the new rule (only `KH-001` carries a `note`, and it is a non-empty string), which step 2's picture compare proves: 118 screens against `main`'s 116, with screens 10 and 11 byte-identical. What is left — the rule written out four times with nothing shared — is item 105.

## 101. The join page draws no language switch though the mock did — the machine; `[DEFERRED]` (signin-look, build, Sonnet, 2026-11-05, Low)

The mock drew the language switch on the three join screens, but `Joining` (`ui/src/OperatorApp.tsx#L57-L65`) fixes the language from the device once and holds no handler or state to change it, unlike the console beside it and the client's app. The piece's bound was the words through the caller's existing handler, and giving the join page one means a state in `Joining` and a changed way of choosing the language, so the join page's frame (`JoinPage.tsx`, unchanged) draws the header and no switch. *Fix:* hold the language in `Joining` as `Console` does (`device.setLanguage` and a state) and pass `languages={LANGUAGES}` and the handler to `JoinPage` and on to `SignInFrame`, which already takes both. *Trigger:* the human's word that the join screens should carry the switch the mock showed.

## 102. The QR landing card's heading sits outside the announced region — the machine; `[DEFERRED]` (signin-look, review, Opus, 2026-11-05, Low)

`ui/src/QrLanding.tsx#L34` moved `role="status"` from the card onto the inner `Stack`, so the heading ("Signing you in" / "This code cannot sign you in") now sits outside the announced region and a screen reader hears only the body text and the button. Every word is unchanged and no test or walk reads the region. *Fix:* move the one attribute back to the element that holds the heading. *Trigger:* the first accessibility pass over the doors, or the next change to `QrLanding`.

## 103. A door draws the client's logo, the shell does not — the machine; `[DEFERRED]` (signin-look, review, Opus, 2026-11-05, Info)

A door draws `brand.logo` when there is one (`ui/src/SignIn.tsx#L74-L78`), while `Shell` draws its generic mark unconditionally and never reads `brand.logo` (`ui/src/Shell.tsx#L145-L147`), so a client with a logo sees its logo on the door and the generic mark one click later. `Shell` was outside this piece's bound and the human approved the mock's choice at 18:12. *Fix:* have `Shell` draw `brand.logo` when there is one, as the door does. *Trigger:* the first client with a logo, or the next change to `Shell`'s header.

## 104. The words test's BEFORE table was written by hand, not rendered from the old doors — the machine; `[DEFERRED]` (signin-look, review, Opus, 2026-11-05, Info)

Case 8's `BEFORE` table (`ui/src/words.test.tsx#L10-L11`) was hand-written from the doors as they then read, not rendered from `c759c43`, so it pins the words firmly from now on but did not itself prove the rewrite changed no word; the reviewer hand-checked three entries (`qr-busy`, `signin-refused`, `operator-notgiven`) and they matched. *Fix:* render the doors at `c759c43` once and compare the table to the output. *Trigger:* a doubt about a door's wording after this piece, or the next rewrite of the doors' markup.

## 105. One rule for "has a note", written out six times — the machine; `[DEFERRED]` (products-cards, review, Opus, 2026-11-06, Low)

Item 100 is closed by making every picker read the page's rule, but each reads its own copy of it: `walk/specs/lists.spec.ts#L18-L19`, `visual/src/walks.ts#L183-L184`, `visual/src/words.test.tsx#L27-L28`, the inline pair in `visual/src/walks.test.ts#L668`, and a fifth shape in the unit test, `ui/src/ListPage.test.tsx#L12` with `#L240` and `#L301`. The pages themselves hold the sixth, as the truthiness of `textIn` (`ui/src/listSheet.ts#L63`, used at `ui/src/ProductPage.tsx#L20` and `ui/src/CustomerPage.tsx#L20`). Nothing fails today — all six agree — but the next change to what a page counts as a note (a trim, say, so that a note of spaces draws no card) moves one and leaves five, and the red appears only in the human's full picture run, where a walk opens the record it still calls noted and waits for a heading that is correctly absent. *Fix:* export the rule once beside `textIn` (`noteOf`, or `hasNote` taking `extra`) and add `./lists` to `ui/package.json`'s exports, which today offers `./import-demo`, `./mock`, `./scene` and `./words` only; the walk and the visual package already import `@credo/ui/words`, so both can take it. *Trigger:* the next change to how a page decides to draw a conditional card, or a seventh copy of the rule.

## 106. The person's page can still draw a blank half, and no test says so — the machine; `[DEFERRED]` (orders-cards, review, Opus, 2026-11-06, Low)

Item 99 is marked done on the first of the two fixes it named, and this is the second, unmade: the case that item was opened for is still live. The person's page passes `side={<Stack>…</Stack>}` (`ui/src/PersonPage.tsx#L552-L553`), an element that is always truthy, and every panel inside it is conditional (`#L554`, `#L564`, `#L567`, `#L577`, `#L587`, `#L590`). A viewer who is not the root, may not delete and has no photo field gets an empty `Stack`, so `DetailColumns` still draws the details at 7/12 beside a blank 5/12 — the symptom item 90 opened. No screen shows it: of the 116 built screens 40 draw a 5/12 column and none of them is empty, so the fix would move no picture. Nothing tests the case either: only `ui/src/DetailCards.test.tsx` and `ui/src/OrdersPages.test.tsx` read a grid column, so the person's page's own tests (`ui/src/StaffPages.test.tsx`) never count its columns. *Fix:* have the page pass `undefined` when every panel is out — one `const` over the six conditions — with a test for that viewer; or, narrower, let `DetailColumns` count an element with no rendered children as none. *Trigger:* the next change to the person's page's side, or a client whose office staff are neither root nor deleters.

## 107. The new column tests count every grid column in the document — the machine; `[DEFERRED]` (orders-cards, review, Opus, 2026-11-06, Info)

`columnOf` and `columnCount` (`ui/src/OrdersPages.test.tsx#L349-L353`) query `document` for `.mantine-Grid-col`, so they hold only while the page's frame draws no other `Grid`. They are right today and read the real class the component emits, which is the point; but a `Grid` added to the shell or a banner would turn the column *indexes* wrong rather than merely failing, and the message would point at the order's page. *Fix:* scope both to the page's own grid (the `.mantine-Grid` nearest the found heading). *Trigger:* a `Grid` added to `ui/src/Shell.tsx`, or the next page to copy these helpers.

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

In three whole gates of the same tree, `ui`'s `src/StaffSetupPage.test.tsx` timed out at 5,000 ms in every run, and the others moved about: 6 timeouts, then 4, then 1, the last being that file alone at the quietest load (`20261106-1324-walk-machinery-step5-gate.log`, `20261106-1329-walk-machinery-step5-gate.log`, `20261106-1337-walk-machinery-step5-gate.log`). The four failing files passed alone. It is the slowest file rather than a broken one, and the first to starve; item 112 is the same shape in `visual`. Not chased in the walk-machinery piece. *Trigger:* the next such red; first time the file alone and raise its limit or split it.

## 114. A `ui` test reads a call count straight after awaiting a heading, and can read zero under load — the machine; `[DEFERRED]` (walk-machinery, step 5 gate, 2026-11-06, Low)

`ui/src/MyDeliveries.test.tsx#L48` expects `myDeliveries` to have been called exactly once with `DEMO_TODAY` right after awaiting the "My deliveries" heading, and read zero calls in one whole gate (`20261106-1343-walk-machinery-step5-gate.log`, the file ran 1,856 ms, no timeout). The file passed alone twice straight afterwards at a load of 16 to 18. A separate flake from item 113; neither is the walk-machinery piece's to fix. *Trigger:* the next such red; first wait for the call (`waitFor`) rather than reading it at once.

## 115. The verdict's cross-walk guard covers a moved screen but not a new one — the machine; `[DEFERRED]` (walk-machinery, review, 2026-11-06, Low)

In `found_in_compare` (`ops/full-run.sh`) a named screen that moved in one walk is not listed as "not moved" because of another walk, but a screen that is new in one walk and named-and-seen in another is not given the same care. Unreachable today: no screen name is shared by two walks. It becomes reachable the day two walks use one screen name. *Trigger:* a screen name used by two walks; then treat new like moved.

## 116. The base write removes the old pictures before it copies the new, with no `nullglob` — the machine; `[DEFERRED]` (walk-machinery, review, 2026-11-06, Low)

`walk/run.sh`'s write (`rm -f …/*.png`, then a copy loop over `$run/full-1/$w/*.png`) leaves the folder empty and writes one literal `*.png` copy attempt if a green walk produced no picture. Unreachable today: a green walk has its tests passed, each of which takes pictures, and the shape is the old block's. It becomes reachable if a walk with no pictures is added. *Trigger:* a walk that takes no picture; then guard the loop with `[ -e "$picture" ] || continue`.


## 117. A delete that fails in the deploy check shows only to whoever opens the log or the Clients list — the machine; `[DEFERRED]` (deploy-check-cleanup, review, 2026-11-07, Low)

`ops/check.sh`'s `cleanup_extra` prints a `WARN the check's client … was not deleted` line when `untenant` fails, and nothing in `ops/lib.sh` or `.github/workflows/ci.yml` reads `WARN`. This is the asked-for behaviour (a failed delete must not turn the check red); it is written down because it is the one way the old symptom, the Clients list refilling after each deploy, could come back unannounced. *Trigger:* a `check-…` client seen in ridge's Clients list after a deploy; then read the deploy's log for the `WARN`, and if it recurs make the workflow surface it.

## 118. An over-8 KB save answers 400 and the page says to try again, which cannot work — the machine; `[DEFERRED]` (edit-customer, review of line 64.1, 2026-11-07, Low)

Deferred from line 64.1's review, not a fault of the piece. `extra` is bounded at 8 KB (`shared/src/extra.ts#L34`); a customer save past it answers 400 and the page shows "What you typed is still here: try again", which is true but useless, since trying again cannot succeed. The form caps nothing. Not data loss: what was typed stays. *Trigger:* the product page copying this save shape; then give the form a cap and the 400 a notice of its own.

## 119. A save that lands and is then deleted would answer 404, "not saved" over a write that did land — the machine; `[DEFERRED]` (edit-customer, review of line 64.1, 2026-11-07, Low)

Deferred from line 64.1's review, not a fault of the piece. If a customer's write lands and the record is deleted before the answer is read again, the route answers 404 and the office would see "not saved" over a write that did land. Unreachable today: no customer delete exists. *Trigger:* a customer delete; then let the 404 after a write say what is known.

## 120. A non-string `phone`, `address` or `note` is erased by a customer save — the machine; `[DEFERRED]` (edit-customer, review of line 64.1, 2026-11-07, Low)

Deferred from line 64.1's review, not a fault of the piece. The customer save rebuilds those three keys from the body, so a stored value that is not a string is erased, where the employee's own-fields path deliberately keeps a stored value it cannot render. Reachable only through a direct call, not through the UI's sheet reader, which writes strings. *Trigger:* a second writer of customer records (an importer or another client); then keep an unrenderable value as the employee's path does.

## 121. The API address in front of the BFF answers anyone — the human; *parked* until a client signs or real client data reaches a deployment (the architecture page, 2026-11-07)

The day-one plan specified that only CloudFront would call the back end ([the architecture plan](plans/2026-10-27-architecture.md), its diagram and "Each client gets its own back end"), signed by origin access control on a Lambda function URL. Function URLs are not offered in the Region, so CloudFront reaches an API Gateway HTTP API instead ([ridge-app's call 2](plans/2026-10-28-ridge-app.md#the-humans-calls)), and the signed-origin property went with the function URL and was never regained. **Nobody decided this**: it followed from the Region's limit. Until this item, no open item and no convention recorded it — the template's own comment was the only place it was stated, and then [the architecture page](architecture.md), which is what raised it. What stands today: payload 2.0, one catch-all route, one stage, 10 requests a second with bursts of 50 and no access log; the API's address answers anyone and the throttle bounds what that costs (`ops/env.yml#L244`). The position is accepted rather than broken, on the same premise item 6 gives for deferring the backup: ridge holds no real client records, and both premises stop being true on the same day. No fix is proposed here — what a signed origin, a key or a WAF would be worth is weighed when the conditions are known. *Trigger:* a client signs, or real client data reaches any deployment, whichever comes first.

## 122. A run green in every pass is turned red by a browser that vanishes before the join, and `--write` still writes — the machine; `[DEFERRED]` (browser-guard, review of line 72, 2026-11-07, Low)

Deferred from line 72's review, not a fault of the piece. The post-join check (`walk/run.sh#L523`, `#L604`) adds a red rather than only labelling reds already collected, which was the plan's intent: a run green in every pass and comparison exits 1 if the browser vanishes in the second between the last pass and the join. `red_walks` is untouched, so `--write` still writes the bases while the run exits 1. *Trigger:* a green run turned red by that check; then make it label only.

## 123. A prune undone before the join leaves no signal — the machine; `[DEFERRED]` (browser-guard, review of line 72, 2026-11-07, Low)

Deferred from line 72's review, not a fault of the piece. `browser_lost` is set only when a pass was blocked, and the post-join check is a fresh stat, so an install that deletes and re-downloads the same revision mid-pass fails the pass silently. Harmless today. *Trigger:* a pass failing on `Executable doesn't exist` with no browser line; then record the first missing stat.

## 124. A crash between the claim's draft and its rename leaves `.claim-<pid>` in the shared folder for good — the machine; `[DEFERRED]` (browser-guard, review of line 72, 2026-11-07, Low)

Deferred from line 72's review, not a fault of the piece. `scripts/src/claim.ts` writes the draft beside `.links` and renames it; a crash between the two leaves `.claim-<pid>` in the shared browser folder, and nothing prunes it. It sits outside `.links`, so no install reads it. *Trigger:* a `.claim-*` file seen in the browser folder; then remove it by hand.

## 125. The generic hint on every claim failure made a revision mismatch read as two instructions — the machine; `[DONE]` (browser-guard, review of line 72, 2026-11-07, Low)

Deferred from line 72's review, folded into its Medium 1 fix: `walk/run.sh` now appends the way to write the claim only where writing was the failure, and names a walk in it because `--checks` alone is refused by the parser.

## 126. The 409's `current: null` arm has no case — the machine; `[DEFERRED]` (edit-a-product, review of line 64.2, 2026-11-07, Low)

In `bff/src/lists.ts` the save's conflict answer carries `current: now && docOf(now)`, so it is `null` when the record was deleted between the read and the failed write. No test reaches that arm: it needs the record removed between those two calls, and the customer route merged with the same gap. *Trigger:* the order page's plan, or a customer delete.

## 127. The product page's `extra` test dropped two of its three variants — the machine; `[DEFERRED]` (edit-a-product, review of line 64.2, 2026-11-07, Low)

In `ui/src/ListPage.test.tsx` the test that became the editable-versus-reader one kept only one of its three `extra` shapes: `{ note: 5 }` is still exercised as a save, while `{ note: '' }` is covered only through the `textIn` behaviour, and the third is gone. A change to how an emptied or non-string note is written would not fail a case of its own. *Trigger:* the next change to how a note is read or written on a detail page.

## 128. `src/walk-run.test.ts` is now the `scripts` package's floor — the machine; `[DEFERRED]` (scripts-time, review of line 73, 2026-11-07, Medium)

About 119.4 s summed over 47 tests, as long as the whole package. It met the plan's 25 % rule from the start: the plan's table missed it because the runner line it read (`src/walk-run.test.ts (34 tests | 1 failed) 67047ms`) was an aborted run, while locally the file was 86.4 s over 38 tests, 43 % of 199.98 s. The longest apply shard is about 89 s; every other file is 43 s or under. **This piece deliberately does not cover it**: a different file and a different change. *Caveat:* per-file seconds here are sums of test times, because vitest's verbose reporter prints no file totals, so the 86.7 s runner figure has no equivalent after the split. *Trigger:* the next piece that touches `scripts`' run time.

## 129. The c-storage handle in `apply-support.ts` lives in two module-level variables — the machine; `[DEFERRED]` (scripts-time, review of line 73, 2026-11-07, Low)

`scripts/src/demo/apply-support.ts#L25-L26` keeps the handle in two module-level `let`s, written at `#L31-L34` and read at `#L48`. Harmless today, and ruled out by the reviewer rather than assumed: `scripts/vitest.config.ts` sets no `isolate`, `pool` or `fileParallelism` and the script is a plain `vitest run --coverage`, so each of the ten files gets its own fork and module instance. The one break is a second `useCStorage()` in one file: the second `beforeAll` would overwrite the handle and the single `afterAll` would leak a c-storage process and a temp folder. *Fix if ever wanted:* return the handle instead of closing over it.
