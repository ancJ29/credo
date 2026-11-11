# Where the audit log sits, recap, 2026-11-10

Piece 102. Written after the piece reached `main`, not before its squash.

## What happened

On 2026-11-09 the human described the audit integration they want: every request from the UI goes through the BFF, one middleware logs what the controller says should be logged. They asked for the architecture page to say so first, before any code. A session sent at the audit work reads that page first, and a silent page leaves it to invent a destination.

The page (`d8b33e14`, 368 to 594 lines) now carries the audit backbone as a ninth package, **in the repository and called by nothing**, and the intended path in one section headed "intended, and not built" (today `docs/activity-log.md`, since piece 103 split the page). Facts sit in the sections a reader would assume are wired; every decision sits in that one section, its heading, blockquote and dashed diagram all saying it is not built. `documentation.md` permits a page to describe absent code but does not say how to mark it, so the marking was decided here.

## What the page decides, with its price

- **Attempts are logged too**, so the declaration of intent moves in front of the work.
- **The entry is written before the response, under a 600 ms bound, and a failed write is swallowed**, because the BFF is a Lambda and freezes once it responds, so a queue shipping the entry afterwards has nowhere to live. The mechanism is the storage client's existing abort signal under a tighter bound.
- **Where the service runs is left open**, on purpose: the middleware points at a URL, so same box or its own is a deploy, not a rewrite. The piece's own opening note said "decided: beside `c-storage`"; the page says open, and the page is right.

## What the piece found

- **The gate's cross-compile asserted the wrong machine** (`056c09d3`). `audit-backbone/Makefile` targeted amd64 under a comment calling it the box's arch, while the box is arm64, so its green said a build succeeded for a machine the project does not have. Fixed in the piece because the gate already performs the cross-compile, so the fix was verifiable at once; `make check` green on arm64 (`20261109-1651-audit-backbone-arm64.log`). The fault hid behind the word "cross-compile" in a comment and in rule `AB1`; only a sentence specific enough to name the architecture exposed it.
- **A line citation naming an unrelated sentence**, found only because the piece touched that claim. The check verifies a citation's file and never its line, so the standing exposure is filed as open item 203 with nothing recommended; the sweep that would close it is the human's call.

## What remains the human's

Item 203's question. And the build the page describes: the actor on the request first, since most deliberate write sites have no identity in scope, then the middleware.

No `docs/products.md` row: the piece is a page for sessions, with nothing a user or partner can open.

## Evidence

- Page `d8b33e14`, Makefile `056c09d3`, items `72b93a49` (the commit the board calls the merge; it holds only the two open items).
- The page's length and the Go file and package counts (22 files, nine packages) read with `git show` and `git ls-tree` at `d8b33e14`. The board's counts of write sites and line citations were not re-measured here, so none is quoted.
