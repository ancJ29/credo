# A record states a run's verdict and names no log, plan, 2026-11-11

## At a glance

**A committed record says what ran and how it ended, in words, and names no log; one pinned number
in the citation test holds the log names already written, so a new one is red.** What it is for: a
reader of a plan, a recap or an open item who tries to check a run is no longer sent to a file that
opens nothing. A log is a working file in `logs/` in the credo root: outside git, on one machine,
moved by every tidy. On GitHub and on any other machine every log citation opens nothing; here 196
of today's 411 already do.

The cheapest safe path is what is here: the citation check in `scripts/src/citations.ts`, which
skips `logs/` on purpose, gains a count of log citations beside it. The count opens no log, so it
reads the same in a worktree, a fresh clone and a GitHub run. The price: about 50 minutes, and the
369 citations in old plans and recaps stay as they are, as history.

## The slice

A session writes a log's path into a plan's tick; `pnpm --filter @credo/scripts check` goes red,
naming the pinned count and the rule; the session rewrites the tick as the run and its verdict in
words, and the gate is green. The rule in the documentation convention then says the same to every
session before it writes.

## What the code says, and what the plan decides

**No check of log citations exists, and the one check there skips them on purpose.** `PLACEHOLDER`
matches `^logs\/` with a comment saying no tracked file is there (`scripts/src/citations.ts#L42-L43`),
and a test holds that ("leaves a log receipt alone", `scripts/src/citations.test.ts#L128-L134`).
Both premises of the piece hold: no such check exists, and the logs are not to be written back. The
new count is an extension of that file, not a new one: the same tracked list, the same reader, the
same repository test (`scripts/src/citations.test.ts#L10-L21`).

**The count reads every tracked Markdown file, not the living set.** The citation check reads only
`LIVING` (`scripts/src/citations.ts#L15-L29`), and log citations sit almost all outside it: 261 in
plans, 108 in recaps, 36 in `docs/open-items.md`, 2 in `docs/products.md`, and 4 in
`docs/client-readiness.md`, the one living document carrying any.

**The gate runs on GitHub, where `logs/` does not exist, so the check opens no file.** The `app`
job runs `pnpm check` (`.github/workflows/ci.yml#L144-L145`), and the scripts package's tests include
the citation test. A check that opened each cited log would be red there for every citation, or
would have to pass in silence when the folder is missing; here it would go red each time a tidy
moved a log, which makes working files evidence again. A text count gives one answer everywhere.
`ci.yml`'s `paths:` (`#L9-L26`) hold no `docs/**`, so a commit of documents alone starts no GitHub
run: the package gate and the whole check on `pre-merge` are what catch a new citation there.

**The decision, read strictly.** A text check cannot tell a log named "as where it was" from one
cited as evidence, and on GitHub both open nothing. So a new record names no log: it says what ran,
when, at which commit, its exit, and the line that decided it. A stop's report, read on the machine
that ran it the same day, still cites its log by path, pasted from `ls`
(`docs/conventions/qa.md#L309`, `#L326`); the report is not committed.

**Old records stay as written.** Plans and recaps were true when written and are not bound as living
documents are (`docs/conventions/documentation.md#L152`), and a recap is append-only (`#L169`). The
count holds their citations under the pin and never asks for them to change; the rule says how to
read them: a log named in a record written before the rule says where a log was, and may open
nothing.

### The three forms, on today's tree

Every tracked Markdown file at `pre-merge`'s 705ed659, counted by a scratch script that step 1's
test replaces:

| Form | Citations | Open nothing here | Documents | The check sees it |
| --- | --- | --- | --- | --- |
| a `logs/<name>` path | 295 | 164 | 53 | yes |
| a path with a root before it: `$ROOT_DIR/logs/<name>`, and one home path written out | 10 | 9 | 5 | yes |
| a log's file name in one of qa.md's two shapes (`#L305-L307`), no `logs/` before it | 106 | 23 | 49 | yes, step 2 |
| a log's name in neither shape with no `logs/`, or a log told in words | not counted | — | — | no |

