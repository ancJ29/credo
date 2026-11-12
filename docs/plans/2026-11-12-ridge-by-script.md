# Nothing in ridge made by hand: the demo copies by command, and a deploy you press

**What the reading found against the piece's three premises, first.** (1) The six demo copies are
the only part of ridge still made by hand: true. The operator has its script (`ops/operator.sh`),
but nobody has run it on the new ridge, so running it is one of your acts below. There is no code
for it. (2) "The seed's scripts can make them": **false as they stand.** The seed is built never to
make a client (`ops/seed.sh#L6`); a missing copy is `missing`, "not on this service, left"
(`scripts/src/demo/apply.ts#L638`). The making goes into `ops/root-password.sh`, which already
takes the six codes, a terminal and the password you type, and the seed then fills the copies with
no change. A fresh copy also needs **four presses** of the seed at today's bound: a first fill
holds 7 days, and one press applies at most 2 (`apply.ts#L50`, `#L59`). (3) "A pressed workflow can
run the deploy scripts unchanged": **true.** `ops/release.sh`, `ops/app.sh` and `ops/check.sh` read
`GITHUB_ACTIONS` and `GITHUB_OUTPUT` and never the event's name (`ops/lib.sh#L160`, `#L194`,
`ops/release.sh#L70`). But the press costs less than the deploy ideas page priced it. It needs no
new workflow file: `ci.yml` gets one more trigger, and its deploy job's `if` lets that trigger
through.

## At a glance

Ridge came back yesterday by commands, empty: no demo copy, no operator. This piece makes
re-making it cost commands, never a person's afternoon, and adds the button you asked for on
2026-11-10.

| When | You | What happens |
| --- | --- | --- |
| first landing | press **Run workflow** on `ci`, on `main` | the four gates, then the same deploy job a push runs |
| second landing | `ops/root-password.sh ridge <a partner's codes>`, once a partner, typing that partner's password | each named copy that is missing is made by the console's own create, then given the password |
| then | press **Run workflow** on `seed` until it stops saying `STILL BEHIND` (four times on a fresh ridge) | each copy is filled and brought up to yesterday |
| then | `ops/operator.sh ridge` | the operator, and a join link for your passkey |

Everything here reuses what already exists. The price is about 62 to 74 of the machine's minutes
by its ledger, plus about an hour and a half of GitHub's runners and a few minutes of your typing.

## The slice

One slice, walked when the plan ends: you press a deploy and it goes green. You make the six
copies with three terminal runs and fill them with seed presses. Then you open your own copy's
link and sign in as its root, and today's deliveries are waiting. **It lands twice**, because the
halves share no file and the first is ready in minutes:

1. **The pressed deploy goes first.** It is three lines of workflow and a pin. Its first press is
   also the deploy job's first run onto the role the re-up made, which the re-up's recap still
   marks unknown. The seed takes that same role in that same environment, so the role gets proved
   before four seed presses depend on it. It also lands first on the lines of `ci.yml` and
   `ops/test.sh` that the activity log changes right beside it (below).
2. **The demo copies by command.** This half carries the code, and its walk is the slice's.

What is **not** here, so nobody pulls it in:
- **A teardown, by script or by workflow.** Your word of 2026-11-10: "let skip it from github
  action for now (will add later)". The script waits with it: open item 314, parked.
- **A change to the seed's bound.** That is your point below. The plan runs on today's bound
  either way.
- **The push's own deploy.** It stays. "have to way of deploy" reads here as two ways: a push to
  `main` deploys by itself, as now, and you can also press. If you meant the press only, say so,
  and a one-line follow-up removes the push's deploy.
- **A new workflow file for the press.** `deploy_guards` pins `needs: [check, e2e, ops, app]`
  (`ops/test.sh#L805`), so a file of its own would have to copy the four gate jobs as well as the
  deploy's 100 lines, and both copies would drift. The production lane's draft makes the other
  choice for production, for its own reason: a separate role behind your approval.

## What the code decides

