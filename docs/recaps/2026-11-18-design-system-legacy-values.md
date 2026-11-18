# The design system's legacy values on the screens, recap, 2026-11-18

Landing 3 of 3: every screen takes the legacy app's values from one theme. Pictures were meant to move, and 728 of 786 did.

| | Before | Now |
| --- | --- | --- |
| Main colour, badge, table, dialog | the app's theme beside the design system's | one theme, `themeOf`, in `ui/src/design-system/` |
| A section card | large title, no icon, padding 16 | small capital title, grey icon tile, padding 24, on 27 cards |
| The menu's labels | 16 px at 500 | 14 px at 600 |
| On a phone | the app's header and bar | the legacy's shadows and line |

## What happened

Each card takes the legacy's icon, else the nearest. The dialog header's padding came in the fix pass `f2407e45`; item 507 stays half done, as the gallery draws no dialog or table row. The review said may merge with changes; its Lows are items 595 and 596, and step 10's is 590, all `[DEFERRED]`.

Your first picture run, which wrote the new pictures, read green: 35 comparisons, none new, none without a counterpart, none unreadable. 728 of 786 pictures moved against the old bases; they are committed in `4f3a2a7e`.

Your second picture run, over all twelve walks with no flags, read green: every picture in every walk the same as the new bases, every stack pass's tests passed, and no base written.

## Open

Your look, point 4: does each walk read as the legacy app, on the walks page? The push waits for your yes.

## Evidence

- Commits `49d96d13`, `9785d28f`, `ffb02689` (steps 9 to 11), `f2407e45`, `9865d82b` (`pre-merge` taken in), `4f3a2a7e`, on `design-system`.
- Each new case was red first. With `pre-merge` in, the ui check read 934 tests and the visual check 212, both green, coverage full.
- `docs/products.md`: the gallery row's landing-3 clause.
