# The walk scenes' stillness race, recap, 2026-11-09

## What happened

A walk scene ends once the page has stood still for 40 milliseconds. On a loaded machine that gap can pass before the page has finished drawing, so the words are read off a half-drawn screen. That is the whole cause, and the live walks page the human judges on uses the same reader. The previous piece fixed the client delete walk's last screen; this one closes its siblings.

## What was done

The scene's wait step (`see`) now also matches alerts and can fill a word's `{{name}}`. Each screen ends on a wait for what it is about:

- **Screen 1 (the delete page):** waits for the title, drawn only after the client list is read. Real race.
- **Screen 3 (the failure):** waits for the failure alert, drawn after two awaits. Real race.
- **Screen 2 (the wrong code):** **no race**: its alert is set synchronously, so the wait is met on the first look. Idle but harmless, and it guards the day the code check moves to the server. **Two screens were closed, not three.**

Each real race was red without the change and green with it under the same 300 ms delay; screen 3 also holds at 80 ms. **The expectations are byte-identical to main** (`visual/src/words.test.tsx` untouched): a fix, not a loosening, and no retry or timer, since a constant delay fails every attempt.

## Pictures cannot change

The committed baselines are Playwright's under `walk/`, which does not depend on `visual/`, so no committed pixel can move. The unchanged words test already pinned each wait's subject, so the old capture held that content. **No picture run was skipped; none is owed.**

## Limits

- Only six `see` steps exist, all on this walk; other walks carry the same exposure until given waits.
- No real browser walk ran (none starts in the sandbox).
- Nothing waits on the human; no `docs/products.md` row changes (internal).

## Evidence

- Commits `c55e3d03` and the fix pass after it; both guard rows shown red by a named mutation, then reverted.
- Gate on the `visual` package: `20261109-0933-scene-reader-races-gate.log`, last line `== exit 0 (typecheck 0 eslint 0 prettier 0 test 0 knip 0)`.
