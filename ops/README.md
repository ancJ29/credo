# ops: the runbook

The why of every step lives in [the ridge plan](../docs/plans/2026-10-28-ridge.md); this file is
the order and the commands. Each script writes its log to `logs/` in the credo root (the folder
that holds `.bare`) and ends it on `== exit <n>`; the machine reads the log, so paste nothing.
A push to `main` releases c-storage, ships the BFF and the UI, and checks ridge by itself ([the deploy job](#the-deploy-job)).

## At a glance

| You want | Run | Takes |
| --- | --- | --- |
| the network, once | `ops/stack.sh network` | about 5 minutes |
| GitHub's provider, once | `ops/stack.sh github` | about a minute |
| an environment's box and deploy role | `ops/stack.sh env <name>` | about 5 minutes |
| to see a change before it happens | add `--plan` to any of the above | about a minute |
| a release | push to `main` ([the deploy job](#the-deploy-job)) | under 10 minutes |
| a release, when GitHub Actions is down | `ops/release.sh <env> [<sha>]` | about 4 minutes |
| the BFF and the UI, when GitHub Actions is down or a key changed on the box | `ops/app.sh <env> [<sha>]` ([the app](#the-app)) | about 5 minutes by hand, 2 in the job |
| the operator's account on ridge | `ops/operator.sh ridge [--replace] [<name>]` ([the operator](#the-operator)) | about a minute |
| the demo copies brought up to yesterday, when Actions is down or for a copy just made | `ops/seed.sh ridge` ([the seed](#the-seed)) | about a minute, a few for a first fill |
| to check an environment | `ops/check.sh <env>` | about 3 minutes |
| to read ridge's c-storage from this Mac, with Bruno or curl | `ops/tunnel.sh ridge` ([the tunnel](#the-tunnel)) | until Ctrl-C, an hour at most |
| the crash and reboot drill | `ops/drill.sh <env>`, then `ops/check.sh <env>` | about 5 minutes |

## Before any step

1. Work in a worktree at `main`. Each script fetches `origin/main` itself and stops when `ops/`
   here differs from it, so only reviewed scripts act under your AWS session.
2. Hold an AWS session for the account, in the terminal you run the script from.
   - The Region is fixed in `ops/lib.sh` (`ap-southeast-5`); the script stops if the account has it
     disabled.
3. Have `jq`, `ssh`, and `gh` logged in with rights on the repository (`stack.sh env` needs them).
   - `check.sh` also needs Bruno CLI 4.2.0: `npm install -g --ignore-scripts @usebruno/cli@4.2.0`.

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
   - A stack that stays in `ROLLBACK_COMPLETE` is deleted by hand in the console before the script
     is run again; the script stops and says so.

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
   - `env` reads the deploy role's subject from GitHub (`gh api repos/<owner>/<name>/actions/oidc/customization/sub`),
     prints it as `subject prefix:` in the log, and keeps the stack's. It stops if GitHub's differs
     from the stack's, if the settings use custom claim keys, or if it cannot read them.
3. Run it again without `--plan`.
   - **REFUSED:** the change set removes or replaces something and nothing changed. If the plan's
     step names that change on purpose, run again with `--take <LogicalId>`; otherwise change the
     template.
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
2. Read the log's last lines: `released <sha>`.

c-storage listens on the box's private address, the stack's `BoxAddress`, and on no other interface.
Each release writes `/etc/c-storage/listen.env` from it and the unit reads that file. The first
release that carries this change reads `/health` on that address before sending anything, which the
old loopback listener does not answer: the log then finds no running commit, and the release goes on
(the same as a first release). The check, the drill and the tunnel read the same address.
3. `ops/check.sh ridge`.

## The deploy job

The human's push to `main` that touches `c-storage/`, `ops/`, the app (`bff/`, `ui/`, `shared/`,
`scripts/`, `visual/`, `walk/`, the workspace's files) or the workflow starts it, once `check`, `e2e`,
`ops` and `app` are green. It builds the binary, the BFF's bundle and the UI (before it holds the
role, since those run third-party code), takes the deploy role (environment `ridge`, secret
`AWS_ROLE_ARN`), then runs `ops/release.sh ridge`, `ops/app.sh ridge` and `ops/check.sh ridge` over the
tunnel. It changes no stack: a template change stays your change set. After a change set on ridge,
re-run the latest deploy: the template's `Bff` is a stub with no environment, and a change to it may
put that back (the BFF then answers 503 until the next deploy).

1. Read the run's log in GitHub; the scripts' lines end `released <sha>` and `== green`.
   - **superseded: ridge runs <sha>, then == green:** a newer commit of `main` is already on ridge
     (its gates finished first); nothing was sent, and the app's ship and the check are skipped: that
     commit's own deploy shipped them. ridge never moves backwards.
   - **skipped: ridge's stack holds no layer four yet:** `app.sh` and the check's new reads wait for
     the human's change set (`ops/stack.sh env ridge`, plan step 15); the job is green without them.
   - **shown cancelled:** a newer push to `main` took its place in the queue; that push's own
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

`ops/operator.sh ridge` makes the operator's account (the name `operator`, or the one given) and shows
its first password on your terminal once. It is never written in the log: the script writes it past the
log, then searches the log for it. It refuses in GitHub's job and without a terminal.

1. Run it from a worktree at `main` with `pnpm install` done, after the first app deploy (which makes
   the BFF's service). Read the account from the terminal, not the log.
   - **the operator ... exists:** it will not make one over another; add `--replace` for a new password,
     the way back from a lost one.
   - **the run was killed with `kill -9`:** the trap that deletes the scratch folder did not run, and
     the first password stays in `$TMPDIR` (`credo-ops.*/shown`). Delete that folder, then run again
     with `--replace`.
2. Open `<the app's address>/operator` and sign in. The address is in the local log of
   `ops/stack.sh env ridge` (never in a committed file or a public log).

## The seed

The demo copies on ridge get a day each morning from `.github/workflows/seed.yml` (06:00 in Vietnam,
and a manual run), which runs `ops/seed.sh ridge` under the deploy role. The script makes no client and
no password: the human makes each copy at `/operator` first, under its mapped code. The why is
[the plan](../docs/plans/2026-10-29-demo-seed.md#how-the-data-reaches-ridge).

1. Make a copy at `/operator` under its code from the mapping (`scripts/src/demo/mapping.ts`), and
   send its link and root password privately. Then run `ops/seed.sh ridge` by hand from a worktree at
   `main` with `pnpm install` done, or wait for the morning's run.
2. Read the log's lines: `seed: <n> copies mapped, <n> up to date, <n> not on this service, <n> days
   applied`, then `seeded <sha>`.
   - **<code>: not on this service, left:** that mapped code has no client on ridge. Make it at
     `/operator`; a mistyped code is not in the mapping, so it stays empty.
   - **<code>: holds more than a new client does, left:** its users used it before the seed filled it. It
     stays as it is; make a new copy under a new code.
   - **<code>: <n> days behind, more than 30, left:** the schedule stopped for a month; the run ends red.
     Run it again after reading why.
   - **/health names <sha>, not <sha>:** ridge runs another commit than the seed's. Nothing was
     written. After a deploy, run it again once the deploy is green; the next morning catches the day up.
   - **below the floor:** the box has too little free disk, memory or swap; free it first.
   - **this tree differs from <sha>:** commit or drop the change; the seed runs the code in this tree.
3. A red scheduled run is a defect, never a run to repeat. GitHub disables a public repository's
   schedules after 60 days without activity: if the last green is older than two days, run the workflow
   by hand (`gh workflow run seed`, or Actions, "Run workflow", on `main`).
   - **the credentials step fails:** the environment `ridge` or its secret is missing; `ops/stack.sh env ridge`.
   - **a key is in this log:** as in [the check](#the-check).

## The check

1. `ops/check.sh ridge`; it ends `== green`, or names each red. Once the stack holds layer four it also
   reads the BFF's group, the function (its subnet, group and the names of its variables, never the
   values), the UI's bucket and the one commit in `/health`, the function and `index.html`, then makes a
   fresh client `check-<time>` through the tunnel and signs it in through the app's address, as a
   partner would, with no cache in front of `/api/*`. Each run leaves that client, three records.
   - **needs pnpm install done:** the client is made by `scripts/`, run under Node.
   - **no c-storage/bruno, or the wrong Bruno CLI:** merge `main` in, or install 4.2.0.
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
   `c-storage/bruno/environments/ridge-tunnel.yml` (0600, git-ignored) with ridge's keys and a fresh
   service's.
2. In Bruno, open the collection `c-storage/bruno`, pick the environment `ridge-tunnel`: Health, then
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

## The drill

Once on a new box, and again when the unit, the templates or the box change. It breaks the known
state, so release first.

1. `ops/drill.sh ridge`; rows 13 and 14 of the plan's checks read green.
   - **the box did not come back:** wait, then run `ops/check.sh ridge`; the reboot may be slow.
2. `ops/check.sh ridge` reads green again.

## The ops job

CI lints the scripts (ShellCheck 0.11.0, installed in the job from its release) and templates
(cfn-lint), and runs `ops/test.sh`: the guards on hand-written input (the change-set filter among
them), `app.sh`, `operator.sh` and `seed.sh` whole on stand-ins for aws and ssh, and the `/health` check against
the real c-storage, built there, so Go must be installed. The guards also need Ruby (reads `env.yml`
as JSON), Node (the CloudFront Function, the scripts under `scripts/`) and `pnpm install` done.
Run the same three before pushing an `ops/` change:

1. `shellcheck -x ops/*.sh`
2. `cfn-lint ops/network.yml ops/github.yml ops/env.yml`
3. `bash ops/test.sh`, which also reads the workflow's `deploy` job: its branch condition,
   `!env.ACT` on each step, `needs`, the environment, the single concurrency and its `cancel-in-progress`,
   no `continue-on-error`, the Region, and the account id's mask; and the seed workflow's (a schedule
   and a manual run, `main` alone, environment `ridge`, the group `ridge-seed`, `!env.ACT` on each step).

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
