# Operator guide: every task, its command, what you see

## At a glance

One page for whoever runs credo: a system admin at a terminal, an operator in the console at `/operator`.
Find the task, paste its block, read the line under it. A task marked **in the console** is done by hand
in the app; one marked **no command yet** has none anywhere in this repository. The why of every step is
in the runbook, [`ops/README.md`](../ops/README.md), and where the two differ the runbook wins.

| You meet it | Section |
| --- | --- |
| once, on a new machine, account or environment | [Once, the first time](#once-the-first-time) |
| any day | [Everyday](#everyday) |
| a change to ship | [A change to ship](#a-change-to-ship) |
| a client or a demo copy | [A client](#a-client) |
| the people who run credo | [Operators](#operators) |
| ridge down for the weekend and back | [Ridge down and back](#ridge-down-and-back) |
| something wrong | [Something wrong](#something-wrong) |
| records to put back | [Restore](#restore) |
| more room for companies | [More boxes](#more-boxes) |

Ridge is the one shared environment on AWS where somebody can check a piece without reading its code; a
piece's card is in [Check a piece on ridge, without code](products.md#check-a-piece-on-ridge-without-code).
When it is down, its records are gone and the demo copies with them.

Every block finds the project's folder by itself, so you can paste it from any folder inside a checkout
of this project. Every block runs from the `main` folder and reads `ops/` there. Each script fetches
`origin/main` itself and stops, changing nothing, when the code in that folder is not the same as
`origin/main`'s; it then prints one line, `the code here (tracked and unignored files under every path ci.yml deploys on, and .gitignore) differs from origin/main's: run the scripts from a worktree at main, never unreviewed ones`, and it counts an edit you have not committed as a difference too.

Every script writes its log to the `logs` folder of the project's root and ends it on `== exit` and the
code. A line `RED` or a `== red` in it is the thing to read first.

## Once, the first time

### What the terminal needs

None of these is a block to paste:

- An AWS session for the account, opened in that same terminal.
- `gh` logged in with rights on the repository (`gh auth login` if it is not).
- The [first-time setup](first-time-setup.md) done, and `jq`.

### The Bruno command line

```sh
npm install -g --ignore-scripts @usebruno/cli@4.2.0
```

You will see npm add one package. Checking ridge and bringing it back refuse to start without exactly this
version.

### Bring the `main` folder up to date

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && git pull --ff-only origin main
```

You will see git fetch and move `main` forward, or say it is already up to date. If instead `main` holds
commits GitHub lacks (merged here, not pushed), the pull changes nothing and the difference stays: the fix
is a push, which is your decision, not a step on this page.

### The region, for the `aws` blocks

In each terminal you paste an `aws` block into:

```sh
export CREDO_REGION="$(sed -n 's/^CREDO_REGION=${CREDO_REGION:-\(.*\)}$/\1/p' "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main/ops/lib.sh")"
```

You will see nothing; `echo "$CREDO_REGION"` then prints the region the scripts pin in `ops/lib.sh`.

### The network

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/stack.sh network
```

About 5 minutes. The log names the stack made, its outputs and `internet gateways on the VPC: 0`.

### GitHub's provider

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/stack.sh github
```

About a minute. When the account already has the provider, the log says `found already there` and makes no
stack.

### An environment

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/stack.sh env ridge
```

About 5 minutes. The run ends on `ok   no key in this log`, or on a `RED` line.

### A company's own address: the certificate

```sh
aws acm request-certificate --region us-east-1 --domain-name '*.<domain>' --validation-method DNS
```

You will see the certificate's ARN. Put its validation record in Cloudflare as DNS only (no proxy).

```sh
aws acm wait certificate-validated --region us-east-1 --certificate-arn <the certificate>
```

You will see nothing until the certificate is validated, then the prompt.

### A company's own address: the stack

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && CREDO_DOMAIN=<domain> CREDO_CERTIFICATE_ARN=<the certificate> bash ops/stack.sh env ridge --plan
```

You will see one `Modify` of `Distribution` and nothing removed or replaced. Then the same without
`--plan`, which prints CloudFront's own name. In Cloudflare, one wildcard record, `*.<the domain's first part>`, to that name, DNS only. Then [deploy a change](#deploy-a-change), and [a lost
passkey](#a-lost-passkey) for an operator who held passkeys at the old address.

### The alarms and their Slack channel

The Slack steps are by hand, in [`ops/README.md`](../ops/README.md), "The watch": **no command yet**. Then:

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && CREDO_SLACK_WORKSPACE_ID=<workspace id> CREDO_SLACK_CHANNEL_ID=<channel id> bash ops/stack.sh env ridge --plan
```

You will see the change: a topic, four alarms, a channel and its role added, nothing changed or removed.
Then the same without `--plan`; its log ends `== exit 0` and its outputs read `Watch = alarms reach Slack`.

### Production's first environment

**no command yet**: no production stack exists; [`ops/README.md`](../ops/README.md), "On production", says
what each script does there.

## Everyday

### Check ridge

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/check.sh ridge
```

About 3 minutes. It makes a throwaway company, signs it in through the app's address as a partner would and
deletes it again. Near its end the log reads `== green`, or `== red` followed by one line for each thing
that failed. Add `--reads-only` after `ridge` to change nothing at all.

### Bring the demo copies up to yesterday

Do this before anyone checks anything against ridge.

```sh
gh workflow run seed
```

It starts the `seed` workflow on GitHub, which has no schedule. Read its run on GitHub. Or, while Actions
is down:

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/seed.sh ridge
```

Up to about 15 minutes; it applies 2 days a copy a run. It prints `seed:` with how many copies are mapped, up
to date, not on the service and how many days it applied, then `seeded` and the commit. A `seed: STILL BEHIND` line just before that `seed:` line means it is green but not yet at yesterday: run it again to go on.

### See whether the services answer

**in the console**: `/operator/services`.

### Read ridge's storage from this Mac

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/tunnel.sh ridge
```

You will see `ready: http://127.0.0.1:3192 is ridge's c-storage, until Ctrl-C or` a clock time `(the endpoint's hour)`. Bruno or curl reads it until then; Ctrl-C ends it.

## A change to ship

### Deploy a change

A push to `main` that touches the storage service, the activity log's service, `ops/`, the app or the
workflow deploys onto ridge by itself, once the five gates are green. To deploy without a push, open the
repository on GitHub, choose the workflow `ci`, press **Run workflow** on `main`. Nothing to paste.

Only while GitHub Actions is down, do the same by hand, these two in order:

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/release.sh ridge
```

Near its end the log says `released` and the commit it put on the box. If ridge already runs something newer
it says `superseded: ridge runs` and that commit, sends nothing and still exits 0.

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/app.sh ridge
```

Near its end the log says `shipped` and the commit: the app's server code and its screens are on ridge.

### Go back to the last good version

Revert the bad commit on `main` and push: the deploy that follows ships the reverted tree onto ridge, as in
[Deploy a change](#deploy-a-change). On ridge a revert took 65 minutes 58 seconds from being written to ridge
running the code from before. A deploy that stopped half way leaves a mixed version until then.

Only while GitHub Actions is down, do the same by hand, these two in order:

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/release.sh ridge
```

Near its end the log says `released` and the revert's commit. Never the old commit: it says
`superseded: ridge runs` and that commit, sends nothing and still exits 0.

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/app.sh ridge
```

Near its end the log says `shipped` and the commit.

### A change to a template

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/stack.sh env ridge --plan
```

About a minute; it builds the change set, reads it to you, deletes it and changes nothing. A stack already
as the template says prints `no changes: the stack is as the template says`. Read each change, then the
same without `--plan`. Put `network` or `github` in place of `env ridge` for those two stacks.

### The first deploy was refused at the role

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/stack.sh env ridge --plan
```

You will see the change set read and nothing changed. Then the same without `--plan`, then:

```sh
gh run rerun <id> --failed
```

GitHub starts the run's failed jobs again; read the run on GitHub.

## A client

### Add a client and copy its sign-in link

**in the console**: `/operator`, Clients.

### Pick the box a new client lives on

**in the console**: `/operator`, Clients, add a client (shown when the back end holds more than one box).

### Give a client's root a new password

**in the console**: the client's row in Clients, "New root password".

### Delete a client

**in the console**: the client's row in Clients, "Delete". A deletion left unfinished: **no command yet**
([open item 133](open-items.md)).

### Move a client to another box

**in the console**: the client's row in Clients, "Move to another box".

### Remake the six demo copies

**This deletes all six copies, and whatever partners did in them.** Do not run it while the seed runs.

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/demo-remake.sh ridge
```

About 10 minutes, up to 15, with Go on your PATH. It first asks for one password for each partner, each
typed twice and never shown; send each partner their link and password by your own channel. It then lists
the six copies and asks you to type `remake ridge`, and prints a line every 30 seconds while it works. Its
last line before `== exit` is `the 6 demo copies on ridge are remade, each with its partner's password, 21 days filled up to yesterday`.

A stop before the first delete reads `== refused:` and changed nothing. A stop after it reads `error:`: add
`--go-on` after `ridge`, which asks nothing and copies only what differs from the store this Mac kept, or
run the block again whole.

### Give a demo copy's root a new password

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/root-password.sh ridge CODE
```

Put the copy's code from `scripts/src/demo/mapping.ts` where `CODE` is; name several codes, space apart, for
copies one person holds. Do not run it while the seed runs. It asks for the password twice, shows nothing,
logs nothing and keeps nothing. Near its end it says `set on` and the number of roots, `root(s); every session of them ended`.

### Read a partner's returned words in

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/words-in.sh <returned file> p1
```

You will see every change shown, then its question, which you answer `y`. It ends `== exit 0` when the words
landed on `pre-merge`, or when there was nothing to land; `== refused:` and exit 2 changed nothing. Making
the file to send is in [`ops/README.md`](../ops/README.md), "A partner's returned words".

### Send a partner their link and password

**no command yet**: by your own channel.

## Operators

### Make the first operator on ridge

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/operator.sh ridge
```

About a minute. It prints the operator's one-time join link on your terminal and says it is shown once and
is in no log. Open it to make the first passkey; it works once and expires after a day. It needs a real
terminal and the app deployed once. If the operator already exists it refuses to make another.

### Add an operator

**in the console**: `/operator/operators`.

### A lost passkey

**in the console**: the operator's row on the Operators page, "New link". For the first operator, from a
terminal:

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/operator.sh ridge --replace
```

It prints a new one-time join link, replaces every passkey they held and ends their sessions.

### Delete an operator

**in the console**: the operator's row on the Operators page, "Delete".

## Ridge down and back

### Take ridge down (Friday night)

**This cannot be undone.** Ridge's records, the demo copies and the operator all go with it. The one thing
kept is a snapshot of the records disk, which no script here restores.

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/destroy.sh ridge
```

About 5 minutes. It lists what it found and what will go, prints the way back, and then asks you to type
`ridge`. Anything else stops it with nothing changed. Once you type it, it switches off the two workflows
that reach ridge (`ci` and `seed`, never `walks`), deletes everything of ridge's one piece at a time and
reads each back as gone. The log's verdict is `== verdict: ridge is destroyed, ci.yml and seed.yml are off`,
and it ends `== exit 0`. If it stops part-way, run the same block again: it looks again and skips what is
gone.

While ridge is down, a push to `main` runs nothing of `ci`, the five gates included.

### Bring ridge back (Monday morning)

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/remake.sh ridge
```

About 15 minutes, five steps: the stack, the release, the app, the check, then the two workflows switched
back on and read back active. Near its end it reads `== ridge is remade from main and checked. It is empty: it holds no operator and no demo copy.` and then `== green`. If a step is red it says `== stopped at step`
and which one, the workflows stay off, and the remedy is to run the same block again.

Ridge is empty now, and its address may be a new one: a link you kept to the old address, and every old
passkey, no longer works. Then [make the first operator](#make-the-first-operator-on-ridge), [remake the six
demo copies](#remake-the-six-demo-copies) and [bring them up to
yesterday](#bring-the-demo-copies-up-to-yesterday).

## Something wrong

### The check is red

[Check ridge](#check-ridge), then the log's `RED` and `== red` lines.

### Replace one of the four keys

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/keys.sh ridge <key>
```

Put `front-door`, `internal`, `admin` or `service` where `<key>` is. Under a minute, longer for `front-door`
(the distribution's deploy). It ends `replaced the <key> key`, after reading the old value back refused and
the new one accepted. On an environment with a box added, run `ops/app.sh` for it again after.

### The crash and reboot drill

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/drill.sh ridge
```

About 5 minutes. The log reads rows 13, 14 and 17 (the store killed and back, the box rebooted and back, a
restore holding the code), then `next: ops/check.sh ridge`. Then [check ridge](#check-ridge).

### A box the stack kept

```sh
aws ec2 describe-instances --region "$CREDO_REGION" --filters Name=tag:Name,Values=credo-<env> --query 'Reservations[].Instances[].[InstanceId,Placement.AvailabilityZone,State.Name,LaunchTime]' --output text
```

You will see one line a box: its id, its zone, its state and when it started. What to do next is in
[`ops/README.md`](../ops/README.md), "A retained box".

### A records disk left behind

```sh
aws ec2 describe-volumes --region "$CREDO_REGION" --filters Name=status,Values=available --query 'Volumes[].[VolumeId,Size,AvailabilityZone,CreateTime]' --output text
```

You will see one line a loose disk: its id, its size, its zone and when it was made.

```sh
aws ec2 attach-volume --region "$CREDO_REGION" --volume-id <id> --instance-id <new> --device /dev/sdf
```

You will see the attachment, its state `attaching`. The rest is in [`ops/README.md`](../ops/README.md), "A
left-behind volume".

### An alarm in the Slack channel

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/check.sh ridge --reads-only
```

About 3 minutes, changing nothing. Near its end the log reads `== green`, or `== red` followed by one line
for each thing that failed.

Then [see whether the services answer](#see-whether-the-services-answer): **in the console**:
`/operator/services`.

Then, if the records are lost or wrong, [put the records back from the copy](#put-the-records-back-from-the-copy):

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/restore.sh ridge
```

About a minute. It names the box, restores on it, and says the live file is untouched, with the command to
swap a fresh restore in.

### Who changed a record, and what it held before

**no command yet**: nothing records it ([`docs/README.md`](README.md), its first section).

## Restore

### Put the records back from the copy

Ridge's records are copied to a bucket about once a second while it runs. This writes the newest copy to a
new file beside the live one and touches nothing live.

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/restore.sh ridge
```

About a minute. It names the box, restores on it, and says the live file is untouched, with the command to
swap a fresh restore in. Add `--at <time>` (such as `2026-11-12T10:00:00Z`) after `ridge` for the records as
they stood then. It does not apply after a take-down: the copy bucket goes with the destroy.

### Swap a restore onto the live file

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/restore.sh ridge --onto-live
```

About a minute. It stops the store, moves the live file aside under a name ending `.aside-<stamp>`, never
deleting it, puts the restored file in its place and starts the store again. Refused on an environment that
may hold real data.

### Restore onto a blank disk

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/restore.sh ridge --onto-blank
```

About a minute, for a replacement box or a disk the release refused as blank. It refuses a disk that holds
records or a store that is running. Then [release again](#deploy-a-change). Add `--box <name>` for a box
added to the stack.

### Put one demo copy back, alone

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/company-restore.sh ridge <code>
```

About two minutes, plus the tunnel. The other copies keep their later changes. A stop before its first write
reads `== refused:` and exits 2; after it, `error:` and exit 1.

### The records after a take-down (the kept snapshot)

**no command yet**: no script restores it.

## More boxes

### Add a box

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/stack.sh env ridge --more-boxes b2 --plan
```

You will see the box, its role and profile, its records disk and its attachment added, and three outputs;
the home box and everything else as they are. Anything changed or replaced, stop. Then the same without
`--plan`, then:

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/release.sh ridge
```

It releases to the home box and then to each box added, each with its own log.

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/app.sh ridge
```

Near its end the log says `shipped`; the back end now knows every box.

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/check.sh ridge --box b2
```

The log reads `== green` for that box alone.

### Take the added boxes away

Move the companies off the box first, and write down its id and zone.

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && bash ops/stack.sh env ridge --more-boxes none --plan
```

You will see the removal refused, naming the five pieces of the box; it passes when each is named with
`--take`. The steps after are in [`ops/README.md`](../ops/README.md), "Adding a box".

## Not on this page

A developer's own copy of the app is [the quick start](quick-start.md). The gate, the walks' full run and the
Pages previews are a developer's, in [`ops/README.md`](../ops/README.md).

## What has not run yet

- Remaking the demo copies and a demo copy's root password are in the repository and tested on stand-ins,
  but no recap in `docs/recaps/` records a run of either on the real ridge. The remake's timing above is the
  plan's aim, measured only between two stores on this Mac.
- Putting the records back from the copy ran on ridge on 2026-11-13, and so did one demo copy alone. A
  restore onto a box named with `--box` ran only on stand-ins, and no recap records one onto a blank disk on
  ridge. Treat those two as untried.
- Taking ridge down, bringing it back and making the operator ran on the real ridge on 2026-11-12: the
  take-down took about 5.5 minutes, the bring-back about 7.5 and the operator 13 seconds, each ending 0.
  Whether the operator's passkey was then made is not yet recorded.
- The press of **Run workflow** has not yet been recorded as run.
- The region block, and every block on this page that names a placeholder in angle brackets, was written
  for this page and has not yet been pasted.
