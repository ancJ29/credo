# Operator guide: every task, its command, what you see

> Skeleton, pass 1 of two (2026-11-18): each task's title and its command where one exists, pasted from
> the file named beside it. Pass 2 fills the paste-ready form and the one line of what you see. A task
> marked **no command yet** has none anywhere in this repository; one marked **in the console** is done
> by hand in the app at `/operator`.

## At a glance

One page for whoever runs credo: a system admin at a terminal, an operator in the console. Find the
task, paste its block, read the line under it. No reasons here: the why of every step is in the
runbook, [`ops/README.md`](../ops/README.md), and where the two differ the runbook wins.

| You meet it | Section |
| --- | --- |
| once, on a new account or environment | [Once, the first time](#once-the-first-time) |
| any day | [Everyday](#everyday) |
| a change to ship | [A change to ship](#a-change-to-ship) |
| a client or a demo copy | [A client](#a-client) |
| the people who run credo | [Operators](#operators) |
| ridge down for the weekend and back | [Ridge down and back](#ridge-down-and-back) |
| something wrong | [Something wrong](#something-wrong) |
| records to put back | [Restore](#restore) |
| more room for companies | [More boxes](#more-boxes) |

Every block runs from the `main` folder, up to date with GitHub; each script stops, changing nothing,
when it is not. Every script logs to the `logs` folder of the project's root and ends on `== exit`.

## Once, the first time

### The Bruno command line

Pass 2 moves it here from [the ridge guide, "Once, the first time"](ridge-guide.md#once-the-first-time).

### The network, GitHub's provider, an environment

```sh
ops/stack.sh network
ops/stack.sh github
ops/stack.sh env <name>
```

From [`ops/README.md`](../ops/README.md), "Bootstrap, once, in this order".

### A company's own address (the certificate, then the domain)

```sh
aws acm request-certificate --region us-east-1 --domain-name '*.<domain>' --validation-method DNS
aws acm wait certificate-validated --region us-east-1 --certificate-arn <the certificate>
```

From [`ops/README.md`](../ops/README.md), "A company's own address"; then its steps 3 to 5 (`ops/app.sh <env>`,
`ops/operator.sh <env> --replace`).

### The alarms and their Slack channel

The Slack steps: **no command yet** (by hand in Slack). Then, from [`ops/README.md`](../ops/README.md), "The watch":

```sh
ops/stack.sh env ridge --plan
```

### Production's first environment

**no command yet**: no production stack exists; [`ops/README.md`](../ops/README.md), "On production", says
what each script does there.

## Everyday

### Check ridge

[The ridge guide, step 2](ridge-guide.md#2-check-ridge); pass 2 moves it here.

### Bring the demo copies up to yesterday

[The ridge guide, step 7](ridge-guide.md#7-bring-the-demo-copies-up-to-yesterday); pass 2 moves it here.

### See whether the services answer

**in the console**: `/operator/services`.

### Read ridge's storage from this Mac

```sh
ops/tunnel.sh ridge
```

From [`ops/README.md`](../ops/README.md), "The tunnel".

### Read a script's log

**no command yet**: the log is in the root's `logs` folder; a `RED` or `== red` line is the one to read first.

## A change to ship

### Deploy a change

[The ridge guide, step 1](ridge-guide.md#1-deploy-a-change); pass 2 moves it here.

### A change to a template

```sh
ops/stack.sh <network | github | env name> --plan
```

From [`ops/README.md`](../ops/README.md), "A change to a template".

### The first deploy was refused at the role

```sh
ops/stack.sh env ridge --plan
ops/stack.sh env ridge
gh run rerun <id> --failed
```

From [`ops/README.md`](../ops/README.md), "The first deploy was refused at the role".

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

[The ridge guide, step 6](ridge-guide.md#6-make-the-six-demo-copies); pass 2 moves it here.

### Give a demo copy's root a new password

[The ridge guide, step 8](ridge-guide.md#8-give-a-demo-copys-root-a-new-password); pass 2 moves it here.

### Send a partner the words file, and read it back in

```sh
ops/words-in.sh <returned file> p1
```

From [`ops/README.md`](../ops/README.md), "A partner's returned words", which also makes the file to send.

### Send a partner their link and password

**no command yet**: by your own channel.

## Operators

### Make the first operator on ridge

[The ridge guide, step 5](ridge-guide.md#5-make-the-operator); pass 2 moves it here.

### Add an operator

**in the console**: `/operator/operators`.

### A lost passkey

**in the console**: the operator's row on the Operators page, "New link". The first operator's own,
from a terminal: `--replace` in [the ridge guide, step 5](ridge-guide.md#5-make-the-operator).

### Delete an operator

**in the console**: the operator's row on the Operators page, "Delete".

## Ridge down and back

### Take ridge down

[The ridge guide, step 3](ridge-guide.md#3-take-ridge-down-friday-night); pass 2 moves it here.

### Bring ridge back, then the operator and the demo copies

[The ridge guide, steps 4, 5 and 6](ridge-guide.md#4-bring-ridge-back-monday-morning); pass 2 moves them here.

## Something wrong

### The check is red

[The ridge guide, step 2](ridge-guide.md#2-check-ridge), then the log's red lines.

### Replace one of the four keys

```sh
ops/keys.sh <env> <key>
```

From [`ops/README.md`](../ops/README.md), "The keys".

### The crash and reboot drill

```sh
ops/drill.sh ridge
ops/check.sh ridge
```

From [`ops/README.md`](../ops/README.md), "The drill".

### A box the stack kept

```sh
aws ec2 describe-instances --region ap-southeast-5 --filters Name=tag:Name,Values=credo-<env> --query 'Reservations[].Instances[].[InstanceId,Placement.AvailabilityZone,State.Name,LaunchTime]' --output text
```

From [`ops/README.md`](../ops/README.md), "A retained box", which goes on with the box opened over Instance Connect.

### A records disk left behind

```sh
aws ec2 describe-volumes --region ap-southeast-5 --filters Name=status,Values=available --query 'Volumes[].[VolumeId,Size,AvailabilityZone,CreateTime]' --output text
aws ec2 attach-volume --volume-id <id> --instance-id <new> --device /dev/sdf
```

From [`ops/README.md`](../ops/README.md), "A left-behind volume".

### An alarm in the Slack channel

**no command yet**.

### Who changed a record, and what it held before

**no command yet**: nothing records it ([`docs/README.md`](README.md), its first section).

## Restore

### Put the records back from the copy

[The ridge guide, step 9](ridge-guide.md#9-put-the-records-back-from-the-copy); pass 2 moves it here.

### Swap a restore onto the live file, or onto a blank box

```sh
ops/restore.sh <env> [--at <time>] --onto-live
ops/restore.sh <env> [--at <time>] --onto-blank [--box <name>]
```

From [`ops/README.md`](../ops/README.md), "Restoring the records".

### Put one demo copy back, alone

```sh
ops/company-restore.sh ridge <code>
```

From [`ops/README.md`](../ops/README.md), "Restoring the records".

### The records after a take-down (the kept snapshot)

**no command yet**: no script restores it.

## More boxes

### Add a box

```sh
ops/stack.sh env <env> --more-boxes b2 --plan
ops/release.sh <env> --box b2
ops/check.sh <env> --box b2
```

From [`ops/README.md`](../ops/README.md), "Adding a box".

### Take the added boxes away

```sh
ops/stack.sh env <env> --more-boxes none --plan
```

From [`ops/README.md`](../ops/README.md), "Adding a box".

## Not on this page

A developer's own copy of the app is [the quick start](quick-start.md). The gate, the walks' full run and the
Pages previews are a developer's, in [`ops/README.md`](../ops/README.md).
