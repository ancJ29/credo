# Memo, 2026-11-08: what `Conditional` means on `Box`, and how the fence reaches ridge

*Status, added 2026-11-08 after 17:10: option 3 was taken. The change set was re-run with `--take Box` at 17:10 and ended `== exit 0`, and the box was read back as the same instance with the fence on its root device; nothing below is open as to how to proceed. The body is kept as written at 16:44.*

Not a plan. A decision memo for the backup-policy piece's step 8
(`docs/plans/2026-11-08-backup-policy.md#L116`), which stopped: `bash ops/stack.sh env ridge --plan`
against `origin/main` at `89ecf7e7` built the change set and the guard refused it
(`logs/2026-11-08-164424-stack-ridge.log`, `Modify Box (AWS::EC2::Instance) replacement=Conditional`,
`== exit 1`). Nothing was changed on AWS and nothing is changed by this memo but this file.

## What `Conditional` means, from AWS's own pages

Three sentences, each quoted from the page named:

- **`ResourceChange`** (API Reference,
  `docs.aws.amazon.com/AWSCloudFormation/latest/APIReference/API_ResourceChange.html`), the
  `Replacement` field: "For the `Modify` action, indicates whether CloudFormation will replace the
  resource"; "This value depends on the value of the `RequiresRecreation` property in the
  `ResourceTargetDefinition` structure." Valid Values: `True | False | Conditional`.
- **`ResourceTargetDefinition`** (same guide, `API_ResourceTargetDefinition.html`), the
  `RequiresRecreation` field: "If the `Attribute` value is `Properties`, indicates whether a change
  to this property causes the resource to be recreated."; "The value can be `Never`, `Always`, or
  `Conditionally`."; "To determine the conditions for a `Conditionally` recreation, see the update
  behavior for that property in the" ... "AWS CloudFormation User Guide."
- **`AWS::EC2::Instance`** (User Guide, `aws-properties-ec2-instance.html`), on
  `BlockDeviceMappings`: "Update requires: [Some interruptions]", and the note "After the instance is
  running, you can modify only the `DeleteOnTermination` parameter for the attached volumes" "without
  interrupting the instance." "Modifying any other parameter results in instance replacement."

So `Conditional` is not a second opinion about this change. It is the *property's class*, copied into
the change set: `BlockDeviceMappings` is a `Conditionally` recreating property, and `Replacement` is
derived from `RequiresRecreation` alone, so the change set reports the class, not the outcome for
these particular values. AWS's own instruction for a `Conditionally` value is to go read the
property's update behaviour — which is the EC2 note above, and that note says the one parameter
modifiable without interruption is exactly the one this diff changes.

**The two sentences do reconcile.** "Some interruptions" is the property's label in the reference;
the note is the condition attached to that label. Read together they say: this change, on its own,
should not replace the box — and CloudFormation will not say so in advance, because it answers at the
property's granularity, not the value's. The guard is right to refuse: `Conditional` is a maybe, and
the jq filter treats a maybe as a replacement (`ops/unsafe-changes.jq#L4`).

## Which part of the diff produces it

`Box`'s diff since `0f7d69c1` is three lines and nothing else (`git diff 0f7d69c1..HEAD -- ops/env.yml`):
`DeletionPolicy: RetainExceptOnCreate` and `UpdateReplacePolicy: Retain` added on the resource, and
`BlockDeviceMappings[0].Ebs.DeleteOnTermination` from `true` to `false` (`ops/env.yml#L105-L106`,
`#L128`). Every parameter printed `(previous)` in the refused run, so no intrinsic function under
`Box` moved.

**`Conditional` comes from the device property, and only from it.** The brief's premise that the two
retention attributes "should not appear as a resource change at all" is wrong, and the correction
matters for option 1: `ResourceTargetDefinition`'s `Attribute` field has Valid Values
"`Properties | Metadata | CreationPolicy | UpdatePolicy | DeletionPolicy | UpdateReplacePolicy | Tags`",
so both attributes are things CloudFormation reports as change-set changes. They cannot *cause*
`Conditional`, because `RequiresRecreation` is defined only "If the `Attribute` value is
`Properties`" (and the `Name` field's "For all other attributes, the value is null"), and
`Replacement` depends on `RequiresRecreation`.

Not proved, and only a run proves it: that the refused change set's `Details` carried exactly one
`RequiresRecreation: Conditionally` entry, on `BlockDeviceMappings`. `ops/stack.sh` prints only
`Action`, `LogicalResourceId`, `ResourceType` and `Replacement` (`ops/stack.sh#L223`) and then
deletes the change set, so the log cannot be re-read for it. **Follow-up worth its minutes:** have
`--plan` also print each change's `Details[].Target` (`Attribute`, `Name`, `RequiresRecreation`) and
`Evaluation`. Every future refusal then names its own cause instead of needing a memo.

