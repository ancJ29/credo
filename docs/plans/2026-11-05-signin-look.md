# The sign-in screens take the app's look

## At a glance

The sign-in screens are the first thing every partner, client and operator meets, and they do not
look like the app behind them: each draws its own card on its own pale gradient, under a tinted head
and a brand bar the app has nowhere else. Line 54 matched the app's frame to the old app's; no
sign-in screen was in any of its four milestones.

This piece draws them all in the app's own frame. **It is a look, and nothing else.** No route,
token, session, passkey ceremony or validation changes; no screen says a new word or shows a new
error. A step that would change what a sign-in *does* goes to `docs/open-items.md` instead.

The cheapest safe path is in the code: `SignInFrame` (`ui/src/SignIn.tsx#L41`) is the home three
doors import, so the frame is rewritten there, not drawn from zero, and the one door outside it
moves onto it. The price: the QR landing loses its markup (`ui/src/QrLanding.tsx#L19-L38`), two
walk screens.

## The frame, decided

**A sign-in screen takes the app's own coloured header — the gradient, the logo, the name, the
language switch — and no side menu; the card sits on the app's ground beneath.** Drawn and judged
in mock round 1 (`ui/signin-mock/index.html`, `signin.js`, `data.js`), checked by
`one-off/20261105-1755-signin-look-round-1/check.log`. That is the authority, implemented here, not
revisited. **If the human answers no on the mock, step 1 is rewritten and no other step moves.**

**One shared component:** `SignInFrame` stays the doors' home and takes the header, built from the
app's own `ui/src/frame.module.css` and `BRAND_GRADIENT` (`ui/src/theme.ts`); `Shell`
(`ui/src/Shell.tsx#L139`) is untouched, since a door's header is a subset of `Shell`'s — no user
mark, no toggle, no open page — and sharing `Shell` would mean a mode switch through its whole tree,
risking the hundred-odd signed-in walk screens.

**The one control the look adds:** where a door's caller offers more than one language, the header
draws the mock's switch through the caller's existing handler: the words shown change, as in the
signed-in header, and nothing of the sign-in. One language, no switch (`Shell.tsx#L176`).

## The slice

The mock's thirteen screens, each a state the product has, all in `ui/src/`.

| The mock's screen | Drawn by | Walk screen |
| --- | --- | --- |
| operator · not-given · refused | `OperatorSignIn.tsx` | `op-1-sign-in`, `pk-3-not-given`, `pk-4-no-operator` |
| join · dead · unavailable | `JoinPage.tsx#L79-L88` | `pk-1-join`, `pk-5-link-dead` |
| signin · refused | `SignIn.tsx` | `1-sign-in`, `2-sign-in-refused` |
| qr · refused | `QrLanding.tsx` | `phone-1-signed-in`, `phone-2-code-used` |
| ended | `SessionEnded.tsx`, a modal | `pk-6-sign-in-ended` |
| passkeys | `PasskeysPage.tsx`, in `Shell` | `pk-2-passkeys` |
| ways | `SignInPanels.tsx`, in `Shell` | `staff-17-email`, `staff-18-qr` |

**Reread against the product:** all thirteen states exist; there is no `ui/src/PasskeyWalk.tsx`,
only its test. The last three rows sit inside the app's frame already, so they are the look's
reference, not its work: **ten doors change, three screens must not.** `join-unavailable` has no
walk screen, only `JoinPage.tsx#L84` and a unit test.

## The cases

| # | The case: one behaviour, one sentence | Held by |
| --- | --- | --- |
| 1 | Every door draws the app's header: gradient, logo, name | `SignIn.test.tsx` |
| 2 | No door draws a side menu or the phone's bar | `SignIn.test.tsx` |
| 3 | The card sits on the app's ground, not a gradient of its own | `SignIn.test.tsx` |
| 4 | A client's door takes its client's colour, credo's doors credo's | `SignIn.test.tsx` |
| 5 | The QR landing draws the same frame as the password sign-in | `QrLanding.test.tsx` |
| 6 | A door whose caller offers one language draws no switch | `SignIn.test.tsx` |
| 7 | The switch changes the words shown, never what is submitted | `SignIn.test.tsx` |
| 8 | Every word each door says is the word it said before | `words.test.tsx` |
| 9 | The three screens inside the app keep the frame they had | pixels, `piece-2`, `operator-passkeys` |

## The steps

About 40 minutes; a first run of this kind.

- [x] **1. The frame, on the fake** (10 min). `SignInFrame` rewritten to the decision above;
  `QrLanding` moved onto it. *Done when:* `pnpm --filter @credo/ui test` green, `git grep -c
  'bg="brand.0"' -- ui/src` prints nothing, `git grep -c SignInFrame -- ui/src/QrLanding.tsx`
  prints 1.
  *Evidence (18:28):* `94f60cb`; `pnpm --filter @credo/ui test` green; the first grep prints nothing;
  the second prints 3, the import and the open and close tags, so one use. The join page's three
  states draw no switch: its caller has no language handler, and giving it one would change how a
  language is chosen, so it is left to the human (`docs/open-items.md#L665`).
- [x] **2. The nine cases, red then green** (10 min). *Done when:* each row red once from its own
  assertion, one red a row in the log; then `pnpm --filter @credo/ui test` green at 100 %.
- [ ] **3. The walks page** (5 min). The doors' question set to the mock's. *Done when:* `pnpm
  report` ends green and `git diff -- walk/specs | grep -c "at('"` prints 0 — no screen added,
  inserted or renumbered.
- [ ] **4. The pixels and the look** (5 min, the human's terminal). *Done when:* `bash walk/run.sh
  piece-1 piece-2 operator operator-passkeys --moved all` prints a raw moved count for each of the
  ten doors and **0** for `pk-2-passkeys`, `staff-17-email`, `staff-18-qr`; `--write` once the look
  is a yes.
- [ ] **5. Item 94 widened** (2 min). The mock read the same pairing wider: white on the **header
  and the primary button** is 2.8:1 to 3.4:1 — terracotta 3.12, sandstone 3.32, autumn 2.84, olive
  3.10, ocean 3.40, coin 3.05. Line 54's pairing, kept as it is. *Done when:* `grep -c '^## '
  docs/open-items.md` is what it was before — no second item — and 94 names the six palettes and
  the button.
- [ ] **6. The gate, the review, the recap** (8 min). *Done when:* `pnpm check` green, one
  cross-model review with every finding tagged, the recap holding the evidence.

## The human's points

**At step 4, the doors on the walks page.** Ten sign-in screens — credo's own door, an operator's
join link and its refusals, a person's sign-in and its refusal, a phone landing from a QR code —
redrawn under the app's coloured header, the card on the app's grey beneath, both languages, both
widths. The question is the mock's: do these doors read as the same app? A yes rewrites the bases;
a no becomes a row above, and only step 1 is redrawn. The three screens already inside the app's
frame are not asked again — case 9 holds them still, and above 0 moved pixels there stops the step.