- **Where a copy is made.** `ops/root-password.sh` already holds the six codes, checks each
  against the mapping (`scripts/src/root-password.ts#L49`), refuses in a job
  (`ops/root-password.sh#L80`) and reads every code before its first write (`#L59-L71`). A code
  with no client stops the whole run today (`#L63`). Instead, such a code is listed as **to make**.
  Once every code has been read and no other refusal stands, each listed copy is made with
  `createClient` (`bff/src/records/clients.ts#L56`, the function behind the console's own create at
  `bff/src/app.ts#L471`) under the mapping's company name. Its random first password is dropped and
  never printed, and then the typed password is set as it is today. *Rejected:* making the copies
  inside the seed. One press would then make and fill, but the seed would have to print or drop a
  password inside a public log. Every seed test also serves five copies that are missing on
  purpose (`scripts/src/ridge-seed.test.ts#L113` and the rows after it; `ops/test.sh#L2424`), so
  each test would fill six copies instead of one. *Rejected:* a seventh script with the full chain
  of checks copied in. `root-password.sh` already has that chain, and a copy that nobody can sign
  in to is no use.
- **A made copy is still new to the seed.** `isFresh` passes a root of any content, sessions and
  the starting settings (`apply.ts#L159-L175`). The password write touches only the root, so the
  next press does the first fill. `ridge-root-password.test.ts#L284` proves this already for a
  copy the console made.
- **Where the press lives.** `ci.yml`'s `on:` (`#L8-L44`) gains `workflow_dispatch:` after
  `pull_request`. `push_paths` stops at the next key (`ops/lib.sh#L664`), so the 16 paths still
  read as 16 (`ops/test.sh#L1064-L1065`). The deploy job's `if` at `ci.yml#L217` becomes
  `(github.event_name == 'push' || github.event_name == 'workflow_dispatch') && github.ref ==
  'refs/heads/main'`. That is an allow-list: a pull request still deploys nothing. A press ignores
  `paths:`, so it also deploys a tip that an earlier documents-only push left undeployed. The
  `ridge` group (`#L225-L227`) keeps a press and a push from overlapping.

## The cases, the machine's

| # | The case | Held by |
| --- | --- | --- |
| 1 | A press of `ci` on `main` runs the four gates, then the deploy job | `ops/test.sh` `deploy_guards`, the `if` pinned |
| 2 | A press on any other branch deploys nothing | `ops/test.sh#L858-L859`, kept |
| 3 | A pull request never deploys, with the new trigger in the file | `ops/test.sh`, a new refusal: an `if` that admits `pull_request` |
| 4 | `ci.yml` holds `workflow_dispatch:`, and the push paths still read as 16 | `ops/test.sh`, one check beside `#L1064` |
| 5 | A named copy that is not on the service is made by the console's create under its mapped company, then given the typed password and read back by a sign-in | `ridge-root-password.test.ts`, new |
| 6 | Every code is read before anything is made: a wrong index or a root that is not a root refuses the run, and nothing is made | `ridge-root-password.test.ts#L309`, kept; its no-client half moves to case 5 |
| 7 | An unfinished deletion under a named code refuses before anything is made | `ridge-root-password.test.ts`, new |
| 8 | A made copy is new to the seed, so the next press fills it | `ridge-root-password.test.ts`, new, after `#L284` |
| 9 | No line holds a made copy's first password, the typed one or a hash | `ridge-root-password.test.ts#L458`, extended |
| 10 | A code outside the six still refuses, and nothing is made | `ridge-root-password.test.ts#L245`, kept |
| 11 | `ops/root-password.sh` run whole makes a named copy missing on its stand-in, and its root is set | `ops/test.sh`, its root-password run (`#L2118`) |

## The steps

🤖 is the machine's and 👤 is yours: no credentialed command (`aws`, `gh`) runs in this sandbox.
Each hand-off comes as one command in its own block, with every path absolute. Sizes come from the
ledger's last runs of the same shape: a build step 2 to 11 minutes (median 5), a review 6 to 13, a
fix pass 6 to 8, a one-off 3 to 7, a log read 1 to 2, a recap 3 to 8.

