# Decisions

## At a glance

**Every decision made in credo, newest first, one line each:** its date, what was decided, what it
beat, and the page that argues it. Read this to answer "why is it this way?" or "what did we decide
last week?"; open the page in the last column for the argument. A decision reversed later keeps its
line and gains a newer one that says so; the page it links is never rewritten.

- **What it beat** is the rejected alternative and its price, as short as it reads. `-` means the
  page holds several decisions, each with its own rival, or names none.
- **A page on the orchestrator branch** is named with its branch, never linked, since no link on
  `main` reaches it.

| Date | Decided | What it beat | Its home |
| --- | --- | --- | --- |
| 2026-11-18 | One review, of everything `pre-merge` holds that `main` lacks, after the whole check on `pre-merge` is green and before `main` moves; the human: "we should only do this kind of review right before merge code from pre-merge to main" | a review of each step or piece before it lands on `pre-merge` | [QA convention, rule 5](conventions/qa.md#the-rules) |
| 2026-11-18 | Each kind of note and fact has one home, every other place points to it, the homes found from one page; the human: "this is something that we should keep on the way as RULE, with dedicated agent to review regularly" | kinds of note and fact held by habit in up to nine places each, with no declared home | [documentation convention, one fact, one home](conventions/documentation.md#one-fact-one-home) |
| 2026-11-18 | The walks page is open by its link, with no sign-in; the human: "I think no need to restrict access anymore / I already removed restriction for credo walks too" | Cloudflare Access's sign-in by emailed code in front of it and its previews since 2026-10-29, with the deploy's two checks that it refused a visitor | worktrees/reviews/2026-11-18-partners/6-walks-open.md on the orchestrator branch |
| 2026-11-18 | Knowledge stays where it is, as Markdown in the repository; the front page gains "Where to look" and `main` gains this log | the orchestrator branch squashed onto `main`: about three lines in four of the whole, every question harder to answer | worktrees/reviews/2026-11-18-knowledge/2-proposal.md on the orchestrator branch |
| 2026-11-16 | The week's objective: the final architecture finished and confirmed on ridge, then the design system | - | worktrees/milestones/2026-11-16-final-architecture-confirmed.md on the orchestrator branch |
| 2026-11-11 | The store is SQLite | DynamoDB: a runaway cost on per-request billing, and very hard to roll back | [c-storage memo](../services/c-storage/docs/memo/c-storage.md#the-store-is-sqlite-not-dynamodb) |
| 2026-11-11 | The week's objective: the final architecture built before Monday | the week's three points of 2026-11-09, which it replaced with five of their eight milestones done | worktrees/milestones/2026-11-11-final-architecture.md on the orchestrator branch |
| 2026-11-11 | The records' continuous copy is built now: a day's loss is acceptable today, a second's in six months | a nightly copy first, built and then replaced | [c-storage memo](../services/c-storage/docs/memo/c-storage.md#a-second-copy-follows-the-file-within-a-second) |
| 2026-11-11 | The shape is pooled: the human as DevOps chooses how many boxes, the operators which tenant goes to which box | a number of companies a box, designed in | [the detail page](architecture-detail.md#how-a-call-finds-its-tenants-box) |
| 2026-11-11 | The wrong-password wait: five free tries, then 30 seconds doubling with each wrong try, at most 15 minutes; a right password clears the count | - | worktrees/milestones/2026-11-11-final-architecture.md on the orchestrator branch |
| 2026-11-11 | Alerts go to a Slack channel, which the human makes | - | worktrees/milestones/2026-11-11-final-architecture.md on the orchestrator branch |
| 2026-11-11 | Photos go on R2, rewritten from the legacy app's piece, never copied whole | - | worktrees/milestones/2026-11-11-final-architecture.md on the orchestrator branch |
| 2026-11-11 | Ridge does not wait on the shape | waiting: ridge's re-up plan changes by zero lines either way | worktrees/milestones/2026-11-11-final-architecture.md on the orchestrator branch |
| 2026-11-10 | The BFF's promises gathered into one memo | spread over the detail page and the code | [docs/memo/bff.md](memo/bff.md) |
| 2026-11-10 | The screens' promises gathered into one memo | written nowhere | [docs/memo/ui.md](memo/ui.md) |
| 2026-11-09 | The code convention: the machine's own house style, binding every session, with no approval from the human | - | [docs/conventions/code.md](conventions/code.md) |
| 2026-11-09 | The week's objective: code in right shape, the coding convention ready, ridge deployed again on correct shape | - | worktrees/milestones/2026-11-09-week-objective.md on the orchestrator branch |
| 2026-10-29 | The machine's rule for every record a client's UI shows, so a client's own logic customises the UI without breaking the BFF | - | [docs/memo/extra.md](memo/extra.md) |
| 2026-10-29 | The demo's seed: two scenarios and a week of history | six scenarios and 30 days | [the demo-seed plan](plans/2026-10-29-demo-seed.md) |
| 2026-10-27 | The documentation convention: one file for both readers, the human's version first | a separate human file per doc, the copy that rots | [docs/conventions/documentation.md](conventions/documentation.md) |
| 2026-10-27 | The collaboration convention, binding every person and agent | - | [docs/conventions/collaboration.md](conventions/collaboration.md) |
| 2026-10-27 | The QA convention, after reading the old app's QA process | - | [docs/conventions/qa.md](conventions/qa.md) |
| 2026-10-27 | The architecture: the machine's decisions and the human's four answers | - | [the architecture plan](plans/2026-10-27-architecture.md) |
| 2026-10-27 | The app's frame: the human's answers | - | [the app-frame plan](plans/2026-10-27-app-frame.md) |
| 2026-10-27 | c-storage as built: the machine's decisions on the service, one memo | a memo for each decision | [c-storage memo](../services/c-storage/docs/memo/c-storage.md) |
