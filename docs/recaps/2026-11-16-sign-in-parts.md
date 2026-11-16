# The sign-in's parts, recap, 2026-11-16

You pointed at the old app's two sign-in pages and asked for components to start the design system from. Five parts now exist and two Mantine entries, each drawn in the gallery. No screen of the app changed.

| Part | Where it lives |
| --- | --- |
| Logo tile, heading, back link | `ui/src/components/atoms/` |
| Brand band | `ui/src/components/molecules/` |
| Door card: the 4-px gradient bar, the band, the body | `ui/src/components/organisms/` |
| Gradient button, labelled divider | the theme, `designThemeOf` |

## What happened

The gallery draws the door card twice, as the old app's sign-in and its link page, in sentence case with "hoặc" on both. It first drew each part beside a picture of the old app's; you said "I think no need for legacy part", so that pane was taken out and item 516 closed as moot. The gallery now has 11 parts under 3 levels.

The review (Opus) said may merge with eight Lows, all fixed in one pass; the memo's counts and its frame line were corrected with them. Item 553 `[DEFERRED]` (Info) holds what the doors' later piece needs: the back link reloads the page under the router, and the band says the company twice to a screen reader.

## Open look

Your look, by eye in the gallery, on whether the parts read as the old app's: yes, 2026-11-16. It opens the question of whether the doors take these parts in a later piece, still unanswered.

## Evidence

- Commits `82c491a3`, `29eeaf0b`, `d072a258`, `99643cfd` (steps 1 to 4), `c9e7a711` (`pre-merge` taken in, no conflict), `1cbca5e2` (the fix pass), on `sign-in-parts`.
- Case 11 counted 0 files outside the gallery's and the parts' folders.
- After the fix pass the ui package's check and the visual package's check each exited 0.
- `docs/products.md`: the gallery row's state.
