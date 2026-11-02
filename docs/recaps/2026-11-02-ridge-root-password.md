# The demo copies' root passwords, recap, 2026-11-02

## At a glance

[The plan](../plans/2026-11-02-ridge-root-password.md), steps 1 to 4, is done on `ridge-root-password`. The human lost the six demo copies' root passwords; `ops/root-password.sh ridge <code>…` now sets a new one on each named copy's root.

| The human does | The machine does |
| --- | --- |
| types one password twice, never shown | checks the rule and the codes before the box is opened |
| names the copies, from `main`'s checkout, in a terminal | reads the box's floor and `/health`, then per root: one write, a real sign-in, a sign-out |
| sends the password to its person by their own channel | ends every session of that root; searches the log for the password |

## What shipped

| What | Where |
| --- | --- |
| the password write, lifted from the staff route so there is one home for the write that mints a new generation | [`setSignInPassword`](../../bff/src/staff-records.ts#L69) |
| the command: `--check` with no connection, the reads before any write, the set-list of a stop | [`root-password.ts`](../../scripts/src/root-password.ts#L40), [`ridge.ts`](../../scripts/src/ridge.ts#L51) |
| the script: ridge alone, main, a terminal, the password on a pipe, `== refused` exit 2 until a write | [`root-password.sh`](../../ops/root-password.sh) |
| its guards and the runbook | [`ops/test.sh`](../../ops/test.sh#L1850), [`ops/README.md`](../../ops/README.md#L192) |

## What was rejected, and why

| Rejected | Why |
| --- | --- |
| the console's part D first | about 12 machine hours and not before 11-04; this door is ridge-only and adds no power its holder lacks |
| a password made and shown once | how these six were lost; a `secrets/` file leaves one on disk |
| `mask` for the password | it puts it on grep's argv and in a bash 3.2 here-string (a temp file); a pipe and `grep -f /dev/stdin` instead |

## The review's findings (Opus, on `d53d53b`)

| Finding | Tag |
| --- | --- |
| M1 (Medium): the end-of-run search put the password on grep's argv and in a here-string; an inherited exported `PASSWORD` would reach children's environments. Now `search_extra` (lib.sh's on_exit hook) on a pipe, `unset PASSWORD`, no `mask`; held by a grep stand-in's argument list, seen red first | [FIXED] |
| L2: the README said not to run during the seed at 06:00 | [FIXED] (03:17, up to about 3 hours late) |
| L3 the read-back's sign-out reply unchecked | [DEFERRED] item 46 |
| L4 a failure before the first write reported as possibly partial | [DEFERRED] item 47 |
| L5 a hung test run never killed | [DEFERRED] item 48 |
| I1 PASSWORD and SECRETS never unset | [DEFERRED] item 49 |
| I2 every ops run's keys through grep's argv and here-strings | [DEFERRED] item 50 |
| I3 "nothing to replace" wrong for a password | [DEFERRED] item 51 |
| I4 the guards step's 5 minutes | [DEFERRED] item 52 |
| I5 Ctrl-C at a prompt may leave echo off | [DEFERRED] item 53 |
| I6 xtrace would trace it | [DEFERRED] item 54 |
| I7 two test switches bypass two checks | [DEFERRED] item 55 |

## What remains the human's

After the push's deploy is green, and not during a seed run (from 03:17 in Vietnam, up to about 3 hours late): `bash ops/root-password.sh ridge vat-lieu-quang-tin-dat-3 phan-phoi-loc-vuong-hai-3`, then the yes to "did the `-3` root sign in with the password you typed?". The first time `read -s` meets a real terminal is that run.
