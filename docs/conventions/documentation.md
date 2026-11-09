# Documentation

> **Decided** 2026-10-27, with the human's rule for the two readers: "for human to read:
> visualize as much as possible; for machine to read: detail". Read this before writing any doc,
> `CLAUDE.md` or code comment, or committing any path.
> **Last amended** 2026-11-09, from the guideline skeleton (piece 98): the rule for how a living document
> cites code, which lived only on the board and in a design page. This file holds the rules as they stand; their
> history is in `git log`.

## At a glance

**Docs explain WHY; the code states WHAT.** A line earns its place only if a competent reader,
without it, would get the next change wrong.

| Reader | Reads | Form |
| --- | --- | --- |
| 👤 human | `README.md`, recaps, and the "At a glance" atop each convention, memo and plan | **Visual first**: a diagram or a table for a flow, a structure or a comparison. Prose only for the why |
| 🤖 machine | `CLAUDE.md`, and the detail below each "At a glance" | **Detailed on the why**: exact names, the rejected alternative and its price, the trigger to revisit it |
| both | the code | the what. No doc copies it |

- Each doc a human reads opens with a short version; a README starts a newcomer in 30 minutes
  ([two readers](#two-readers)).
- A doc holds a decision and what it beat, a risk no check catches, or steps whose order
  matters; a runbook holds the steps alone and links their why
  ([what earns a line](#what-earns-a-line)).
- Each fact is written once, where its rule is enforced; a copy goes stale. A comment states the
  rule that holds here, never the old code's mistakes; a convention carries one `Last amended`
  line and no changelog ([one fact, one home](#one-fact-one-home)).
- A living document cites a file and a symbol in it, never a line
  ([how a living document cites code](#how-a-living-document-cites-code)).
- Progress lives in three files: the plan, one short page; the to-do log; and the recap, which
  holds the evidence and keeps the piece's row in `docs/products.md` true
  ([where progress lives](#where-progress-lives-three-files-one-job-each)).
- Never written down: what was deployed or checked by eye ([never in a doc](#never-in-a-doc));
  a path on one machine, or a person's name
  ([nothing machine-local](#nothing-machine-local-or-personal-in-a-committed-file)).

## Two readers

The table [at a glance](#at-a-glance) says who reads what.

- **Every doc a human reads opens with its human version, in the same file**, under
  `## At a glance`: each convention, memo and plan. A recap is the human's already; `CLAUDE.md`
  stays the machine's alone. The human version fits one screen: about 150 words of plain prose,
  no jargon, a diagram or a table first, and each line pointing to the rule or section below
  that holds it. The machine's detail follows, unchanged in kind. Nothing in the human version
  is new: it is a view of the detail, which stays the one home. *Rejected:* a separate human
  file per doc. It is a second home for the same rules, and the copy is the one that rots: the
  change that alters a rule touches no line there. *Hazard no gate catches:* the two drift
  apart. *Guard:* a change to a rule changes its line in the human version in the same commit,
  and [QA](qa.md)'s rule 5 reviewer reads both.
- **A README lets a newcomer grasp the project in 30 minutes**: what it is in three plain
  sentences, then a tested "try it in 10 minutes"; internals last.
- **A diagram is drawn from committed code and names the files it is drawn from.** A change to
  those files redraws it. Use Mermaid, about twelve boxes at most, drawn by hand; a generated
  dump is not a picture. *Rejected:* no component diagrams because "the code shows them". It
  shows them to the machine, not to the human.
- **Detail for the machine means being exact about what the code cannot say.** It never means
  copying what the code does say: routes, fields, directory trees, command lists. The code is
  already the machine's most detailed doc, and a copy is the part that rots.

## What earns a line

- a **decision**, with the rejected alternative and its price
- a **hazard no gate catches**, with the trigger to revisit it
- a **recipe whose order is not obvious**, and why each step sits where it does

Docs describe *absent* code: a plan, or a rejected option. Present code describes itself.

**An operator's runbook is numbered steps and commands, with one-line branches**, as
[`ops/README.md`](../../ops/README.md) is. Its steps are the recipe above; the why of each stays in
the plan or memo the runbook links once. *Why:* the operator reads the runbook while running it,
and prose between the commands hides the next one.

## One fact, one home

```text
code comment   the rule in ≤ 3 sentences, timeless (no dates, no history); names the test that enforces it
docs/memo/     the argument: one decision, hazard or recipe per file, under one Last amended line
CLAUDE.md      a one-line pointer to the memo; line 2 is  Stack · Gate · Ship
```

The argument lives once, where the rule is enforced. A copy anywhere else is the one most certain
to rot, because the change that breaks it touches no line there.

- **A comment or doc states the rule that holds here, never how the old code got it wrong.**
- **Before writing a WHY, grep a distinctive phrase of it.** If a home exists, extend it there.
  Delete any comment whose loss costs nothing.
- **A convention or memo carries one `Last amended` line, and no changelog inside it.** The line
  names the date and where the change came from — a correction, a review, the piece that found
  it — and its date is read from `date` in the same command that writes it, never typed from
  memory. Not a stamp per rule amended, and not a sentence kept to record what a rule used to
  say: the history of the file is `git log`, which is where it is read here. A rejected
  alternative and its price stay, since those are the argument for the rule
  ([what earns a line](#what-earns-a-line)) and not a log of the file's own passage. *Rejected:*
  an `Amended <date>` stamp per rule touched, what this convention asked for until 2026-11-07.
  Seven of them went into one principles memo's header, one per rule the piece had touched, and
  the human cut the block on sight: there are always exceptions, and logging each one is not
  worth the reader's attention in a memo of principles.

### How a living document cites code

**A living document cites a file and a symbol in it, never a line number.** *Why:* a line moves with
every edit above it and fails nothing when it does, so the citation rots in silence; a symbol
survives every edit and reformat, a rename is a real change worth noticing, and one grep checks it
where a line number never can. Three forms, in this order of preference:

1. **A file and a symbol** is the default: `bff/src/errors.ts`'s `replyFor`.
2. **A key or resource name the file itself contains**, for config and shell, where there is no code
   symbol: `package.json`'s `scripts.check`, `ops/env.yml`'s `BoxGroup`, `walk/run.sh`'s `main`.
   This is no concession: YAML and JSON have no symbols.
3. **A quoted fragment of the line**, only where neither exists, and deliberately ugly so that
   nobody reaches for it first.

**The name must be declared once in its file** (its other occurrences are uses): a name that
resolves twice lets a check pass on the wrong declaration. In Go a method is cited as
`func (s *Server) handle(`, not `handle`, and its case counts.

*Who it binds:* the living documents, which must be true now (the conventions, the architecture
page, the index, every `CLAUDE.md`, the root `README.md` and `docs/client-readiness.md`), and not
plans or recaps, which were written once and were true then. *When:* it binds new writing, and an
existing line citation converts when a piece touches it, not in a sweep of its own; its line is never
checked, but a line citation whose file has gone is red today. *What it cannot hold:* a symbol that still exists and has changed its
meaning passes every grep (a constant that became an import still resolves); only the reader of the
change sees that, so a piece that moves a decision rereads the citations to it.

## Where progress lives: three files, one job each

| File | Job | Rule |
| --- | --- | --- |
| `docs/plans/<date>-<slug>.md` | what to build | [One short page](#the-plan-one-short-page). Each step is a checkbox, ticked only once its check reads back; the ticks are the plan's one status |
| `docs/open-items.md` | the log | Numbered, never renumbered. One entry per thing still to do, naming who does it, or marked *parked* until a review. An entry is deleted when done |
| `docs/recaps/<date>-<slug>.md` | the history and the evidence | Written when a step reads back green: what shipped, what was rejected and why, what remains the human's, in half a page the human reads; below it, the evidence, what each step's check read. Append-only, and never a status source. The piece's recap adds or changes its row in [`docs/products.md`](../products.md), the products on hand, in the same commit |

These names are fixed, so one `grep` finds every one of them. A directory is added once it has
content, never ahead of it.

### The plan: one short page

**A plan is about 2,000 words at most, its case table included**, in this order:

1. **The purpose**, as its `## At a glance`: what the piece is for, who sees it, and the cheapest
   safe path there, what exists picked over a design from zero, the price in one line.
2. **The slice**: one, walkable end to end when the plan ends. A second slice is a second plan.
3. **The steps**, each with its done-when: a check the machine runs, named as a command or a
   count. The first is the cheap end-to-end build: where the piece has a screen, its fake
   (`pnpm fake`) first, then the slice through the stack at its thinnest. The hardened build
   follows, each case seen red once ([QA](qa.md)'s rule 2) and coverage at 100 % (rule 8),
   before the merge into `main`.
4. **The human's points**, up to five, the ones [QA](qa.md#at-a-glance) names, each at the step
   that needs it. **Each point reads on its own, in plain words:** a few sentences, about 60 words,
   that say what the human will see, why it matters, and what a yes and a no each start. A sha, a
   line number or a label follows the words and never stands in for them. Told points have
   run 65 to 270 words of a plan, and five of them would take about 300. *Rejected:* a point in one
   line. The human cannot picture the whole
   story from it, and digging for the rest costs the speed the short page buys. The human gave
   that correction twice on 2026-11-02, of a plan's points and of the orchestrator's day list.

**The 2,000 is what this shape costs, not a target.** Over the eighteen plans written since the
shape was set, `wc -w` ran from 986 to 1,970 words, median 1,610. The parts above cost about
800 of that before the first step: about 150 words for the `## At a glance`, 260 for the slice,
240 for the case table and 150 for the points. A slice of six to nine steps, each with its
done-when and the file-and-line citations a reviewer reads it against, costs about 600 more.
About a fifth of the case table's words are the table's own pipes and dashes, which `wc -w`
counts as words, so the number is not a prose budget. *Rejected:* 1,000 words, what this
convention asked for until 2026-11-07. Seventeen of the eighteen were over it; the cost was not
the overage but about fifteen passes spent shortening prose nobody had asked to be shorter,
while the parts this convention itself demands could not fit in the number — its own arithmetic
had left the slice out and put the steps at a figure no plan has met.

Nothing the builder finds in the repo or in git goes in: no status block, no list of the files it
was drawn from, no evidence. Where a piece stands is its ticks, and across pieces the
orchestrator's board. *Rejected:* the plan as status, provenance, spec, checklist and evidence log
in one, the shape these conventions asked for until 2026-11-02, against the one short page
[pacing](collaboration.md#pacing-one-piece-at-a-time) asks of a page. Those plans ran from 716 to
27,036 words, every reader paid for the four other files to reach the steps, and the best of the
six reviewed on 2026-11-02 was the shortest. A rewritten "Where it stands" was one more copy of what
the ticks and the board already said. *Hazard no gate catches:* the page grows back, one step's
evidence at a time. *Guard:* `wc -w` on the plan before its commit; well over 2,000 words, the
part that grew is named and cut back, and the two limits that bind are the `## At a glance` at
about 150 words and each of the human's points at about 60. *Rejected:* cutting the slice in
two on the word count, what this guard asked for until 2026-11-07. No slice was ever cut on
that ground in the shape's first week, and the count does not diagnose one: the longest of the
eighteen plans is a single walkable slice of eight steps, and the plans this guard was written
against ran from 2,400 to 27,000 words at the same step counts, so what cut them down was
dropping the status, provenance and evidence blocks, not cutting slices. A slice is cut by its
own test above: not walkable end to end when the plan ends.

## Never in a doc

Deploy state and browser checks: who shipped what, where and when, and what was eyeballed. They
belong to the human and change under the doc's feet. A stale "verified" is worse than none.

## Nothing machine-local or personal in a committed file

A committed file (a doc, code, a script or a config) names no path that exists on only one
machine. That means no home directory, no other checkout, and no worktree folder treated as
shared. It names no person either: a role is
written as "the human" or "the machine". Every committed file goes to GitHub and onto each
collaborator's machine. There a local path is wrong, and a name ties a rule or a decision to one
of several humans. Instead:

- A path the code needs is derived where it runs, from git, as `$ROOT_DIR` is.
- A fact only one machine or one person needs stays in that machine's agent memory, or in a
  `*.local*` file, which git ignores.

No gate checks this yet. Before each commit, run `git grep -nE '/Users/|~/'` and read the diff
for a name.
