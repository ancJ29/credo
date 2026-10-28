---
name: session
description: Use at the first message of a session in a piece's worktree, or when a brief says to follow the session skill. It is the session's start and end (plan, do, check, act) — start from the piece's plan, not from memory; work its one step; end at the step's "then stop", or at a question only the human can answer, with the tick and its evidence, "Where it stands" rewritten, a commit and the stop — so no session ends with the plan lying about itself.
---

# session

The conventions hold the rules; this holds only the order a session meets them in. Each line links
the rule that binds it: read that rule, not a summary of it here.

## Start: read, do not remember

1. **Where:** `git rev-parse --show-toplevel`, `git branch --show-current` and `git status --short`
   read back the worktree and branch the brief names, and a clean tree; anything else is said first.
2. **The conventions**, each when [`CLAUDE.md`](../../../CLAUDE.md) says to read it.
3. **The piece's plan**, which the brief names: its "Where it stands", then its first unticked step:
   its Who, its done-when, what it consumes, and its "then stop", the step's own or else the plan's.
   The rest of the plan only where these link. A step whose Who is 👤 is prepared here, never run.
4. **Its recap**, if there is one, and the entries in [the log](../../../docs/open-items.md) that
   name the plan.
5. **What moved since the plan's last commit:**
   `git log --oneline $(git log -1 --format=%h -- <plan>)..HEAD`.

Anything the step needs and lacks (a step it consumes, an answer, an entry still the human's) is a
stop before any work. Otherwise, one line back: the step, its done-when, where it stops.

## During

- The step and nothing else, as
  [pacing](../../../docs/conventions/collaboration.md#pacing-one-piece-at-a-time) says: a surprise
  that does not block the done-when becomes an entry in the log, not a chase; a new piece is parked
  there; nothing is pushed or deployed.
- Every time written (in a plan, an entry, a stop) is read from `date` first, never from the
  session's sense of time.

## End: rewrite, do not append

At the step's "then stop", or earlier at a question only the human can answer
([hand-off 2](../../../docs/conventions/collaboration.md#the-loop)) or at something the step lacks:

1. **The tick**, only for a done-when read back
   ([hand-off 3](../../../docs/conventions/collaboration.md#the-loop)), with its evidence in the same
   edit ([the checklist](../../../docs/conventions/documentation.md#where-progress-lives-three-files-one-job-each)).
   A step not done stays unticked, with one line on where it stopped.
2. **"Where it stands — <time>"** rewritten whole, the time from `date '+%Y-%m-%d %H:%M %Z'`.
3. **The recap's section**, if the step calls for one. An entry in the log that the step finished
   is deleted.
4. **The commit**, with explicit paths and the trailer, as the last rule of
   [pacing](../../../docs/conventions/collaboration.md#pacing-one-piece-at-a-time) says, after
   [the path and name check](../../../docs/conventions/documentation.md#nothing-machine-local-or-personal-in-a-committed-file).
5. **The stop**, where the brief says (a subagent's final report, or a message to the
   orchestrator's session), in this order: the question in one line, or "none"; the lines it rests
   on as `path#Lnn`; the options, with for and against; the recommendation; receipts last (the
   branch, the commit's sha, what each check read). Then stop and wait.
