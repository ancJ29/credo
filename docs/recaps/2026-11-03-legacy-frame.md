# The legacy frame in the app, milestone 2, recap, 2026-11-03

## At a glance

[The plan](../plans/2026-11-03-legacy-frame.md), steps 1 to 6 are done on `legacy-frame`. Every signed-in person, in
the client app and the console, works in the old app's frame: on a PC a header painted from the brand's shade 7 to 9
and a 250-wide side menu a button hides; on a phone the same header and a bar at the foot with the first four pages
and More. The language is its own header button. Cost: $0 a month. Left to the human: the push.

## What shipped

- One `Shell` for both apps, rebuilt to the mock, with More at `/more` and `/operator/more`.
- A stand-in logo (Tabler's `IconBrandAdobe`) beside the company's name; the font was Noto Sans already.
- One new screen, `lists-9-more`; 97 screens moved, ten did not.
- `ops/full-run.sh`, one body for a piece's full run, came from `main` mid-piece.

## Rejected, and the price

- The hidden menu's 60-pixel icon strip: a client's option, moved to milestone 4. Cost: the menu hides whole until then.
- A client's own logo: waits for a client's ask. Cost: every client shows the stand-in.
- A wait for the table scrollbar to hide: replaced by drawing it hidden. Cost: none.

## Evidence

- The plan `b398ffd`, amended `01c3aa3` from the look on the mock.
- The frame on the fake `fa1579f`; weights and sizes `f35d597`; menu labels 500 at the human's ask `d584156`. The look:
  yes 11-03, about 18:40.
- The gate, green on the first run, `6e3cb7a` (`logs/20261103-1843-legacy-frame-gate.log`, `== exit 0`).
- One review (Opus): no High or Medium; one Low, the titles' 700 also moves `phone-2-code-used`
  (`ui/src/theme.ts#L108`, `ui/src/QrLanding.tsx#L24`); the plan's row 9 corrected.
- The full run, five tries 19:15 to 00:22, each red the walk's own, fixed in `walk/` alone: the field found by role
  `ed4da7c`; the scrollbar hidden `a43cf0c`, wait removed `ed47125`; the services clock a minute early `ff73652`.
  Run 1 green 23:38, 582 bases `42d4102`; run 2 read 0 on ten walks (`logs/20261103-2339-walk-…-team.log#L1157-L1188`);
  the services walk plain, green 11-04 08:40 (`logs/20261104-0839-walk-services.log#L76-L80`). The ten screens outside
  the frame did not move.
- `main` taken in twice: `9f7bae6` before the gate, `6dc3d3a` after the helper `cd42d59`.

## What remains the human's

- **The push,** when the human calls for it.
- **Open items 75 and 76:** 75 the icon strip, milestone 4; 76 a client's own logo, on a client's ask. Item 74 (ten
  unmoved, not nine) is closed here.

## Next

Milestone 3, the palette picker.
