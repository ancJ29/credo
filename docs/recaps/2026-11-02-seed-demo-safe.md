# The seed made safe for the demo, recap, 2026-11-02

## At a glance

[The plan](../plans/2026-11-02-seed-demo-safe.md), steps 1 to 4, is done on `seed-demo-safe` (`b1ba7aa`) and reviewed by another model (Opus, no High or Medium). Three changes, so that the demo copies are right on Wednesday 11-04:

| Before | Now |
| --- | --- |
| a full run took 9 m 17 s against a 10 m step | the Seed step has 15 minutes, the job 25 |
| a person closing a driver's day (đối soát) made the next run go red on that copy | the seed sends nothing to a driver whose day is closed, the order goes to another driver and the run goes on green |
| the run was set for 06:00 +07 and GitHub started it about 3 hours late, near 09:00, in the demo | it is set for 03:17 +07 (`17 20 * * *` UTC), so even 3 hours late it starts about 06:17 and ends about 06:30 |

## What shipped

| What | Where |
| --- | --- |
| the limits and the cron, its comment and the runbook's word | [`seed.yml`](../../.github/workflows/seed.yml#L13), [`ops/README.md`](../../ops/README.md#L192) |
| a closed driver's day left out of the drivers an order may go to, from one read of the day's closed days per send-for day, named in the log | [`closedFor`](../../scripts/src/demo/apply.ts#L350) |
| the guards: cron, job 25, step 15, each with a refusal | [`ops/test.sh`](../../ops/test.sh#L744) |
| the test of the closed day, seen red on the BFF's 400 first; the test that 20:17 UTC on 11-03 reads 11-04 (the seed already read Vietnam's date) | [`apply.test.ts`](../../scripts/src/demo/apply.test.ts#L928), [`demo.test.ts`](../../scripts/src/demo/demo.test.ts#L64) |

The whole `pnpm check` read exit 0, scripts at 100 %; `bash ops/test.sh` all checks passed; `actionlint` exit 0. The role's 1200 s covers the 15-minute Seed step, since the role is taken after the installs.

## What was rejected, and why

| Rejected | Why |
| --- | --- |
| (b) read the BFF's 400 as "already changed" and leave the order a draft | no extra call, but an extra draft the demo would show while another driver could take the order, and it swallows a 400 from any other cause. (a) keeps copies unchanged where nothing was closed, at the price of one read a day |

## The review's findings (Opus, on `b1ba7aa`)

None High or Medium. `[DEFERRED]`: the closed-day read after the order's save, and the test's same-day case (items [42](../open-items.md), [43](../open-items.md)); stale morning wording (item [44](../open-items.md)); five Info points (item [45](../open-items.md)).

## What remains the human's

- **The one push.** The schedule changes only once `main` holds this on GitHub and ridge's `/health` names it; the first run after that starts at 03:17 +07 (up to about 3 hours late). Read that run's lines on the morning of 11-04.
- **Hazard no gate catches:** a close made between the seed's read and its confirm still answers 400 and the run goes red; at 03:17 this is not expected.
