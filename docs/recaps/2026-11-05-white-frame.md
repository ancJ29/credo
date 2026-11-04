# The white header, white menu and icon strip, recap, 2026-11-05

## At a glance

[The plan](../plans/2026-11-04-white-frame.md), all seven steps done on `white-frame`: in Settings a client's root turns the header white, the menu white, and the hidden menu to a strip of icons, three switches, all off until on. The wire gained three fields; every stored record reads them off. Line 54 (the app's layout and colours) is now 4 of 4.

| | Before | After |
| --- | --- | --- |
| Settings | name, logo, colour, languages | three switches below the colour |
| Header and menu | the brand's colour | white, with the old app's greys, when on |
| Hidden menu | gone whole | a 60-pixel strip of icons, when on |

## What shipped

- The three switches in `tenantConfigSchema`, each defaulting to false; no route code changed, and five guard rows were each red by a named mutation, then green (`4c13aa2`, `0d3546c`, `b56ee77`).
- The new rules live in `ui/src/frameLook.module.css`: an edit to `frame.module.css` renames every class and moved 96 screens (`4a0d780`).
- The review (Opus): one Medium, the white header's company name drawn in shade 7 at 2.1 to 3.3:1, now grey 8; two Lows, the strip's tip on `:focus-visible` and screen 5 taken with every switch off. All fixed (`e165def`), the reread holds.

## Rejected and what remains the human's

- The cut's two switches: three, since the strip is the human's own ask (`46ddbca`).
- The open page's mark under 3:1 for four palettes, and the strip's tip never drawn in a browser: items 94 and 95, deferred. Item 75 is closed. Nothing is the human's to decide.

## Evidence

- The human's look, yes 11-04 16:16, on "Set up the company", screens 3, 10 and 11.
- The full run, refused once on the Mac's load (23:15, load 30), then green 11-05 00:01 to 00:16, 14m36s: 36 pictures moved on six screens, 12 new for screens 10 and 11 (`047ce97`).
