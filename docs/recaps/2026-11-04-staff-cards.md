# The person's page in the old app's cards, recap, 2026-11-04

## At a glance

[The plan](../plans/2026-11-04-staff-cards.md), steps 1 to 7 done on `staff-cards`: the person's page and the add page wear the old app's cards. Screens only; no route, no field, no wire change.

| | Before | After |
| --- | --- | --- |
| Person's page, PC | one column of bordered blocks | two columns of cards, 7 to 5, details first |
| Person's page, phone | one column | the same cards, one column |
| First card | the sign-in sentence in its own block | names what they sign in with: the code (the email too when allowed) |
| Add page | one column of fields | the same cards, one column; fields two a row from 768 |

## What shipped

- One shared frame, `ui/src/DetailCards.tsx`: `DetailColumns`, `DetailCard` and `FieldPair`, used by both pages and the six panels (`5b51454`). A later detail page takes it as is: fields in `DetailCard`s and `FieldPair`s, identity as `main`, actions and the danger zone as `side`.
- The gate green on a rerun; the first run failed three ui tests on the 5-second timeout at load 11 to 14 (`c53d55d`).
- 16 screens moved, 96 pictures committed, exactly the plan's (`8144bce`).

## Rejected and what remains the human's

- The legacy's actions first on a phone: here they are forms, not one-tap buttons. The sign-in name to the root alone: it stays shown to whoever sees the page.
- The review (Opus) found no High or Medium. Open items 89 and 90 are deferred Lows (an unused key; an empty side column), 91 the walks' button loaders, and 81 gains this run's lane numbers. Nothing is the human's to decide.

## Evidence

- The human's look, yes 11-04 16:2x, on "Take on staff: their records, sign-ins and import", screens 2 and 4.
- The full run, log `20261104-1732-staff-cards-full-run.log`: the first run red at 17:08 on one services picture (the services walk catching a button loader mid-fade, not this piece; fixed in `main` as `926c1b2`); the rerun green 17:32 to 17:48, 16m00s, run 2 every count 0.