That is 411 citations of 304 logs in 95 documents, 196 opening nothing. Every one that opens
nothing is a log of 10-28 to 11-03 or an undated one; every log from 11-04 on still opens. Not
counted at all: a pattern (a name holding `<`, `*` or `{`) and the folder named alone.

The piece file's 188 of 285 (11-08) does not reproduce: its method was not written down and its
count took in the orchestrator's board, which is outside `main`'s tree. The board carries another
379 today, 242 opening nothing, most of them in its archive; the check cannot see it.

## The steps

This piece's own ticks follow the rule from the first step: each says what ran and how it ended,
and names no log, or the pin moves with every tick. The stop's report carries the log's path.

- [x] **The count, end to end.** `logCitations` in `scripts/src/citations.ts`: over every tracked
  `.md` file, each `logs/` path that names a file, whatever stands before `logs/`, with its document
  and line; a name holding `<`, `>`, `*`, `{` or `}` is a pattern, and the folder alone is no
  citation. The repository test in `citations.test.ts` prints the run's account (the forms it sees,
  the two it cannot, a row for each document carrying any, the total) and asserts the total equals
  one pinned number, the count on the tree it lands on. The comment at `scripts/src/citations.ts#L42`
  says where log citations are counted instead. *Done when:* the repository test, run alone, passes
  and prints the pinned total; that total equals an independent `git grep -o` count of the same two
  forms on the same tree; and one `logs/<name>.log` written into a plan by a scratch edit turns it
  red, the edit reverted after. *Size:* about 10 minutes, from the last build rows of one function
  and its tests (6, 10 and 12).
  *Ticked 2026-11-11:* `logCitations` and `describeLogs` in `scripts/src/citations.ts`, the repository
  test and five unit cases in `scripts/src/citations.test.ts`. The repository test, run alone, passed and
  printed 305 citations; an independent `git grep -oP` of the same form, trailing dots and colons cut,
  patterns and the folder alone dropped, gave 305 on the same tree (295 plain paths and 10 with a root
  before them, as the table above). A scratch line citing one log, appended to this plan, turned it red
  (expected 306 to be 305) and was reverted. The package gate ran on the tree as committed and exited 0.

- [x] **The third form, and hardened.** The two log-name shapes counted where no `logs/` stands
  before them, never twice for one citation; each case below seen red once; coverage at 100 %. *Done
  when:* `pnpm --filter @credo/scripts check` exits 0, the pin reread on the tree it runs on. *Size:*
  about 12 (the last two rows that saw every case red, 9 and 14).
  *Ticked 2026-11-11:* `logCitations` now counts the two shapes where no `logs/` stands before them
  (a name after any `/` is part of a path and is not counted twice). The total reads 411 in 95
  documents, which is 305 paths plus 106 bare names; an independent `git grep -oP` of the two shapes
  gave 106 and the pin was moved to 411. Each case was seen red by one mutation of the code, the
  checkout restored after each: case 1 (plain path dropped) six unit cases and the pin; case 2 (root
  before it refused) the root case, case 4 and the pin; case 3 (one shape dropped) the shapes case and
  the pin; case 4 (a name after `/` counted again) the once-only case and the pin; case 5 (the
  pattern test removed) the pattern case; case 6 (the folder test removed) the same case; case 7
  (non-Markdown read) the Markdown-only case; case 8 and case 9 by the repository test, one citation
  added and one removed from a plan; case 11 (document rows emptied) the account case; case 10 holds by
  construction, since the function takes only a reader and opens nothing. The scripts gate, whole,
  exited 0 on the tree as committed, with the first run's knip red (an exported type used nowhere)
  having belonged to step 1.

