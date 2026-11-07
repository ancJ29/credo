# Editing a customer on its page, recap, 2026-11-07

## What the office can now do

Open a customer from the list and correct its name, phone, address or note there, not in the old app. Whoever may edit orders sees Save. If someone else saved first, the page says so and keeps what was typed.

This is the first write anywhere in the new app, so the product and order pages copy its shape: read with a version, saved over it, a 409 carrying the record as it now is.

## The four screens, approved

Yes on all four: 10 (with a note, now in boxes), 11 (no note), 14 (a save that landed), 15 (someone else saved first); and yes on who may edit.

## Decided, and why

- **The code is not editable:** re-coding re-runs the list's uniqueness rule, its own route for a person.
- **The page came before the route,** so the look cost no server work.
- **A conflict is a 409 carrying the record as it now is, what was typed kept.** A write that landed with its answer lost is recovered by one re-read.

## Worth carrying forward

The review (may merge) found the recovery holds because the compare is over the **whole parsed record**, not the fields the body sent. That assumes a customer's code and id never change; a comment at the compare (`bff/src/lists.ts`) says when it stops holding. Three Lows are items 118 to 120.

## Still the human's

The picture run: screens 14 and 15 on the stack lane have never run anywhere. <!-- FILL: the run's verdict and log name -->

## Evidence

- Commits `613073c3` (plan), `3e32c71c` (page), `7e3c941c` (routes, rows 1 to 5 each red once).
- Whole check on the merge result, `== exit 0`: `20261107-1035-edit-customer-step5-check-3.log`; `bff` gate after the comment, five steps green: `20261107-1052-edit-customer-finish-bff-gate.log`.
- `docs/products.md`: the Customers and Products row now names the editing.
