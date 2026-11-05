# The start date, birth date and address, recap, 2026-11-05

## At a glance

[The plan](../plans/2026-11-05-staff-fields.md), all seven steps done on `staff-fields`: a company that keeps them switches a start date, a birth date and an address on in the staff setup, and the root fills them on a person's page and on the add page. The two dates sit in one row, the address full width below, as the old app has them.

| | Before | After |
| --- | --- | --- |
| Staff setup | switches for the second phone, the photo | three more: start date, birth date, address |
| Person's page, add page | no such fields | the two dates in a row, the address below |

## What shipped, in order

- `af56d86` the plan; `ed30369` the build on the fake; `be31091` the gate's tick; `34c8279` the review's fix; `854f57c` the bases of 22 screens.
- The review (Opus) said "may merge as it stands" and still asked two changes, both made. The three reserved keys now bind a write only, so an older company whose own field is keyed `address` keeps its staff screens instead of losing them to a setup that will not parse. A person's own three values are spread after the company's own fields, so the person's win: the overwrite the reservation exists to stop.

## Rejected and what remains the human's

- Items 96 (the values checked in the browser only) and 97 (the day check's production path nearly unreachable) stay open, `[DEFERRED]`, both Low.
- Item 89 closes: `person.signIn` is gone from both dictionaries, no reader left.
- The human's look: yes on the person's page and the add page (`admin-staff/staff-4-person`, `staff-2-add`, 11-05 11:28, vi). The staff setup's own screen, `setup-2-fields`, was not answered; the merge was not held for it, and it stays on the walks page.

## Evidence

- The whole `pnpm check` green first try, last line `== exit 0`, every package at 100 % (`gate-20261105-1057.log`); again after the fix (`gate2-20261105-1114.log`).
- The human's full run green in 13m36s: run 1 wrote the bases for all 22 named screens, 122 of `piece-2`'s 198 pictures moved, 0 new, 0 unreadable; run 2 read every count 0. Why 122 and not 132: 17 screens at all six bases, plus the five list screens at 768 and 1280 only, the phone cards carrying no field of their own.