## The options, priced

**1. Keep both attributes, take `DeleteOnTermination: false` back out.** The change set would then
show `Modify Box` with no `Properties` detail, so `Replacement` is not `Conditional` and the guard
passes; the access log lands and two fences of three land. It is *not* a no-op change set — the
attributes are in the `Attribute` enum above — so "No updates are to be performed" is not the
outcome, though only a run confirms that. The price is not one line: `ops/test.sh#L464-L467` and the
rows at `#L482-L485` and `#L493-L494` require `DeleteOnTermination == false` on `Box` and on every
instance, so the revert reddens five rows of the suite and the fence's third protection has to come
out of five documents. And it buys nothing permanent: a client's stack is a *creation*, which takes
`DeleteOnTermination: false` at launch with no replacement question at all, so re-landing the
property later on ridge meets this same refusal again. A revert in `main` to work around one existing
box is the wrong shape.

**2. `modify-instance-attribute` on the live volume, template left saying `false`.** This does not
unblock anything. A change set is a diff of the submitted template against *the stack's* template,
not against live EC2 — ridge's deployed template still says `true`, so the next `--plan` prints the
same `Modify Box replacement=Conditional` and the guard refuses again. It also creates three-way
drift (live `false`, deployed template `true`, `main` `false`), is invisible to the template guard,
and would have to be repeated by hand for every future stack. Worst option; declined.

**3. `--take Box` on ridge, deliberately.** Settles the question for good on the one environment that
will never again be free to break, and lands the access log in the same act. Priced honestly below.

**4. Land it on the next legitimate replacement.** Real, and worth keeping in mind: any future image
or instance-type change is already a `--take Box`, and the device property would ride it for free.
But it leaves the access log blocked for an unbounded wait, so it is not an answer today.

## Recommendation: option 3, `--take Box` on ridge, at a moment the human picks

Reasons, in order: ridge holds demo data only; AWS's own note says this is the one device parameter
modifiable without interruption, so no replacement is the *expected* outcome and the cheap branch is
the likely one; the knowledge is permanent and is free exactly once, before a client exists; it
unblocks piece 83's access log in the same change set; and the template stays as `main` reviewed it,
so no document has to be rewritten twice.

**If the box is not replaced:** row 13 is answered, all three fences are live on ridge, the access
log lands, cost about five minutes of the human's time.

**If the box is replaced,** and this is the part that was not written down anywhere:

- `UpdateReplacePolicy: Retain` keeps the old box running, outside the stack, with the only copy of
  ridge's seeded records. It and its 8 GB disk keep billing (a `t4g.nano`, a few dollars a month)
  until a person removes them, by `ops/README.md`'s "Reading what the fence kept" → "A retained box",
  every step of which is marked untested. Nobody removes it automatically.
- **The app does not point at an empty disk at once.** The BFF has no `Environment` in the template —
  "the deploy sets the four variables from the box's files" (`ops/env.yml#L229-L232`) — so right after
  a replacement ridge keeps serving from the *retained* box, which is still reachable through
  `BoxGroup`. The swing to the new, empty box happens at the next `ops/release.sh`, and the deploy job
  runs that on each push to `main` (`docs/open-items.md`, item 5). **So the real hazard is a push to
  `main`, not the replacement itself:** it would blank ridge at a moment nobody chose. Either reseed
  promptly (the manual seed, about 22 minutes) or hold pushes until it is done.
- `DeployRole` would have to be re-rendered with the new instance id and private address
  (`ops/env.yml#L467`, `#L481`), which CloudFormation does inside the same update. Which means the
  `Modify DeployRole` line in the refused run may be piece 83's log permission, or a consequence of
  `Box`, or both — another thing the `Details` print would disambiguate.
- Two boxes then carry the tag `credo-ridge`, told apart by `LaunchTime` (`ops/README.md#L388-L392`,
  itself untested), and `ops/tunnel.sh`, `check.sh` and `release.sh` all follow the stack's `BoxId`
  to the *new* box.

The bad branch therefore costs roughly half an hour of the human's time, a cleanup by an untested
procedure, and a few dollars — on an environment with no records. One side benefit: it would be the
first real exercise of the recovery path the recap says nobody has ever run.

## What this falsifies in `main`, file by file, each line read at its target

Option 3 changes no template and no test, so this list is short — which is itself an argument for it.
What it falsifies is the *record of step 8*, and that record is already false as of 16:44 today.
The line numbers below are those at `f4119f2f`, before the correction pass that fixed these lines moved
them.