**First landing: the pressed deploy**

- [ ] **1. The trigger, the condition and their guard.** `ci.yml`'s `on:` and `#L217` as above;
  `ops/test.sh#L804`'s pin to the new line; cases 1, 3 and 4. The words that say only a push
  deploys: `ops/README.md#L6`, the table row `#L16` and "The deploy job" (`#L131-L135`);
  `CLAUDE.md#L2`'s Ship; `docs/architecture-detail.md#L251`. *Done when:* `bash ops/test.sh` and
  `shellcheck -x ops/*.sh walk/*.sh services/c-storage/scripts/*.sh` exit 0; cases 1, 3 and 4 seen
  red once each (the old `if`, an `if` admitting `pull_request`, the trigger removed); `actionlint`
  read by hand (`ops/CLAUDE.md`'s OP3); the citation test green. **About 7 min.**
- [ ] **2. Review and fix.** Another model reads the change (QA rule 5). *Done when:* each finding
  is tagged and the fix pass's own gate is green. **About 8 min**, plus 6 if anything is fixed.
- [ ] **3. The press, read.** The piece lands on `pre-merge` and `main` takes it. 👤 Your push of
  `main`, then the one-off `<stamp>-ridge-pressed-deploy.sh`: `gh workflow run ci.yml --ref main`,
  the new run's id, a watch with a line every 30 seconds, then the run's log tee'd into the
  project's logs folder. *Done when:* 🤖 reads that log whole. The deploy job ran with event
  `workflow_dispatch`; the role was taken; the log shows `released <sha>` for main's tip; the
  check ends `== green` and its step through the app's address did not skip. **About 5 min**, and
  the run's own length on GitHub.
- [ ] **4. The recap.** `docs/recaps/2026-11-12-ridge-by-script.md`, the first half; the re-up
  recap's open marker filled from step 3's reading; `docs/products.md#L80` (a push or a press).
  *Done when:* committed with the citation test green. **About 3 min.**

**Second landing: the demo copies by command**

- [ ] **5. A missing copy made, then given its password.** `scripts/src/root-password.ts`
  (`readTargets`, `setRootPasswords`); the header of `ops/root-password.sh` (`#L1-L17`: it now
  makes a named copy that is missing, and "nothing else of the copy changes" now holds only for a
  copy that was there). Case 5 comes first and end to end: a copy made on the test's real
  c-storage, then filled by `runRidge(['seed'])`. Cases 6 to 11 follow. *Done when:* `pnpm --filter @credo/scripts check` and
  `bash ops/test.sh` exit 0, coverage at 100 %, each case seen red once. **About 10 min**, two
  parts at about 5.
- [ ] **6. The words that send you to `/operator`.** `ops/README.md`'s seed section
  (`#L233-L243`) and its root-password section (`#L206-L226`); `seed.yml#L4`'s comment;
  `ops/seed.sh#L6`; `scripts/src/demo/mapping.ts#L6`; `docs/products.md#L73` and `#L84`. *Done
  when:* the citation test is green, and `git grep -nE 'at .?/operator|Make it at$' ops/ .github/
  docs/products.md scripts/src/` counts 0 (7 today). **About 3 min.**
- [ ] **7. Review and fix.** As step 2. **About 13 min**, plus 6.
- [ ] **8. The copies, made and filled on ridge.** The piece lands, and 👤 you push `main`. The push
  deploys by itself, since `scripts/**` is a deploy path (`ci.yml#L16`). Then 👤 you run the one-off
  `<stamp>-ridge-demo-copies.sh`. It waits for `ci`'s run on main's tip to end green and refuses
  if it is red. It runs `ops/root-password.sh ridge` three times, once a partner (`p1`'s two codes,
  `p2`'s, then yours, the `-3` pair), each time with the password you type. Then it presses `seed`,
  watches the run and reads the run's summary line, and presses again while that line says
  `STILL BEHIND`. It stops at five presses and on any red. Before it waits it prints how long it
  may wait and until what clock time. *Done when:* 🤖 reads every log whole: six copies made and
  six roots set, each read back by a sign-in; the first press's summary shows `0 not on this
  service`; the last shows `6 up to date`; no password or key in any line; and the first press's
  Seed-step minutes are kept as the first measured first fill (`ops/seed.sh#L16-L17`). **About
  8 min**, and about an hour of GitHub's runners. If the first press stops at the step's 18
  minutes, run `ops/seed.sh ridge` once from your terminal, where no step limit applies, and the
  presses go on from there.
- [ ] **9. The operator.** 👤 `ops/operator.sh ridge`, then its link opened in Chrome for your
  passkey. *Done when:* 🤖 its log says the link was shown once and is in no log, and it ends at
  exit 0. **About 2 min.**
- [ ] **10. The recap, the second half.** The readings of steps 8 and 9, and `docs/products.md#L72`
  and `#L73` true. *Done when:* committed, the citation test green, `git grep -nE '/Users/|~/'`
  finds nothing. **About 3 min.**

The sum is about 62 minutes, and 74 if both reviews need a fix pass.

## Your points

**At step 3: a deploy you pressed.** One `ci` run that you started from the button: four gates
green, then c-storage released, the app shipped, and the check green through the app's address.
Does it read true as "ridge deploys when I press"? A yes closes this half. A no reopens step 1 at
whatever did not convince you. A push still deploys by itself; say so if you meant the press alone.

**At step 8: how fresh the demo copies must be.** One press of `seed` catches up two days a copy,
so a week unused takes four presses and a month fifteen. Recommended: refresh only when asked, as
you set on 2026-11-08, but have one press always reach yesterday and leave older missed days
empty. Is yesterday plus today enough for a partner? A yes opens item 315, a small piece. A no
keeps today's presses.

**At step 8's end: your own copy.** Open your `-3` copy's link and sign in as root with the
password you typed. You will see today's deliveries waiting, with last week's orders and closed
days behind them. Does it read as a running company a partner can be handed? A yes lets you send
`p1` and `p2` their links and passwords privately; that act is yours. A no reopens the fill. Each
company's own address will change these links.

## Files another lane also changes, and who lands first

The cut's order is ridge first, so both landings here go before the lanes named below. Whoever
lands second takes `pre-merge` in and keeps both changes.

| File | Here | Also changed by |
| --- | --- | --- |
| `.github/workflows/ci.yml` | `on:`, the deploy job's `if` (`#L217`) | the activity log (the `needs` line right above it, `#L216`, both path lists), the continuous copy (the release step, `#L296-L302`); the production draft cites `#L217` |
| `ops/test.sh` | the pin at `#L804`, two checks | the activity log (the `needs` pin right below it, `#L805`, and the 16-path count); the continuous copy, the Slack alarm, the door, the pooled shape, the store's copy tool |
| `scripts/src/root-password.ts` | the copies made | the pooled shape (item 246: reaching a company through its box); it lands after, and the copies this makes are on the home box |
| `ops/README.md` | the deploy job, the root password, the seed | the continuous copy, the door, the Slack alarm, the activity log, the store |
| `docs/products.md` | rows 72, 73, 80, 84 | the Slack alarm, the activity log |
| `CLAUDE.md`, `docs/architecture-detail.md` | how a deploy starts | the activity log, the door, the pooled shape |

The lines at `ci.yml#L216-L217` and `ops/test.sh#L804-L805` sit next to each other, so git will
show a conflict even though the two changes are both kept. Each company's own address moves the
operator's address: if it lands after step 9, its plan already runs `ops/operator.sh ridge
--replace`.

*Hazard no gate catches:* a reading reported from the plan instead of the run. *Guard:* each
reading at steps 3 and 8 names its log line, and the first fill's minutes come from the run, not
from this page.
