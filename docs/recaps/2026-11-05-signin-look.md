# The sign-in screens in the app's look

The first screens every partner, client and operator meets were a bare white card on an empty page, not the app behind them (the human, 11-05: "not like real app"). Ten doors now wear the app's own coloured header and grey ground. **It is a look and nothing else**: no route, token, session, passkey ceremony, validation, word or error changed.

## What shipped

- A mock of thirteen screens was drawn first and approved (18:12): `ui/signin-mock/`, `3077894`.
- One shared `SignInFrame` (`ui/src/SignIn.tsx`) carries the header; the QR landing moved onto it; `Shell` is untouched. Nine cases, each seen failing first (`94f60cb`, `4c250b7`).
- The one control added: the language switch in the header, bounded to the words shown, through the caller's existing handler.
- Ten doors changed, not thirteen: three mock screens were already inside the app's frame. `join-unavailable` has no walk picture, so nine doors are walked.

## Deliberately absent

The join screens carry no switch: `Joining` holds no language state, and giving it one would change how a language is chosen (item 101). The old app's sign-in was never captured, so the app's own look is the authority.

## What the checks read

- Gate at `8127bd8`: `pnpm check` exit 0, 1,951 tests; `c-storage` green on its own rerun once its Go cache sat inside the sandbox (`20261105-1904-signin-look-gate.log`, `20261105-1910-signin-look-gate-cstorage.log`).
- Pixels, 12m26s, green: 48 pictures moved, all of the eight doors meant to move, nothing else (`20261105-1838-signin-look-pixels.log`).
- The review found one real fault: the walks page's new question was set on nine screens that are not doors, deleting their own. Fixed at `e6539b1` (restored from `main`, plus a test by screen id); all 117 pairs compared with `main`, nine differ, hold lifted. Items 102 to 104 hold its three deferred findings.

## The human's part

The mock was a yes (18:12). Still the human's: the look on the walks page, where a yes writes the new bases and a no redraws only the frame; items 101 to 104.

## Commits

`3077894` mock; `deeac25` plan; `94f60cb` frame; `4c250b7` cases; `5758d74` question; `8127bd8` item 94; `e6539b1` review fix; `43c7657` items 102 to 104.
