# Ridge guide: the shared pre-production environment, by hand

Ridge is the one shared environment on AWS where somebody can check a piece without reading its code.
It can be taken down on a Friday night and brought back on a Monday morning. When it is down, its records are
gone and the demo copies with them.

Nine things you can do. Copy a block, paste it, read the line under it. Every block finds the project's
folder by itself, so you can paste it from any folder inside a checkout of this project. The runbook,
[`ops/README.md`](../ops/README.md), holds the why of each step and every refusal; this page is the short way
through it, and where the two differ the runbook wins.

## Once, the first time

You need three things in the terminal you paste into, and none of them is a block to paste:

- An AWS session for the account, opened in that same terminal.
- `gh` logged in with rights on the repository (`gh auth login` if it is not).
- Node 26, pnpm 12, Go and `jq`.

Then these two, once:

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && pnpm install
```

You will see pnpm fetch and link the packages, ending in a summary of what it installed.

```sh
npm install -g --ignore-scripts @usebruno/cli@4.2.0
```

You will see npm add one package. The check (step 2) and the bring-back (step 4) refuse to start without exactly
this version of the Bruno command line.

Every block below runs from the `main` folder and reads `ops/` there. Each script fetches `origin/main` itself
and stops, changing nothing, when the code in that folder is not the same as `origin/main`'s, so bring the
`main` folder up to date first.

## 1. Deploy a change

A push to `main` that touches the storage service, `ops/`, the app or the workflow deploys onto ridge by itself,
once the four gates are green. To deploy without a push, open the repository on GitHub, choose the workflow `ci`,
press **Run workflow** on `main`. Nothing to paste.

Only while GitHub Actions is down, do the same by hand, these two in order:

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/release.sh ridge
```

The log's last line is `released` and the commit it put on the box. If ridge already runs something newer it
says `superseded: ridge runs` and that commit, sends nothing and still exits 0: ridge never moves backwards.

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/app.sh ridge
```

The last line is `shipped` and the commit: the app's server code and its screens are on ridge.

## 2. Check ridge

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/check.sh ridge
```

About 3 minutes. It reads ridge from AWS and from the box, makes a throwaway company, signs it in through the
app's address as a partner would and deletes it again. The log ends `== green`, or `== red` followed by one line
for each thing that failed. Add `--reads-only` after `ridge` if you want it to change nothing at all.

## 3. Take ridge down (Friday night)

**This cannot be undone.** Ridge's records, the demo copies and the operator all go with it. The one thing kept
is a snapshot of the records disk, which no script here restores.

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/destroy.sh ridge
```

About 5 minutes. It lists what it found and what will go, prints the way back, and then asks you to type
`ridge`. Anything else stops it with nothing changed. Once you type it, it switches off the two workflows that
reach ridge (`ci` and `seed`, never `walks`), deletes everything of ridge's one piece at a time and reads each
back as gone. The log's verdict is `== verdict: ridge is destroyed, ci.yml and seed.yml are off`, and it ends
`== exit 0`. If it stops part-way, run the same block again: it looks again and skips what is gone.

While ridge is down, a push to `main` runs nothing of `ci`, the four gates included: GitHub starts no
workflow that is off.

## 4. Bring ridge back (Monday morning)

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/remake.sh ridge
```

About 15 minutes, five steps: the stack, the release, the app, the check, then the two workflows switched back
on and read back active. It ends `== ridge is remade from main and checked. It is empty: it holds no operator
and no demo copy.` and then `== green`. If a step is red it says `== stopped at step` and which one, the
workflows stay off, and the remedy is to run the same block again.

Ridge is empty now, and its address may be a new one: a link you kept to the old address, and every old
passkey, no longer works. Go on to step 5.

## 5. Make the operator

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/operator.sh ridge
```

About a minute. It prints the operator's one-time join link on your terminal and says it is shown once and is in
no log. Open it to make the first passkey; it works once and expires after a day. It needs a real terminal and
the app deployed once (step 4 did that).

If the operator already exists it refuses to make another; to get a new link for lost passkeys, add `--replace`
after `ridge`, which replaces every passkey they held and ends their sessions.

## 6. Make the six demo copies

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/demo-remake.sh ridge
```

About 2.6 hours, up to 4, and your AWS session must stay open to the clock time it prints. It first asks for one
password for each partner, each typed twice and never shown; send each partner their link and password by your
own channel. It then lists the six copies and asks you to type `remake ridge`. It deletes each copy, makes it
again under that partner's password and fills it with 21 days ending yesterday, printing a line every 30 seconds
while it works. The last line is `the 6 demo copies on ridge are remade, each with its partner's password, 21
days filled up to yesterday`.

A stop before the first delete reads `== refused:` and changed nothing. A stop after it reads `error:`: run the
block again whole if the log's last `[n/6]` line is in the remake, or add `--go-on` after `ridge` if it is in the
fill (that asks nothing and deletes nothing), unless the lines above say a copy is not remade: then the block
again whole.

## 7. Bring the demo copies up to yesterday

Do this before anyone checks anything against ridge: the copies are only as fresh as the last run.

```sh
gh workflow run seed
```

It starts the `seed` workflow on GitHub, which has no schedule. Read its run on GitHub. Or, while Actions is
down, from the `main` folder:

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/seed.sh ridge
```

Up to about 15 minutes; it applies 2 days a copy a run. It prints `seed:` with how many copies are mapped, up to
date, not on the service and how many days it applied, then `seeded` and the commit. A `seed: STILL BEHIND`
line just before that `seed:` line means it is green but not yet at yesterday: run it again to go on.

## 8. Give a demo copy's root a new password

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/root-password.sh ridge CODE
```

Put the copy's code from `scripts/src/demo/mapping.ts` where `CODE` is; name several codes, space apart, for
copies one person holds. It asks for the password twice, shows nothing, logs nothing and keeps nothing. Its last
line is `set on` and the number of roots, `root(s); every session of them ended`.

## 9. Put the records back from the copy

Ridge's records are copied to a bucket about once a second while it runs. This writes the newest copy to a new
file beside the live one and touches nothing live.

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/restore.sh ridge
```

About a minute. It names the box, restores on it, and says the live file is untouched, with the command to
swap a fresh restore in. That swap, `--onto-live`, stops the storage service and moves the live file aside, never
deleting it. It does not apply after a take-down: the copy bucket goes with the destroy.

## Two things worth knowing

Every script writes its log to the `logs` folder of the project's root and ends it on `== exit` and the code.
A line `RED` or a `== red` in it is the thing to read first.

This page does not cover the tunnel (`ops/tunnel.sh ridge`, to read ridge's storage from Bruno), the crash drill
(`ops/drill.sh ridge`), the alarms and their Slack channel, or a change to a template (`ops/stack.sh`). They are
in the runbook.

## What has not run yet

- Steps 6 and 8 (`ops/demo-remake.sh`, `ops/root-password.sh`) are in the repository and tested on stand-ins,
  but no recap in `docs/recaps/` records a run of either on the real ridge. Step 6's timings above are the
  script's own estimates.
- Step 9 (`ops/restore.sh`) and the copy it reads are built and tested on this Mac; the continuous-copy recap
  says nothing of it has run on ridge yet. Treat it as untried.
- Steps 3, 4 and 5 ran on the real ridge on 2026-11-12: the take-down took about 5.5 minutes, the bring-back
  about 7.5 and the operator 13 seconds, each ending 0. Whether the operator's passkey was then made is not
  yet recorded.
- Step 1's press of **Run workflow** has not yet been recorded as run.
