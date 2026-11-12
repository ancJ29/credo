# Nothing in ridge made by hand: the demo copies by command, and a deploy you press

**What the reading found against the piece's three premises, first.** (1) The six demo copies are
the only part of ridge still made by hand: true. The operator has its script (`ops/operator.sh`),
but nobody has run it on the new ridge, so running it is one of your acts below. There is no code
for it. (2) "The seed's scripts can make them": **false as they stand.** The seed is built never to
make a client (`ops/seed.sh#L6`); a missing copy is `missing`, "not on this service, left"
(`scripts/src/demo/apply.ts#L640`), and a used one is refused (`#L645-L646`). **Re-cut on
2026-11-12 to your answer:** the copies are remade, not kept. One new terminal command deletes each
copy whole, makes it again and fills three weeks ending yesterday, by functions that exist. (3) "A pressed workflow can
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
| second landing | push `main` | the push deploys the new command (`scripts/**` is a deploy path) |
| then, on a ridge with no operator | `ops/operator.sh ridge` | the operator, and a join link for your passkey |
| then | `ops/demo-remake.sh ridge`, typing one password for each partner, then `remake ridge` | each of the six copies deleted whole, made again, given its partner's password and filled with 21 days ending yesterday: one run of about 2.6 hours |

Everything here reuses what already exists. The price is about 64 to 76 of the machine's minutes
by its ledger, plus GitHub's runners for the press and the push, the one run of about 2.6 hours in
your terminal, and a few minutes of your typing.

## The slice

One slice, walked when the plan ends: you press a deploy and it goes green. You remake the six
copies with one terminal run. Then you open your own copy's link and sign in as its root: three
weeks of a company behind you, and today's deliveries waiting. **It lands twice**, because the
halves share no file and the first is ready in minutes:

1. **The pressed deploy goes first.** It is three lines of workflow and a pin. Its first press is
   also the deploy job's first run onto the role the re-up made, which the re-up's recap still
   marks unknown. It also lands first on the lines of `ci.yml` and `ops/test.sh` that the
   activity log changes right beside it (below).
2. **The demo copies by one command.** This half carries the code, and its walk is the slice's.

What is **not** here, so nobody pulls it in:
- **A teardown, by script or by workflow.** Your word of 2026-11-10: "let skip it from github
  action for now (will add later)". The script waits with it: open item 314, parked.
- **The freshness point, and item 315.** A remake is now the way to fresh copies, so no press has
  to reach yesterday by itself; both are gone. The press keeps its 2 days, a catch-up between remakes.
- **Ridge's photos in R2.** This command leaves a remake's old photos: the console's delete calls
  the same `deleteClient` and leaves them too, so the photos lane's sweep goes in that function and
  the remake inherits it. Meanwhile at most about half a gigabyte a remake (2,520 deliveries at
  `shared/src/photo.ts#L12`'s 200 KB): cents.
- **A workflow for the remake.** 2.6 hours is far past the Seed step's 18 minutes (`seed.yml#L83`).
- **The push's own deploy.** It stays. "have to way of deploy" reads here as two ways: a push to
  `main` deploys by itself, as now, and you can also press. If you meant the press only, say so,
  and a one-line follow-up removes the push's deploy.
- **A new workflow file for the press.** `deploy_guards` pins `needs: [check, e2e, ops, app]`
  (`ops/test.sh#L805`), so a file of its own would have to copy the four gate jobs as well as the
  deploy's 100 lines, and both copies would drift. The production lane's draft makes the other
  choice for production, for its own reason: a separate role behind your approval.

## What the code decides

- **One command, `ops/demo-remake.sh ridge`, chained from functions that exist.** Before any
  write: ridge alone (`refuse_real`, `ops/lib.sh#L200`), a terminal, main and this commit, as
  `ops/root-password.sh#L78-L92`; one password for each partner (`p1`, `p2`, then yours), typed twice,
  checked against that partner's codes (`checkRootPassword`, `scripts/src/root-password.ts#L40`);
  the six copies listed and `remake ridge` typed back; the stack, the tunnel, the box's floor and
  `/health`, as `ops/seed.sh`. Then `ridge_cli remake`, per copy side by side: `deleteClient`
  (`bff/src/records/clients.ts#L134`) with the index, then without while records are left, 200 a
  call (`#L117`); `createClient` (`#L56`) under the mapping's company, its first password dropped,
  as `startDemo` (`scripts/src/demo/apply.ts#L782-L787`); the partner's password by
  `setRootPasswords` (`root-password.ts#L109`), read back by a sign-in; the first fill, `applyAll`
  with 0 days (`apply.ts#L748`). On an empty ridge all six are simply made. The terminal already
  deletes check clients by one such call (`scripts/src/ridge.ts#L63-L91`); this loops it.
  *Rejected:* the copies made in `ops/root-password.sh`, the first cut: it kept used copies.
- **21 days ending yesterday, in rounds the tunnel holds.** `HISTORY_DAYS` (`apply.ts#L50`) goes
  to 21; `through` stays yesterday (`#L629`). A tunnel lasts the endpoint's hour (`ops/lib.sh#L519`,
  `ops/tunnel.sh#L61`), and 21 days at 7.5 minutes (`apply.ts#L55`) are about 157, so the fill goes
  in rounds, each a new tunnel and `/health` read: `ridge_cli seed --round`, the seed's own
  catch-up (`ridge.ts#L219-L248`) at a new `DAYS_PER_ROUND` of 5, about 38 minutes, until no
  `STILL BEHIND`. `--go-on` runs the rounds alone from the ledger, asking and deleting nothing.
