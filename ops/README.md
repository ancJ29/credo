# ops: the runbook

The why of every step lives in [the ridge plan](../docs/plans/2026-10-28-ridge.md); this file is
the order and the commands. Each script writes its log to `logs/` in the credo root (the folder
that holds `.bare`) and ends it on `== exit <n>`; the machine reads the log, so paste nothing.
A push to `main` releases and checks ridge by itself ([the deploy job](#the-deploy-job)).

## At a glance

| You want | Run | Takes |
| --- | --- | --- |
| the network, once | `ops/stack.sh network` | about 5 minutes |
| GitHub's provider, once | `ops/stack.sh github` | about a minute |
| an environment's box and deploy role | `ops/stack.sh env <name>` | about 5 minutes |
| to see a change before it happens | add `--plan` to any of the above | about a minute |
| a release | push to `main` ([the deploy job](#the-deploy-job)) | under 10 minutes |
| a release, when GitHub Actions is down | `ops/release.sh <env> [<sha>]` | about 4 minutes |
| to check an environment | `ops/check.sh <env>` | about 2 minutes |
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
3. `ops/check.sh ridge`.

## The deploy job

The human's push to `main` that touches `c-storage/`, `ops/` or the workflow starts it, once
`check`, `e2e` and `ops` are green. It builds the binary, takes the deploy role (environment
`ridge`, secret `AWS_ROLE_ARN`), then runs `ops/release.sh ridge` and `ops/check.sh ridge` over the
tunnel. It changes no stack: a template change stays your change set.

1. Read the run's log in GitHub; the scripts' lines end `released <sha>` and `== green`.
   - **superseded: ridge runs <sha>, then == green:** a newer commit of `main` is already on ridge
     (its gates finished first); nothing was sent. ridge never moves backwards.
   - **shown cancelled:** a newer push to `main` took its place in the queue; that push's own
     deploy carries it.
   - **red:** a defect, never a run to repeat. Fix forward and push, or revert the bad commit on
     `main` and push: the deploy that follows ships the reverted tree. Re-running an older run
     does not go back; it ends superseded.
   - **the credentials step fails:** the environment `ridge` or its secret is missing; run
     `ops/stack.sh env ridge` (plan step 11).
   - The job checks `ops/` against its own commit, not the newer `main`, so a push that lands
     during the run turns nothing red.
2. It never runs on a branch or in a pull request, and never under `act`: each of its steps is
   skipped there (`ops/test.sh` holds this).
3. While Actions is down, do the same by hand: [a release by hand](#a-release-by-hand).

## The check

1. `ops/check.sh ridge`; it ends `== green`, or names each red.
   - **no c-storage/bruno, or the wrong Bruno CLI:** merge `main` in, or install 4.2.0.
   - **something already answers on the check's local port:** free it, or set `CHECK_LOCAL_PORT`.
   - **a key is in this log:** delete the log, delete `/etc/c-storage/keys.env` on the box, then run
     `ops/release.sh ridge`, which makes new keys and restarts c-storage.

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
them), and the `/health` check against the real c-storage, built there, so Go must be installed.
Run the same three before pushing an `ops/` change:

1. `shellcheck -x ops/*.sh`
2. `cfn-lint ops/network.yml ops/github.yml ops/env.yml`
3. `bash ops/test.sh`, which also reads the workflow's `deploy` job: its branch condition,
   `!env.ACT` on each step, `needs`, the environment, the single concurrency and its `cancel-in-progress`,
   no `continue-on-error`, the Region, and the account id's mask.

Under `act` two things are act's own, not the scripts': the `check` job's "Post actions/setup-go"
fails (act's copy of the action lacks its cache-save module, and its cache server is unreachable),
and `ops/test.sh` prints `== skipped: the repository's .git cannot be read here` instead of reading
the ignore rule, because the copied worktree's `.git` names a folder of the Mac. Any other red there
is real; GitHub's run reads the rule.
