# The guideline skeleton, recap, 2026-11-09

## What happened

A session starting a change was meant to read the big picture, then the guideline, then the sibling code, and the guideline came up empty for four packages. `shared` had no rule about itself, and the Go package, the one `code.md` admires most, had none for writing Go. This piece closes that, and answers the human's question "a CHEAP mechanism to detect if the code matches the guideline, and which version". **The answer: do not version the guideline, measure the code.** A version number is one more hand-written number that goes stale, and the convention's own typed-in counts were found stale the same day.

| What | Where | What it gives |
| --- | --- | --- |
| A guideline beside each part | one `CLAUDE.md` in each of the eight packages, six sections each | what belongs here, the file to copy, the package's own rules, the non-obvious facts. Written per package, not as seven copies of a template: `shared` and `c-storage` needed rules the others do not |
| Ids `C1` to `C16` | the sixteen rules in `docs/conventions/code.md` | a stable name for each rule, minted once and never reused; a conformance table cannot be read twice without them |
| A citation rule | `docs/conventions/documentation.md`, "How a living document cites code" | a file and a symbol, never a line; it names the documents it binds |
| A citation check | `scripts/src/citations.test.ts`, inside the existing test step | reds when a cited file, symbol or key is not there. It is not a sixth gate step |
| `pnpm counts` | `scripts/src/counts.ts`'s `RULES` | how much of the code follows each countable rule, and **beside each count, what it cannot see**. The numbers live in that command alone; this page and `code.md` carry none |

## The review

A read on a second model said the piece may merge with two sentences corrected.

- **Its headline objection did not hold.** It said one count overstated compliance, because two of the sites it lists reference nothing. Both were opened: one reads the decision's home through a wrapper, the other as a type import. The numbers stood and nothing was corrected on that word.
- **The mechanism criticism behind it was right, and was fixed.** C1 proves compliance by the absence of the old copy, never by the presence of a reference, so a file unrelated to the decision would pass too. The count's printed blind spot now says so. A later reader should hold both halves: the number is sound today, and what it proves is narrower than it reads.
- **One false statement.** "A line citation is counted, not reddened" was wrong: a line citation whose **file** has gone is red today, because only a bare file name is left to convert. It was said in three places, one already in `main`; `scripts/src/citations.ts`, its printed line and `documentation.md` now say it correctly. **Anyone planning a file move needs this.**

## What it does not do

- **Most rules stay unmeasured.** Five are counted (C1, C4, C5, C6, C7) and two are held by the existing route-registration check (C2, C15). Five are shapes with no set to count (C3, C8, C9, C12, C14, for example a handler's step order), and four could become checks and are not built (C10, C11, C13, C16). Open item 160 holds that work, one check at a time.
- **Existing line citations are not converted in a sweep.** They convert as a piece touches them, the human's own drift policy applied to the documents.
- **The counted rules' search patterns are bound to today's flat layout** (`counts.ts`'s `RULES`). After a move into folders C5 and C7 would report nothing to count and C6 would call every screen compliant, silently. Filed as item 198, tagged for piece 100, which must update the patterns in the same change as the move.
- **A symbol that still exists but changed meaning passes the citation check**; only a reader of the change sees it.

## What it filed

Items 195 to 198: `describeRun` never says which scope pattern matched nothing (195); a citation to a file written but not yet staged reds the gate until `git add` (196); `shared/CLAUDE.md`'s SH6 says "the one other spelling" where only exports are meant (197); the flat-layout patterns above (198, the one that matters).

## What remains the human's

Run `pnpm counts` in `main` once this merges and read the five counts with their blind spots. No `docs/products.md` row changes (internal: it is how sessions read the repository, not a product).

## Evidence

- Commits `1caca15b` to `b95c9965` on `guideline-skeleton` (`git log main..HEAD`); the review's fixes are `675b98d0`, `d409d7b1`, `14442a17`, `d423bd2d`, `260945bf`.
- Whole check on the merge result: `2026-11-09-145640-gate-all.log`, `typecheck 0 eslint 0 prettier 0 test 0+1skipped knip 0`, `== green`, last line `== exit 0`, run on the branch tip before this recap was added.