- **The wait notice.** Before the first round, the minutes and the clock time they end at, read by
  `date` there (`clock`, `ops/tunnel.sh#L27`, moved into `lib.sh`); in a round, a line every 30
  seconds by `tunnel_hold`'s sleep and wait (`ops/lib.sh#L514-L520`), ended with the round.
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
| 5 | A used copy (filled, edited, a session open) is deleted to zero records, made again, signs in with its partner's password, and holds a new ledger. *Red:* one `deleteClient` call | `ridge-remake.test.ts`, new, copied from `ridge-root-password.test.ts` |
| 6 | A copy not on the service, as after ridge down and up, is made and filled. *Red:* it is skipped | `ridge-remake.test.ts` |
| 7 | An unfinished earlier deletion is finished, then the copy made. *Red:* no resume, so `createClient` answers `taken` (`clients.ts#L68`) | `ridge-remake.test.ts` |
| 8 | `p1`'s password signs in to `p1`'s copies and is refused at `p2`'s. *Red:* one password for all | `ridge-remake.test.ts` |
| 9 | A bad or missing password is status 2 before any delete. *Red:* the check after the delete | as `ridge-root-password.test.ts#L179` |
| 10 | The first fill applies no day; each round at most 5, `STILL BEHIND` until the last, which ends at yesterday, 21 days in the ledger. *Red:* `HISTORY_DAYS` at 7 | `ridge-remake.test.ts` |
| 11 | No line holds a typed or first password, or a hash. *Red:* the first password printed | as `ridge-root-password.test.ts#L458` |
| 12 | Another environment, no terminal or a job refuses, exit 2, the stand-in unchanged. *Red:* the job's check removed | `ops/test.sh`, as its root-password run (`#L2295`) |
| 13 | A reply other than `remake ridge` refuses, exit 2, nothing deleted. *Red:* no confirmation | `ops/test.sh` |
| 14 | The notice names minutes and a clock time; a round past 30 seconds prints at 30; a dropped round ends red and `--go-on` finishes it. *Red:* no ticker | `ops/test.sh`, a stand-in node half under `RIDGE_SCRIPTS_DIR` (`ops/lib.sh#L685-L688`), no 21-day fill |
| 15 | `DAYS_PER_ROUND` at 7.5 minutes with a fifth over fits 50 minutes, the hour less ten. *Red:* 7, on a scratch copy | `ops/test.sh` beside `#L977-L982`, as `#L1038-L1042` |
| 16 | The script joins the stance check at column 0 (item 322); its floor goes from 9 to 10 (`#L3190`). *Red:* no `refuse_real` | `ops/test.sh` |

## The steps

