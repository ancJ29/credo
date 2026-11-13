# ops: the runbook

The why of every step lives in [the ridge plan](../docs/plans/2026-10-28-ridge.md); this file is
the order and the commands. Each script writes its log to `logs/` in the credo root (the folder
that holds `.bare`) and ends it on `== exit <n>`; the machine reads the log, so paste nothing.
A push to `main` releases c-storage and the activity log, ships the BFF and the UI, and checks ridge by itself, and so does a press of `ci` on `main` ([the deploy job](#the-deploy-job)).

## At a glance

| You want | Run | Takes |
| --- | --- | --- |
| the network, once | `ops/stack.sh network` | about 5 minutes |
| GitHub's provider, once | `ops/stack.sh github` | about a minute |
| an environment's box and deploy role | `ops/stack.sh env <name>` | about 5 minutes |
| to see a change before it happens | add `--plan` to any of the above | about a minute |
| a release | push to `main`, or a press of `ci` on `main` ([the deploy job](#the-deploy-job)) | under 10 minutes |
| a release, when GitHub Actions is down | `ops/release.sh <env> [<sha>]` | about 4 minutes |
| the BFF and the UI, when GitHub Actions is down or a key changed on the box | `ops/app.sh <env> [<sha>]` ([the app](#the-app)) | about 5 minutes by hand, 2 in the job |
| the operator and their join link on ridge | `ops/operator.sh ridge [--replace] [<name>]` ([the operator](#the-operator)) | about a minute |
| ridge destroyed, from your terminal | `ops/destroy.sh ridge`, then type `ridge` ([ridge down and back](#ridge-down-and-back)) | about 5 minutes |
| ridge made again from `main`, and the two workflows turned on | `ops/remake.sh ridge`, then `ops/operator.sh ridge` ([ridge down and back](#ridge-down-and-back)) | about 15 minutes |
| the six demo copies remade and filled with 21 days | `ops/demo-remake.sh ridge` ([the demo copies](#the-demo-copies)) | about 2.6 hours |
| the demo copies brought up to yesterday, when Actions is down or for a copy just made | `ops/seed.sh ridge` ([the seed](#the-seed)) | up to about 15 minutes (2 days a copy at most), longer for a first fill |
| a demo copy's root, given a new password | `ops/root-password.sh ridge <code>…` ([the root password](#the-demo-copies-root-password)) | about a minute, plus the typing |
| your own preview of a walks page built here | `ops/walks-preview.sh [<built folder>]` ([previews](#previews-on-cloudflare-pages)) | about 2 minutes |
| your own preview of a committed folder (such as the app frame's mock) | `ops/pages-preview.sh --worktree … --sub … --branch …` ([previews](#previews-on-cloudflare-pages)) | about 2 minutes |
| a piece's full run of the walks (two runs, the bases committed between) | `ops/full-run.sh --worktree … --branch … --walks …` ([the full run](#the-full-run)) | the walks' own, 6 to 35 minutes a run |
| ridge's acts on one page of copy-and-paste blocks: deploy, check, down, back, the operator, the demo copies | [the ridge guide](../docs/ridge-guide.md), which draws on this runbook | the page's own, per act |
| a copy of the app on this Mac that stays up between commands | [the quick start](../docs/quick-start.md), which holds the five commands, what each prints and which two print a password | the build, then seconds |
| a package's gate (typecheck, eslint, prettier, tests, knip), or the whole repository's | `pnpm --filter @credo/<pkg> check`, or `pnpm check` for all six; each runs `ops/gate.sh`, which waits for the load and the gate lock and writes `logs/<stamp>-gate-<pkg>.log` ending `== exit <code>` (c-storage's own gate is `make check` there) | about 30 seconds a package, about 6 minutes for all |
| to check an environment | `ops/check.sh <env> [--reads-only]` ([on production](#on-production)) | about 3 minutes |
| to read ridge's c-storage from this Mac, with Bruno or curl | `ops/tunnel.sh ridge` ([the tunnel](#the-tunnel)) | until Ctrl-C, an hour at most |
| the records back from the copy, to a new file, or onto the live one | `ops/restore.sh <env> [--at <time>] [--onto-live | --onto-blank]` ([restoring the records](#restoring-the-records)) | about a minute |
| the alarms and their Slack channel | your Slack steps, then `ops/stack.sh env ridge` with the two IDs ([the watch](#the-watch)) | about 5 minutes, plus the Slack steps |
| the crash and reboot drill | `ops/drill.sh <env>`, then `ops/check.sh <env>` | about 5 minutes |

## Before any step

1. Work in a worktree at `main`. Each script fetches `origin/main` itself and stops when `ops/`
   here differs from it, so only reviewed scripts act under your AWS session.
2. Hold an AWS session for the account, in the terminal you run the script from.
   - The Region is fixed in `ops/lib.sh` (`ap-southeast-5`); the script stops if the account has it
     disabled.
3. Have `jq`, `ssh`, and `gh` logged in with rights on the repository (`stack.sh env` needs them).
   - `check.sh` also needs Bruno CLI 4.2.0: `npm install -g --ignore-scripts @usebruno/cli@4.2.0`.

## On production

Production is every environment not listed in `INVENTED_ENVS` in `ops/lib.sh`, today `ridge` alone:
a script knows an environment only by its name, so any other name (a taiga, a crest, the production
stack, whatever its plan calls it) may hold a real company's records. The network and GitHub stacks
sit under every environment, production's included. Each script that reaches an environment says its
answer first, in its first step: `refuse_real` stops it with the script's own words, `real_ok` prints
one `ok   <env> may hold real data; this script is safe there: <why>` line. `ops/test.sh` holds that
every such script calls exactly one of the two (the section "every script that reaches an environment
says what it does on production"), so a new script meets the same rule. The production plan must never
name its stack `ridge`.

| Script | On production | Why |
| --- | --- | --- |
| `ops/stack.sh` | works | a change set is shown first, and a removal or replacement is refused unless named; the network and GitHub stacks sit under every environment |
| `ops/release.sh` | works | it ships main's commits alone, never backwards, above the box's floor |
| `ops/app.sh` | works | it ships main's commits alone, never backwards, and changes nothing else |
| `ops/operator.sh` | works | production's first operator comes from it, and it refuses GitHub's job |
| `ops/check.sh` | works, reads only | no key off the box, none of the function's keys read (only its variables' names and two non-secret values), no Bruno file, no collection, no client made or swept; every AWS read, the box's facts, `/health`, the copy's status (read on the box; its key stays there) and the bucket's listing, layer four's reads and the six reads that need no client stay |
| `ops/restore.sh` | works, to a new file | by default it writes a new file beside the live one and touches nothing live; `--onto-live` is refused there |
| `ops/drill.sh` | refuses | it kills the store and reboots the box; ridge's drill proves the same template and unit |
| `ops/tunnel.sh` | refuses | another stack's admin keys would land on this disk, and the collection would write test records into it |
| `ops/seed.sh` | refuses | a client's stack must never receive demo data |
| `ops/root-password.sh` | refuses | a client's own stack is the console's; a terminal path to a client's root password does not exist (open item 132) |
| `ops/destroy.sh` | refuses | it deletes by name in an account that holds other stacks, a client's among them; it destroys ridge alone |
| `ops/remake.sh` | refuses | it makes the stack, ships and turns workflows on for ridge alone |

`ops/walks-preview.sh` and `ops/pages-preview.sh` are not credo's environment: they send a folder to
Cloudflare Pages and refuse that service's own production branch. `ops/legacy-capture.sh` writes
nothing. On a real environment `real_ok` also refuses `RIDGE_SCRIPTS_DIR` and `OPS_TEST_NO_TTY`, the
tests' two switches, so the code run there is the reviewed tree's.

`ops/check.sh <env> --reads-only` gives ridge the production run, which is the way to rehearse it
there; the flag can only narrow, and the deploy job's check on ridge passes none. A save is proved
by ridge's full check, on the same commit, before a production check reads.

## Bootstrap, once, in this order

Plan steps 9 to 11. Each stack is made from the template in `origin/main`, never from your
working copy.

1. `ops/stack.sh network`. Read the log for the stack made, its outputs and `internet gateways on
   the VPC: 0`.
2. `ops/stack.sh github`.
   - The log says "found already there" when the account has the provider: no stack is made, and
     that is the answer.
3. `ops/stack.sh env ridge`, on the day the first deploy is merged.
   - A run ends on `ok   no key in this log` or on a `RED` line. `RED  the box's private address is in
     this log` is not a key: redact it in this log, nothing is replaced ([the check](#the-check)).
   - The log reads the box over the tunnel (arm64, swap on, the SSM agent stopped), then GitHub's
     environment admitting `main` alone, and its secret `AWS_ROLE_ARN`.
   - A stack that stays in `ROLLBACK_COMPLETE` (its creation did not complete and was rolled back, so
     it holds nothing) is deleted by hand in the console before the script is run again; the script
     stops and says so. A rolled-back creation's box is terminated, and `DeleteOnTermination: false`
     (`ops/env.yml#L151`) leaves its empty root disk behind as an `available` volume, a few cents a
     month: remove it. *Reasoned, not seen:* CloudFormation's deletion of the instance terminates it,
     so EC2's attribute governs (high confidence, never tried).

## A change to a template

1. Merge the change into `main` after its review.
2. `ops/stack.sh <network | github | env name> --plan`: read each change. On a stack not yet made
   the plan changes nothing either: it deletes the empty stack CloudFormation keeps for the change
   set, so the next run is a creation.
   - A stack left in `REVIEW_IN_PROGRESS` by a failed or interrupted creation is created again, with
     fresh parameters.
   - An update keeps the stack's `Repository` and stops if your clone's `origin` is another
     repository, such as a fork.
   - **GitHub's subject prefix ... but the stack's SubjectPrefix is ...:** one of two causes. Your
     clone is a fork's (its ids differ): run from a clone of the stack's repository. Or the
     repository's OIDC subject setting changed on GitHub (the immutable subject switched on or off,
     or the repository deleted and made again): the role's trust is not moved by a plain update;
     see [the trust in the plan](../docs/plans/2026-10-28-ridge.md#deploys-from-github-actions).
   - A `--plan` the guard refuses prints `REFUSED` and one line per change, deletes the change set and
     changes nothing (exit 1). A `replacement=Conditional` line is the property's class, taken from
     `RequiresRecreation`, not a verdict on this change: read AWS's update behaviour for that property,
     and see `docs/plans/2026-11-08-backup-policy-conditional-memo.md`. Naming the resource with
     `--take <id>` passes the guard; do it only deliberately.
   - `env` reads the deploy role's subject from GitHub (`gh api repos/<owner>/<name>/actions/oidc/customization/sub`),
     prints it as `subject prefix:` in the log, and keeps the stack's. It stops if GitHub's differs
     from the stack's, if the settings use custom claim keys, or if it cannot read them.
3. Run it again without `--plan`.
   - **REFUSED:** the change set removes or replaces something and nothing changed. If the plan's
     step names that change on purpose, run again with `--take <LogicalId>`; otherwise change the
     template. `--take Box` leaves the old box running with the records' live file while the
     new box comes up empty: read [Reading what the fence kept](#reading-what-the-fence-kept) first.
   - **no changes:** the stack already matches the template.

## The first deploy was refused at the role

GitHub issues this repository the immutable subject (the owner and the repository each followed by
`@<id>`), so a trust built from the name alone refuses every deploy ("Not authorized to perform
sts:AssumeRoleWithWebIdentity"). The template now takes the prefix from GitHub. In this order:

1. This change merges into `main` and is pushed. That push's `deploy` is red at "Take the deploy
   role" unless step 2 lands first: the trust in AWS is still the old one, and the step retries for
   a while.
2. Run `ops/stack.sh env ridge --plan`; read the one line
   `Modify DeployRole (AWS::IAM::Role) replacement=False` and the `subject prefix:` line (the ids).
   Then run `ops/stack.sh env ridge`.
3. Re-run the run of the push that brought this fix to `main`, not the older failed run: it deploys
   `main`'s tip, so one re-run is enough (`gh run rerun <id> --failed`). If step 2 landed before
   that job's role step stopped retrying, the job is green and nothing is re-run. The job compares
   `ops/` with its own commit, so the re-run is valid.

## A release by hand

Only while GitHub Actions is down: its concurrency group cannot see a run made here.

1. `ops/release.sh ridge` for `main`'s tip, or `ops/release.sh ridge <sha>`.
   - **is not a commit of main:** the sha is refused; use one `main` holds.
   - **superseded: ridge runs <sha>:** green, nothing sent. ridge never moves backwards, so a sha
     behind what runs is not released. To go back, revert the commit on `main` and release that.
   - **below the floor:** the box has too little free disk, memory or swap; free it before releasing.
   - **/health answered ...:** the new binary is installed and c-storage did not name it. Read the
     journal lines the log prints, then revert the bad commit on `main` and release `main`'s tip
     to put the last good tree back.
   - **the activity log's half stopped:** the message begins `c-storage <sha> is released and runs; the
     activity log's half stopped` and names the step: its gate or build failed (by hand the release
     builds it with `make check` then `make dist`; the job hands it the binary it built, and a job that
     names none is refused), the binary arrived with a different checksum than was sent, the key could not
     be made, the unit could not be installed or started, or the log did not name <sha> on its `/health`.
     c-storage is as it was; read the journal lines the log prints, fix forward, and release again. The
     log's write key is made by the first release and never rewritten by a later one.
2. Read the log's last lines: `released <sha>`, printed only after c-storage and the activity log both named the commit.

c-storage listens on the box's private address, the stack's `BoxAddress`, and on no other interface.
Each release writes `/etc/c-storage/listen.env` from it and the unit reads that file. The first
release that carries this change reads `/health` on that address before sending anything, which the
old loopback listener does not answer: the log then finds no running commit, and the release goes on
(the same as a first release). The check, the drill and the tunnel read the same address.
3. `ops/check.sh ridge`.

## The deploy job

The human's push to `main` that touches `services/c-storage/`, `services/audit-backbone/`, `ops/`, the app (`bff/`, `ui/`, `shared/`,
`scripts/`, `visual/`, `walk/`, the workspace's files) or the workflow starts it, and a press of `ci` on `main` ("Run workflow" on GitHub) starts it as well, whatever main's last push touched, once `check`, `audit`, `e2e`,
`ops` and `app` are green. It builds the binary, the BFF's bundle and the UI (before it holds the
role, since those run third-party code), takes the deploy role (environment `ridge`, secret
`AWS_ROLE_ARN`), then runs `ops/release.sh ridge`, `ops/app.sh ridge` and `ops/check.sh ridge` over the
tunnel. It also builds the activity log's binary from the same commit and names it to the release (`RELEASE_AUDIT_BINARY`), and waits on the `audit` job as it does on `check`. It changes no stack: a template change stays your change set. After a change set on ridge,
re-run the latest deploy: the template's `Bff` is a stub with no environment, and a change to it may
put that back (the BFF then answers 503 until the next deploy).

1. Read the run's log in GitHub; the scripts' lines end `released <sha>` and `== green`.
   - **superseded: ridge runs <sha>, then == green:** a newer commit of `main` is already on ridge
     (its gates finished first); nothing was sent, and the app's ship and the check are skipped: that
     commit's own deploy shipped them. ridge never moves backwards.
   - **skipped: ridge's stack holds no layer four yet:** `app.sh` and the check's new reads wait for
     the human's change set (`ops/stack.sh env ridge`, plan step 15); the job is green without them.
   - **shown cancelled:** a newer push to `main`, or a newer press of `ci` on `main`, took its place in the queue; that push's own
     deploy carries it.
   - **red:** a defect, never a run to repeat. Fix forward and push, or revert the bad commit on
     `main` and push: the deploy that follows ships the reverted tree. Re-running an older run
     does not go back; it ends superseded.
   - **never re-run a deploy that started before the private-address change reached `main`, and push
     nothing to `main` while one is queued:** it runs the old scripts, reads `/health` on loopback,
     is not seen as superseded, installs the old unit and moves c-storage back to 127.0.0.1, so every
     BFF call answers 503 though its own check reads green. No script can refuse it, since the old
     run uses the old scripts. The way back is to re-run the latest deploy
     ([plan hazard](../docs/plans/2026-10-28-ridge-app.md#hazards-no-gate-catches)).
   - **the activity log's first landing on ridge: one push, one red deploy, a stack run, a rerun.** The
     template's half and the code reach `main` in one push, so that deploy runs before ridge's stack has the log's
     rule and port, and ends red once at the check: the release and `app.sh` have finished (the log runs on the box, the
     function holds `AUDIT_URL` and `AUDIT_KEY`), and the check names three reds, the box group's rule reading, the back
     end group's, and the entry count `'0'`, not 1. That red is expected; nothing is half-changed. Then, in this order:
     `ops/stack.sh env ridge --plan`, read it, `ops/stack.sh env ridge` (it reads its template from `origin/main`, so
     only after the push), then re-run the latest `ci` run of `main` with "Re-run all jobs"; a rerun of the same
     commit is not superseded, and the check then ends `== green` with the entry found.
   - **the credentials step fails:** the environment `ridge` or its secret is missing; run
     `ops/stack.sh env ridge` (plan step 11).
   - The job checks `ops/` against its own commit, not the newer `main`, so a push that lands
     during the run turns nothing red.
2. It never runs on a branch or in a pull request, and never under `act`: each of its steps is
   skipped there (`ops/test.sh` holds this).
3. While Actions is down, do the same by hand: [a release by hand](#a-release-by-hand).

## The app

`ops/app.sh ridge` ships the BFF's bundle to the one function and the UI's files to the one bucket,
code only: the deploy role holds no stack, IAM or CloudFront right. The job passes it what it built
(`APP_BUNDLE`, `APP_UI_DIR`); by hand it builds the commit in a throwaway worktree (needs pnpm).

1. Read the log's last line: `shipped <sha>`. Before it: `service registered` (the first time) or
   `service present`, the function's checksum, and the bucket.
   - **skipped:** the stack holds no layer four yet.
   - **nothing sent: <sha> is behind what ridge runs:** the function already runs a newer commit.
   - **the function runs code of checksum ...:** what the function runs is not what was sent; run it again.
   - **the box holds a bff.env:** the BFF's service code and key, made once by the first run, 0600, root's.
     The function holds a copy, set again at each run: after a key changes on the box, run
     `ops/app.sh ridge`, or the BFF answers 503. The BFF's service key cannot be replaced (c-storage has
     no route for it): a leaked one means a new `bff.env` and a new service code, and ridge's clients
     made again.
   - **a key is in this log:** as in [the check](#the-check).

## The operator

`ops/operator.sh ridge` makes the operator (the name `operator`, or the one given) and shows their
one-time join link, `<the app's address>/operator/join#<token>`, on your terminal once. It is never
written in the log: the script writes it past the log, then searches the log for it. It refuses in
GitHub's job and without a terminal.

1. Run it from a worktree at `main` with `pnpm install` done, after the first app deploy (which makes
   the BFF's service and sets `APP_ORIGIN` in its environment). Read the link from the terminal, not
   the log, and give it to the operator: they open it and make their first passkey. It works once,
   within 24 hours.
   - **the operator ... exists:** it will not make one over another; add `--replace` for a
     new-passkey link, the way back from lost passkeys. Using it replaces every passkey the operator
     held and ends their sessions.
   - **the run was killed with `kill -9`:** the trap that deletes the scratch folder did not run, and
     the link stays in `$TMPDIR` (`credo-ops.*/shown`). Delete that folder, then run again with
     `--replace`.
2. The link opens at the app's address, which a passkey is bound to for good: CloudFront's own name.
   The address is in the local log of `ops/stack.sh env ridge` (never in a committed file or a
   public log).

## Ridge down and back

Two commands, each from the worktree at `main` (its `ops/` must match `origin/main`), in a terminal signed
in to AWS with `gh` logged in. Both refuse every environment but ridge, and a stack that is not ridge's
by its tags and parameters. The destroy asks for a typed name and cannot run from GitHub: the deploy role
can only read its stack, so there is no timer either. Each log is the newest `<stamp>-<script>-ridge.log`
in the credo root's `logs/`.

1. Down, about 5 minutes. It reads the account, prints what will go, asks you to type `ridge`, switches
   off the workflows that name `environment: ridge` (`ci.yml` and `seed.yml`, never `walks.yml`), then
   deletes the box and its root disk, the UI bucket's files, the copy bucket's files and the bucket, the stack
   (its records disk goes with it, after the stack's own snapshot of it, which stays) and the two log groups,
   each read back as gone. `RIDGE_KEEP_DISK_SNAPSHOT=1` takes one more snapshot of the records disk first.

   ```
   cd <the worktree at main> && bash ops/destroy.sh ridge
   ```

2. Up, about 15 minutes. It runs `ops/stack.sh env ridge`, `ops/release.sh ridge`, `ops/app.sh ridge` and
   `ops/check.sh ridge` in that order, then turns the two workflows on and reads them back active. A red
   stops it at that step with the workflows still off; run it again.

   ```
   cd <the worktree at main> && bash ops/remake.sh ridge
   ```

3. The operator, whose one-time link you open at the new address to make your passkey (see
   [the operator](#the-operator)).

   ```
   cd <the worktree at main> && bash ops/operator.sh ridge
   ```

What each log's last lines read:

- The destroy's log has `== verdict: ridge is destroyed, ci.yml and seed.yml are off`, then
  `== CLOSING, in plain words:` with the two commands above, and ends `== exit 0`. With no stack and no box
  it reads `== verdict: ridge's stack and box were already gone, so nothing was destroyed by this run, and no workflow was changed`.
- The remake's log ends `== ridge is remade from main and checked. It is empty: it holds no operator and no demo copy.`,
  the operator's command, a line that the address may be new, then `== green` and `== exit 0`. A stop reads
  `== stopped at step <n>/<total>, ops/<script> (exit <code>). No later step ran and the workflows stay off.`

Ridge is empty after the remake. This command does not re-make the demo copies, and the records are gone with
the disk. The app's address may be new, and a DNS record that points at the old one is repointed by hand.
The address lane's two settings, `CREDO_DOMAIN` and `CREDO_CERTIFICATE_ARN`, are not in `main` yet: once the
address lane lands, the remake's stack step takes them from your environment, passed through unchanged,
and the certificate, outside the stack, survives.

## The demo copies' root password

`ops/root-password.sh ridge <code>…` gives the root of each named demo copy a new password: typed
here twice, never shown, never in the log and never kept. Every session of that root ends at its next
click; nothing else of the copy changes. The six demo copies of `scripts/src/demo/mapping.ts` only: a
client's own stack is the console's. The why is
[the plan](../docs/plans/2026-11-02-ridge-root-password.md).

1. Run it from a worktree at `main` with `pnpm install` done, in a terminal, not while the seed runs, naming the codes of the copies one person holds, for example
   `ops/root-password.sh ridge <code> <code>`. Type the password at each prompt (8 to 128 characters, a
   capital, a small letter, a digit, one of `@$!%*?&`, no space at either end). Send it to the person
   by your own channel; the script never shows it again.
2. Read the log: each code's company, then `<code>: set` and `<code>: signs in` per root,
   `ok   no key in this log` and `== exit 0`.
   - **== refused: ...:** nothing was changed. The line names why: another environment, GitHub's job,
     no terminal, no code, `ops/` or this commit not `origin/main`'s, the two typings differ, the
     password breaks the rule, a code outside the six, a taken port, a box below its floor, or `/health`
     naming no commit of main.
   - **error: the run stopped:** the lines above name the roots set and the roots not reached; those
     keep their old password. Run it again for the same codes.
   - **<code> is not on this service:** that copy was never made (`ops/demo-remake.sh ridge` makes all six); nothing was written.
   - **the new password is in this log:** redact the log; nothing to replace.

## The demo copies

The six demo copies on ridge (two invented companies, three copies each, the codes in
`scripts/src/demo/mapping.ts`) are made by one command, never made by hand in the console. It deletes each copy
to zero records, makes it again under its partner's password and fills it with 21 days ending yesterday.
Once, from a terminal; it takes about 2.6 hours (up to 4) plus your typing, and it refuses GitHub's job.

1. On a ridge with no operator yet, first `ops/operator.sh ridge` ([the operator](#the-operator)); the
   remake itself needs no operator. Use a worktree at `main` with `pnpm install` done, not while the seed runs.
2. Run it, then type one password for each partner (`p1`, `p2`, then yours), each twice, and `remake ridge` when
   it lists the six copies. A password is never shown, logged or kept.

   ```
   cd <the worktree at main> && bash ops/demo-remake.sh ridge
   ```

3. Read the log: it ends green, with each copy's sign-in read back. A line `== refused: <why>` (exit 2) means
   nothing was touched. A red after the first delete (exit 1) depends on the step it stopped in, which the
   log's last `[n/6]` line names:
   - in "the remake" (the deletes and the makes): run the same command again, whole; it asks the passwords
     again, finishes a deletion left half done and makes the copies again. `--go-on` is not a way on there: it
     fills a copy that never got its partner's password, and the round now refuses it, naming the copy.
   - in "the fill, in rounds" (a dropped tunnel, an AWS session that ended, a round that failed): run
     `ops/demo-remake.sh ridge --go-on`, which runs the rounds left from the ledger, asks nothing and deletes
     nothing. Unless the lines above say a copy is not remade: then the same command again, whole.
   The fill waits about 160 minutes, and AWS must stay signed in until the clock time the log gives.
4. Send each partner their link and password by your own channel. `/operator` is where you sign in
   to see the copies, not where they are made.

## The seed

The demo copies on ridge are brought up to yesterday by `.github/workflows/seed.yml`, which runs only when
somebody asks ("Run workflow" on `main`, or `gh workflow run seed`; it has no schedule since 2026-11-08) and
runs `ops/seed.sh ridge` under the deploy role, at most 2 days a copy a run (about 15 minutes; the Seed step is limited to 18, inside the role's 20). The script makes no client and
no password: the copies are made first, all six by `ops/demo-remake.sh ridge` ([the demo copies](#the-demo-copies)). The why is
[the plan](../docs/plans/2026-10-29-demo-seed.md#how-the-data-reaches-ridge).

1. Have the copies made first: `ops/demo-remake.sh ridge` makes the six in the mapping (`scripts/src/demo/mapping.ts`)
   and fills them. Then run `ops/seed.sh ridge` by hand from a worktree at `main` with `pnpm install` done,
   or run the workflow, to bring them up to yesterday.
2. Read the log's lines: `seed: <n> copies mapped, <n> up to date, <n> not on this service, <n> days
   applied`, then `seeded <sha>`.
   - **<code>: not on this service, left:** that mapped code has no client on ridge. Run
     `ops/demo-remake.sh ridge` to make it; a mistyped code is not in the mapping, so it stays empty.
   - **<code>: holds more than a new client does, left:** its users used it before the seed filled it. It
     stays as it is; make a new copy under a new code.
   - **<code>: the ledger names client <X>, the mapping <Y>** (or **the ledger names <S>, the mapping
     <S>**, for the scenario): the copy was filled for another client or trade than the mapping now
     maps to that code. It is refused and left, never switched; make a new copy under a new code.
   - **/health names <sha>, not <sha>:** ridge runs another commit than the seed's, and not an earlier
     one that differs from it in no path `ci.yml` deploys on (a push touching none deploys nothing, so
     the seed goes on). Nothing was written. After a deploy, run it again once the deploy is green.
   - **ci.yml's push trigger holds a line this script cannot read:** the seed reads the paths a push
     deploys on from `ci.yml`, and only as `      - "<path>"` or `      - "<path>/**"`; the line
     named is quoted another way, commented or a deeper glob. Nothing was written; write the entry in
     that form, or teach `push_paths` in `ops/lib.sh` the new one.
   - **the BFF's function names <sha>, /health <sha>:** a deploy shipped c-storage and stopped before
     the BFF. Nothing was written; read the deploy's log, and run it again once the deploy is green.
   - **below the floor:** the box has too little free disk, memory or swap; free it first.
   - **this tree differs from <sha>:** commit or drop the change; the seed runs the code in this tree.
3. A run that ends `seed: STILL BEHIND` is green: it applied 2 days a copy and the line names what is
   left and how many more runs it takes; run it again to go on, at once if you like, each run takes off 2
   days whatever the backlog (a month's gap is about 15 runs of about 15 minutes; no backlog is refused).
   A gap of N days takes N/2 runs, so a week's gap is 4 runs one after the other (about an hour in all);
   a single run asked once a week falls 5 days further behind each time, and never catches up. A red run is read before it is run again. Ridge's data is only as fresh as
   the last run, so run the workflow before anyone checks anything against it.
   - **the credentials step fails:** the environment `ridge` or its secret is missing; `ops/stack.sh env ridge`.
   - **a key is in this log:** as in [the check](#the-check).

## Previews on Cloudflare Pages

`ops/pages-preview.sh` is the one body of every preview deploy: it sends a static folder to the Pages project as a
preview at a branch, behind Access, never production, and checks that both addresses refuse a visitor. Two cases call it.
For both, set `CLOUDFLARE_PAGES_PROJECT` (the Pages project's name) and either `CLOUDFLARE_API_TOKEN` with
`CLOUDFLARE_ACCOUNT_ID` (the walks workflow's secrets) or neither after a `wrangler login`;
`CLOUDFLARE_PAGES_PRODUCTION_BRANCH` only if it is not `main`. It needs Node 26, `npm`, `curl`, `jq` and `tar`, and
installs wrangler 4.151.0 (the workflow's) into a temp folder. Its parameters: `--folder <dir>` (a folder on disk) or
`--worktree <dir> --sub <path>` (that worktree's folder as committed at its HEAD, by `git archive`; a dirty tree is
refused); `--branch <name>` (the preview's branch); `--commit <sha>` and `--stem <log name>` (optional).

**The walks page.** `ops/walks-preview.sh [<built folder>]` puts the walks page you built on this Mac up as a preview of
the branch its build line names. It refuses a page built on `main` or on the production branch. The folder defaults to
the newest under `walks/` in the credo root that does not end in `-changes`. Log:
`logs/<YYYYMMDD-HHMM>-walks-preview.log`.

**The app frame's mock.** The mock at its committed HEAD, previewed at the branch `app-frame-mock`:

```
bash <credo root>/wip-app-frame-mock/ops/pages-preview.sh --worktree <credo root>/wip-app-frame-mock --sub ui/frame-mock --branch app-frame-mock --stem frame-mock-preview
```

(Once this script is in `main` and merged into that worktree; until then run it from any worktree that has it.)
Uncommitted files are not sent.

Read the terminal, where the two addresses show (never in the log, `logs/<YYYYMMDD-HHMM>-<stem>.log` in the credo
root). A good ending is `project found`, `refused: a redirect to Access's sign-in` twice, `== verdict: good` and `== done`.
- **== refused: ...:** nothing was changed; the line names why (no folder or no `index.html`, a dirty worktree, no
  project name, no credential, a missing tool, the production branch, a project not in the account, or a preview
  address that answers a visitor: turn Access on for the project's previews first).
- **FAIL: an address ANSWERS the page without Access:** the terminal shows the command that takes the deployment
  down; run it now.

## The full run

`ops/full-run.sh` is the one body of a piece's full run, in your terminal on the Mac: it runs `walk/run.sh` twice in the
piece's worktree, run 1 with `--write` (the new and moved bases), run 2 plain, every count 0. Between them it makes one
local commit of the base pictures alone (`walk/specs/*-snapshots/*.png`; anything else in the tree is a stop), since
`walk/run.sh` refuses a dirty tree. Nothing is pushed. A piece's one-off in `one-off/` only calls it:

```
bash <credo root>/main/ops/full-run.sh --worktree <credo root>/wip-<piece> --branch <branch> --walks operator,passkeys,team --moved tm-1-list --subject "test(walk): the team walk's bases" --stem <piece>-full-run
```

Parameters: `--worktree`, `--branch` and `--walks` (comma separated, as `walk/run.sh` names them) are required;
`--moved <screens|all>` is run 1's (default none); `--subject` the bases commit's subject; `--stem` the log's name
(`logs/<YYYYMMDD-HHMM>-<stem>.log`, each run's text beside it as `…-run-<n>.out`); `--node` the Node it needs (default
v26.12.1, from nvm); `--lock` the gate lock it refuses on (default `<credo root>/.gate-lock`); `--run-lock` its own lock (default
`<credo root>/.full-run-lock`); `--check` runs the refusals and shows the two commands, then stops, taking no lock. It never
takes the gate lock: `walk/run.sh` refuses while it exists, and the gate waits while `.full-run-lock` exists. It takes `.full-run-lock` after the refusals, so two full runs
cannot overlap, and releases it on green, red and interrupt. A lock left behind (a run killed hard) is refused on, never
cleared by the script: the refusal names the owner and prints the `rm -rf` that clears it.
- **== refused: ...:** nothing ran; the line names why (a missing parameter, no worktree, the wrong branch, a dirty tree,
  the gate lock held with its owner, another full run's lock held with its owner, the wrong Node). It is in the log too.
- **== verdict: red: ...:** the run and its failure are named (run 1 not green, more than base pictures in the tree, run 2
  with a count not 0); bring the log and the walk logs back. A good ending is `== verdict: green` and `== done`. The green verdict names, from run 1's compare lines, the screens that moved, the screens that are new and the named screens that moved nothing, beside the list that was asked.

## The gate

`ops/gate.sh [<pkg>]` is the five steps of one package's check, or of all six: typecheck and test of each
package (its own scripts, so the coverage and the 100 % thresholds are the package's), then eslint, prettier
and knip once over the whole tree, because their configs are repo-wide. It runs all five whatever any one
does, takes `.gate-lock` once the one-minute load is under 8, and writes `logs/<stamp>-gate-<pkg>.log` ending
`== exit <code>`. Read the `== steps:` line: `skip` is a step that ran nowhere (a package with no `test`
script, `walk`), `0+1skipped` is one that skipped a package, and neither is a pass. A red names its step and
the other four still show. It does not cover c-storage: that gate is `make check` in `services/c-storage/`.

- **The lock is held by someone:** the log says by whom and waits; after 30 minutes it gives up. A lock left behind
  (a run killed hard) is refused on, never cleared by the script: the refusal names the owner, says whether its pid
  is still alive, and prints the one `rm -rf` that clears it only when the owner is gone or cannot be checked; a live
  owner is told to be waited for, since a healthy full run (6 to 35 minutes) outlasts the 30-minute wait.
- **A full run is going:** `ops/full-run.sh` holds `.full-run-lock` for its whole time, and `walk/run.sh` stops its
  lanes and ends red when `.gate-lock` appears mid-run. So the gate waits (same loop, same 30 minutes, same refusal
  naming `.full-run-lock`) while that lock exists, and a short check never reddens a long run. A bare
  `walk/run.sh` takes no lock, so a gate cannot wait for it: start the gate when no walk is running.
- **No package list, or a package.json that cannot be read:** `pnpm check` refuses when `pnpm-workspace.yaml` yields
  no package, and a `package.json` it cannot parse (or no `node`) is a red step, never a skip.
- **A forced red, to see the gate catch it:** break one line in one position, run `pnpm --filter @credo/shared
  check`, put it back. A new export in a file `shared/src/index.ts` re-exports is not a knip red (it is the
  package's public entry); one in a file only the app uses is.

## The check

1. `ops/check.sh ridge` (or `ops/check.sh <env> --reads-only`, [on production](#on-production)); it ends `== green`, or names each red. Once the stack holds layer four it also
   reads the BFF's group, the function (its subnet, group and the names of its variables, never the
   values), the UI's bucket and the one commit in `/health`, the function and `index.html`, then makes a
   fresh client `check-<time>` through the tunnel and signs it in through the app's address, as a
   partner would, with no cache in front of `/api/*`. The run deletes that client at its end, green or red; a delete that fails is a `WARN` line, not a red.
   - **needs pnpm install done:** the client is made by `scripts/`, run under Node.
   - **no services/c-storage/bruno, or the wrong Bruno CLI:** merge `main` in, or install 4.2.0.
   - **something already answers on the check's local port:** free it, or set `CHECK_LOCAL_PORT`.
   - **a key is in this log:** delete the log, delete `/etc/c-storage/keys.env` on the box, then run
     `ops/release.sh ridge`, which makes new keys and restarts c-storage.
   - **the box's private address is in this log:** the line names what matched, and it is not a key:
     redact it in this log (nothing is replaced), and find which step printed the address.

## The tunnel

Holds `http://127.0.0.1:3192` open to ridge's c-storage, in your own AWS session, until Ctrl-C or the
endpoint's hour. Only test data goes to ridge through it, never a client's, and the command accepts no environment but
`ridge`, until the guard that refuses a client's stack exists. The why is
[the plan](../docs/plans/2026-10-28-ridge-tunnel.md).

1. `ops/tunnel.sh ridge`, from a worktree at `main`. Wait for the `ready:` lines; the run says ready
   only once `/health` names a commit of `main`, and writes
   `services/c-storage/bruno/environments/ridge-tunnel.yml` (0600, git-ignored) with ridge's keys and a fresh
   service's.
2. In Bruno, open the collection `services/c-storage/bruno`, pick the environment `ridge-tunnel`: Health, then
   the collection once. Or `curl http://127.0.0.1:3192/health`. Use `127.0.0.1`, not `localhost`.
   - A second collection run in the same session answers 409 at its register; run the tunnel again
     for a fresh service.
   - Records saved stay on ridge, and no one can read them after the run: the service's key leaves
     with the file.
3. Ctrl-C. The log ends on `ok   no key in this log` and `== exit 130`, and `environments/` holds no
   `ridge-tunnel.yml`.
   - **something already answers on 127.0.0.1:3192:** another run is open, or a killed one left its
     ssh: `lsof -nP -iTCP:3192 -sTCP:LISTEN`, then stop that ssh (its endpoint ends it within the
     hour anyway).
   - **a keys file left by a killed run (`kill -9`):** the next run replaces it and says so; delete
     `ridge-tunnel.yml` by hand if there is no next run. The same kill leaves the run's scratch folder
     `credo-ops.*` in your temp folder, holding the Instance Connect private key it pushed (valid 60
     seconds after the push, so already useless); delete the folder.
   - **/health names no commit, or a commit main does not hold:** nothing was written; release
     `main` (the deploy job) and run again.
   - **the tunnel dropped:** the endpoint's hour ended, or the box rebooted (the drill does); run it
     again. The keys are already gone.
   - **a key is in this log:** as in [the check](#the-check).
   - `channel N: open failed: connect failed` while c-storage restarts is harmless.

## Reading what the fence kept

`Box` carries `RetainExceptOnCreate` on a stack delete (it retains on every act but the rollback of its own creation, which deletes a box that never served) and `Retain` on a replacement, and its root disk carries
`DeleteOnTermination: false` (`ops/env.yml`, the comment above `Box`). That keeps a disk. It does not
make the records come back, and **nobody has done either path below**: every step is written from
what `ops/lib.sh`, `ops/release.sh`, `ops/c-storage.service` and `ops/env.yml` show, and a step marked
*untested* is a guess from AWS's or systemd's documented behaviour, not something seen on a box. There
is no copy of any client's records that has been read back: the continuous copy is built and has not run
on an environment ([open item 6](../docs/open-items.md)), so the paths below are for a bad day before it. The
first real run of either path is a drill, and until then treat these as notes for a bad day, not a
rehearsed procedure. Region `ap-southeast-5`, your own AWS session, every `aws` line yours to run.

The file to read in both is `/var/lib/c-storage/c-storage.db` (`DB_PATH`, `ops/c-storage.service`); on a box
that has had a release with the copy it sits on the records disk, mounted where the state directory resolves.
The unit is `DynamicUser=yes` with `StateDirectoryMode=0700`, so only root reads it: `sudo` on the
box (`ops/release.sh` uses `sudo` for everything). *Untested:* systemd documents that a dynamic-user
service keeps its state under `/var/lib/private/c-storage`, with `/var/lib/c-storage` a link to it.

### A retained box

The stack was deleted (or a replacement set the old box aside) and the instance is still running,
outside any stack.

1. Find it. `BoxId` was a stack output and went with the stack, so look the instance up by the tag
   `ops/env.yml` gives it, `Name` = `credo-<env>`:
   `aws ec2 describe-instances --region ap-southeast-5 --filters Name=tag:Name,Values=credo-<env> --query 'Reservations[].Instances[].[InstanceId,Placement.AvailabilityZone,State.Name,LaunchTime]' --output text`.
   After a replacement two boxes carry the name: the older `LaunchTime` is the retained one. *Untested:*
   that the tag survives on a retained instance (the tag is the template's own property, so it should).
2. Do not use `ops/tunnel.sh`, `check.sh` or `release.sh` on it: `box_open` reads `BoxId` from the
   stack and stops with "stack <env> does not exist" (`ops/lib.sh`). Do by hand what `box_open` does:
   a throwaway key (`ssh-keygen -t ed25519 -N '' -f <keyfile>`), then
   `aws ec2-instance-connect send-ssh-public-key --instance-id <id> --availability-zone <zone> --instance-os-user ec2-user --ssh-public-key file://<keyfile>.pub`,
   then within 60 seconds
   `ssh -i <keyfile> -o IdentitiesOnly=yes -o ProxyCommand="aws ec2-instance-connect open-tunnel --instance-id %h" ec2-user@<id>`.
   *Untested:* that the endpoint (the network stack's, which an environment's delete leaves) still
   reaches it. The way in is `BoxGroup`'s port-22 rule, and `BoxGroup` is in the stack that went:
   the kept instance still uses it, so a delete is expected to stop there, but nobody has seen it.
   If the group is gone, the box has no way in, and the way to read it is to stop the instance, detach its disk and follow the left-behind volume below.
3. On the box, stop the service so the file is whole (`sudo systemctl stop c-storage`): the memo
   says a copy taken while it runs can miss commits held in the `-wal` file
   ([the memo](../docs/memo/c-storage.md#a-second-copy-follows-the-file-within-a-second)). Then
   `sudo ls -la /var/lib/c-storage/` and expect the `.db` file with no `-wal` beside it. *Untested:*
   that a clean stop leaves it so; if a `-wal` is there, copy the whole folder and keep all three files.
4. Copy it out over the same connection, the way `ops/release.sh` sends files the other way:
   `ssh <the options above> ec2-user@<id> 'sudo cat /var/lib/c-storage/c-storage.db' > <local file>`,
   then `sudo sha256sum` on the box against `shasum -a 256` here. Both sums equal is the only proof
   the copy is the file.
5. Reading the copy is *untested and unwritten*: `DB_PATH` is the one setting that names the file, so
   pointing a local c-storage at the copy is the expected way, but the keys in
   `/etc/c-storage/keys.env` (root's alone, on the box) are what a client of it needs, and no step here
   has been tried.
6. Only after step 5 has read real records, remove the box. Nothing removes it for you, and it bills.

Running `ops/stack.sh env <name>` again does **not** bring the old records back: it makes a new box
and a new, empty database beside the retained one.

### A left-behind volume

The instance was terminated (console, or any act outside CloudFormation) and its disk is still there,
status `available`.

1. Find it: `aws ec2 describe-volumes --region ap-southeast-5 --filters Name=status,Values=available --query 'Volumes[].[VolumeId,Size,AvailabilityZone,CreateTime]' --output text`.
   The records are on the **records disk**, a separate whole-disk XFS volume tagged `Name` = `credo-<env>-records`
   (`RecordsVolume`, `ops/env.yml`; a stack delete snapshots it too). The root disk, picked by the stack's
   `VolumeSize` and a `CreateTime` close to the box's launch, holds only `c-storage.db.moved`, the records as
   they stood before the copy began, which is old.
2. Launch any instance in the same zone and attach the volume to it as a second disk
   (`aws ec2 attach-volume --volume-id <id> --instance-id <new> --device /dev/sdf`). The disk is
   encrypted under the account's default EBS key (`ops/env.yml` sets `Encrypted: true` and no key id),
   so the same account reads it. *Untested:* a way in to that instance: the repository only shows a box
   reached through the endpoint with `BoxGroup`'s port-22 rule, so the easy case is a new instance in
   the same subnet with that group, which exists only while the environment stack does.
3. On it, find the disk with `lsblk`. The records disk has no partition table: mount the whole device
   read-only, `sudo mount -o ro,nouuid /dev/<device> /mnt` (XFS refuses a second filesystem with the
   running root's id, hence `nouuid`). *Untested, expected.* A root disk is mounted the same way on its root
   partition, for the old file only.
4. Stop at `/mnt/c-storage.db` on the records disk (`/mnt/var/lib/private/c-storage/c-storage.db` on a root
   disk from before the move): copy and compare as in the retained box's step 4. Nothing was running on it, so
   no `-wal` is expected beyond what the last stop left.
5. Remove the volume and the helper instance when the copy has been read, not before.

## The drill

Once on a new box, and again when the unit, the templates or the box change. It breaks the known
state, so release first.

1. `ops/drill.sh ridge`; rows 13, 14 and 17 of the plan's checks read green (row 17: the copy holds a code registered seconds before, and a restore to a moment before it does not).
   - **the box did not come back:** wait, then run `ops/check.sh ridge`; the reboot may be slow.
2. `ops/check.sh ridge` reads green again.

## Restoring the records

The records are copied to the bucket a second at a time ([the plan](../docs/plans/2026-11-11-continuous-copy.md)).
`ops/check.sh` reads the copy: red when the newest copy lags the last write by over five minutes, when the
newest full copy is over six days old, or when the records disk is under 1 GiB free. c-storage keeps the time
of its last write in memory only, so right after a restart (every release is one) there is none to compare
with: the check then says plainly that **the lag was not read** and does not say the copy holds the last write.
The drill reads the copy for real.

1. `ops/restore.sh <env>` writes the newest copy to a new file, `restored-<stamp>.db`, on the records disk, and
   touches nothing live. `--at <time>` (such as `2026-11-12T10:00:00Z`) restores the records as of that moment.
2. To put a restore in place, `ops/restore.sh <env> [--at <time>] --onto-live`: c-storage stops, the live file and
   its companions are moved aside (`c-storage.db.aside-<stamp>`, never deleted), the restored file takes the live
   path and c-storage starts again. Refused on an environment that may hold real data ([on production](#on-production)):
   restore to the new file there, look at it, and swap it in by hand from the box, with c-storage stopped.
   - **a records disk that holds no `c-storage.db`, while the bucket holds a copy** (a replacement box, or a
     disk made blank): a release refuses it, blank or mounted by hand alike, and names the one path:
     `ops/restore.sh <env> [--at <time>] --onto-blank`. It formats a disk with no filesystem, mounts it at the
     records path and restores the newest copy (or the copy as of `--at`) onto it, with c-storage stopped and
     never started in between; it runs on any environment, since nothing live exists there, and refuses a
     c-storage that is running, a filesystem other than XFS and a disk that already holds a `c-storage.db`.
     Then release again. **Never release before the restore, and never format the disk by hand first:** a
     c-storage started over an empty disk makes an empty database, and Litestream then saves it over the newest
     copy. Not yet walked on a real blank disk.
   - **no file written:** the role may list and read the bucket; read the log's last lines for Litestream's words.
## The watch

Four alarms on an environment, all to one topic, `Alerts`: the app's calls failing (the API's `5xx`),
the back end's own errors, the back end refusing work under load (its function's `Errors` and
`Throttles`), and the box failing its health check (`StatusCheckFailed`). Each alarm, and its return to
normal, goes to the topic. With a Slack workspace ID and a channel ID the stack also makes AWS's Slack
app's channel configuration, which carries the topic into your channel; with neither, the topic and the
alarms exist and tell no one, and the output `Watch` says `alarms reach no one: no Slack channel`.
Neither ID is a credential, and neither is written into any committed file.

1. Your Slack steps, once (from AWS's page "Tutorial: Get started with Slack"):
   1. In Slack, make a **private** channel: the alarms are yours, and the workspace may hold the
      partners who post their answers there. Name it as you like.
   2. In Slack's left pane choose **Automations** (or **More**, then **Automations**), **Browse Apps
      Directory**, find **Amazon Q Developer in chat applications**, choose **Add**.
   3. In the channel, type `/invite @Amazon Q`, then choose **Invite Them**.
   4. In AWS's console, open **Amazon Q Developer in chat applications**; under **Configure a chat
      client** choose **Slack**, then **Configure**. Slack's authorisation page opens: pick your
      workspace at the top right, choose **Allow**. You will see the **Workspace details** page.
   5. Copy the workspace ID from **Workspace details**, and the channel ID from Slack (right-click the
      channel, **Copy Link**: the ID is the end of the link). Make no channel configuration in the
      console; the stack makes it.
2. The stack run, from a worktree at `main`, with both IDs in the environment of that one command
   (`CREDO_SLACK_WORKSPACE_ID` and `CREDO_SLACK_CHANNEL_ID`): `ops/stack.sh env ridge --plan`, read
   the change (a topic, four alarms, a channel and its role added, nothing changed or removed), then
   the same without `--plan`. The log ends `== exit 0` and its outputs read `Watch = alarms reach
   Slack`.
   - **One ID without the other** is refused before any change set: a lone channel ID makes no channel.
   - **`none` for one ID and a real ID for the other** is refused too: the template then makes no
     channel and the run would still end 0.
   - **Neither ID given on an update** keeps the stack's values. `none` and `none` turns the channel
     off; on a stack that holds a channel that is a removal, which the guard refuses unless the run
     takes `--take AlertsChannel --take AlertsChannelRole`.
   - **A workspace ID changed later** is two runs, not one: the workspace ID and the configuration's
     name are both fixed at creation, so a replacement would create the new configuration while the
     old one still holds the name, and the update would fail and roll back. First `none` and `none`
     with both `--take` flags above, then the new IDs.
3. The forced alarm, once the app answers on the environment: the calls-failing alarm is put into its
   alarm state by hand (`aws cloudwatch set-alarm-state`, in your own AWS session). Two messages
   follow in the channel, the alarm and, at the next five-minute evaluation, its return to normal.
   The alarm's history shows each action run. A forced alarm proves the path from alarm to channel,
   not the metric under it.

## The ops job

CI lints the scripts (ShellCheck 0.11.0, installed in the job from its release) and templates
(cfn-lint), and runs `ops/test.sh`: the guards on hand-written input (the change-set filter among
them), `app.sh`, `operator.sh`, `root-password.sh` and `seed.sh` whole on stand-ins for aws and ssh, and the `/health` check against
the real c-storage, built there, so Go must be installed. The guards also need Ruby (reads `env.yml`
as JSON), Node (the CloudFront Function, the scripts under `scripts/`) and `pnpm install` done.
Run the same three before pushing an `ops/` change:

1. `shellcheck -x ops/*.sh walk/*.sh`
2. `cfn-lint ops/network.yml ops/github.yml ops/env.yml`
3. `bash ops/test.sh`, which also reads the workflow's `deploy` job: its branch condition,
   `!env.ACT` on each step, `needs`, the environment, the single concurrency and its `cancel-in-progress`,
   no `continue-on-error`, the Region, and the account id's mask; and the seed workflow's (a manual run
   and nothing else, no schedule and no permission but the OIDC token, `main` alone, environment `ridge`, the group `ridge-seed`, `!env.ACT` on each step).

Under `act` two things are act's own, not the scripts': the `check` job's "Post actions/setup-go"
fails (act's copy of the action lacks its cache-save module, and its cache server is unreachable),
and `ops/test.sh` prints `== skipped: the repository's .git cannot be read here` instead of reading
the ignore rule, because the copied worktree's `.git` names a folder of the Mac. A third, rarer one:
four jobs clone and copy the same action at once, and one's "Main actions/setup-go" can fail at
once (about 100 ms) with `lstat .../.cache/act/actions-setup-go@.../package-lock.json: no such file
or directory`, a copy that raced another's. A reader tells it from a real failure by that line and by
the step failing before it ran any of the action's own code (no `Setup go version` line); the same
step was green in the runs before. Another is the Mac's network: the `e2e` job's `go build` can fail with `Get "https://proxy.golang.org/…": dial tcp …:443: i/o timeout` (a module download), which GitHub's runner does not hit; the line itself is the proof, and the job is green when it is run again with the network. Any other red there is real, and a test that times out under act's
parallel jobs is a defect in the test (QA rule 6): it is made to do less, never given more time;
GitHub's run reads the rule.
