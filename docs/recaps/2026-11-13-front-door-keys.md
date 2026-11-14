# The back end answers only the front door, and every key is replaceable by one script, recap, 2026-11-13

| | Before | Now |
| --- | --- | --- |
| A call to the back end's own address | answered for anyone | 403 without the front door's key |
| Replacing a key | none could be | `ops/keys.sh <env> front-door`, `internal`, `admin` or `service`, the old key read back refused |

## What happened

CloudFront adds a secret key to every call it passes on, and the back end's first hook refuses any call without it. The store gained a route that replaces a service's key. Steps 1 to 7 are ticked.

The review found five Mediums and seven Lows; the fix pass fixed, parked or rejected each, and the reread found every fix holding.

## On ridge and on Linux

Ridge's check ended green before the keys and after them (37 requests each time). The first front-door run stopped safe: the stack run refused its change set, which the guard fix (`07c104af`) now admits. The second ended green, the old key refused with 403. Calls were refused about 4 seconds for the internal key and about 6 for the service key, whose run also restarted every sign-in wait and voided open challenges. The admin key ran green and the operator was replaced.

On Linux (CI's Ubuntu) the audit, ops, check and e2e jobs passed, but the app job was cancelled in `pnpm check` at about 25 minutes, its limit (`.github/workflows/ci.yml#L139`), and the deploy was skipped: no deploy of this landing has run.

## Still yours

- The deploy: a rerun of GitHub's run. <!-- FILL: the rerun's verdict -->
- Your point, answered 2026-11-13 14:52: yes, those refused seconds and the service key's sign-in effects are acceptable once real clients use it; the runbook says so.
- Items 397 to 399, 412 to 414 and 417 to 419. Step 7 closed items 121, 134 and 415; the conventions page's citations go to `main` by its route.

## Evidence

- Commits `ac85857e`, `f2583090`, `9e20e3ba`, `1adaaed6`, `54d6f81d`, `4c87f87f`, `6b094ada`, `07c104af`.
- `ops/test.sh` and the `scripts` gate (the citation test inside) ended at exit 0 on the final tree; the store's `make check` ended at exit 0 at step 4, no Go changed after.
- `docs/products.md`: no row changes; scripts are not rows.
