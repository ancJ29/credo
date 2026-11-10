# The architecture page a person can read, recap, 2026-11-10

Piece 103. Written after the piece reached `main`, not before its squash.

## What happened

On the evening of 2026-11-09 the human read the architecture page they had asked for two hours earlier and judged it: the only thing a person could read on it was the diagram. Three rounds followed, each started by the human reading the last.

1. **Re-ordered** (`20ee2ecf`, `ae8d2abf`): the page became one request walked from the screen to the record, not a tour of the parts, and the activity log got a page of its own.
2. **Split** (`7676bd29`): the human read it ("easier for me to read ... however, I still not really satisfy") and asked who the audience was, the person or the machine, and said that if both, there should be two memos. The page divided at the divider it already had: `docs/architecture.md` (145 lines, 1,958 words) and `docs/architecture-detail.md` (377 lines, 4,063 words). **All 74 lines holding a line citation (61 line-anchored links) moved to the detail page; the person's page kept none.**
3. **Told at one altitude** (`2bef5390`): the human asked for a memo at the level of SQLite's own architecture page, then corrected two readings: the memo tells the journey and the image of the final state, not what to do, and **the SQLite page is an example of the level of abstraction, not a template**. The codemap table went to the detail page; in its place `## What each part is for` tells nine parts in seven paragraphs, one role each, eight carrying a reason sourced from the repository and the ninth, `audit-backbone/`, saying plainly that nothing calls it; the diagram gained group labels. 178 lines, 2,172 words. The human: "this one is what I really expected."

## What the piece found

- **A collision between two pieces that no reader would see.** While this page was rearranged, piece 100 was moving `ui/src`'s files on a branch, and the page cited `ui/src/CustomerPage.tsx`, now `ui/src/pages/client/CustomerPage.tsx`. Neither document was wrong about its own world; the fault existed only in the merge result. The citation check caught it; fixed in `8be98d7c`.
- **A gap in that check.** It reads a file, a symbol and a bare path, and ignores Markdown links and heading anchors. Two links in `docs/activity-log.md` pointed at sections that had moved, and the check was green over both; a hand `git grep "architecture.md#"` found them, corrected in `7676bd29`. The gap is still open.
- **A debt left on purpose.** `docs/conventions/documentation.md` still says "a diagram is drawn from committed code and names the files it is drawn from", and the diagram's sources now sit on the detail page, so the line is untrue. The amendment is one sentence, owed by the next piece that touches that file; this recap records it and does not pay it.

## The lesson about altitude

A reference page's altitude is a property every sentence must share. The two things that broke it were both true: a table of file locations, and the parentheticals saying how each absence had been verified. Truth did not keep them on the page; level did. The detail page holds both now.

## What remains the human's

The convention's one sentence (above) and whether links should join the citation check. No `docs/products.md` row changes: the page is internal.

## Evidence

- Commits `20ee2ecf`, `ae8d2abf`, `8be98d7c`, `7676bd29`, `2bef5390`, on `architecture-for-people`.
- Sizes read from the files at `7676bd29` and `2bef5390` with `wc`; the detail page stands at 409 lines, 4,574 words after round three.
- Two facts rest on the brief alone: the verdict's hour, and piece 100's move (the repository shows it only as the `directory-structure` branch merged at `ef40aa7a`).
