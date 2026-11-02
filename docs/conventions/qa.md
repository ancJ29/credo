# QA

> **Decided** 2026-10-27, after reading the old app's QA process. **Amended** 2026-10-27 by the
> human: rules 7 and 8. **Amended** 2026-10-27 by the
> human: rules picked from the old repo's standing preferences. **Amended** 2026-10-27 by the
> human: the gate's scope and cadence, in rule 6. **Amended** 2026-10-28 by the human: a review's
> findings tagged, in rule 5. **Amended** 2026-10-31 by the human: rule 7, a moved pixel counted
> raw. **Amended** 2026-11-02 by the human: rule 1, the case table the machine's whole and the
> human's points visual, up to five, each told. **Amended** 2026-11-03 by the human: rule 7, a
> yes held until its screen's version moves. Binds every feature's plan, every test and every
> merge into `main`.

## At a glance

**The human has up to five points in a feature, each a look:** its walk, a page or a diagram,
told in a few sentences and answered yes or no. The machine does the rest.

```mermaid
flowchart LR
  table["case table<br/>🤖"] --> cheap["cheap end-to-end build<br/>🤖 fake first"]
  cheap --> look["fake walk, page or diagram<br/>👤"] --> red["red<br/>🤖 breaks each case once"]
  red --> green["green · coverage 100 %<br/>🤖"]
  green --> review["review<br/>🤖 another model"]
  review --> walks["walks<br/>👤 yes or no a screen"]
  walks -- "all yes" --> merge["merge into main"]
  review -. a finding .-> red
  walks -. a no .-> table
```

