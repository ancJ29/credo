# Three rules written where they bind, recap, 2026-11-10

Written before the branch merges into `main`, not after.

## What happened

Three rules every session already followed lived in one skill, on the board or in a memory, so a session that loaded none of them was not bound. They were held back until the screens' document step had merged, because that step edited the same convention files. Commit `dab36902` writes them:

- **No internal identifier in anything written for a person** (`docs/conventions/collaboration.md`, the fourth hand-off). The old line barred a step number, a model's name and minutes against sized; it now bars every identifier out of the machine's own tracking, and says the human asked for plain text in their own words. The diff adds a boundary the piece's description did not name: a number a document publishes as its own (the log's items, the code rules' ids, a plan's steps) stays.
- **One review, one fix pass** (`docs/conventions/qa.md`, rule 5). That pass's own gate is the re-check, and what a second round would raise is deferred, not handed to a third reviewer. The diff adds one exception the description did not: a finding that, acted on, costs something that cannot be undone.
- **A plan is about 2,500 words, not 2,000** (`docs/conventions/documentation.md`). The description said either the cap or the plans were wrong; the diff answers that the cap was, since ten of the twelve plans written under it were over (1,048 to 3,612 words, median about 2,490). The guard now acts well past 3,000.

Two small edits ride along: the same commit strips a piece number from the code convention's amended line, and shortens the QA at-a-glance gate wording to "one command", matching the gate rule below it.

## What it cost, and what remains

- **Rejected, and written into the rules:** rounds of review until the reviewer is silent; a 1,000- or 2,000-word plan figure that no plan met.
- **Not in this piece:** the open log joining the citation check's living set; it waits on an audit of the citations that no longer resolve.
- **The first final gate never finished.** It died with its session partway through the visual package and wrote no `== exit` line (`2026-11-10-155556-gate-all.log`), which proves nothing. One whole gate over the branch tip, which also holds this recap and two new open items (212, 213), is the check: <!-- FILL: rerun log name and its exit line -->
- **Nothing to deploy and nothing for the human to look at;** the rules are documents.

## Evidence

- Rules: `dab36902`; the trunk merged in at `e53beb3a`, trunk tip then `0c938a52`.
- No row in `docs/products.md` changes: the piece adds no product.