| File and line | The sentence | Why it is false |
| --- | --- | --- |
| `docs/plans/2026-11-08-backup-policy.md#L92` | row 13's holder, "the human's `ops/stack.sh env ridge --plan`" | `--plan` cannot hold row 13. It reported `Conditional`, which answers neither way. Only an executed update settles it. |
| `docs/plans/2026-11-08-backup-policy.md#L97` | "Row 13 is the only thing that can answer whether changing a root device replaces an instance" | True of the *question*, false of the *means*: the `--plan` named there cannot answer it. |
| `docs/plans/2026-11-08-backup-policy.md#L112` | step 8's done check, "The plan's output names no change to `Box`" | The output named a change to `Box`. The step's stop condition fired; option 3 overrides it deliberately for ridge, and its "that is the loss itself on a client's stack" stays true for a client. |
| `docs/plans/2026-11-08-backup-policy.md#L216` | "Only a real `--plan` says whether changing a root device replaces the instance" | A real `--plan` ran and did not say. |
| `docs/recaps/2026-11-08-backup-policy.md#L21` | "The human's change set has not been run on ridge ... so whether applying it replaces the box is not known" | It has been run, as `--plan`, and was refused. The second clause is still true, and now has a reason. |
| `docs/open-items.md#L65-L66` | "closed with that piece's recap commit; the human's change set has still not been run on ridge." | It has been run and refused. |
| `docs/open-items.md#L80-L81` | "the template is not applied to ridge until the human runs its change set" | Literally true, materially misleading: the human ran it and the guard refused it. |
| `docs/client-readiness.md#L69-L71` | "One condition is open: the human's change set ... has not been run on ridge, so whether applying it replaces the box is not known." | First clause false. |
| `docs/client-readiness.md#L66-L68` | "As of `main` after the backup-policy piece, `Box` carries ... so a stack delete and a replacement leave the box and a termination leaves the disk." | True of `main`'s template, not of any running environment. The distinction is nowhere in the page, and a reader takes it as deployed state. |
| `docs/client-readiness.md#L78` | "That guard is one `--take` away from being passed" | Not false — it is now a description of what option 3 does, and it needs the date on which it was done. |
| `ops/unsafe-changes.jq#L4-L6` | "the new box comes up with an empty database and the old one holds the only copy of the records" | True of the boxes, incomplete about the app: the BFF keeps reaching the retained box until the next deploy (`ops/env.yml#L229-L232`). The sentence reads as "the app is blank at once", which is not what happens. |
| `ops/README.md#L64-L66` | "`--plan`: read each change." | Not false, a gap: the runbook has no row for a `--plan` the guard refuses, which is now a thing that has happened. |

Nothing in `main` claims the fence is live on ridge, and no "three named losses" sentence
(`docs/recaps/2026-11-08-backup-policy.md#L5`, `docs/open-items.md#L78-L79`,
`docs/plans/2026-11-08-backup-policy.md#L15`) becomes false under option 3 — all three are claims
about the template, and all three hold. **Under option 1 every one of them would have to say two.**

## What only a real AWS run can settle

1. Whether executing this change set replaces `Box`. No local read answers it, and `--plan` has now
   demonstrably declined to.
2. Which `Details` entry carried `Conditionally` — i.e. that the device property is the sole cause,
   rather than reasoned from the diff and AWS's pages as above.
3. Whether a change set holding *only* the two policy attributes is non-empty (option 1's premise).
   The `Attribute` enum says CloudFormation reports such changes; it does not say a change set
   containing nothing else is accepted rather than "No updates are to be performed".
4. Whether `cfn-lint` accepts the template (row 12; CI's `ops` job is its verdict).
5. Whether either recovery path in `ops/README.md` works. Still never tried.

## The human's commands, if option 3 is taken

The first changes nothing and takes about a minute; read its guard line before running the second.

```
cd /Users/hau/projects/credo/main && bash /Users/hau/projects/credo/main/ops/stack.sh env ridge --plan --take Box
```

What you will see: the same four change lines, then `ok   no removal and no replacement` instead of
`REFUSED`, then `--plan: the change set is deleted, nothing changed` and `== exit 0`. A `REFUSED` here
names a resource other than `Box`, and that is a new question — stop and bring it back.

```
cd /Users/hau/projects/credo/main && bash /Users/hau/projects/credo/main/ops/stack.sh env ridge --take Box
```

What you will see: the change set executed, then the run's later steps. **The one line that matters
is whether `Box` appears as replaced.** A *no* means row 13 is answered, the fence is live on ridge
and nothing else is owed. A *yes* means ridge now has two boxes: hold pushes to `main`, rerun the
deploy and the seed, and remove the retained box and its volume by `ops/README.md`'s "A retained box".
Either way the access log is live on ridge and piece 83 is unblocked.
