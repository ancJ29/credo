# The staff list as the old app's, recap, 2026-11-04

## At a glance

[The plan](../plans/2026-11-04-staff-list.md), steps 1 to 6 done on `staff-list`: the staff list shows who is active, and reads on a phone. Screens only; no route, no field, no wire change.

| | Before | After |
| --- | --- | --- |
| Each person | no status mark | a chip, Active or Inactive |
| People who left | a "Show people who left" box | a Status choice: Active (the default), Inactive, All |
| Phone | a table scrolling sideways | one card a person: name, code, department, position, phone, chip |
| PC | the table | the table with a Status column; the five filters on one line at 1280 |

## What shipped

- The chip, the Status choice (an old `left=1` link reads as All) and the phone cards, changed in place on `StaffListPage` and `staffFilter` (`122161e`).
- The gate green on a rerun; the first run red on two 5-second ui timeouts at load 47 (`b1e14ad`).
- 5 screens moved, 30 pictures committed, exactly the plan's (`97bde05`).

## Rejected and what remains the human's

- The two looks' noes were both the PC filters: the first, a crowded filter row (fixed to one line from 768, `8899a08`); the second, the licence select wrapping and the selects unnamed (all five on one line at 1280, each "all" naming its filter, `b976465`).
- The review (Opus) found no High or Medium, three Lows fixed (`a7fd011`, `3bb5813`) and one Info. Open items 92 (the card's avatar condition untested) and 93 (at 992 the last select wraps) are deferred. Nothing is the human's to decide.

## Evidence

- The human's looks: phone yes, PC no (16:0x), no (16:28), then yes 19:1x.
- The full run 19:19 to 19:35, 16m42s: green, its raw counts naming only the five screens.