The eight rules, numbered as [below](#the-rules):

1. Each feature starts with a table of cases, one behaviour a line, all of it the machine's.
2. A test counts only if it fails when its behaviour breaks, so each is seen failing once; a
   route only a test calls is dead.
3. Each case is tested as close to its code as it can be.
4. Each test is named after its case; there is no second list.
5. A different AI model reviews the code before it merges; each finding is fixed, rejected or
   deferred, with its reason.
6. A test that fails only sometimes is a bug, never rerun until it passes; and only the gate that
   can change a conclusion is run.
7. The screens are the final check: each person's day, on their device, yes or no a screen
   until its look changes; the machine counts every moved pixel, raw.
8. Every line is tested, or says why not, as in "we choose not to test this".

## The shapes, from an invented feature

The case table, before any code, the machine's alone; the test's name is the sentence.

| # | The case: one behaviour, one sentence | Held by |
| --- | --- | --- |
| 1 | A name already in the list is refused, and the list stays as it was | BFF route, `items.route.test.ts` |
| 2 | A name is stored without the spaces around it | unit, `item-name.test.ts` |

The map of walks. A dash is a part of the day not built yet.

| | set up | the daily work | the month's close |
| --- | --- | --- | --- |
| **manager**, PC | a walk | a walk | — |
| **staff**, phone | — | a walk | — |

## The rules

1. **A feature's plan carries a case table, and every row is the machine's.** Each case is one
   behaviour in one sentence, beside the test that holds it. The machine drafts and holds them all,
   among them those that say what the feature must do for its user, or what it lacks that a user
   will need. **The human's points are looks, up to five:** the walk of rule 7, a page or a
   diagram, each told in a few sentences the human can picture and answered yes or no at the step
   that needs it. A product choice with a stake (a client, money, data or production) is asked
   there as one recommendation, as [collaboration](collaboration.md)'s hand-off 2 draws the line;
   an ask the human makes on their own becomes a case. *Rejected:* the human reading the business
   rows before any code. Of the 85 the human read in the plans up to 2026-11-02, none came back
   corrected, while every real change came from the human's own asks. A kind of row that never
   comes back corrected is the machine's. *Rejected:* the human reading every row. Technical rows,
   read without the code's facts, come back as guesses. *Rejected:* two points at most, each in
   one line. The human's cost was never the count but a point too thin to picture: on 2026-11-02
   the human set five as still fine, and asked for each to be explained, not given in one line.
2. **A case is held only when breaking its rule turns its test red**, so each case is broken
   once before it passes: run red before its code exists, or with its rule's line changed and
   then put back. The red must come from the assertion on that rule; a missing import or an
   earlier crash holds nothing. This is not rule 8's gate: the table says which behaviours are
   held, coverage that no line is left undecided. *Rejected:* coverage as the measure of a case.
   A line can run with nothing checking its outcome: the old app sat at 100 % of lines beside 41
   behaviours no test held. *Rejected:* a mutation tool, hundreds of mutants to sort for a
   question about behaviours. A route only a test calls is dead: move the test onto the path the
   product uses, or retire it; a negative test must fail if the feature vanishes.
3. **Each case is tested at the lowest layer that can hold it**: a unit test where its rule lives
   in one package; the BFF's route where it crosses to c-storage; the browser only where the
   browser meets the stack. A lower test runs faster, and its red sits nearer the line that
   broke. *Rejected:* a browser test per case. Each needs the whole stack up, and its red names
   a page, not a line.
4. **The test names are the cases.** Once built, each test's name is its case's sentence; the
   plan's table stays as it was at its commit, never kept in step. *Rejected:* a test-case file
   beside the tests. It repeats the names, and goes stale at the first test nobody copies in.
5. **A model other than the author's reviews the code before it merges into `main`**, with its
   tests and the case table, asking of each test whether breaking its case would turn it red.
   The author's model is the one in the commits' `Co-Authored-By` line. *Rejected:* the
   author's model reviewing its own code. It shares the blind spots that wrote it. Each finding is
   listed in the recap and tagged `[FIXED]`, `[REJECTED]` or `[DEFERRED]`, with its reason; a
   deferred one names where it went. A finding made without context that a memo or the plan
   already holds is rejected, naming that home. *Why:* treating every finding as a bug erodes
   trust in the memos, and treating none as one misses real defects.
6. **A flaky red is a defect: never retried until green.** A rerun may reproduce it, but its
   green is no verdict. A rerun gone green teaches a session to rerun past a real red, and with
   several worktrees running at once, load is the normal case. *Rejected:* a retry setting,
   which greens the real red too; a longer timeout, which hides the cause.

   **Run the gate that can change a conclusion:** nothing for a read-only task, typecheck and one
   test while iterating, the touched package's gate at a commit, the whole only before shipping.
   *Rejected:* the whole gate at every step. Several worktrees run at once, and a full run's
   minutes buy no verdict a smaller gate does not already give.
7. **The screens are the end-to-end check.** Each person's part of the business's day is walked
   screen by screen, on that person's device. The map places each walk: the day's stages
   across, its people down; an empty cell shows what is missing. A walk shows the main path and
   each kind of failure once; the variations stay in the machine's tests. Each screen has two
   readers. The machine compares its look with its committed base image, raw: a moved pixel is any
   pixel whose colour moved by any amount, a softened edge's included, and one is a red. The same
   input gives the same picture: a date, a name or anything random is fixed at its source (the data
   set, the fake, the stack's seed); a mask, a box of one colour, covers only what a unit test holds
   and the human need not judge, and names that test. The run script prints the raw count of moved
   pixels for every comparison it makes. *Rejected:* a tolerance, a threshold or a comparator that
   skips anti-aliased pixels: it hides a picture that is not steady, and the next real move of one
   shade inside it. *Rejected:* a mask over what moves, such as a card's frame: the human judges the
   frame. The human answers yes or no for the business, from the picture and one short question,
   one answer a screen; a yes holds until the screen's version moves. The version is computed
   from the screen's own markup, in both languages, and the style rules that match it; its one
   home is `versionOf` in `visual/src/capture.ts`. The answers are kept in the answerer's browser,
   under the name typed there, and reach the machine as the block the answerer copies into the
   chat. A "no" becomes a case in the table, and a feature is done when none of its walks holds
   an open "no". *Rejected:* a gallery of every screen that asks nothing. It makes the human read,
   and finds nothing missing: a picture shows only what was built. *Rejected:* a base image per
   captured case, hundreds of them, rewritten by any layout change. *Rejected:* keying a yes to
   the screen's words, this rule before 2026-11-03. Its price: a screen whose look changed under
   the same words kept its yes, unseen, and each screen was asked once a language. It rested on
   an earlier rejection, keying a yes to the pixels, as a new value would re-ask an answered
   screen; that no longer holds: a date or a name is fixed at its source (above), and two builds
   of one commit give every screen the same version, as `visual/src/capture.test.ts` holds.
8. **Coverage is 100 %, and every line left out says why.** The gate is 100 % of statements,
   lines, functions and branches. A line the tests do not run is tested, or carries the coverage
   tool's ignore hint, its reason starting with one of three words: `unreachable`, no input in
   any environment runs it; `elsewhere`, another gated layer checks it, named; `untested`,
   reachable and nothing checks it: we choose not to cover it, and say why that is accepted.
   Under a v8-based runner: `/* v8 ignore next -- untested: a timeout, rethrown */`. The
   `untested` hints, found by one grep, are the risk list a review reads, not the percentage. A
   whole file another layer owns, such as an entry point, is excluded in the coverage config,
   its word and reason beside the exclude. *Rejected:* only tested or deleted, with no hint, the
   old app's later rule. Real defensive code then gets a test that exists only to cover it, or
   is deleted, and "we choose not to cover" has nowhere to be said. *Rejected:* a threshold
   below 100, where a new untested line gets in while the number holds.

## Hazards no gate catches

Rule 8's hints carry two, the reasons the old app refused hints:

- **A hint's range wraps only what its reason names.** Code added inside a range, or after one
  never closed, hides while the gate stays at 100: the old app hid an access check that way,
  and 95 lines behind one unclosed range. *Guard:* a diff touching a hinted range is reviewed as
  new code, and rule 5's reviewer reads each new hint against its reason.
- **A hint over code that runs is a claim no gate checks.** *Guard:* in a scratch run, remove
  the hints, re-run coverage and read what ran inside each range. A body that ran is a hint to
  delete.