🤖 is the machine's and 👤 is yours: no credentialed command (`aws`, `gh`) runs in this sandbox.
Each hand-off comes as one command in its own block, with every path absolute. Sizes come from the
ledger's last runs of the same shape: a build step 8 (the median of the last three), a review 6 to 13, a
fix pass 6 to 8, a one-off 3 to 7, a log read 1 to 2, a recap 3 to 8.

**First landing: the pressed deploy**

- [x] **1. The trigger, the condition and their guard.** `ci.yml`'s `on:` and `#L217` as above;
  `ops/test.sh#L804`'s pin to the new line; cases 1, 3 and 4. The words that say only a push
  deploys: `ops/README.md#L6`, the table row `#L16` and "The deploy job" (`#L131-L135`);
  `CLAUDE.md#L2`'s Ship; `docs/architecture-detail.md#L251`. *Done when:* `bash ops/test.sh` and
  `shellcheck -x ops/*.sh walk/*.sh services/c-storage/scripts/*.sh` exit 0; cases 1, 3 and 4 seen
  red once each (the old `if`, an `if` admitting `pull_request`, the trigger removed); `actionlint`
  read by hand (`ops/CLAUDE.md`'s OP3); the citation test green. **About 7 min.**
  *Done 2026-11-12:* `bash ops/test.sh` and the `shellcheck` line ended at exit 0; the old `if` and an `if`
  admitting `pull_request` each reddened the pinned-condition check, and the trigger removed reddened the
  new trigger check, each put back; `actionlint` on `ci.yml` printed nothing; the citation test passed (32 tests).
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

**Second landing: the demo copies by one command** (re-cut 2026-11-12: the three copy steps, the
seed presses' one-off among them, are now step 5)

- [ ] **5. The remake, one build in two parts**, each the ledger's code-shape step (8 minutes, the
  median of its last three). **The node half, end to end first:** `remake`, `remake --check` and
  `seed --round` in `scripts/src/ridge.ts`; `HISTORY_DAYS` and `DAYS_PER_ROUND` in `apply.ts`;
  `ops/test.sh#L2563-L2565`'s words to 21 days and 19 left. Case 5 first, on the test's real
  c-storage, `runRidge(['remake'])` then rounds to up to date; then cases 6 to 11. **About 8 min.**
  **The terminal half:** `ops/demo-remake.sh`, its header in `ops/root-password.sh#L1-L17`'s shape,
  and `clock` into `lib.sh`; cases 12 to 16. **About 8 min.** *Done when:* `pnpm --filter
  @credo/scripts check`, `bash ops/test.sh` and step 1's `shellcheck` line exit 0, coverage at
  100 %, each case seen red once.
- [ ] **6. The words that send you to `/operator`.** `ops/README.md`'s seed section (`#L262`) and a
  remake section beside the root password's (`#L239`); `seed.yml#L4`'s comment; `ops/seed.sh#L6`;
  `scripts/src/demo/mapping.ts#L6`; `docs/products.md#L72`, `#L73` and `#L84`. *Done when:* the citation
  test is green, and `git grep -nE 'at .?/operator|Make it at$' ops/ .github/ docs/products.md
  scripts/src/` counts 0 (7 today). **About 3 min.**
- [ ] **7. Review and fix.** As step 2. **About 13 min**, plus 6.
- [ ] **8. The push.** The piece lands on `pre-merge`, `main` takes it, and 👤 you push `main`. The
  push deploys by itself, since `scripts/**` is a deploy path (`ci.yml#L16`). *Done when:* 🤖 reads
  `ci`'s run on that tip whole, green. **About 2 min.**
- [ ] **9. The operator, on a ridge that has none.** 👤 `ops/operator.sh ridge`, then its link opened
  in Chrome for your passkey. After ridge down and up (the ridge-cycle lane) this is your first
  step and the remake your next; whichever lane lands second writes that order into
  `ops/README.md`. *Done when:* 🤖 its log says the link was shown once and is in no log, and it
  ends at exit 0. **About 2 min.**
- [ ] **10. The one run.** 👤 `ops/demo-remake.sh ridge` in your terminal, about 2.6 hours, its log
  tee'd into the project's logs folder. *Done when:* 🤖 reads the log whole: six copies deleted to
  zero records, made and set, each read back by a sign-in; five rounds, the last saying 6 up to
  date at yesterday; no password or key in any line; and the first fill's minutes kept as its first
  measure (`ops/seed.sh#L16-L17`). **About 2 min.**
- [ ] **11. The recap, the second half.** The readings of steps 8 to 10, and `docs/products.md`
  `#L72` and `#L73` true. *Done when:* committed, the citation test green, `git grep -nE '/Users/|~/'`
  finds nothing. **About 3 min.**

The sum is about 64 minutes, and 76 if both reviews need a fix pass.

## Your points

**At step 3: a deploy you pressed.** One `ci` run that you started from the button: four gates
green, then c-storage released, the app shipped, and the check green through the app's address.
Does it read true as "ridge deploys when I press"? A yes closes this half. A no reopens step 1 at
whatever did not convince you. A push still deploys by itself; say so if you meant the press alone.

**At step 8: the push.** The remake is on `main`, reviewed, every gate green. Pushing `main`
deploys it to ridge by itself, since it changes the scripts, but the copies stay as they are until
you run the command. Push now? A yes is the push; the operator and the run follow when you choose.
A no keeps it on `main`, and nothing reaches ridge.

**At step 10: the one run, about 2.6 hours.** You run the command in your terminal and type a
password for each partner, then `remake ridge`. It says how long it will take and until what
time, then prints a line every 30 seconds. All six copies are deleted and made again, and anything
a partner changed in them is lost, by design. Is now a time no partner is using theirs? A yes
starts the run. A no leaves the copies as they are.

**At step 10's end: your own copy.** Open your `-3` copy's link and sign in as root with the
password you typed. You will see three weeks of orders, deliveries and closed days ending
yesterday, and today's deliveries waiting. Does it read as a running company a partner can be
handed? A yes lets you send `p1` and `p2` their links and passwords privately; that act is yours.
A no reopens the fill. Each company's own address will change these links.

## Files another lane also changes, and who lands first

The cut's order is ridge first, so both landings here go before the lanes named below. Whoever
lands second takes `pre-merge` in and keeps both changes.

| File | Here | Also changed by |
| --- | --- | --- |
| `.github/workflows/ci.yml` | `on:`, the deploy job's `if` (`#L217`) | the activity log (the `needs` line right above it, `#L216`, both path lists), the continuous copy (the release step, `#L296-L302`); the production draft cites `#L217` |
| `ops/test.sh` | the pin at `#L804`, two checks; the remake's cases, the seed's 21 days | the activity log (the `needs` pin right below it, `#L805`, and the 16-path count); the continuous copy, the Slack alarm, the door, the pooled shape, the store's copy tool, ridge down and up, the company address |
| `ops/lib.sh` | `clock` moved in | the continuous copy, the Slack alarm, ridge down and up, the company address |
| `scripts/src/ridge.ts`, `scripts/src/demo/apply.ts` | `remake`, `seed --round`, the 21 days | no other lane's branch |
| `ops/README.md` | the deploy job, the remake, the seed | the continuous copy, the door, the Slack alarm, the activity log, the store |
| `docs/products.md` | rows 72, 73, 80, 84 | the Slack alarm, the activity log |
| `CLAUDE.md`, `docs/architecture-detail.md` | how a deploy starts | the activity log, the door, the pooled shape |

The lines at `ci.yml#L216-L217` and `ops/test.sh#L804-L805` sit next to each other, so git will
show a conflict even though the two changes are both kept. Each company's own address moves the
operator's address: if it lands after step 9, its plan already runs `ops/operator.sh ridge
--replace`.

*Hazard no gate catches:* a reading reported from the plan instead of the run. *Guard:* each
reading at steps 3 and 10 names its log line, and the first fill's minutes come from the run, not
from this page. *Hazard:* the first fill is unmeasured, and it runs inside the first tunnel's hour
with the deletes. *Guard:* a stop ends red and names where: in the deletes or the makes, the same
command again finishes what is left (case 7); in the fill, `--go-on` goes on from the ledger.
