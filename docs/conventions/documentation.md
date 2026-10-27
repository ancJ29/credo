# Documentation

> **Decided** 2026-10-27, with the human's rule for the two readers: "for human to read:
> visualize as much as possible; for machine to read: detail". **Amended** 2026-10-27: nothing
> machine-local or personal in a committed file. **Amended** 2026-10-27 by the human: every doc
> opens with its human version. Read this before writing any doc, `CLAUDE.md` or code comment,
> or committing any path. **Amended** 2026-10-27 by the human: rules picked from the old repo's
> standing preferences.

## At a glance

**Docs explain WHY; the code states WHAT.** A line earns its place only if a competent reader,
without it, would get the next change wrong.

| Reader | Reads | Form |
| --- | --- | --- |
| 👤 human | `README.md`, recaps, and the "At a glance" atop each convention, memo and plan | **Visual first**: a diagram or a table wherever the content is a flow, a structure or a comparison. Prose only for the why |
| 🤖 machine | `CLAUDE.md`, and the detail below each "At a glance" | **Detailed on the why**: exact names, the rejected alternative and its price, the trigger to revisit it |
| both | the code | the what. No doc copies it |

- Each doc a human reads opens with a short version for the human; a README gets a newcomer
  started in 30 minutes ([two readers](#two-readers)).
- A doc holds a decision and what it beat, a risk no check catches, or steps whose order
  matters ([what earns a line](#what-earns-a-line)).
- Each fact is written once, where its rule is enforced; a copy goes stale. A comment states the
  rule that holds here, never the old code's mistakes ([one fact, one home](#one-fact-one-home)).
- Progress lives in three files: the plan, the to-do log and the recap
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

## One fact, one home

```text
code comment   the rule in ≤ 3 sentences, timeless (no dates, no history); names the test that enforces it
docs/memo/     the argument: one decision, hazard or recipe per file, stamped Decided / Amended <date>
CLAUDE.md      a one-line pointer to the memo; line 2 is  Stack · Gate · Ship
```

The argument lives once, where the rule is enforced. A copy anywhere else is the one most certain
to rot, because the change that breaks it touches no line there.

- **A comment or doc states the rule that holds here, never how the old code got it wrong.**
- **Before writing a WHY, grep a distinctive phrase of it.** If a home exists, extend it there.
  Delete any comment whose loss costs nothing.
- **A Decided or Amended stamp is read from `date`, never typed from memory.**

## Where progress lives: three files, one job each

| File | Job | Rule |
| --- | --- | --- |
| `docs/plans/<date>-<slug>.md` | the checklist | Each step is a checkbox with its done-when (something read back). Once ticked, its evidence goes in the same edit. Its "Where it stands — <date>" is rewritten, never appended to |
| `docs/open-items.md` | the log | Numbered, never renumbered. One entry per thing still to do, naming who does it, or marked *parked* until a review. An entry is deleted when done |
| `docs/recaps/<date>-<slug>.md` | the history | Written when a step reads back green: what shipped, what was rejected and why, what remains the human's. Append-only, and never a status source |

These names are fixed, so one `grep` finds every one of them. A directory is added once it has
content, never ahead of it.

## Never in a doc

Deploy state and browser checks: who shipped what, where and when, and what was eyeballed. They
belong to the human and change under the doc's feet. A stale "verified" is worse than none.

## Nothing machine-local or personal in a committed file

*Amended 2026-10-27 by the human, on the second correction.* A committed file (a doc, code, a
script or a config) names no path that exists on only one machine. That means no home directory,
no other checkout, and no worktree folder treated as shared. It names no person either: a role is
written as "the human" or "the machine". Every committed file goes to GitHub and onto each
collaborator's machine. There a local path is wrong, and a name ties a rule or a decision to one
of several humans. Instead:

- A path the code needs is derived where it runs, from git, as `$ROOT_DIR` is.
- A fact only one machine or one person needs stays in that machine's agent memory, or in a
  `*.local*` file, which git ignores.

No gate checks this yet. Before each commit, run `git grep -nE '/Users/|~/'` and read the diff
for a name.
