# The guideline skeleton, recap, 2026-11-09

## What happened

The guideline a session reads before a change came up empty for four packages: `shared` had no rule about itself, and the Go package had none for writing Go. This piece closes that, and answers the human's question "a CHEAP mechanism to detect if the code matches the guideline, and which version". **The answer: do not version the guideline, measure the code.** A version number is one more hand-written number that goes stale, and the convention's own typed-in counts were found stale the same day.

| What | Where | What it gives |
| --- | --- | --- |
| A guideline beside each part | one `CLAUDE.md` in each of the eight packages, six sections each | what belongs here, the file to copy, its own rules, the non-obvious facts. Written per package, not from one template |
| Ids `C1` to `C16` | the sixteen rules in `docs/conventions/code.md` | a stable name per rule; a table of results is unreadable on its second run without them |
| A citation rule | `docs/conventions/documentation.md`, "How a living document cites code" | a file and a symbol, never a line; it names the documents it binds |
| A citation check | `scripts/src/citations.test.ts`, inside the existing test step | reds when a cited file, symbol or key is not there. It is not a sixth gate step |
| `pnpm counts` | `scripts/src/counts.ts`'s `RULES` | how much of the code follows each countable rule, and **beside each count, what it cannot see**. The numbers live in that command alone; this page and `code.md` carry none |

## The review

A read on a second model said the piece may merge with two sentences corrected.

- **Its headline objection did not hold.** It said one count overstated compliance, because two listed sites reference nothing. Both were opened: one reads the home through a wrapper, the other as a type. The numbers stood.
- **The mechanism criticism behind it was right, and was fixed.** C1 proves compliance by the absence of the old copy, never by the presence of a reference, so a file unrelated to the decision would pass too. The count's printed blind spot now says so.
- **One false statement.** "A line citation is counted, not reddened" was wrong: a line citation whose **file** has gone is red today. It was said in three places, one already in `main`; `scripts/src/citations.ts`, its printed line and `documentation.md` now say it correctly. **Anyone planning a file move needs this.**

## What it does not do

- **Nine of the sixteen rules are neither counted nor checked.** Five are counted (C1, C4, C5, C6, C7) and two are held by the one route-registration check (C2, C15). Of the nine left, five are shapes with no set to count (C3, C8, C9, C12, C14, for example a handler's step order) and four could become checks and are not built (C10, C11, C13, C16). Open item 160 holds that work.
- **Existing line citations are not converted in a sweep.** They convert as a piece touches them.
- **The counted rules' search patterns are bound to today's flat layout** (`counts.ts`'s `RULES`). After a move into folders C5 and C7 would count nothing and C6 would call every screen compliant, silently (item 198, for piece 100).
- **A symbol that still exists but changed meaning passes the citation check**; only a reader of the change sees it.

## What remains the human's

Run `pnpm counts` in `main` once this merges and read the five counts with their blind spots. Items 195 to 198 hold what the review filed. No `docs/products.md` row is added, as in the day's other three recaps.

## Evidence

- Commits `1caca15b` to `b95c9965` (`git log main..HEAD`); the review's fixes are `675b98d0`, `d409d7b1`, `14442a17`, `d423bd2d`, `260945bf`.
- Whole check on the merge result: `2026-11-09-145640-gate-all.log`, `typecheck 0 eslint 0 prettier 0 test 0+1skipped knip 0`, `== green`, last line `== exit 0`, run on `b95c9965`; the only change since is this recap.
