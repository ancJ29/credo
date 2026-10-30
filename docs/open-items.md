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

## 25. The app's fixed top bar lands mid-page in a full-page picture, so a screen reached after scrolling can differ between two runs on the bar alone — the walk; *parked* until the walk is next changed, or a second such difference (the employee list plan, step 16, 2026-10-29)

The walk scrolls to a panel before it takes the picture, and a full-page picture at phone width draws the
fixed bar (company name, menu, avatar) at the scroll position the walk leaves. That position moved a little
between the fake run and the full run, so `staff-15-code-changed-vi-390` differed (3597 pixels) on the bar
alone; the fields, words and layout were the same. The fix belongs to the next change to the walk: scroll to
the top, or capture with the bar unfixed, before each picture. It moves every such screen's base and its fake
reference at once, so it is done once, not per screen.

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
