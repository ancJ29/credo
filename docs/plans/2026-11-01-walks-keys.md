# The walks page: its keys, and a map of the day that folds

**Where it stands — 2026-11-01 13:19 +07:** built on `walks-keys` from `main`@`b170d07`, checked,
tried by the human ("perfect now") and reviewed (Opus); the review's fixes are in. The steps below
are ticked; the open list at the foot is the human's.

> **Drafted** 2026-11-01 by the machine, line 33. It amends
> [the walks page's plan](2026-10-29-walks-nav.md) ([keys and Tab](2026-10-29-walks-nav.md#moving),
> [the guide](2026-10-29-walks-nav.md#after-the-first-preview-the-guide-the-footer-the-frames)); that plan stays as
> it was at its commit ([QA](../conventions/qa.md) rule 4). Code: `visual/src/page.tsx`,
> `guide.tsx`, `choices.ts`, `page.css`.

## At a glance

| Before | After |
| --- | --- |
| J next, K previous | ← previous, → next; J and K do nothing |
| the guide opens on `?` and its buttons | H opens it too; Escape still closes it |
| Tab walks the page's buttons | Tab moves focus nowhere; the page is click-only |
| the map of the day is always open | it folds; open on a first visit, the fold remembered in this browser |

The page's keys are now ← → Y N L U H ? and Escape. A text field, clicked, still takes typing.
**The price, accepted by the human:** someone using only a keyboard cannot reach the buttons by Tab.

## The rules

- **← and → move, even from a radio.** A Language or Show radio keeps the focus after a click, and
  the browser would move the radio on an arrow; the page takes the key first and prevents that.
  *Rejected:* keeping J and K beside the arrows (the human: instead of).
- **Tab is prevented on the page itself**, in text fields too, and left alone with Ctrl, Cmd or
  Alt (the browser's tab switch) and while a dialog is open (its focus stays inside, a
  [modal](../../visual/src/modal.tsx)'s rule). *Rejected:* `tabindex="-1"` on every control: each new
  control would have to remember it. *Price:* a screen-reader or switch user cannot reach the
  buttons; they remain real buttons, clickable.
- **The map's fold is a `<details>`** like the rail's walks, its state in `localStorage` in a
  try/catch like the guide's first-visit mark ([`choices.ts`](../../visual/src/choices.ts)):
  without storage the map is open at every load.

## The case table

| # | 👤 | The case: one behaviour, one sentence | Held by |
| --- | --- | --- | --- |
| 1 | 👤 | H opens the guide, as the ? key and its buttons do, and Escape closes it | unit, `guide.test.tsx` |
| 2 | 👤 | ← and → move to the previous and next screen and J and K no longer move, also when a Language or Show radio has the focus after a click, which the arrow then leaves as it was | unit, `one-screen.test.tsx` |
| 3 | 👤 | Tab moves the focus nowhere on the page, while ←, →, Y, N, L, U, H and ? still act, and a clicked text field still takes typing | unit, `one-screen.test.tsx` |
| 4 | 👤 | The map of the day folds; it is open on a first visit and a fold is kept in this browser, so a reload finds it as it was | unit, `page.test.tsx` |
| 5 | | ← and → stop at the first and the last screen | unit, `one-screen.test.tsx` |
| 6 | | ← and → do nothing in a text box, in the paste box, or with Ctrl, Cmd or Alt | unit, `one-screen.test.tsx` |
| 7 | | Ctrl, Cmd or Alt with Tab is left to the browser, and Tab is left alone while a dialog is open | unit, `one-screen.test.tsx` |
| 8 | | With "Only unanswered" on, ← and → and Prev and Next keep to the screens with a language left | unit, `one-screen.test.tsx` |
| 9 | | While a dialog is open, ←, →, Y, N, L, U and H do nothing to the page behind | unit, `guide.test.tsx`, `bar.test.tsx` |
| 10 | | The keys line under the moves and the guide's keys list name H and ← · →, and no longer J · K | unit, `one-screen.test.tsx`, `guide.test.tsx` |
| 11 | | The fold is kept as a mark in the browser; with no storage the page works and the map is open at each load | unit, `choices.test.ts`, `page.test.tsx` |
| 12 | | The drawn screens take no pointer and are not `inert`, and the panel's Yes and No follow the line atop and come before them in the reading order | unit, `one-screen.test.tsx` |
| 13 | | A clicked radio (Yes and No, Language, Show) lets go of the focus, so ↑ and ↓ scroll the page and never flip an answer, the language or the width (added after the review, as Safari behaves) | unit, `one-screen.test.tsx` |
| 14 | | H, h and ? typed in a text box (the reason, the paste box, the label) open no guide | unit, `one-screen.test.tsx`, `panel.test.tsx` |

## What it replaces in the walks page's plan

| Walks-nav row | What changes | Now held by |
| --- | --- | --- |
| 2 | the keys J, K become ← and →; Y, N, L and U stand | rows 2 and 5 here |
| 9 | Tab reaching the drawn language's Yes and No: gone; the reading order and the pointer rule stay | rows 3 and 12 |
| 11 | a key does nothing in a text box or with a modifier: stands, with ← and → in place of J and K | row 6 |
| 18 | J and K in "Only unanswered" become ← and → | row 8 |
| 22 | the guide also opens on H; its keys list names H and ← · → | rows 1 and 10 |
| 28 | the keys that do nothing while a dialog is open are ← → Y N L U H | row 9 |

Every other row stands as written.

## Steps

- [x] **1. This plan**, with the four 👤 rows read as the human decided (`439520f`).
- [x] **2. The reds**, each at its own assertion, then the code (`ae3d408`): `20261101-1253-walks-keys-red-guide-h.log`,
  `…1254-walks-keys-red-arrows.log`, `…1255-walks-keys-red-arrows-radio.log` (the radio rule's line changed),
  `…1254-walks-keys-red-tab.log`, `…1254-walks-keys-red-fold.log`. After the review: `…1317-walks-keys-red-h-in-text.log`
  (the H check moved above `isTyping`) and `…1317-walks-keys-red-blur.log`.
- [x] **3. The whole check** at `ae3d408`: `20261101-1255-walks-keys-check.log`, `== exit 0`, every package at 100 %.
- [x] **4. The report build**: `walks/2026-11-01-130155-ae3d4083b`, log `20261101-1301-walks-keys-report.log`.
- [x] **5. The human's look** at that page, between 13:02 and 13:16: "perfect now".
- [x] **6. The review** (Opus, `20261101-1316-walks-keys-review.md`): findings 1 and 3 to 6 fixed (rows 13 and 14,
  the three comments, row 10, this section); 2, 7, 8 and 9 in the open list.
- [ ] **7. The whole check and the report build again** after the fixes (logs in the recap of the session).

## Open

- Review finding 2: screen `5-language-menu`'s open menu may take the focus into the drawn frame, so the keys
  would go quiet from that screen until a click. Not changed here (the app's own menu is `ui/src/Shell.tsx`'s,
  not this line's); the human checks it on the next build.
- Review finding 7: jsdom moves no radio on an arrow, so `radio.checked` assertions in the arrows test cannot go
  red; the `defaultPrevented` assertions hold the rule.
- Review finding 8: the Tab test presses ← and U without asserting them and never presses N or ?; the first
  "moving" test and the guide tests hold those.
- Review finding 9: the map's `<h2>` sits inside a `<summary>`; some screen readers may drop it from a heading
  list. It fits the click-only price accepted.
