# The money defects of a driver's day, recap, 2026-11-08

## What the office can now rely on

A driver's day closes once, against the person who closed it. Three open items were ranked as the last money faults before a real client's first order. **Two of the three were not what the page said, and the index that ranked them would have bought a code change where only a missing test was at fault.**

- **Item 36, finding 5 (screen and cash disagree after a price change): already fixed on 11-07** by the earlier order-editing piece. Nothing was built; the readiness page still called it the one to fix first.
- **Item 41, finding 2 (two closes overwriting each other's cash): the safeguard was always in the code** (`bff/src/routes/reconciliations.ts#L41` passes `null`, sent as `if-none-match: *`). Nothing held it: both tests stopped the write before c-storage saw it, so deleting the `null` left all fourteen green. A new rival-close case lets our write through so the precondition itself refuses it (409, first cash kept), and goes red without the `null`.
- **Item 41, finding 7 (a close recorded as the root): a race only,** needing the closer's staff record to vanish between sign-in and close. The closer is now read before anything is cancelled; a gone person gets a 401 with nothing cancelled or stored. Only the root has no id, so the mis-attribution is **unreachable for a non-root**, not merely narrowed (the review re-proved it).

The day's sum is made by one function, `driverDay` (`shared/src/reconciliations.ts#L62`), so the page, the per-driver list and the close agree by construction. What can drift is its input, and a new case holds that seam: a proof, not a fix.

## Still open

- Item 41, finding 5, the page-side reload after a close that stops part way: left out on purpose. This piece took only the half that was the same two lines.
- Filed, both Low: item 149 (the 409 case asserts one field of the surviving record, not all) and item 150 (the page's pre-close sum is held by pixels, not an assertion).
- Item 56 now names its real cause: a test at about 82 per cent of its own time limit, not machine load.

## Evidence

- Whole check green, 100 per cent coverage: `20261108-121757-money-defects-step4-whole-gate.log`, last line `== exit 0`.
- Review: may merge as it stands; no High, no Medium, three Lows (two filed, one the plan's "built twice", corrected).
- Look: one null proof, that no screen moved and the Closed card reads as before: green on 2026-11-08, six comparisons over 84 pictures, every count 0.
- `docs/products.md`: the Đối soát row names the fixes.
