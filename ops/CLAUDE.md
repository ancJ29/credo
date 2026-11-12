# ops
Stack: bash 3.2 and Ubuntu's, plus hand-written CloudFormation YAML · Gate: rows 3 to 5 of [the gate](../CLAUDE.md#the-gate) (ShellCheck, cfn-lint, `bash ops/test.sh`), which CI's job `ops` runs; `pnpm check` runs `ops/gate.sh` from this folder and reads none of the rest · Ship: a push to `main`, or a press of `ci` on `main`, runs the release, the app's ship and the check in CI's job `deploy`

What a person or CI runs against ridge and the hosting account. Not product code.

## What belongs here, and what does not

- **OP1. A step is here when it is a CLI call on an environment, the box or a hosting account** (`aws`, `ssh`, `gh`, `wrangler`), or a template. A step that must run the product's own code is a `scripts/` command, called through `ops/lib.sh`'s `ridge_cli`. A walk is `walk/run.sh`'s. A piece's `one-off/` calls a script here, never copies one ([the full run](README.md#the-full-run)).
- **OP2. A script a person runs has a row in `ops/README.md`'s table** and its steps in the runbook. The filters a workflow calls (`ops/walks-digest.sh`) have none; `ops/test.sh` holds them.

## The file to copy

- **A script that acts on an environment:** `ops/seed.sh`, on `ops/lib.sh`'s `log_start`, `step`, `ok` and `die`; for the verdict, `ops/check.sh`'s last line.
- **A script a person runs on this Mac, no environment:** `ops/pages-preview.sh`, with its own `refuse` and `say`.
- **A filter, no log:** `ops/walks-refused.sh`.

## This package's own rules

An `ops/` change needs the three gate rows, as [the ops job](README.md#the-ops-job) lists them.

- **OP3. `actionlint` is no gate row;** a workflow change is read with it by hand ([the walks plan](../docs/plans/2026-10-28-walks-share.md#the-upload-from-github-actions)). CI's pinned ShellCheck is the verdict, not yours.
- **OP4. A bad call exits 2:** `usage: ops/<name>.sh …` on stderr in the twelve scripts that print one, a refusal (OP6) in the four hand-run ones. `gate.sh` is outside that count: it prints `usage: bash ops/gate.sh [<pkg>]` and exits 2. Line 2 of a file is that usage.
- **OP5. A script that acts under the AWS session sources `lib.sh`, opens with `log_start <name> <env>` and calls `main_synced` in its first step** (9 of 9), so only reviewed scripts act. The log's name and closing `== exit <n>` are `lib.sh`'s ([the receipt](../docs/conventions/qa.md#the-log-is-the-receipt)).
- **OP6. A stop before the first act is, in a `lib.sh` script, `die`: `error:` on stderr, exit 1 (8 of 9); in a hand-run script, `== refused: <why>` in the log, exit 2 (4 of 4).** `root-password.sh` redefines `die` to say both and misreads where the first write was (open item 47 in [`docs/open-items.md`](../docs/open-items.md)); the next file copies `seed.sh`.
- **OP7. A run ends in a verdict.** A `lib.sh` script ends `== green` (`verdict`) or on a line naming what was done (`released <sha>`); a hand-run one ends `== verdict: green` or `red: <why>`, then `== done`. Two say `good`; the next file says `green`.
- **OP8. A value that must not reach a log goes to `mask` as it is read;** the exit searches the log for it.
- **OP9. A script that calls `main_synced` also says its answer on production, in one call between `log_start` and `main_synced` (9 of 9):** `refuse_real <env> <why>` to stop on an environment not listed in `INVENTED_ENVS`, or `real_ok <env> <why>` to go on with a reason (both in `ops/lib.sh`). `ops/test.sh`'s section on the stance holds it over the glob, so a script written later meets it; the answers are [on production](README.md#on-production).

## Non-obvious facts

- **`ops/gate.sh` is the one gate command:** every package's `check` script and the root's call it, it takes the gate lock and writes `logs/<stamp>-gate-<pkg>.log`, and `ops/test.sh`'s gate section holds its cases ([the gate](README.md#the-gate)).
- **`.prettierignore`'s `# ridge's infrastructure` entry (`ops/`) keeps the formatter off this folder;** only the three rows read it.
- **A script stops when `ops/` differs from `origin/main`** (`main_synced`): a branch's edit runs only after it merges.
- **Local ports are one a script,** 3191 to 3196; a new one takes 3197, and the comment above `LOCAL_PORT` in `ops/root-password.sh` lists the others.
- **Open item 160 in [`docs/open-items.md`](../docs/open-items.md) asks a check to hold one `refuse()`, one log opener and one shebang;** until it does, OP6 and OP7 are per kind.

## Where the rest is

- The big picture: [`architecture.md`](../docs/architecture.md#at-a-glance).
- The cross-package rules: [`code.md`](../docs/conventions/code.md).
- The sibling to copy: [`scripts/CLAUDE.md`](../scripts/CLAUDE.md), the same jobs in the other language; its SC5 is OP4's.
