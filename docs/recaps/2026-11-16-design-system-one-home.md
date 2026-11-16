# The design system's one home for the colours, recap, 2026-11-16

Landing 2 of 3: every colour the app writes lives in the design system's folder, the app is light only, and a check keeps it so. No picture was meant to move.

| | Before | Now |
| --- | --- | --- |
| The app's theme, palettes and theme stylesheet | loose in `ui/src/` | in `ui/src/design-system/`, with the tokens |
| The frame's hand-written colours | 26 in two stylesheets, more in the shell and the sign-in card | variables written from the tokens |
| Dark | 16 rules and a dark choice in the mock harness | gone: light whatever the device asks |
| A colour typed on a screen | nothing stopped it | a test over every stylesheet and a lint rule fail it |

## What happened

The move changes no pixel by design. One difference is not this piece's: the company list gained a Box column when the move between boxes came in from `pre-merge`, so twelve pictures of the operator's company list (`op-5-dashboard`, `dc-4-gone`) were retaken as new bases in `d03892b6`. Your first run, moving all bases, showed only those twelve.

The review (Opus) said fix first; the fix pass is `7fc94042`: the variable check reads the names the frame uses, and the light-only check goes red without the force. A reread said may merge. Two Lows are items 539 (the colour checks miss `white`, upper-case and `oklch(`) and 541 (two dead branches left by light-only), both `[DEFERRED]`.

Your run of all twelve walks with no flags read green on `d03892b6`: 35 comparisons, every count 0 (moved, new, without a counterpart, unreadable). The move changed no picture.

## Ahead

Landing 3 gives the legacy's values to every screen, with a picture run of yours.

## Evidence

- Commits `c2c0c2ea`, `3adcfdc6`, `2e406013`, `e7cb476c` (steps 4 to 7), `7fc94042` (fix pass), `d03892b6` (pictures), on `design-system`.
- The package's check and the visual check read green at each step; each new check was red once on a planted colour and put back.
- `docs/products.md`: the gallery row's state only.
