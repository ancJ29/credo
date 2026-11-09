# The nightly seed of ridge, recap, 2026-11-08

## What happened

Ridge is the environment everyone checks their work against, and a nightly job refreshed its demo data. GitHub's 15-minute limit killed that job every night it ran long, and **nothing in any workflow told anyone** (item 151).

A diagnosis read the failed log whole, for the first time by anyone, and found **it was never stuck**: a constant write rate, three nights of backlog in a window sized for one, and idempotent work whose ledger advances per completed day. A killed run still made progress and merely always reported failure.

## What was done

A fix gave the run room, bounded a backlog night so it ends green saying what is left, and added a job to open an issue on failure. The human then decided the seed should **leave GitHub Actions' schedule entirely**, which answered the permission question by deleting it. The schedule and the notifier went; the manual run stayed, so ridge can still be seeded without anyone holding long-lived keys. **Item 151 is closed by removal, not by fix: the timeout was not solved, the job that hit it was taken away.**

Two defects were then found in the work itself. A catch-up run **outlived its own credentials** (the role lasts twenty minutes, the step was allowed thirty, the bound was sized at twenty-two); a run is now two days inside an 18-minute step, and `ops/test.sh` checks the relations between those numbers. And a refusal for copies far behind was a **dead end nobody could clear**; it was removed rather than softened.

## Limits, and the cost

- **Ridge's data now refreshes only when somebody asks.**
- **A run asked once a week can never keep up:** each run takes off two days while seven go by, so the gap grows five days a week (a week's gap is about four runs back to back, a month's about fifteen). Someone will have to decide how fresh ridge needs to be.
- A first fill of a fresh copy is unmeasured; it may exceed the step's limit, end in a clean timeout and repeat from its start.
- That GitHub accepts the changed workflow, and that two days fit the real hardware, rest on reading the code; only a real run settles them.

## Items

- **44** (time wording from the old 06:00 run): the schedule wording is moot, and the "about a minute" line is fixed.
- **45** (closed-day small things): rewritten from the code, since a collision with a driver's close is now likelier.
- **151**: closed by removal, above.
- **156** (Low, filed here): the 7.5 minutes a day all the sizing rests on is written where no check can read it.

Nothing here waits on the human.

## Evidence

- Review (another model): may merge after repairs; all seven findings fixed in `ecd2d1b3`.
- Merge of `main`: `2d455149`. Gate on it: `20261108-1434-seed-timeout-merge-gate.log`, last line `== exit 0` (scripts typecheck and tests, eslint, prettier, knip and the ops suite each 0).
