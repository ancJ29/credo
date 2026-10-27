# ops: the runbook

The why of every step lives in [the ridge plan](../docs/plans/2026-10-28-ridge.md); this file is
the order and the commands. Each script writes its log to `logs/` in the credo root (the folder
that holds `.bare`) and ends it on `== exit <n>`; the machine reads the log, so paste nothing.

## At a glance

| You want | Run | Takes |
| --- | --- | --- |
| the network, once | `ops/stack.sh network` | about 5 minutes |
| GitHub's provider, once | `ops/stack.sh github` | about a minute |
| an environment's box and deploy role | `ops/stack.sh env <name>` | about 5 minutes |
| to see a change before it happens | add `--plan` to any of the above | about a minute |
| a release, when GitHub Actions is down | `ops/release.sh <env> [<sha>]` | about 4 minutes |
| to check an environment | `ops/check.sh <env>` | about 2 minutes |
| the crash and reboot drill | `ops/drill.sh <env>`, then `ops/check.sh <env>` | about 5 minutes |

## Before any step

1. Work in a worktree at `main`, with `main` fetched: `git fetch origin main`.
2. Hold an AWS session for the account, in the terminal you run the script from.
   - The Region is fixed in `ops/lib.sh` (`ap-southeast-5`); the script stops if the account has it
     disabled.
3. Have `jq`, `ssh`, and `gh` logged in with rights on the repository (`stack.sh env` needs them).
   - `check.sh` also needs Bruno CLI 4.2.0: `npm install -g @usebruno/cli@4.2.0`.

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
     is run again.

## A change to a template

1. Merge the change into `main` after its review.
2. `ops/stack.sh <network | github | env name> --plan`: read each change.
3. Run it again without `--plan`.
   - **REFUSED:** the change set removes or replaces something and nothing changed. If the plan's
     step names that change on purpose, run again with `--take <LogicalId>`; otherwise change the
     template.
   - **no changes:** the stack already matches the template.

## A release by hand

Only while GitHub Actions is down: its concurrency group cannot see a run made here.

1. `ops/release.sh ridge` for `main`'s tip, or `ops/release.sh ridge <sha>`.
   - **is not a commit of main:** the sha is refused; use one `main` holds.
   - **below the floor:** the box has too little free disk or memory; free it before releasing.
   - **/health answered ...:** the box runs the old build, as it was. Read the journal lines the
     log prints.
2. Read the log's last lines: `released <sha>`.
3. `ops/check.sh ridge`.

## The check

1. `ops/check.sh ridge`; it ends `== green`, or names each red.
   - **no c-storage/bruno, or the wrong Bruno CLI:** merge `main` in, or install 4.2.0.
   - **something already answers on the check's local port:** free it, or set `CHECK_LOCAL_PORT`.
   - **a key is in this log:** delete the log, delete `/etc/c-storage/keys.env` on the box, restart
     c-storage; the next release makes new keys.

## The drill

Once on a new box, and again when the unit, the templates or the box change. It breaks the known
state, so release first.

1. `ops/drill.sh ridge`; rows 13 and 14 of the plan's checks read green.
   - **the box did not come back:** wait, then run `ops/check.sh ridge`; the reboot may be slow.
2. `ops/check.sh ridge` reads green again.

## The ops job

CI lints the scripts (ShellCheck) and templates (cfn-lint), and runs `ops/test.sh`: the change-set
filter on two recorded change sets, and the `/health` check against a local server stamped with
another commit. Run the same three before pushing an `ops/` change:

1. `shellcheck -x ops/*.sh`
2. `cfn-lint ops/network.yml ops/github.yml ops/env.yml`
3. `bash ops/test.sh`
