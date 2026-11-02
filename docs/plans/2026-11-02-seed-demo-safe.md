# The seed made safe for the demo: room in its limits, a closed day passed, a start off the demo hour

**Where it stands — 2026-11-02 10:53 +07:** steps 1 to 3 built and read back; step 4: the whole `pnpm check` read exit 0, at the commit below; ready for review. (a) was chosen for the closed day.

> **Drafted** 2026-11-02 by the machine, on the human's yes of 10:4x +07 (Decide 53 amended), from
> `.github/workflows/seed.yml`, `scripts/src/demo/apply.ts`, `bff/src/orders.ts` and
> [the demo seed's plan](2026-10-29-demo-seed.md) at `5eda430`.

## At a glance

| Before the demo (Wednesday 11-04) | What changes |
| --- | --- |
| A full run took 9 m 17 s against a 10 m step | the step gets 15 m, the job 25 m |
| A person who closes a driver's day (đối soát) makes the next seed run go red on that copy | the seed sends nothing to a driver whose day is closed, and goes on green |
| GitHub starts the 06:00 run about 3 hours late, so it lands near 09:00 in the demo | the run is set for 03:17 Vietnam time (`17 20 * * *` UTC), done well before 07:00 |

"Today" is already Vietnam's date (`vietnamToday`, `scripts/src/demo/days.ts`): a run at 20:17 UTC on 11-03
reads 11-04 and fills through 11-03. Nothing to fix there; a test now holds it.

## The cases

| # | 👤 | The case | Held by |
| --- | --- | --- | --- |
| 1 | 👤 | A closed driver's day gets nothing more from the seed, and the run goes on green | `apply.test.ts`, the closed-day test |
| 2 | | Where no day was closed the copy is what it was: the same driver draw, no extra draft | `apply.test.ts`, the existing orders tests unchanged |
| 3 | | The seed's date is Vietnam's: 20:17 UTC reads the next day | `demo.test.ts` |
| 4 | 👤 | The seed's run ends before 07:00 +07 on a normal day (start 03:17, a caught-up day ~8 m, a nine-day catch-up ~9 m) | `ops/test.sh`, the schedule guard |
| 5 | 👤 | The step has room for a normal day (15 m for ~8 to 10 m; the job 25 m) | `ops/test.sh`, the timeout guards |
| 6 | | The role's session (1200 s) covers the steps that need it | read, step 1 |

## The two ways for a closed day

(a) leave a closed driver out of the drivers an order may go to, from one read of the day's closed
days; (b) read the BFF's 400 as "already changed" and leave the order a draft. (a) is chosen: the
copy stays as it was where nothing was closed, no order is left a draft while another driver can
take it, and the price is one extra read a day sent for (the same list `dayCloses` reads). (b) costs
no call but leaves a draft the demo would show, and it also swallows a 400 for any other cause.

## Steps

- [x] **1. The limits and the start.** `seed.yml`: step 10 to 15 m, job 20 to 25 m, cron `17 20 * * *`, the
  comment's time; `ops/test.sh`'s guards follow. Done when: actionlint (if installed) and `bash ops/test.sh`'s
  seed section read green, and the role session's reach is said. Read: `actionlint` exit 0; `bash ops/test.sh` all checks passed, its three new refusals ok. The role is taken after the install and its 1200 s outlast the 15 m Seed step, so 25 m on the job needs no more.
- [x] **2. The closed day.** Red first (the run throws a 400 on a closed driver's day), then `dayOrders` skips
  closed drivers. Done when: the new test is seen failing from its own assertion, then green, scripts at 100 %. Read: failed once with the BFF's 400 on the confirm, green after `dayOrders` leaves a closed driver out.
- [x] **3. Today.** A test at 20:17 UTC. Done when green. Read: green.
- [x] **4. The gate, the commit, the stop.** Whole `pnpm check` exit 0, then stop for review. Read: exit 0, scripts at 100 %.
