# Records that name no log, recap, 2026-11-11

Written before the landing on `pre-merge`. <!-- FILL: the landing's sha and time, and the day `main` reaches this recap -->

## What happened

You asked for a check and a rule on citing a log, not the logs written back. A log is a working file in the credo root: outside git, on one machine, and every tidy moves it, so on GitHub and on any other machine a log cited in a plan, a recap or an open item opens nothing.

The rule is in `docs/conventions/documentation.md`, under "Nothing machine-local": a committed record that mentions a run says how it ended in words and names no log. Plans and recaps written before the rule are history and stay as written; an open item or a living document that names a log converts when a piece touches it. A stop's report still cites its log, because it is read the same day on the machine that ran it. `docs/conventions/qa.md` says the same in one sentence.

The check is the citation test in `scripts`. It lists every log path and every bare log file name in a tracked Markdown file and compares the list to a pinned file of 456 rows, so a new citation is red and names itself, and a removal asks for its row out. It opens no log, so it reads the same on GitHub.

## What the next session would otherwise re-learn

- **The first count was too narrow.** A pinned total of 411 missed paths in bold or underscores and names without a stamp; the review found it, and the list grew to 456.
- **A total is a poor pin.** Two branches adding the same new total merge into a red neither had, so the pin became a list of rows.
- **The rule first said too much.** "History, not rewritten" covered open items and living documents, against the convention's own "true now"; you were told, and the sentence now covers plans and recaps only.
- **The orchestrator's build and recap skills told agents to name a log.** They are edited in `orch`; the sync line is yours.

## Still yours

- The sync line that copies the skill mirror into `.claude/`.
- Two deferred items, 241 and 242, in `docs/open-items.md`: names in bold or stars and names led by an ellipsis still go uncounted, and the pin has small gaps in how a red reads.
- `main` reaches this recap only at the next whole check on `pre-merge`.
- No look of this piece is open; your yes to the rule is answered.

## Evidence

- Base `705ed659`; commits `f21e8eb0` (plan), `dcac25c7` (the count), `14e41432` (the second shape), `0c541ef1` (the rule), `9082f7d0` (the review's fix pass).
- Review: Opus, one fix pass; findings 2 to 7 held and were fixed, finding 1 held in part and its remainder is item 241. Each new case was seen red by one mutation of the code.
- The scripts package gate on the fix pass's tree ended green: 423 tests passed, no file with missing coverage.
- `docs/products.md` changes no row: a rule about how records are written adds nothing a partner or an operator can do.
