# Part B2 of the operator console: a new link for a lost passkey, and the delete, recap, 2026-11-03

## At a glance

[The plan](../plans/2026-11-03-console-operators-b2.md), steps 1 to 7 are done on `console-operators-b2`. An operator
who lost every passkey gets a new join link from a colleague: **New link** on their row, a touch, the link shown once.
An operator also deletes a colleague: a page says what goes, one touch, and they are gone, signed out at their next
step. Never oneself. B2 ends B and closes open items 65 to 68. Cost: $0 a month. Left to the human: the push.

## What shipped

- Two routes in `bff/src/routes/operator-team.ts`: a link (201, once) and a delete (204), each behind its own touch.
- A new link removes nothing when made; the old passkeys go at its use, so a link never opened locks no one out.
- The delete removes the links first, then the roster line, then the account; the review's Medium was that order
  (`4131696`).
- The walk `operator-team` gains `tm-4-link` and `tm-5-delete`; `tm-1-list` is asked again.

## Rejected, and the price

- A delete typed with the colleague's name: the page and a touch already stop a stolen session. Cost: none.
- Ending the deleted one's sessions: the roster check refuses them already. Cost: their records stay, as every ended
  one's do.
- Not fixed in B2, three Lows from the review plus two from its reread: items 70 to 73 below.

## Evidence

- The plan `bfac8ec`; the page on the fake `c188bc2`; the routes `44db639`.
- The gate `888b22f`: green on a rerun after item 56's flake (`logs/20261103-1625-b2-step4-gate.log` `== exit 1`,
  `logs/20261103-1630-b2-step4-gate.log` `== exit 0`).
- The review's Medium fixed `4131696`: three of four red, then green; tags `092ca8d`.
- The look, 👤 1: yes at 16:16 +07 on all six screens of "Who else may sign in here".
- The full run, 17:04 to 17:16 +07: run 1 wrote the bases (`tm-1-list` 6 moved, `tm-4-link` and `tm-5-delete` 12 new),
  run 2 read every count 0. A first run was red on the walk spec's lookups (`walk/specs/operator-team.spec.ts#L77`,
  fixed `ec0d1cf`), not the app. The bases `6529c3c`; logs `20261103-1644-walk-operator-passkeys-team.log`,
  `20261103-1704-walk-operator-passkeys-team.log`, `20261103-1710-walk-operator-passkeys-team.log`, read whole: no
  warning, no secret pattern.

## What remains the human's

- **The push,** when the human calls for it.
- **Hazards, open items 70 to 73,** all Low:
  - **70:** a link made by the deleted one after the sweep passed a colleague's account survives the 204, and the
    comment at `bff/src/records/operators.ts#L165-L166` claims more.
  - **71, 72:** a link's kind from a roster read that can be stale; `--replace` refuses names with a space or accent.
  - **73:** a delete refused at its roster write has already removed the links of an operator who stays listed
    (`bff/src/records/operators.ts#L178-L191`); a new link recovers each.

## Next

C and D are in `main`; B is done. The next line is the human's.
