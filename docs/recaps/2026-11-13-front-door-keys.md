# The back end answers only the front door, and every key is replaceable by one script, recap, 2026-11-13

| | Before | Now |
| --- | --- | --- |
| A call to the back end's own address | answered for anyone | 403 without the front door's key |
| Replacing a key | none could be | `ops/keys.sh <env> front-door`, `internal`, `admin` or `service`, the old key read back refused |

## What happened

CloudFront adds a secret key to every call it passes on, and the back end's first hook refuses any call without it. The store gained a route that replaces a service's key. Each key run ends on the app's address answering through the door. Steps 1 to 6 are ticked.

The review found five Mediums and seven Lows; the fix pass fixed, parked or rejected each, and the reread found every fix holding and one runbook sentence, since reworded. Rejected: the stack run before the push, since it reads its template from `main`.

## Not yet run

Every check ran on this Mac; none has run on Linux (CI's Ubuntu). Nothing has run on ridge: CloudFront accepting the key-only change, the function taking two keys, the distribution's own wait, and the seconds a real replacement refuses calls.

## Still yours

- Ridge: your push (its deploy ends red once, at the door's key, before anything changes), the stack run adding `DistributionId`, the rerun, the check, then the key runs. <!-- FILL: do not write a result, a count, a time or a log name -->
- Your point: while a key is replaced its calls are refused for a few seconds, and replacing the back end's service key restarts every sign-in wait and voids open operator challenges. <!-- FILL: do not write a result, a count, a time or a log name -->
- Items 397 to 399 and 412 to 415. Step 7's prose, and items 121 and 134, come after.

## Evidence

- Commits `ac85857e`, `f2583090`, `9e20e3ba`, `1adaaed6`, `54d6f81d`, `4c87f87f`, `6b094ada`.
- `ops/test.sh` and the `scripts` gate (the citation test inside) ended at exit 0 on the final tree; the store's `make check` ended at exit 0 at step 4, no Go changed after.
- `docs/products.md`: no row changes; scripts are not rows.
