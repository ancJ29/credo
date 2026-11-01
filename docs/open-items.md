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

## 11. Two places inline a Vite build into one HTML file — the machine; *parked* until a third caller (the visual report plan, step 4, 2026-10-28)

`ui/vite.mock.config.ts` (a plugin, for `pnpm mock`) and `visual/src/build.ts` (`onePage`, for
`pnpm report`) each fold Vite's script and styles into the one HTML file a browser opens from
`file://`, with the same two patterns. They differ in where they run: the plugin inside the
bundle's own write, `onePage` on the in-memory output so it can add the report's data. A shared
helper would make `visual` depend on `ui`'s config, or `ui` on `visual`. Join them when a third
page needs it, in a package both already depend on, or when Vite changes the tags it emits and the
two patterns must be fixed twice.

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

## 16. A partner's post that loses its title and `By:` outside a code fence joins the one above — the machine; *parked* until the real copy of Slack's text is read (the sharing plan, step 6, 2026-10-29)

`pnpm answers --partners` ends a block at a title or a code fence's end. When a post's title and
its `By:` line are both lost and no fence stands between, its answer lines read under the previous
post's label; only a chat name-and-time line separates them, and no pattern for it is sound before
the real copy of Slack's text is read. *Trigger:* that copy, from the step 6 round trip.

The case it does not cover, the other way: in `--partners` mode, if Slack's copy loses the fences, a
chat line that starts `by:` inside a block now spoils a valid partner's block, since any
`By:`-looking line inside one counts as a `By:` line. The refusal is loud, by line, and nothing is
misattributed; it waits for the same copy.

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
Still open here: the `SignIns.test.tsx` and `cli.test.ts` reds. Item 23 (the scripts test) is not touched.

A scene can hang its full 30 s at a low load with no frozen process (line 31's review, 2026-11-01): the second `answer` in "With
partners…" (`visual/src/cli.test.ts#L214`) failed with "walk admin-staff, screen staff-14-search: the scene did not end in 30000 ms"
at a load of 1.4 to 1.8, the other draws in that process staying at 26 to 27 s
(`logs/20261101-0839-ci-timeouts-review-scene-hang.log`). Each step waits at most 3 s to find and 3 s to go still, so
`runSteps` settles well inside 30 s; the phase never reaching `done` or `failed` points at the status update not landing
(`visual/src/scene.tsx#L54-L66`, awaited at `visual/src/words.tsx#L120-L131`). A red like it is not filed under the sandbox's freeze,
and no test budget covers it. To diagnose after the 11-04 demo, or the first time it shows on GitHub: log in `drawnSceneWords`
whether `runSteps` had settled when the 30 s ran out. The 240 s for every `visual` test stays (Decide 48); item 37 holds the finer budget.

`ui/src/StaffRecord.test.tsx#L315` (the editor's refusal of three bad fields) timed out at 5302 ms in a loaded whole check (`logs/20261101-0852-orders-delivery-check.log`). `4760ad9` cut it from 975 to 803 ms alone, a margin of about 2x under load. The next step, after 11-04 or at its next red: split it into its three cases, one behaviour a test (QA rules 1 and 4).

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
  request's cancel): a moved order is left as it is and the page reads the request as none, so the
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

## 37. `visual`'s tests: review findings 3 to 7 of line 31 and a finer budget, deferred under the 11-04 demo's exception — the machine; *parked* until after the demo (ci-timeouts, step 3, 2026-11-01)

The review of line 31 fixed its High and Medium findings; these stay.
- **Finding 3, `visual/src/cli.test.ts#L111-L119` and `visual/src/setup.ts#L56-L58`:** the shared build is charged to whichever test
  awaits it first, and when that test times out `report()` keeps running with `installDom`'s globals, so the next `beforeEach` fails
  with `Cannot read properties of undefined (reading 'setItem')` (the `window is not defined` of item 27). Fix: the tests that read
  the build under one nested `describe`, the build in its `beforeAll`, and 240 s as that block's budget.
- **Finding 4, `visual/src/cli.ts#L70-L73`:** no test holds that `answer` draws only the screens a block answers; passing `undefined`
  for `asked` leaves the cheap answers tests green and slower (20 ms to 27 s). Fix: a test of `answer` that counts what it draws,
  through a words reader passed in or a `vi.mock('./words', …)` wrapper in a small file of its own.
- **Finding 5, `visual/src/cli.test.ts` (the four whole-page tests) and `.github/workflows/ci.yml#L117`:** the file is the `app` job's
  critical path, about 370 s on GitHub; the job ends near 10.5 of its 15 minutes now and about 11.5 after line 30, plus about a
  minute per ten screens. Fix: the report test's build serves as the file's one build, and the partners' "Yes to all" holds its
  rule with `parseBlock` over the whole message plus `answer` on a few keys.
- **Finding 6, `visual/src/take.ts#L16` and `visual/src/cli.test.ts#L235-L236`:** two comments say "every screen" where it is now
  "the screens asked". Fix: reword both at the next touch.
- **Finding 7, `visual/src/cli.test.ts#L107-L109` and `#L123`:** `Built` repeats `Report`, and `as unknown as Built` would hide a
  renamed field. Fix: read `Report` directly.
- **The finer budget (Decide 48's (b), done honestly):** the build's readers under one `describe` with 240 s on that block alone,
  then `visual/vitest.config.ts`'s default lowered to what the other tests need (the slowest takes about 35 s on GitHub).

*Trigger:* after the 11-04 demo, or the `app` job nearing its 15 minutes, or line 32's screens pushing a whole-page test past 120 s.

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
