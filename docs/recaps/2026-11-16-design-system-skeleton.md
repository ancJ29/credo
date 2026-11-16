# The design system's skeleton, recap, 2026-11-16

The partners asked that the new app look like the legacy one. This is landing 1 of 3: a place for that look and a page that shows it, with no screen of the app changed.

| | Before | Now |
| --- | --- | --- |
| The legacy's values the app lacks | nowhere | `ui/src/design-system/tokens.ts`, laid over the app's theme |
| Parts of the look | drawn by hand on each screen | samples in `ui/src/components/`, two a level: atoms, molecules, organisms |
| Seeing them | on a screen | `ui/gallery.html`, a page of our own |

## What happened

The gallery is our own page, since Storybook was too much for a skeleton. It draws the values, Mantine's button and field in the theme, then each sample in its states, light whatever the device asks. A lint rule keeps a level importing only from below. `ui/src/theme.ts` is read and never changed, so the tokens hold only what the app lacks.

Your look at the skeleton was yes on 2026-11-12, and your look at the gallery, "does the gallery read as the legacy app?", was yes on 2026-11-16. No look of this landing is open.

The review (Opus) said fix first. Two Mediums, fixed in `bace8b47` with the label's weight and spacing, the gallery's light case, the card's gap and the empty dash. Lows: items 504 to 508 `[DEFERRED]`. An Opus reread of that fix said may merge; its three Lows are items 513 and 514 `[DEFERRED]` and a corrected line in item 508.

## Ahead

Landings 2 and 3 start after this one, each with a picture run of yours: first the theme moves into the folder with no picture changed, then the legacy's values reach every screen.

## Evidence

- Commits `c1bb597b`, `199eea92` and `bace8b47` on `design-system`.
- The package's check read green on the fix pass's tree, `bace8b47`, with typecheck, lint, format, tests and unused-code all clean.
- Case 6 printed `ui/CLAUDE.md` alone: no file the app, the fake build or the walks read changed.
- `docs/products.md`: the design system's gallery row.