- [x] **The rule.** In `docs/conventions/documentation.md`, under "Nothing machine-local or personal
  in a committed file" (`#L236`), one paragraph: a log is a working file on one machine; a committed
  record (a plan's tick, a recap's evidence, an open item, a living document) says what ran, when, at
  which commit, its exit and the line that decided it, and names no log; a record written before the
  rule says where a log was, and may open nothing; the count is `scripts/src/citations.ts`'s
  `logCitations`, a citation the existing check resolves. Its At a glance bullet (`#L38-L40`) says a
  log is one such path. "No gate checks this yet" (`#L249`) narrows to the paths other than logs. The
  recap row (`#L169`) says its evidence is in words, by that rule. In `docs/conventions/qa.md`, "The
  log is the receipt" gains one sentence: a stop's report cites its log by path, and the record it
  lands in says the verdict in words. Read and left alone, since each names the folder a script
  writes to, or a pattern, which stays true: `docs/conventions/collaboration.md#L96`,
  `docs/conventions/code.md#L105`, `docs/README.md#L69`, `ops/CLAUDE.md#L30`. By the conventions
  kind: one `Last amended` line, each changed At a glance measured before and after, a sweep for the
  old wording, no local path. *Done when:* `git grep -n` finds the paragraph once in
  `documentation.md` and the sentence once in `qa.md`, and `pnpm --filter @credo/scripts check`
  exits 0, `logCitations` resolved by the existing check. *Size:* about 10 (a first pass on a
  convention's prose, median 12; the last two 5 and 6).
  *Ticked 2026-11-11:* the paragraph "A log is such a path" stands once in `documentation.md` under
  its "Nothing machine-local" heading, with the At a glance bullet (350 to 354 words, `wc -w` from the
  heading to the next `## `, paid by no trim), "No gate checks the other paths yet", the recap row, and
  one sentence in `qa.md`'s "The log is the receipt" (its At a glance stays 282), each file with its
  `Last amended` line. `git grep -n "names no log" -- docs/conventions` finds the paragraph once in
  `documentation.md` and the sentence once in `qa.md`; the four files the plan names stay as read.
  The sweep `git grep -nE "logs?/|[Ll]og path|log's (name|path)"` over the conventions, the root and
  `docs` `CLAUDE.md` pages and `ops/CLAUDE.md` met no other line telling a record to cite a log. The
  citation test, run alone, passed with the pin still 411. The orchestrator's build and recap skills,
  which told agents to name a log, are edited outside this tree for the orchestrator to carry.

- [x] **Reviewed.** Another model reads the check, its tests, this table and the rule; one fix pass;
  the whole check again. *Done when:* the recap lists every finding tagged, and `pnpm check` exits 0.
  *Size:* about 20 (a review with its whole check).
  *Fix pass, 2026-11-11, one round, the reviewer's findings each confirmed on disk before a change:*
  1. **Fixed (Medium).** Confirmed: bold, underscored, angle-bracketed and star-trailed paths, names with
     seconds in the stamp, a stamp at the end, a date-only name and an unstamped name were all uncounted.
     A path's token now drops a trailing `*`, `_`, `>` or `|` after its extension, `_` may stand before
     `logs/`, and a bare name is any name ending `.log` with no folder before it; a name elided with an
     ellipsis is counted, since it still names a log that opens nothing. The tracked tree went from 411 to
     456 citations, 151 of them bare names. A name told in words stays unseen, as the rule says.
  2. **Fixed (Medium).** Confirmed: the rule's "history, not rewritten" covered open items and living
     documents against the convention's own "true now". Plans and recaps written before the rule are
     history; an open item or a living document converts when a piece touches it, as a line citation does.
  3. **Fixed (Low).** The pin is now a list of document and name rows beside the test, compared as a
     multiset, so a red names its citation and two branches adding the same new total no longer merge
     into a red neither had; a line number is not in a row.
  4. **Fixed (Low).** The code comment and the run's printed account say a name after a folder other than
     `logs/` is not counted.
  5. **Fixed (Low).** The rule asks of a record that mentions a run that it say how it ended in words and
     name no log, and leaves where each kind of evidence goes to the rules for that record.
  6. **Fixed (Low).** The repository test lists tracked and unstaged-new files; an untracked scratch page
     citing a log turned it red, and with the flag taken out it passed, so the flag matters.
  7. **Fixed (Info).** The open-items row in the progress table now reads "the list of what is open".
  Each new case was seen red by one mutation: the bare-name widening, the trailing-mark trim, the
  underscore before `logs/`, the ellipsis counted, the multiset count; the unstaged case as in finding 6.
  The scripts gate, whole, exited 0 on the tree as committed.

## The case table

| # | The case | Held by |
| --- | --- | --- |
| 1 | A `logs/<name>` path in a tracked Markdown file is counted, with its document and line | unit, a made-up repository |
| 2 | A path with a root before it, `$ROOT_DIR/logs/<name>` or a full path, is counted the same | unit |
| 3 | A log's name in either of qa.md's two shapes, with no `logs/` before it, is counted | unit, step 2 |
| 4 | One citation is counted once: a shaped name inside a `logs/` path is not counted again | unit, step 2 |
| 5 | A pattern is no citation: a name holding `<`, `>`, `*`, `{` or `}` | unit |
| 6 | The folder alone, `logs/` or `logs/archive/`, is no citation | unit |
| 7 | A file that is not Markdown is not read, such as a script naming where it writes its log | unit |
| 8 | The repository's count equals the pin: one more is red, and the message names the rule | the repository test, the pin moved by one |
| 9 | One fewer is red too, asking for the pin to come down, so a removal never leaves room for a new one | the repository test |
| 10 | The count is the same with no `logs/` folder anywhere, as on GitHub: the check opens no log | unit, the made-up repositories have none |
| 11 | The run prints the forms it sees, the two it cannot, and a row for each document carrying any | unit, beside `describeRun` |

## The human's point

**After the rule: the rule, read.** In `docs/conventions/documentation.md`, the paragraph on logs
under "Nothing machine-local or personal in a committed file" should say that a log is a working
file on one machine, and that a plan, a recap or an open item says what ran and how it ended instead
of pointing at a log. A yes lands the piece on `pre-merge`, and keeps logs as working files; a no
names the sentence that reads wrong, and the rule reopens.

## The later opening, sized from the count

- **Plans and recaps are not repaired:** 261 citations in 45 plans (147 opening nothing) and 108 in
  47 recaps (37). They are history, and the rule says how to read them. That takes most of the piece
  file's third part out of the opening.
- **What is read as true now carries 42:** `docs/open-items.md` 36 (12 opening nothing),
  `docs/client-readiness.md` 4 and `docs/products.md` 2 (all still open). Each becomes the run's
  verdict in words, read from its log while the log still opens, or a line saying the log is gone;
  the pin comes down with each one. Thirty of the 42 can still be read from their logs today, and
  each tidy of `logs/` turns some into a line saying it is gone, so the opening is cheaper the sooner
  it runs. *Size:* about 25 minutes and a gate, at the page-fix rate of five fixes in 3 minutes.
- **Open item 230** (the open-items log outside the citation check's living set) names "the next
  change to the citation check" as its trigger, which this piece is. It is not taken here: its audit
  is of code citations, size unknown. The later opening reads the same file and is its natural
  carrier.
- **One home path written out**, in `docs/plans/2026-11-08-backup-policy.md#L174`, breaks the rule
  against local paths; a plan is history, so whether to cut that one path is the opening's call.

## What stays out

- Writing the logs back, or keeping them: they are working files.
- Opening each cited log, in the gate or in `pnpm counts`: nothing calls it before the later
  opening, which measures with its own read.
- The board's own citations: the orchestrator's, outside `main`'s tree.

## Hazards no gate catches

- **The task skills that write a tick or a recap ask for a log's name today.** Until they say the
  verdict in words, the first tick written after this lands is red. They are the orchestrator's,
  outside `main`'s tree, and change in the same landing.
- **A change that removes one log name and adds another passes the pin.** The review reads the diff
  for a new one.
- **A log told in words, with no name, passes**, and that is the form the rule asks for.
